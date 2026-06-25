const { expect } = require('chai');

const MilestoneService = require('../modules/milestones/service');

// Pure-function unit tests for MilestoneService.checkMilestone / checkSpecialMilestone.
// checkMilestone has no DB access, so we instantiate with a null client and
// exercise every `special` handler plus the simple threshold path.
describe('Milestones - checkMilestone (pure)', () => {
    let svc;

    before(() => {
        svc = new MilestoneService(null);
    });

    const mk = (overrides = {}) => ({
        _id: { toString: () => overrides._id || 'm-1' },
        id: overrides.id,
        checkType: overrides.checkType || 'special',
        threshold: overrides.threshold ?? null,
        rarity: overrides.rarity,
        ...overrides,
    });

    // ---------- simple threshold path ----------
    describe('simple threshold milestones', () => {
        it('passes when stats[checkType] >= threshold', () => {
            expect(svc.checkMilestone(mk({ id: 'first_forge', checkType: 'totalGames', threshold: 1 }), { totalGames: 1 })).to.be.true;
        });

        it('fails when below threshold', () => {
            expect(svc.checkMilestone(mk({ id: 'first_forge', checkType: 'totalGames', threshold: 1 }), { totalGames: 0 })).to.be.false;
        });

        it('fails when stats[checkType] is undefined', () => {
            expect(svc.checkMilestone(mk({ id: 'first_forge', checkType: 'totalGames', threshold: 1 }), {})).to.be.false;
        });

        it('treats threshold: null as unattainable', () => {
            expect(svc.checkMilestone(mk({ id: 'unused', checkType: 'totalGames', threshold: null }), { totalGames: 999 })).to.be.false;
        });
    });

    // ---------- existing cross-mode specials ----------
    describe('cross-mode specials (existing handlers)', () => {
        it('versatile requires 5 games in every mode', () => {
            const pass = { normalGames: 5, timedGames: 5, survivalGames: 5, chainGames: 5 };
            const fail = { normalGames: 5, timedGames: 5, survivalGames: 5, chainGames: 4 };
            expect(svc.checkMilestone(mk({ id: 'versatile' }), pass)).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'versatile' }), fail)).to.be.false;
        });

        it('points_perfect uses stats.avgPointsPerWord', () => {
            expect(svc.checkMilestone(mk({ id: 'points_perfect' }), { avgPointsPerWord: 30 })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'points_perfect' }), { avgPointsPerWord: 29 })).to.be.false;
        });

        it('survival_only_master requires 50 survival and <10 in every other mode', () => {
            expect(svc.checkMilestone(mk({ id: 'survival_only_master' }), {
                survivalGames: 50, normalGames: 9, timedGames: 9, chainGames: 9
            })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'survival_only_master' }), {
                survivalGames: 50, normalGames: 10, timedGames: 9, chainGames: 9
            })).to.be.false;
        });
    });

    // ---------- per-game score ----------
    describe('per-game score specials', () => {
        it('jackpot_winner unlocks at 500+ max single-game score', () => {
            expect(svc.checkMilestone(mk({ id: 'jackpot_winner' }), { maxScorePerGame: 500 })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'jackpot_winner' }), { maxScorePerGame: 499 })).to.be.false;
        });

        it('survival_high_score unlocks at 500+ max survival score (and only survival)', () => {
            expect(svc.checkMilestone(mk({ id: 'survival_high_score' }), { survivalMaxScore: 500, maxScorePerGame: 1000 })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'survival_high_score' }), { survivalMaxScore: 499, maxScorePerGame: 1000 })).to.be.false;
        });
    });

    // ---------- consistency ----------
    describe('consistency specials', () => {
        it('consistency_king requires 200+ points in 50% of games', () => {
            const pass = { totalGames: 4, gamesAbove200: 2 };
            const fail = { totalGames: 4, gamesAbove200: 1 };
            const tinyFail = { totalGames: 1, gamesAbove200: 1 };
            expect(svc.checkMilestone(mk({ id: 'consistency_king' }), pass)).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'consistency_king' }), fail)).to.be.false;
            // Requires >=2 games before the 50% threshold is meaningful
            expect(svc.checkMilestone(mk({ id: 'consistency_king' }), tinyFail)).to.be.false;
        });
    });

    // ---------- unique-word collection ----------
    describe('unique-word-collection specials', () => {
        it('word_collect_50 unlocks at 50 unique words', () => {
            expect(svc.checkMilestone(mk({ id: 'word_collect_50' }), { uniqueWordsCount: 50 })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'word_collect_50' }), { uniqueWordsCount: 49 })).to.be.false;
        });

        it('word_encyclopedia unlocks at 2500 unique words', () => {
            expect(svc.checkMilestone(mk({ id: 'word_encyclopedia' }), { uniqueWordsCount: 2500 })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'word_encyclopedia' }), { uniqueWordsCount: 2499 })).to.be.false;
        });
    });

    // ---------- word-length usage ----------
    describe('word-length-usage specials', () => {
        it('word_explorer_3 counts 3-letter words (50+)', () => {
            const stats = { wordLengthCounts: { 3: 50, 4: 0, 5: 0, 6: 0, '7+': 0 } };
            expect(svc.checkMilestone(mk({ id: 'word_explorer_3' }), stats)).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'word_explorer_3' }), { wordLengthCounts: { 3: 49 } })).to.be.false;
        });

        it('word_masterclass aggregates 7+ letter words (20+)', () => {
            expect(svc.checkMilestone(mk({ id: 'word_masterclass' }), {
                wordLengthCounts: { 3: 0, 4: 0, 5: 0, 6: 0, '7+': 20 }
            })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'word_masterclass' }), {
                wordLengthCounts: { 3: 0, 4: 0, 5: 0, 6: 999, '7+': 19 }
            })).to.be.false;
        });
    });

    // ---------- meta milestones ----------
    describe('meta (rarity) specials', () => {
        const commonA = { _id: { toString: () => 'c-a' }, id: 'c-a', rarity: 'common' };
        const commonB = { _id: { toString: () => 'c-b' }, id: 'c-b', rarity: 'common' };
        const rareX = { _id: { toString: () => 'r-x' }, id: 'r-x', rarity: 'rare' };

        it('letterforge_master unlocks when all common milestones are unlocked', () => {
            const all = [commonA, commonB, rareX];
            expect(svc.checkMilestone(mk({ id: 'letterforge_master' }), {}, {
                unlockedIds: new Set(['c-a', 'c-b']),
                allMilestones: all,
            })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'letterforge_master' }), {}, {
                unlockedIds: new Set(['c-a']),
                allMilestones: all,
            })).to.be.false;
        });

        it('letterforge_legend unlocks when all rare milestones are unlocked', () => {
            const all = [commonA, rareX];
            expect(svc.checkMilestone(mk({ id: 'letterforge_legend' }), {}, {
                unlockedIds: new Set(['r-x']),
                allMilestones: all,
            })).to.be.true;
            expect(svc.checkMilestone(mk({ id: 'letterforge_legend' }), {}, {
                unlockedIds: new Set(),
                allMilestones: all,
            })).to.be.false;
        });

        it('returns false if no context provided', () => {
            expect(svc.checkMilestone(mk({ id: 'letterforge_master' }), {})).to.be.false;
        });
    });

    // ---------- deferred specials ----------
    describe('deferred specials', () => {
        let warnStub;

        before(() => {
            warnStub = [];
            const original = console.warn;
            console.warn = (...args) => warnStub.push(args.join(' '));
            // restore in `after` of the parent describe
            after(() => { console.warn = original; });
        });

        it('returns false for deferred ids and warns once', () => {
            const result = svc.checkMilestone(mk({ id: 'social_butterfly' }), {});
            expect(result).to.be.false;
            const firstWarnCount = warnStub.length;
            // Calling again must not re-warn
            svc.checkMilestone(mk({ id: 'social_butterfly' }), {});
            expect(warnStub.length).to.equal(firstWarnCount);
        });
    });
});
