const LOG_LEVELS = {
	CRITICAL: 'critical',
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info',
	DEBUG: 'debug',
};

const CONSOLE_METHOD = {
	[LOG_LEVELS.CRITICAL]: 'error',
	[LOG_LEVELS.ERROR]: 'error',
	[LOG_LEVELS.WARNING]: 'warn',
	[LOG_LEVELS.INFO]: 'info',
	[LOG_LEVELS.DEBUG]: 'log',
};

function formatLogLine(data) {
	return Object.entries(data)
		// eslint-disable-next-line no-unused-vars
		.filter(([_, val]) => val !== undefined && val !== null)
		.map(([key, val]) => `${key}=${JSON.stringify(val)}`)
		.join(' ');
}

const logger = {
	log({
		level = LOG_LEVELS.INFO,
		message = '',
		method,
		status,
		traceId,
		module = 'general',
		service = 'app',
		apiName,
		data,
	}) {
		const logLine = formatLogLine({
			timestamp: new Date().toISOString(),
			level,
			message,
			method,
			status,
			traceId,
			module,
			service,
			apiName,
			...(data ? { data } : {}),
		});

		const consoleMethod = CONSOLE_METHOD[level] || 'log';
		console[consoleMethod](logLine);
	},
};

module.exports = {
	logger,
	LOG_LEVELS,
};
