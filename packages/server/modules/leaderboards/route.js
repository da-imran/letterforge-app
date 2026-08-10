const express = require('express');
const { authRequired } = require('../../middleware/auth');
const { MODES, PERIODS } = require('../../utilities/constant');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

function parsePagination(limit, offset) {
    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);

    return {
        limit: Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : Math.min(Math.max(parsedLimit, 1), MAX_LIMIT),
        offset: Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0),
    };
}

module.exports = (leaderboardService) => {
    const router = express.Router();

    router.get('/', async (req, res, next) => {
        try {
            const { mode, period, limit = DEFAULT_LIMIT, offset = 0 } = req.query;

            if (!mode || !period) {
                return res.status(400).json({ status: 400, message: 'mode and period are required' });
            }

            if (!MODES.includes(mode)) {
                return res.status(400).json({ status: 400, message: 'Invalid mode' });
            }

            if (!PERIODS.includes(period)) {
                return res.status(400).json({ status: 400, message: 'Invalid period' });
            }

            const { limit: safeLimit, offset: safeOffset } = parsePagination(limit, offset);

            const leaderboard = await leaderboardService.getLeaderboard({
                mode,
                period,
                limit: safeLimit,
                offset: safeOffset
            });

            res.json(leaderboard);
        } catch (err) {
            next(err);
        }
    });

    router.post('/submit', authRequired, async (req, res, next) => {
        try {
            const { userId, mode, period, score, gameId } = req.body || {};

            if (userId && userId !== req.userId) {
                return res.status(403).json({ status: 403, message: 'You can only submit scores for your own account' });
            }

            if (!mode || !period || score === undefined) {
                return res.status(400).json({ status: 400, message: 'mode, period, and score are required' });
            }

            if (typeof score !== 'number' || score < 0) {
                return res.status(400).json({ status: 400, message: 'Score must be a non-negative number' });
            }

            const result = await leaderboardService.submitScore({
                userId: req.userId,
                mode,
                period,
                score,
                gameId
            });

            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    router.get('/rank/:userId', async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { mode, period } = req.query;

            if (!mode || !period) {
                return res.status(400).json({ status: 400, message: 'mode and period are required' });
            }

            const rank = await leaderboardService.getUserRank(userId, mode, period);

            if (!rank) {
                return res.status(404).json({ status: 404, message: 'User not found in leaderboard' });
            }

            res.json(rank);
        } catch (err) {
            next(err);
        }
    });

    router.get('/all', async (req, res, next) => {
        try {
            const { limit = DEFAULT_LIMIT } = req.query;
            const { limit: safeLimit } = parsePagination(limit, 0);

            const allLeaderboards = {};

            await Promise.all(
                MODES.map(async (mode) => {
                    allLeaderboards[mode] = {};
                    await Promise.all(
                        PERIODS.map(async (period) => {
                            const leaderboard = await leaderboardService.getLeaderboard({
                                mode,
                                period,
                                limit: safeLimit,
                                offset: 0
                            });
                            allLeaderboards[mode][period] = leaderboard;
                        })
                    );
                })
            );

            res.json(allLeaderboards);
        } catch (err) {
            next(err);
        }
    });

    return router;
};
