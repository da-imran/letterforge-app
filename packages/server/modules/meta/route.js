const express = require('express');
const router = express.Router();

const { VERSION, SERVICE_NAME } = require('../../utilities/env');
const { GAME_CONFIG, MODE_CONFIG } = require('../../utilities/constant');

router.get('/meta', (req, res) => {
    // #swagger.tags = ['meta']
    // #swagger.summary = 'Get engine metadata'
    // #swagger.description = 'Returns service information, available game modes, and configuration'
    res.json({
        service: SERVICE_NAME,
        apiVersion: VERSION,
        modes: Object.keys(MODE_CONFIG),
        maxLetterCount: GAME_CONFIG.MAX_LETTERS,
        uptime: process.uptime(),
    });
});

router.get('/health', (req, res) => {
    // #swagger.tags = ['meta']
    // #swagger.summary = 'Health check'
    // #swagger.description = 'Returns the health status of the engine'
    res.status(200).json({ status: 'healthy' });
});

module.exports = router;