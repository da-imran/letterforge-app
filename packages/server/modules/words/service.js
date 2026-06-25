const { isValidDictionaryWord } = require('../dictionary/service');

/**
 * Validate a submitted word against rules and dictionary
 * @param {string} word
 * @param {string[]} requiredLetters
 * @returns {boolean}
 */
function validateWord(word, requiredLetters = []) {
    if (typeof word !== 'string') {
        return false;
    }

    const normalized = word.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    if (!/^[a-z]+$/.test(normalized)) {
        return false;
    }

    if (!Array.isArray(requiredLetters) ||
        !requiredLetters.every(letter => normalized.includes(letter))
    ) {
        return false;
    }

    try {
        return isValidDictionaryWord(normalized);
    } catch (err) {
        console.error('Dictionary validation failed:', err.message);
        return false;
    }
}

module.exports = { validateWord };