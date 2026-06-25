const mongo = require('../../utilities/mongodb');

// Thresholds for unique-word-collection `special` milestones (id -> count).
const UNIQUE_WORD_THRESHOLDS = {
  word_collect_50: 50,
  word_collect_200: 200,
  word_collect_500: 500,
  word_collect_1000: 1000,
  word_encyclopedia: 2500,
};

// Thresholds for word-length-usage `special` milestones.
// `length: '7+'` aggregates every word of 7 or more letters.
const WORD_LENGTH_THRESHOLDS = {
  word_explorer_3: { length: 3, count: 50 },
  word_explorer_4: { length: 4, count: 50 },
  word_explorer_5: { length: 5, count: 50 },
  word_artisan: { length: 6, count: 30 },
  word_masterclass: { length: '7+', count: 20 },
};

// Meta milestones: unlock once every milestone of a given rarity is collected.
// Evaluated in a second pass (see checkAndUnlockMilestones) against the
// fully-updated unlocked set, so they fire only after their lower-tier peers.
const META_SPECIALS = new Set(['letterforge_master', 'letterforge_legend', 'letterforge_god']);
const META_RARITY = {
  letterforge_master: 'common',
  letterforge_legend: 'rare',
  letterforge_god: 'epic',
};

// `special` milestones whose criteria require data not currently collected
// (per-game timing, chain-break info, invalid-attempt counts, time-of-day,
// day-streaks, time-windowed scores, social shares, seasonal windows).
// They are inert today; logged once per process so the gap is visible.
const DEFERRED_SPECIALS = new Set([
  'chain_perfectionist', 'chain_speed_run', 'speed_demon_100', 'max_rush',
  'no_miss_gamer', 'marathon_mode',
  'daily_100', 'daily_500', 'weekly_1000', 'weekly_5000', 'monthly_15000',
  'streak_warrior', 'perfect_month', 'first_week', 'first_month',
  'early_bird', 'night_owl', 'weekend_warrior',
  'social_butterfly', 'community_sharer', 'influencer', 'viral_star', 'content_king',
  'spring_champion', 'summer_surfer', 'autumn_archer', 'winter_warrior', 'season_champion',
]);
const warnedDeferred = new Set();

class MilestoneService {
  constructor(client) {
    this.client = client;
    this.collection = 'milestones';
    this.userCollection = 'users';
  }

  /**
   * Get all milestones from collection
   */
  async initializeMilestones() {
    return this.getAllMilestones();
  }

  /**
   * Get all milestones
   */
  async getAllMilestones() {
    return mongo.find(this.client, this.collection, {});
  }

  /**
   * Get milestone by ID
   */
  async getMilestoneById(milestoneId) {
    return mongo.findOne(this.client, this.collection, { id: milestoneId });
  }

  /**
   * Get user milestones (completed milestones)
   */
  async getUserMilestones(userId) {
    const user = await mongo.findOne(
      this.client,
      this.userCollection,
      { _id: mongo.getObjectId(userId) }
    );

    if (!user || !user.milestones || !Array.isArray(user.milestones)) {
      return [];
    }

    const milestoneObjectIds = user.milestones.map(m => mongo.getObjectId(m));
    const milestones = await mongo.find(this.client, this.collection, {
      _id: { $in: milestoneObjectIds }
    });

    return milestones;
  }

  /**
   * Check and unlock milestones for a user based on their stats
   *
   * Two-pass: ordinary `special` milestones are evaluated first from `stats`,
   * then meta milestones (`letterforge_*`) are checked against the fully-
   * updated unlocked set so they correctly fire only after all lower-tier
   * milestones of a rarity have been collected.
   */
  async checkAndUnlockMilestones(userId, stats) {
    const allMilestones = await this.getAllMilestones();
    const user = await mongo.findOne(
      this.client,
      this.userCollection,
      { _id: mongo.getObjectId(userId) }
    );

    const existingMilestoneIds = user?.milestones || [];
    const unlockedIds = new Set(
      existingMilestoneIds.map(id => (typeof id === 'string' ? id : String(id)))
    );
    const newlyUnlocked = [];

    // Pass 1: every milestone except the rarity-meta specials.
    for (const milestone of allMilestones) {
      const idStr = milestone._id.toString();
      if (unlockedIds.has(idStr)) {
        continue;
      }

      const isMeta = META_SPECIALS.has(milestone.id);
      if (isMeta) {
        continue;
      }

      if (this.checkMilestone(milestone, stats, { unlockedIds })) {
        newlyUnlocked.push(idStr);
        unlockedIds.add(idStr);
      }
    }

    // Pass 2: meta specials (letterforge_master/legend/god) — evaluated
    // against the unlocked set that now includes pass-1 results.
    for (const milestone of allMilestones) {
      const idStr = milestone._id.toString();
      if (unlockedIds.has(idStr) || !META_SPECIALS.has(milestone.id)) {
        continue;
      }
      if (this.checkMilestone(milestone, stats, { unlockedIds, allMilestones })) {
        newlyUnlocked.push(idStr);
        unlockedIds.add(idStr);
      }
    }

    if (newlyUnlocked.length > 0) {
      const updatedMilestones = [...existingMilestoneIds, ...newlyUnlocked];
      await mongo.findOneAndUpdate(
        this.client,
        this.userCollection,
        { _id: mongo.getObjectId(userId) },
        { milestones: updatedMilestones }
      );
    }

    return newlyUnlocked;
  }

