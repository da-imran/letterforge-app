const { expect } = require('chai');
const { calculatePoints } = require('../modules/scoring/service');

describe('Scoring Service', () => {
    it('[SC01] - Gives 1x points for new words', () => {
        const points = calculatePoints(false);
        expect(points).to.equal(10);
    });

    it('[SC02] Gives 0.5x points for duplicate words', () => {
        const points = calculatePoints(true);
        expect(points).to.equal(5);
    });
});
