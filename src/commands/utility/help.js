/** @format */

module.exports = {
	data: {
		name: 'help',
		description: 'Get help with the bot',
	},

	async execute(interaction) {
		const message =
			'Chess allows you to play chess with your friends or against a bot.\nTo get started, challenge a player or bot with `/challenge (@player)`';

		const chessCommands = {
			color: 0x007aff,
			title: 'Chess Commands',
			fields: [
				{
					name: 'Challenge a player or bot',
					value: '`/challenge (@player)`',
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: true,
				},
				{
					name: 'Resign from a game',
					value: '`/resign (challenge_id)`',
					inline: true,
				},
				{
					name: 'View the board',
					value: '`/board (challenge_id)`',
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: true,
				},
				{
					name: 'View the leaderboard',
					value: '`/leaderboard`',
					inline: true,
				},
				{
					name: 'All othher functions are available through the buttons on the board',
					value: ' ',
					inline: false,
				},
			],
		};

		const utilityCommands = {
			color: 0x007aff,
			title: 'Utility Commands',
			fields: [
				{
					name: 'Get help with the bot',
					value: '`/help`',
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: true,
				},
				{
					name: "Get the bot's changelog",
					value: '`/changelog`',
					inline: true,
				},
				{
					name: 'Invite the bot to your server',
					value: '`/invite`',
					inline: false,
				},
			],
		};

		await interaction.reply({
			content: message,
			embeds: [chessCommands, utilityCommands],
			ephemeral: true,
		});
	},
};
