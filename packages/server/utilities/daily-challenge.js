const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DAILY_MAX_ROUNDS = 5;

/**
 * Date key in the server's local timezone. The challenge resets at local
 * midnight, so the key must be derived from calendar fields, not a raw
 * timestamp.
 */
function getDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Deterministic PRNG (mulberry32) seeded from the date key. Every caller gets
 * the same sequence for the same day, which is what makes the challenge fair.
 */
function seededRandom(dateKey) {
    let h = 1779033703 ^ dateKey.length;
    for (let i = 0; i < dateKey.length; i++) {
        h = Math.imul(h ^ dateKey.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    let state = h >>> 0;
    return () => {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const DATA_DIR = path.join(__dirname, '..', 'modules', 'dictionary', 'data');

let poolCache = null;

/**
 * Build the candidate pool of { word, clue } pairs from the dictionary's
 * MEANINGS. Words with unusable clues (e.g. "letter of the alphabet") are
 * excluded so the daily challenge is always answerable.
 */
function buildDailyPool() {
    if (poolCache) return poolCache;

    const pool = [];
    const files = fs.readdirSync(DATA_DIR).filter(f => /^[a-z]\.json$/.test(f)).sort();
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        for (const word of Object.keys(data)) {
            if (!/^[a-z]+$/i.test(word)) continue;
            if (word.length < 4 || word.length > 12) continue;

            const meanings = data[word].MEANINGS;
            if (!meanings || typeof meanings !== 'object') continue;
            const first = Object.keys(meanings)[0];
            const entry = meanings[first];
            if (!Array.isArray(entry)) continue;
            const definition = entry[1];
            if (typeof definition !== 'string' || !definition.trim()) continue;
            if (/letter of the (roman )?alphabet/i.test(definition)) continue;

            pool.push({ word: word.toLowerCase(), clue: definition });
        }
    }

    poolCache = pool;
    return pool;
}

/**
 * Today's shared challenge: one deterministic { word, clue } pair for every
 * player. The player is shown the clue and must submit the matching word.
 */
function getTodayChallenge() {
    const dateKey = getDateKey();
    const pool = buildDailyPool();
    const random = seededRandom(dateKey);
    const entry = pool[Math.floor(random() * pool.length)];

    return {
        date: dateKey,
        word: entry.word,
        clue: entry.clue,
        attempts: DAILY_MAX_ROUNDS,
        seed: crypto.createHash('sha256').update(dateKey).digest('hex').slice(0, 16),
    };
}

module.exports = {
    getDateKey,
    seededRandom,
    buildDailyPool,
    getTodayChallenge,
    DAILY_MAX_ROUNDS,
};
