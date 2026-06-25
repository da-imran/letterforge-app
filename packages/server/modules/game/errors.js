const ERROR_CODES = {
    INVALID_MODE: 'mode is required and must be a valid game mode',
    GAME_NOT_FOUND: 'Game not found',
    GAME_COMPLETED: 'Game is already completed',
    GAME_EXPIRED: 'Game expired',
    MAX_ROUNDS_REACHED: 'Maximum rounds reached',
    NO_LIVES_REMAINING: 'No lives remaining',
    RESET_ALREADY_USED: 'Reset already used in this game',
};

module.exports = { ERROR_CODES };
