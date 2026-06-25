const MODULES = {
	GAMECONTROLLER: 'game-controller',
	GAMESERVICE: 'game-service',
	GAMEROUTES: 'game-routes',
	GAMETYPES: 'game-types',
	SCORINGSERVICE: 'scoring-service',
	WORDVALIDATORSERVICE: 'word-validator-service',
};

const METHODS = {
	GET: 'GET',
	PATCH: 'PATCH',
	POST: 'POST',
	DELETE: 'DELETE',
};

const GAME_CONFIG = {
	MIN_LETTERS: 2,
	MAX_LETTERS: 3,
	DEFAULT_TIME_LIMIT_SECONDS: 30,
	DEFAULT_ROUNDS: 10,
};

const MODE_CONFIG = {
	normal_mode: {
		maxRounds: 10,
		letterCount: 3,
		lives: null,
		expiresAt: null,
		batchSize: 10,
		useBatch: true,
	},
	time_attack: {
		maxRounds: null,
		letterCount: 3,
		lives: null,
		expiresAt: 60_000, // 60s TTL
		batchSize: 10,
		useBatch: true,
	},
	survival_mode: {
		maxRounds: null,
		letterCount: 4,
		lives: 5,
		expiresAt: null,
		batchSize: 10,
		useBatch: true,
	},
	chain_mode: {
		maxRounds: 10,
		letterCount: 2,
		lives: null,
		expiresAt: null,
		batchSize: 10,
		useBatch: true,
	},
};

module.exports = { METHODS, MODULES, GAME_CONFIG, MODE_CONFIG };