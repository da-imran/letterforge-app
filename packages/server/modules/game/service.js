const crypto = require('crypto');
const mongo = require('../../utilities/mongodb');
const scoringService = require('../scoring/service');
const { validateWord } = require('../words/service');
const { MODE_CONFIG, MODES, GAME_CONFIG } = require('../../utilities/constant');
const { HttpError } = require('../../utilities/http-error');
const { ERROR_CODES } = require('./errors');
const { getTodayChallenge } = require('../../utilities/daily-challenge');

// Points for the daily challenge by attempt number (round 1-5). A correct
// word is worth 50, 40, 30, 20, 10 respectively; failing all rounds scores 0.
const DAILY_ROUND_POINTS = [50, 40, 30, 20, 10];

// Cache of 2-3 letter dictionary words used for chain-mode letter generation.
// Extracted once and reused to avoid rescanning the full 45k-word dictionary
// on every createGame / submitWord / reset / refillBatch call.
let shortWordsCache = null;

function getShortWords() {
    if (shortWordsCache) return shortWordsCache;
    const { getDictionary } = require('../dictionary/service');
    const dictionary = getDictionary();
    shortWordsCache = [];
    if (dictionary) {
        for (const word of dictionary) {
            if (word.length >= 2 && word.length <= 3) shortWordsCache.push(word);
        }
    }
    return shortWordsCache;
}

class GameService {
    constructor(client, milestoneService = null, progressionService = null) {
        this.client = client;
        this.collection = 'games';
        this.milestoneService = milestoneService;
        this.progressionService = progressionService;
    }

    async createGame({ mode, letterCount, letters: predeterminedLetters, letterBatch: predeterminedBatch, userId }) {
        if (!mode || !MODES.includes(mode)) {
            throw new HttpError(400, ERROR_CODES.INVALID_MODE);
        }

        const modeConfig = MODE_CONFIG[mode];
        const now = Date.now();

        // Survival mode: lives
        const lives = mode === 'survival_mode' ? modeConfig.lives : null;
        const maxLives = lives;

        // Chain mode: no initial last letter
        const lastLetter = null;

        // Time limit
        const ttl = (mode === 'time_attack' || mode === 'survival_mode') ? modeConfig.expiresAt : null;
        const expiresAt = ttl ? new Date(now + ttl) : null;

        // Daily challenge: players see a meaning clue and must submit the
        // matching word (up to DAILY_MAX_ROUNDS attempts). The challenge is
        // one-per-day per user — resuming (or replaying) returns the game
        // already created today.
        let dailyAnswer = null;
        let clue = null;
        let dailyMeanings = null;
        if (mode === 'daily_challenge') {
            if (userId) {
                const startOfDay = new Date(now).setHours(0, 0, 0, 0);
                const existing = await mongo.findOne(this.client, this.collection, {
                    mode: 'daily_challenge',
                    userId: mongo.getObjectId(userId),
                    createdAt: { $gte: startOfDay },
                });
                if (existing) {
                    return this.toPublicGame(existing);
                }
            }
            const challenge = getTodayChallenge();
            dailyAnswer = challenge.word;
            clue = challenge.clue;
            dailyMeanings = challenge.meanings;
        }

        // Letter count (daily challenge uses no letters — the clue is the puzzle)
        const finalLetterCount = mode === 'daily_challenge' ? 0 : this._validateLetterCount(letterCount || modeConfig.letterCount);

        // Batch letter generation for suitable modes
        let letterBatch = null;
        let batchIndex = modeConfig.useBatch ? 0 : null;
        const letterGenerator = mode === 'chain_mode' ? this.generateChainModeLetters.bind(this) : this.generateRandomLetters.bind(this);
        // Daily challenge uses no letters — the clue is the puzzle.
        let letters = [];
        if (mode !== 'daily_challenge') {
            letters = predeterminedLetters || letterGenerator(finalLetterCount);
            if (modeConfig.useBatch) {
                const batchSize = modeConfig.batchSize || 10;
                if (predeterminedBatch) {
                    letterBatch = predeterminedBatch;
                    letters = predeterminedLetters || predeterminedBatch[0];
                } else if (!predeterminedLetters) {
                    letterBatch = Array.from({ length: batchSize }, () => letterGenerator(finalLetterCount));
                    letters = letterBatch[0];
                }
            }
        }

        const maxRounds = (mode === 'normal_mode' || mode === 'chain_mode' || mode === 'fade_mode' || mode === 'daily_challenge') ? modeConfig.maxRounds : null;

        const game = {
            trace_id: crypto.randomUUID(),
            mode,
            letterCount: finalLetterCount,
            letters,
            userId: userId ? mongo.getObjectId(userId) : null,
            createdAt: now,
            expiresAt,
            submissions: [],
            usedWords: [],
            score: 0,
            isCompleted: false,
            round: 1,
            maxRounds,
            // Survival mode fields
            lives,
            maxLives,
            // Chain mode fields
            lastLetter,
            // Batch fields for normal_mode and time_attack
            letterBatch,
            batchIndex,
            // Daily challenge fields
            dailyAnswer,
            clue,
            dailyMeanings,
        };

        const result = await mongo.insertOne(this.client, this.collection, game);

        return this.toPublicGame({
            ...game,
            _id: result.insertedId,
            lives,
            maxLives,
            lastLetter,
        });
    }

