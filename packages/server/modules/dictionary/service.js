const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// Per-letter caches: { a: Set, b: Set, ... }. A file is only read the first
// time a word starting with that letter is looked up.
const loaded = new Map(); // letter -> Set<string>
let merged = null;        // lazily-built full dictionary (all letters)

/**
 * Load (once) the file for a single first letter, e.g. `b.json`.
 * Each file is an object whose keys are words beginning with that letter:
 *   { "BAD": { "MEANINGS": {...}, "ANTONYMS": [], "SYNONYMS": [...] }, ... }
 */
function loadLetter(letter) {
    if (loaded.has(letter)) return loaded.get(letter);

    const filePath = path.join(DATA_DIR, `${letter}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Dictionary data file not found: ${letter}.json`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const words = new Set();
    for (const raw of Object.keys(data)) {
        const normalized = raw.trim().toLowerCase();
        if (/^[a-z]+$/.test(normalized)) {
            words.add(normalized);
        }
    }

    loaded.set(letter, words);
    return words;
}

/**
 * Validate the data directory exists. Files are read lazily per first letter
 * on first lookup, so nothing is loaded eagerly at boot.
 */
function loadDictionary() {
    if (!fs.existsSync(DATA_DIR)) {
        throw new Error('Dictionary data directory not found');
    }
    return null;
}

/**
 * Check if a word exists in dictionary. The first letter of the input picks
 * the file to consult, e.g. "BAD" -> `b.json`.
 * @param {string} word
 * @returns {boolean}
 */
function isValidDictionaryWord(word) {
    if (typeof word !== 'string') {
        return false;
    }

    const normalized = word.trim().toLowerCase();
    if (!/^[a-z]+$/.test(normalized)) {
        return false;
    }

    const letter = normalized[0];
    return loadLetter(letter).has(normalized);
}

/**
 * Full dictionary across all letters (lazily loaded and cached). Needed by
 * callers that scan the whole word list (chain-mode letter generation, the
 * daily-challenge solvability check).
 */
function getDictionary() {
    if (!merged) {
        merged = new Set();
        for (const letter of LETTERS) {
            for (const word of loadLetter(letter)) {
                merged.add(word);
            }
        }
    }
    return merged;
}

module.exports = {
    loadDictionary,
    isValidDictionaryWord,
    getDictionary,
};
