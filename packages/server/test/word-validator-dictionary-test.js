const { expect } = require('chai');
const { validateWord } = require('../modules/words/service');
const { loadDictionary } = require('../modules/dictionary/service');
const { getRandomWord } = require('./helper/dictionary-helper');

describe('Dictionary Word Validation', () => {
    before(() => loadDictionary());

    it('[DV01] - Accepts random dictionary words', () => {
        for (let i = 0; i < 20; i++) {
            const word = getRandomWord(3);
            const letters = [...new Set(word.slice(0, 2))];
            expect(validateWord(word, letters)).to.be.true;
        }
    });
});
