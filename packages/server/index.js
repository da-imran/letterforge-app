module.exports = async (app, config) => {
	await require('./modules/meta')(app, config);
	await require('./modules/auth')(app, config);
	await require('./modules/scoring')(app, config);
	const scoreService = await require('./modules/scores')(app, config);
	const milestoneService = await require('./modules/milestones')(app, config);
	const progressionService = await require('./modules/progression')(app, config);
	const gameService = await require('./modules/game')(app, config, scoreService, milestoneService, progressionService);
	milestoneService.setStatsProvider((userId) => gameService.getUserStatsForMilestones(userId));
	await require('./modules/duels')(app, config, gameService);
	const duelService = config.duelService;
	if (duelService && typeof duelService.startWatchdog === 'function') {
		duelService.startWatchdog();
	}
	await require('./modules/users')(app, config, gameService);
	const leaderboardService = await require('./modules/leaderboards')(app, config, scoreService);
	config.leaderboardService = leaderboardService;
	await require('./modules/scoring/consumer')(app, config);
};
