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

    // Every required letter must appear in the word at least as many times as
    // it appears in the rack (multiset containment). A plain `includes` check
    // ignores multiplicity, so a rack of ["c","a","c"] wrongly accepted "can"
    // (only one "c"). Counting frequencies fixes that.
    if (!Array.isArray(requiredLetters)) {
        return false;
    }
    if (requiredLetters.length > 0) {
        const wordFreq = {};
        for (const ch of normalized) {
            wordFreq[ch] = (wordFreq[ch] || 0) + 1;
        }

        const requiredFreq = {};
        for (const ch of requiredLetters) {
            const lower = typeof ch === 'string' ? ch.toLowerCase() : '';
            if (!lower) continue;
            requiredFreq[lower] = (requiredFreq[lower] || 0) + 1;
        }

        for (const ch of Object.keys(requiredFreq)) {
            if ((wordFreq[ch] || 0) < requiredFreq[ch]) {
                return false;
            }
        }
    }

    try {
        return isValidDictionaryWord(normalized);
    } catch (err) {
        console.error('Dictionary validation failed:', err.message);
        return false;
    }
}

module.exports = { validateWord };