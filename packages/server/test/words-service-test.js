const { expect } = require('chai');
const { validateWord } = require('../modules/words/service');
const { loadDictionary } = require('../modules/dictionary/service');

describe('Word Validator', () => {
    before(() => {
        loadDictionary();
    });

    it('[WV01] - Accepts valid dictionary words with required letters', () => {
        const result = validateWord('races', ['r', 'a', 'c']);
        expect(result).to.be.true;
    });

    it('[WV02] - Rejects words missing required letters', () => {
        const result = validateWord('race', ['r', 'a', 's']);
        expect(result).to.be.false;
    });

    it('[WV03] - Rejects non-dictionary words', () => {
        const result = validateWord('zzzzz', ['z']);
        expect(result).to.be.false;
    });
});