    /**
     * Public view of a game. The daily challenge answer is never exposed to
     * the client (only the clue) while the game is in progress, so players
     * cannot read it off the response. Once completed, the answer is revealed
     * so a reopened daily challenge can display it.
     */
    toPublicGame(game) {
        if (game && game.expiresAt) {
            const expiresAtMs = game.expiresAt instanceof Date ? game.expiresAt.getTime() : new Date(game.expiresAt).getTime();
            if (!Number.isNaN(expiresAtMs)) {
                game = { ...game, expiresAt: expiresAtMs };
            }
        }
        if (game && game.mode === 'daily_challenge' && game.dailyAnswer !== undefined && !game.isCompleted) {
            const { dailyAnswer, ...rest } = game;
            return rest;
        }
        return game;
    }

    /**
     * Validate a letter count is an integer in [MIN_LETTERS, MAX_LETTERS].
     * @throws {HttpError} 400 when invalid
     */
    _validateLetterCount(letterCount) {
        if (typeof letterCount !== 'number' || !Number.isInteger(letterCount)) {
            throw new HttpError(400, 'letterCount must be an integer');
        }
        if (letterCount < GAME_CONFIG.MIN_LETTERS || letterCount > GAME_CONFIG.MAX_LETTERS) {
            throw new HttpError(400, `Letter count must be ${GAME_CONFIG.MIN_LETTERS}-${GAME_CONFIG.MAX_LETTERS}`);
        }
        return letterCount;
    }

    generateRandomLetters(count) {
        const alphabet = 'abcdefghijklmnopqrstuvwxyz';
        const letters = [];
        for (let i = 0; i < count; i++) {
            const letter = alphabet[Math.floor(Math.random() * alphabet.length)];
            letters.push(letter);
        }
        return letters;
    }

    /**
     * Generate letters from valid 2-3 letter dictionary words for chain mode
     */
    generateChainModeLetters(count) {
        const shortWords = getShortWords();

        if (shortWords.length === 0) {
            return this.generateRandomLetters(count);
        }

        const letters = [];
        const wordCount = Math.ceil(count / 2);

        for (let i = 0; i < wordCount; i++) {
            const randomWord = shortWords[Math.floor(Math.random() * shortWords.length)];
            const wordLetters = randomWord.split('');
            for (const letter of wordLetters) {
                letters.push(letter);
                if (letters.length >= count) break;
            }
            if (letters.length >= count) break;
        }

        while (letters.length < count) {
            const alphabet = 'abcdefghijklmnopqrstuvwxyz';
            letters.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
        }

        for (let i = letters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letters[i], letters[j]] = [letters[j], letters[i]];
        }

