/**
 * LetterForge Scoring Service
 *
 * Scoring Rules:
 * - Base points: 10 for new words, 5 for duplicate words
 * - Bonus for longer words (only for new words):
 *   - 6-10 letters: +15 bonus (total: 25)
 *   - 11+ letters: +20 bonus (total: 30)
 */

function calculatePoints(isDuplicate, wordLength = 0) {
    if (isDuplicate) {
        return 5;
    }

    let points = 10;
    if (wordLength >= 6 && wordLength <= 10) {
        points += 5;
    } else if (wordLength > 10) {
        points += 10;
    }

    return points;
}

/**
 * Get points breakdown for a word
 * @param {boolean} isDuplicate - Whether the word was already used
 * @param {number} wordLength - Length of the word
 * @returns {object} Points breakdown
 */
function getPointsBreakdown(isDuplicate, wordLength) {
    const points = calculatePoints(isDuplicate, wordLength);

    return {
        points,
        basePoints: 10,
        bonusPoints: points > 10 ? points - 10 : 0,
        isDuplicate,
        wordLength,
    };
}

module.exports = { calculatePoints, getPointsBreakdown };
