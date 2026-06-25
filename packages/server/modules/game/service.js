const { v4: uuidv4 } = require('uuid');
const mongo = require('../../utilities/mongodb');
const scoringService = require('../scoring/service');
const { validateWord } = require('../words/service');
const { isValidDictionaryWord } = require('../dictionary/service');
const { MODE_CONFIG } = require('../../utilities/constant');
const { ERROR_CODES } = require('./errors');
const { ObjectId } = require('mongodb');

class GameService {
    constructor(client, milestoneService = null) {
        this.client = client;
        this.collection = 'games';
        this.milestoneService = milestoneService;
    }

    async createGame({ mode, letterCount, letters: predeterminedLetters, userId, ...options }) {
        if (!mode || !['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'].includes(mode)) {
            throw new Error(ERROR_CODES.INVALID_MODE);
        }

        const modeConfig = MODE_CONFIG[mode];
        const now = Date.now();

        // Survival mode: lives
        const lives = mode === 'survival_mode' ? modeConfig.lives : null;
        const maxLives = lives;

        // Chain mode: no initial last letter
        const lastLetter = mode === 'chain_mode' ? null : null;

        // Time limit
        const ttl = (mode === 'time_attack' || mode === 'survival_mode') ? modeConfig.expiresAt : null;
        const expiresAt = ttl ? now + ttl : null;

        // Letter count
        const finalLetterCount = letterCount || modeConfig.letterCount || 3;

        // Batch letter generation for suitable modes
        let letterBatch = null;
        let batchIndex = modeConfig.useBatch ? 0 : null;
        const letterGenerator = mode === 'chain_mode' ? this.generateChainModeLetters.bind(this) : this.generateRandomLetters.bind(this);
        let letters = predeterminedLetters || letterGenerator(finalLetterCount);
        if (modeConfig.useBatch && !predeterminedLetters) {
            const batchSize = 10;
            letterBatch = Array.from({ length: batchSize }, () => letterGenerator(finalLetterCount));
            letters = letterBatch[0];
        }

        const maxRounds = (mode === 'normal_mode' || mode === 'chain_mode') ? modeConfig.maxRounds : null;

        const game = {
            trace_id: uuidv4(),
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
        };

        const result = await mongo.insertOne(this.client, this.collection, game);

        return {
            ...game,
            _id: result.insertedId,
            lives,
            maxLives,
            lastLetter,
        };
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
        const dictionaryService = require('../dictionary/service');
        const dictionary = dictionaryService.getDictionary();

        // Extract 2-3 letter words from dictionary
        const shortWords = [];
        if (dictionary) {
            for (const word of dictionary) {
                const len = word.length;
                if (len >= 2 && len <= 3) {
                    shortWords.push(word);
                }
            }
        }

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

    async loadGame(gameId) {
        const game = await mongo.findOne(
            this.client,
            this.collection,
            { _id: new ObjectId(gameId) }
        );

        if (!game) throw new Error(ERROR_CODES.GAME_NOT_FOUND);
        return game;
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

    async submitWord(gameId, word) {
        const game = await this.loadGame(gameId);
        const now = Date.now();

        if (game.isCompleted) {
            throw new Error(ERROR_CODES.GAME_COMPLETED);
        }

        if (game.expiresAt && now > game.expiresAt && !game.isCompleted) {
            throw new Error(ERROR_CODES.GAME_EXPIRED);
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

        const normalized = word.toLowerCase();

        if (!validateWord(normalized, game.letters)) {
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
            if (!normalized.includes(targetLetter)) {
                return {
                    valid: false,
                    reason: 'break_chain',
                    message: `Word must contain letter '${targetLetter}'`,
                    totalScore: game.score,
                    letters: game.letters,
                    lastLetter: game.lastLetter,
                    round: game.round,
                };
            }
        }

        const isDuplicate = game.usedWords.includes(normalized);
        const wordLength = normalized.length;
        let points;

        if (!isDuplicate) {
            game.usedWords.push(normalized);
            points = scoringService.calculatePoints(isDuplicate, wordLength);

            if (game.mode === 'survival_mode' && game.lives < game.maxLives) {
                game.lives = Math.min(game.maxLives, game.lives + 1);
            }

            game.score += points;
            game.submissions.push({ word: normalized, points });
        } else {
            points = scoringService.calculatePoints(true, wordLength);
            game.submissions.push({ word: normalized, points });
        }

        if (game.mode === 'chain_mode') {
            game.lastLetter = normalized[normalized.length - 1];
        }

        let newLetters;
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

        if (game.maxRounds) {
            game.round += 1;
            if (game.round > game.maxRounds) {
                game.isCompleted = true;
            }
        }

        await this.saveGame(game);

        return {
            valid: true,
            duplicate: isDuplicate,
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
     * Reset letters for game modes
     */
    async resetLetters(gameId, letterCount = null, predeterminedLetters = null) {
        const game = await this.loadGame(gameId);
        const now = Date.now();

        if (game.isCompleted) {
            throw new Error(ERROR_CODES.GAME_COMPLETED);
        }

        const finalLetterCount = letterCount || game.letterCount;
        if (predeterminedLetters) {
            if (predeterminedLetters.length !== finalLetterCount) {
                throw new Error('Predetermined letters length must match letterCount');
            }
        } else if (finalLetterCount < 2 || finalLetterCount > 5) {
            throw new Error('Letter count must be 2-5');
        }

        if (game.expiresAt && now > game.expiresAt && !game.isCompleted) {
            throw new Error(ERROR_CODES.GAME_EXPIRED);
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
            totalPoints: 0,
            maxWordStreak: 0,
            avgPointsPerWord: 0,
            totalWords: 0,
            // Extended stats consumed by `special` milestone checks.
            // All derivable in a single pass over completed games — no time
            // bucketing, so time-of-day / day-streak / seasonal specials stay
            // deferred (see modules/milestones/service.js).
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
    async refillBatch(gameId) {
        const game = await this.loadGame(gameId);

        if (game.isCompleted) {
            throw new Error(ERROR_CODES.GAME_COMPLETED);
        }

        if (!game.letterBatch) {
            throw new Error('Game mode does not support batch letter generation');
        }

        const batchSize = 10;
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
    async completeGame(gameId) {
        const game = await this.loadGame(gameId);

        game.isCompleted = true;
        game.updatedAt = new Date();

        await this.saveGame(game);

        if (game.userId) {
            try {
                const newlyUnlocked = await this.checkMilestonesAfterGame(game.userId.toString());
                if (newlyUnlocked.length > 0) {
                    console.log(`Unlocked ${newlyUnlocked.length} new milestone(s) for user ${game.userId}`);
                }
            } catch (err) {
                console.error('Failed to check milestones:', err);
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
    async getGameResult(gameId) {
        const game = await this.loadGame(gameId);

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
}

module.exports = GameService;
