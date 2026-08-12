const mongo = require('../../utilities/mongodb');
const { HttpError } = require('../../utilities/http-error');

// Titles unlocked by reaching a level. Higher levels supersede lower ones.
const TITLE_MILESTONES = [
    { level: 1, title: 'Word Initiate' },
    { level: 5, title: 'Wordsmith' },
    { level: 10, title: 'Word Artisan' },
    { level: 15, title: 'Lexicon Adept' },
    { level: 20, title: 'Forge Master' },
    { level: 30, title: 'Linguistic Champion' },
    { level: 40, title: 'Word Legend' },
    { level: 50, title: 'Eternal Forger' },
];

// XP earned for completing a game is scaled by mode difficulty so
// challenge modes reward proportionally.
const MODE_XP_MULTIPLIER = {
    normal_mode: 1,
    time_attack: 1.5,
    survival_mode: 2,
    chain_mode: 1.5,
    fade_mode: 1.5,
    daily_challenge: 1.25,
};

const POWER_UP_TYPES = ['hint'];

/**
 * XP awarded for completing a game of `mode` with `score`.
 * Base is `5 + floor(score / 25)`; minimum 5 XP per game.
 */
function xpForGame(score, mode) {
    const base = 5 + Math.floor(score / 25);
    const multiplier = MODE_XP_MULTIPLIER[mode] || 1;
    return Math.max(5, Math.round(base * multiplier));
}

/**
 * Derive level from total XP using a growing cost curve:
 * level 1->2 costs 100, then +50 per further level.
 */
function levelInfo(xp) {
    let level = 1;
    let currentXp = xp;
    let need = 100;

    while (currentXp >= need) {
        currentXp -= need;
        level += 1;
        need = 100 + (level - 1) * 50;
    }

    return { xp, level, currentXp, xpToNext: need };
}

function titlesForLevel(level) {
    return TITLE_MILESTONES.filter((t) => level >= t.level).map((t) => t.title);
}

class ProgressionService {
    constructor(client) {
        this.client = client;
        this.collection = 'users';
    }

    async _getUser(userId) {
        const objectId = mongo.getObjectId(userId);
        if (!objectId) throw new HttpError(400, 'Invalid user ID');

        const user = await mongo.findOne(this.client, this.collection, { _id: objectId });
        if (!user) throw new HttpError(404, 'User not found');
        return user;
    }

    /**
     * Award XP for a completed game and grant a hint power-up per level gained.
     * Idempotent per caller: `completeGame` guards against double completion.
     */
    async awardGameXp(userId, { mode, score }) {
        const user = await this._getUser(userId);
        const xp = xpForGame(score || 0, mode);

        const before = levelInfo(user.xp || 0);
        const after = levelInfo((user.xp || 0) + xp);
        const levelsGained = after.level - before.level;

        const powerUps = {
            hint: (user.powerUps?.hint || 0) + levelsGained,
        };

        await mongo.updateOne(
            this.client,
            this.collection,
            { _id: user._id },
            { $inc: { xp }, $set: { powerUps, updatedAt: new Date() } }
        );

        return {
            xpAwarded: xp,
            level: after.level,
            leveledUp: levelsGained > 0,
            levelsGained,
            hintsGranted: levelsGained,
        };
    }

    /**
     * Full progression snapshot for a user.
     */
    async getProgression(userId) {
        const user = await this._getUser(userId);
        const xp = user.xp || 0;
        const info = levelInfo(xp);
        const titles = titlesForLevel(info.level);

        return {
            xp,
            level: info.level,
            currentXp: info.currentXp,
            xpToNext: info.xpToNext,
            titles,
            currentTitle: titles.length > 0 ? titles[titles.length - 1] : null,
            powerUps: user.powerUps || { hint: 0 },
        };
    }

    /**
     * Consume a power-up. Returns the remaining count for the type.
     */
    async usePowerUp(userId, type) {
        if (!POWER_UP_TYPES.includes(type)) {
            throw new HttpError(400, `Unknown power-up type '${type}'`);
        }

        const user = await this._getUser(userId);
        const powerUps = user.powerUps || { hint: 0 };
        const current = powerUps[type] || 0;

        if (current <= 0) {
            throw new HttpError(400, `No '${type}' power-ups available`);
        }

        const updated = { ...powerUps, [type]: current - 1 };
        await mongo.updateOne(
            this.client,
            this.collection,
            { _id: user._id },
            { $set: { powerUps: updated, updatedAt: new Date() } }
        );

        return { type, remaining: updated[type] };
    }
}

module.exports = ProgressionService;
module.exports.xpForGame = xpForGame;
module.exports.levelInfo = levelInfo;
module.exports.titlesForLevel = titlesForLevel;
module.exports.TITLE_MILESTONES = TITLE_MILESTONES;
