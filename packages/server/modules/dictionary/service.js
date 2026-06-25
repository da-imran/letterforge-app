const fs = require('fs');
const path = require('path');

let dictionary = null;

function loadDictionary() {
    const filePath = path.join(__dirname, 'dictionary.txt');

    if (!fs.existsSync(filePath)) {
        throw new Error('File dictionary.txt not found');
    }

    const words = fs.readFileSync(filePath, 'utf8').split('\n');

    dictionary = new Set(
        words
            .map(w => w.trim().toLowerCase())
            .filter(Boolean)
    );

    console.log(`Loaded ${dictionary.size} words`);
}

/**
 * Check if a word exists in dictionary
 * @param {string} word
 * @returns {boolean}
 */
function isValidDictionaryWord(word) {
    if (!dictionary) {
        throw new Error('Dictionary not loaded. Call loadDictionary() first.');
    }

    if (typeof word !== 'string') {
        return false;
    }

    const normalized = word.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return dictionary.has(normalized);
}

module.exports = {
    loadDictionary,
    isValidDictionaryWord,
    getDictionary: () => dictionary,
};