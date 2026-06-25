const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function randomLetters(count = 3) {
    const letters = new Set();
    while (letters.size < count) {
        letters.add(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
    }
    return Array.from(letters);
}

module.exports = { randomLetters };