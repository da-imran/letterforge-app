const { expect } = require('chai');
const { validateWord } = require('../modules/words/service');
const { loadDictionary } = require('../modules/dictionary/service');

describe('Non-dictionary Words', () => {
    before(() => loadDictionary());

    it('[WI01] - Rejects random fake words', () => {
        expect(validateWord('qwertyuiopasdf', ['q'])).to.be.false;
    });

    it('[WI02] - Rejects valid-letter but non-dictionary words', () => {
        expect(validateWord('racezzz', ['r','a','c','e'])).to.be.false;
    });
});