  /**
   * Check if a milestone is achieved based on stats.
   *
   * `ctx` carries `unlockedIds` (and `allMilestones` for meta checks) so
   * meta specials can be resolved. Pure function over `stats` + `ctx` —
   * no DB access — which keeps it unit-testable.
   */
  checkMilestone(milestone, stats, ctx = {}) {
    const { checkType } = milestone;

    if (checkType === 'special') {
      return this.checkSpecialMilestone(milestone.id, stats, ctx);
    }

    const { threshold } = milestone;
    if (threshold === null) {
      return false;
    }

    const value = stats[checkType];
    return value !== undefined && value >= threshold;
  }

  checkSpecialMilestone(id, stats, ctx) {
    const { normalGames = 0, timedGames = 0, survivalGames = 0, chainGames = 0 } = stats;

    // --- Cross-mode play-count milestones ---
    switch (id) {
      case 'versatile':
        return normalGames >= 5 && timedGames >= 5 && survivalGames >= 5 && chainGames >= 5;
      case 'balanced_warrior':
        return normalGames >= 10 && timedGames >= 10;
      case 'dual_master':
        return normalGames >= 25 && timedGames >= 25 && survivalGames >= 25 && chainGames >= 25;
      case 'triple_play':
        return normalGames >= 50 && timedGames >= 50 && survivalGames >= 50 && chainGames >= 50;
      case 'all_modes_played':
        return normalGames >= 1 && timedGames >= 1 && survivalGames >= 1 && chainGames >= 1;
      case 'mode_dabbler':
        return normalGames >= 5 && timedGames >= 5 && survivalGames >= 5 && chainGames >= 5;
      case 'mode_specialist':
        return normalGames >= 20 && timedGames >= 20 && survivalGames >= 20 && chainGames >= 20;
      case 'mode_omniscient':
        return normalGames >= 50 && timedGames >= 50 && survivalGames >= 50 && chainGames >= 50;
      case 'survival_only_master':
        return survivalGames >= 50 && normalGames < 10 && timedGames < 10 && chainGames < 10;
      case 'points_perfect':
        return stats.avgPointsPerWord >= 30;
      default:
        break;
    }

    // --- Per-game score milestones (single highest game) ---
    if (id === 'jackpot_winner') {
      return stats.maxScorePerGame >= 500;
    }
    if (id === 'survival_high_score') {
      return stats.survivalMaxScore >= 500;
    }

    // --- Consistency milestones (aggregate over completed games) ---
    if (id === 'consistency_king') {
      return stats.totalGames >= 2 && stats.gamesAbove200 >= stats.totalGames / 2;
    }

    // --- Unique-word-collection milestones ---
    if (UNIQUE_WORD_THRESHOLDS[id] !== undefined) {
      return stats.uniqueWordsCount >= UNIQUE_WORD_THRESHOLDS[id];
    }

    // --- Word-length-usage milestones ---
    const wlThreshold = WORD_LENGTH_THRESHOLDS[id];
    if (wlThreshold) {
      const observed = stats.wordLengthCounts?.[wlThreshold.length] || 0;
      return observed >= wlThreshold.count;
    }

    // --- Meta milestones: all milestones of a given rarity unlocked ---
    if (META_SPECIALS.has(id)) {
      return this.checkMetaMilestone(id, ctx);
    }

    // --- Deferred: criteria require data not yet collected ---
    if (DEFERRED_SPECIALS.has(id)) {
      this.warnDeferred(id);
      return false;
    }

    return false;
  }

  /**
   * `letterforge_master/legend/god` — unlocked once every milestone of the
   * matching rarity has been collected (excluding these meta specials
   * themselves, which are legendary).
   */
  checkMetaMilestone(id, ctx) {
    const { unlockedIds = new Set(), allMilestones = [] } = ctx;
    const targetRarity = META_RARITY[id];
    if (!targetRarity) {
      return false;
    }

    // Guard against vacuous truth: if the catalog is empty (or has no
    // milestones of the target rarity), we cannot confirm the meta condition
    // and must not unlock it.
    let matched = 0;
    for (const m of allMilestones) {
      if (m.rarity !== targetRarity || META_SPECIALS.has(m.id)) {
        continue;
      }
      matched++;
      if (!unlockedIds.has(m._id.toString())) {
        return false;
      }
    }
    return matched > 0;
  }

  warnDeferred(id) {
    if (warnedDeferred.has(id)) {
      return;
    }
    warnedDeferred.add(id);
    console.warn(
      `[milestones] "${id}" is deferred: requires data not currently tracked ` +
      `(timing, streaks, time-of-day, social, or seasonal). See modules/milestones/service.js.`
    );
  }
}

module.exports = MilestoneService;