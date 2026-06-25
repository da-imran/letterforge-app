const { expect } = require('chai');
const { validateWord } = require('../modules/words/service');
const { loadDictionary } = require('../modules/dictionary/service');
const { getRandomWord } = require('./helper/dictionary-helper');

describe('Word Length Boundaries', () => {
    before(() => loadDictionary());

    [3,4,5,6,7,8,9,10,11,15].forEach(len => {
        it(`[WL01] - Accepts dictionary word with length >= ${len}`, () => {
            const word = getRandomWord(len);
            const letters = [...new Set(word.slice(0, 2))];
            expect(validateWord(word, letters)).to.be.true;
        });
    });
});