        return letters;
    }

    async loadGame(gameId, actorUserId) {
        const objectId = mongo.getObjectId(gameId);
        if (!objectId) {
            throw new HttpError(400, 'Invalid game ID');
        }

        const game = await mongo.findOne(
            this.client,
            this.collection,
            { _id: objectId }
        );

        if (!game) throw new HttpError(404, ERROR_CODES.GAME_NOT_FOUND);
        this._assertOwnership(game, actorUserId);
        return game;
    }

    /**
     * Enforce that the actor owns the game. Owned games require authentication
     * and matching ownership; ownerless (guest) games remain publicly playable.
     */
    _assertOwnership(game, actorUserId) {
        if (game.userId && !actorUserId) {
            throw new HttpError(401, 'Authentication required to access this game');
        }
        if (game.userId && game.userId.toString() !== actorUserId.toString()) {
            throw new HttpError(403, 'You do not have permission to access this game');
        }
    }

    async saveGame(game) {
        const updateObj = {
            submissions: game.submissions,
            usedWords: game.usedWords,
            score: game.score,
            expiresAt: game.expiresAt,
            isCompleted: game.isCompleted,
            letters: game.letters,
            round: game.round,
            maxRounds: game.maxRounds,
            updatedAt: new Date(),
        };

        // Batch fields
        if (game.letterBatch) {
            updateObj.letterBatch = game.letterBatch;
            updateObj.batchIndex = game.batchIndex;
        }

        // Mode-specific fields
        if (game.lives !== undefined) {
            updateObj.lives = game.lives;
            updateObj.maxLives = game.maxLives;
        }
        if (game.lastLetter !== undefined) {
            updateObj.lastLetter = game.lastLetter;
        }

        await mongo.findOneAndUpdate(
            this.client,
            this.collection,
            { _id: mongo.getObjectId(game._id) },
            updateObj
        );
    }

    async submitWord(gameId, word, actorUserId) {
        const game = await this.loadGame(gameId, actorUserId);
        const now = Date.now();

        if (game.isCompleted) {
            throw new HttpError(409, ERROR_CODES.GAME_COMPLETED);
        }

        if (game.expiresAt && now > game.expiresAt && !game.isCompleted) {
            throw new HttpError(409, ERROR_CODES.GAME_EXPIRED);
        }

        if (game.mode === 'daily_challenge') {
            return this._submitDailyChallenge(game, word, actorUserId);
        }

        if (game.mode === 'survival_mode' && game.lives <= 0) {
            game.isCompleted = true;
            await this.saveGame(game);
            return {
                valid: false,
                reason: 'no_lives',
                totalScore: game.score,
                letters: game.letters,
                lives: game.lives,
                isCompleted: true,
            };
        }

        const normalized = typeof word === 'string' ? word.toLowerCase() : '';

        if (!normalized || !validateWord(normalized, game.letters)) {
            if (game.mode === 'survival_mode') {
                game.lives = Math.max(0, game.lives - 1);
                if (game.lives <= 0) {
                    game.isCompleted = true;
                }
                await this.saveGame(game);
                return {
                    valid: false,
                    reason: 'invalid_word',
                    totalScore: game.score,
                    letters: game.letters,
                    lives: game.lives,
                    isCompleted: game.isCompleted,
                };
            }

            return {
                valid: false,
                reason: 'invalid_word',
                totalScore: game.score,
                letters: game.letters,
                lastLetter: game.lastLetter,
                round: game.round,
                maxRounds: game.maxRounds,
            };
        }

        if (game.mode === 'chain_mode' && game.lastLetter) {
            const targetLetter = game.lastLetter;
            if (!normalized.startsWith(targetLetter)) {
                return {
                    valid: false,
                    reason: 'break_chain',
                    message: `Word must start with letter '${targetLetter}'`,
                    totalScore: game.score,
                    letters: game.letters,
                    lastLetter: game.lastLetter,
                    round: game.round,
                };
            }
        }

        // Duplicates are not awarded points and do not advance the round.
        const isDuplicate = game.usedWords.includes(normalized);
        if (isDuplicate) {
            return {
                valid: false,
                reason: 'duplicate',
                message: 'Word already used in this game',
                totalScore: game.score,
                letters: game.letters,
                lastLetter: game.lastLetter,
                round: game.round,
                maxRounds: game.maxRounds,
                isCompleted: game.isCompleted,
            };
        }

        const wordLength = normalized.length;
        game.usedWords.push(normalized);
        const points = scoringService.calculatePoints(false, wordLength);

        if (game.mode === 'survival_mode' && game.lives < game.maxLives) {
            game.lives = Math.min(game.maxLives, game.lives + 1);
        }

        game.score += points;
        game.submissions.push({ word: normalized, points });

        if (game.mode === 'chain_mode') {
            game.lastLetter = normalized[normalized.length - 1];
        }

        if (game.maxRounds) {
            game.round += 1;
            if (game.round > game.maxRounds) {
                game.isCompleted = true;
            }
        }

        // Regenerate letters for the next round, unless the game just
        // completed (e.g. a one-word daily challenge keeps its letters).
        let newLetters;
        if (!game.isCompleted) {
            const letterGenerator = game.mode === 'chain_mode' ? this.generateChainModeLetters.bind(this) : this.generateRandomLetters.bind(this);
            if (game.letterBatch && game.batchIndex !== undefined) {
                if (game.batchIndex < game.letterBatch.length - 2) {
                    game.batchIndex++;
                    newLetters = game.letterBatch[game.batchIndex];
                } else {
                    newLetters = letterGenerator(game.letterCount);
                }
            } else {
                newLetters = letterGenerator(game.letterCount);
            }
            game.letters = newLetters;
        }

        await this.saveGame(game);

        return {
            valid: true,
            duplicate: false,
            points,
            totalScore: game.score,
            letters: game.isCompleted ? game.letters : newLetters,
            lastLetter: game.lastLetter,
            lives: game.lives,
            round: game.round,
            maxRounds: game.maxRounds,
            isCompleted: game.isCompleted,
            letterBatch: game.letterBatch,
            batchIndex: game.batchIndex,
        };
    }

    /**
     * Daily challenge: player is shown a meaning clue and must submit the
     * matching word. Each submission is one attempt; a correct answer scores
     * points by attempt (50/40/30/20/10), a wrong one advances the round.
     * After DAILY_MAX_ROUNDS without the correct word the game ends at 0.
     */
    async _submitDailyChallenge(game, word) {
        if (game.isCompleted) {
            throw new HttpError(409, ERROR_CODES.GAME_COMPLETED);
        }

        const normalized = typeof word === 'string' ? word.trim().toLowerCase() : '';
        if (!normalized || !/^[a-z]+$/.test(normalized)) {
            return {
                valid: false,
                reason: 'invalid_word',
                totalScore: game.score,
                round: game.round,
                maxRounds: game.maxRounds,
                isCompleted: game.isCompleted,
            };
        }

        game.submissions.push({ word: normalized, points: 0 });

        const correct = normalized === game.dailyAnswer;
        if (correct) {
            const points = DAILY_ROUND_POINTS[game.round - 1] || 0;
            game.score += points;
            game.isCompleted = true;
        } else {
            game.round += 1;
            if (game.round > game.maxRounds) {
                game.isCompleted = true;
            }
        }

        await this.saveGame(game);

        return {
            valid: correct,
            reason: correct ? undefined : 'incorrect',
            points: correct ? DAILY_ROUND_POINTS[game.round - 1] || 0 : 0,
            totalScore: game.score,
            round: game.round,
            maxRounds: game.maxRounds,
            isCompleted: game.isCompleted,
            attemptsLeft: Math.max(0, game.maxRounds - game.round + 1),
        };
    }

    /**
     * Reset letters for game modes
     */
    async resetLetters(gameId, letterCount = null, predeterminedLetters = null, actorUserId) {
        const game = await this.loadGame(gameId, actorUserId);
        const now = Date.now();

        if (game.isCompleted) {
            throw new HttpError(409, ERROR_CODES.GAME_COMPLETED);
        }

        const finalLetterCount = letterCount ? this._validateLetterCount(letterCount) : game.letterCount;
        if (predeterminedLetters) {
            if (predeterminedLetters.length !== finalLetterCount) {
                throw new HttpError(400, 'Predetermined letters length must match letterCount');
            }
        }

        if (game.expiresAt && now > game.expiresAt && !game.isCompleted) {
            throw new HttpError(409, ERROR_CODES.GAME_EXPIRED);
        }

        const resetGenerator = game.mode === 'chain_mode' ? this.generateChainModeLetters.bind(this) : this.generateRandomLetters.bind(this);
        const newLetters = predeterminedLetters || resetGenerator(finalLetterCount);

        game.letters = newLetters;
        game.usedWords = [];
        game.updatedAt = new Date();

        await this.saveGame(game);

        return {
            letters: newLetters,
            usedWords: [],
            totalScore: game.score,
        };
    }

    /**
     * Calculate user stats for milestone checking from completed games
     */
    async getUserStatsForMilestones(userId) {
        const allGames = await mongo.find(this.client, this.collection, {
            userId: mongo.getObjectId(userId),
            isCompleted: true
        });

        const stats = {
            totalGames: allGames.length,
            normalGames: 0,
            timedGames: 0,
            survivalGames: 0,
            chainGames: 0,
            fadeGames: 0,
            totalPoints: 0,
            maxWordStreak: 0,
            avgPointsPerWord: 0,
            totalWords: 0,
            maxScorePerGame: 0,
            survivalMaxScore: 0,
            gamesAbove200: 0,
            uniqueWordsCount: 0,
            wordLengthCounts: { 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 },
        };

        let totalWords = 0;
        let totalPoints = 0;
        let maxWordStreak = 0;
        const uniqueWords = new Set();

        for (const g of allGames) {
            if (g.mode === 'normal_mode') stats.normalGames++;
            else if (g.mode === 'time_attack') stats.timedGames++;
            else if (g.mode === 'survival_mode') stats.survivalGames++;
            else if (g.mode === 'chain_mode') stats.chainGames++;
            else if (g.mode === 'fade_mode') stats.fadeGames++;

            const gamePoints = g.score || 0;
            const gameWords = g.usedWords ? g.usedWords.length : 0;

            totalPoints += gamePoints;
            totalWords += gameWords;
            maxWordStreak = Math.max(maxWordStreak, gameWords);
            stats.maxScorePerGame = Math.max(stats.maxScorePerGame, gamePoints);

            if (g.mode === 'survival_mode') {
                stats.survivalMaxScore = Math.max(stats.survivalMaxScore, gamePoints);
            }
            if (gamePoints >= 200) {
                stats.gamesAbove200++;
            }

            if (Array.isArray(g.usedWords)) {
                for (const word of g.usedWords) {
                    if (typeof word !== 'string') continue;
                    uniqueWords.add(word);
                    const len = word.length;
                    if (len === 3) stats.wordLengthCounts[3]++;
                    else if (len === 4) stats.wordLengthCounts[4]++;
                    else if (len === 5) stats.wordLengthCounts[5]++;
                    else if (len === 6) stats.wordLengthCounts[6]++;
                    else if (len >= 7) stats.wordLengthCounts['7+']++;
                }
            }
        }

        stats.totalPoints = totalPoints;
        stats.maxWordStreak = maxWordStreak;
        stats.totalWords = totalWords;
        stats.avgPointsPerWord = totalWords > 0 ? Math.round(totalPoints / totalWords) : 0;
        stats.uniqueWordsCount = uniqueWords.size;

        return stats;
    }

    /**
     * Per-mode aggregate stats for the profile page (single query per mode).
     */
    async getUserStats(userId) {
        const objectId = mongo.getObjectId(userId);
        if (!objectId) {
            throw new HttpError(400, 'Invalid user ID');
        }

        const pipeline = [
            { $match: { userId: objectId, isCompleted: true } },
            {
                $group: {
                    _id: '$mode',
                    totalPoints: { $sum: '$score' },
                    gameCount: { $sum: 1 },
                },
            },
        ];

        const rows = await mongo.aggregate(this.client, this.collection, pipeline);
        const byMode = {};
        for (const row of rows) {
            byMode[row._id] = { totalScore: row.totalPoints, gameCount: row.gameCount };
        }

        return {
            normal_mode: byMode.normal_mode || { totalScore: 0, gameCount: 0 },
            time_attack: byMode.time_attack || { totalScore: 0, gameCount: 0 },
            survival_mode: byMode.survival_mode || { totalScore: 0, gameCount: 0 },
            chain_mode: byMode.chain_mode || { totalScore: 0, gameCount: 0 },
            fade_mode: byMode.fade_mode || { totalScore: 0, gameCount: 0 },
        };
    }

    /**
     * Check milestones for user after game completion
     */
    async checkMilestonesAfterGame(userId) {
        if (!this.milestoneService) {
            return [];
        }

        const stats = await this.getUserStatsForMilestones(userId);
        return this.milestoneService.checkAndUnlockMilestones(userId, stats);
    }

    /**
     * Get a fresh batch of letter sets for batch-enabled modes.
     */
    async refillBatch(gameId, actorUserId) {
        const game = await this.loadGame(gameId, actorUserId);

        if (game.isCompleted) {
            throw new HttpError(409, ERROR_CODES.GAME_COMPLETED);
        }

        if (!game.letterBatch) {
            throw new HttpError(400, 'Game mode does not support batch letter generation');
        }

        const batchSize = game.letterBatch.length || 10;
        const generator = game.mode === 'chain_mode' ? this.generateChainModeLetters.bind(this) : this.generateRandomLetters.bind(this);
        const newBatch = Array.from({ length: batchSize }, () => generator(game.letterCount));
        game.letterBatch = newBatch;
        game.batchIndex = 0;
        game.usedWords = [];
        game.updatedAt = new Date();

        game.letters = newBatch[0];

        await this.saveGame(game);

        return {
            letterBatch: newBatch,
            batchIndex: game.batchIndex,
            letters: game.letters,
            totalScore: game.score,
        };
    }

    /**
     * Complete the game and mark it as finished
     */
    async completeGame(gameId, actorUserId) {
        const game = await this.loadGame(gameId, actorUserId);

        game.isCompleted = true;
        game.updatedAt = new Date();

        await this.saveGame(game);

        if (game.userId) {
            const userId = game.userId.toString();

            try {
                const newlyUnlocked = await this.checkMilestonesAfterGame(userId);
                if (newlyUnlocked.length > 0) {
                    console.log(`Unlocked ${newlyUnlocked.length} new milestone(s) for user ${userId}`);
                }
            } catch (err) {
                console.error('Failed to check milestones:', err);
            }

            if (this.progressionService) {
                try {
                    await this.progressionService.awardGameXp(userId, { mode: game.mode, score: game.score });
                } catch (err) {
                    console.error('Failed to award XP:', err);
                }
            }
        }

        return {
            score: game.score,
            isCompleted: game.isCompleted,
        };
    }

    /**
     * Get game result
     */
    async getGameResult(gameId, actorUserId) {
        const game = await this.loadGame(gameId, actorUserId);

        return {
            gameId: game._id,
            mode: game.mode,
            score: game.score,
            usedWords: game.usedWords,
            isCompleted: game.isCompleted,
            userId: game.userId,
            lives: game.lives,
            maxLives: game.maxLives,
            lastLetter: game.lastLetter,
            round: game.round,
            maxRounds: game.maxRounds,
        };
    }

    /**
     * Permanently remove a game. Used when a player abandons a game before
     * submitting any words. Ownership rules still apply.
     */
    async deleteGame(gameId, actorUserId) {
        const game = await this.loadGame(gameId, actorUserId);
        if (game.isCompleted) {
            throw new HttpError(400, 'Completed games cannot be deleted');
        }

        const result = await mongo.deleteOne(
            this.client,
            this.collection,
            { _id: game._id }
        );

        if (result.deletedCount === 0) {
            throw new HttpError(404, ERROR_CODES.GAME_NOT_FOUND);
        }

        return { message: 'Game deleted', gameId: game._id };
    }
}

module.exports = GameService;
