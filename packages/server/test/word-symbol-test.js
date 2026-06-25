const { expect } = require('chai');
const { validateWord } = require('../modules/words/service');

describe('Symbol And Space Rejection', () => {
    it('[WS01] - Rejects words with symbols', () => {
        expect(validateWord('race!', ['r','a'])).to.be.false;
    });

    it('[WS02] - Rejects words with spaces', () => {
        expect(validateWord('race car', ['r','a'])).to.be.false;
    });
});
