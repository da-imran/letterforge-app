module.exports = async (app, config) => {
	await require('./modules/meta')(app, config);
	const scoreService = await require('./modules/scores')(app, config);
	const milestoneService = await require('./modules/milestones')(app, config);
	await require('./modules/game')(app, config, scoreService, milestoneService);
	await require('./modules/users')(app, config);
	await require('./modules/leaderboards')(app, config);

	app.locals.milestoneService = milestoneService;
};
