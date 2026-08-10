const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(
    __dirname,
    '../../modules/dictionary/data'
);

const words = [
    ...new Set(
        fs
            .readdirSync(DATA_DIR)
            .filter(f => /^[a-z]\.json$/.test(f))
            .flatMap(file => Object.keys(JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))))
            .map(w => w.trim().toLowerCase())
            .filter(w => /^[a-z]+$/.test(w))
    ),
];

function getRandomWord({ minLength = 1, maxLength = Infinity, exactLength } = {}) {
    const candidates = words.filter(w => {
        if (exactLength !== undefined) return w.length === exactLength;
        return w.length >= minLength && w.length <= maxLength;
});

if (candidates.length === 0) throw new Error('No dictionary words for constraints');
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function getRandomWords(count, options = {}) {
    const candidates = words.filter(w => {
        if (options.exactLength !== undefined) return w.length === options.exactLength;
        return w.length >= (options.minLength ?? 1) && w.length <= (options.maxLength ?? Infinity);
});

if (candidates.length < count) throw new Error(`Not enough words to satisfy request: ${count}`);
    const result = new Set();
    while (result.size < count) {
        const word = candidates[Math.floor(Math.random() * candidates.length)];
        result.add(word);
    }
    return [...result];
}

/**
 * Return words that include all required letters
 * @param {string[]} letters
 * @param {number} count
 */
function getWordsContainingLetters(letters, count = 1) {
    let candidates = words.filter(word => letters.every(l => word.includes(l)));
    candidates = [...new Set(candidates)]; // Remove duplicates
    
    if (candidates.length < count) {
        throw new Error(
            `Not enough words containing letters [${letters.join(',')}] in dictionary`
        );
    }

    // Shuffle array
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    
    return candidates.slice(0, count);
}

module.exports = {
    words,
    getRandomWord,
    getRandomWords,
    getWordsContainingLetters,
};
