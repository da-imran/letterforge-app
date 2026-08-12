const GAME_CONFIG = {
	MIN_LETTERS: 2,
	MAX_LETTERS: 5,
	DEFAULT_TIME_LIMIT_SECONDS: 60,
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
	fade_mode: {
		maxRounds: 10,
		letterCount: 3,
		lives: null,
		expiresAt: null,
		batchSize: 10,
		useBatch: true,
	},
	daily_challenge: {
		maxRounds: 5,
		letterCount: 0,
		lives: null,
		expiresAt: null,
		batchSize: 10,
		useBatch: false,
	},
};

const MODES = Object.keys(MODE_CONFIG);
const PERIODS = ['daily', 'weekly', 'all_time'];

module.exports = { GAME_CONFIG, MODE_CONFIG, MODES, PERIODS };
