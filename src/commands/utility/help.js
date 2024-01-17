/** @format */

module.exports = {
	data: {
		name: 'help',
		description: 'Get help with the bot',
	},

	async execute(interaction) {
		const message =
			'Chess allows you to play chess with your friends or against a bot.\nTo get started, challenge a player or bot with `/challenge (@player) (true/false)`';

		const commands = {
			color: 0x007aff,
			title: 'Commands',
			fields: [
				{
					name: 'Challenge a player or bot',
					value: '`/challenge (@player) (true/false)`',
					inline: false,
				},
				{
					name: 'View the board',
					value: '`/board (challenge_id)`',
					inline: false,
				},
				// {
				// 	name: 'View the leaderboard',
				// 	value: '`/leaderboard`',
				// 	inline: true,
				// },
				{
					name: 'Get help with the bot',
					value: '`/help`',
					inline: false,
				},
				{
					name: "Get the bot's changelog",
					value: '`/changelog`',
					inline: false,
				},
				{
					name: 'All othher functions are available through the buttons on the board',
					value: ' ',
					inline: false,
				},
			],
		};

		const changelogEmbed = {
			color: 0x007aff,
			description: 'View the changelog [here](https://chesscord.com/changelog)',
		};

		await interaction.reply({
			content: message,
			embeds: [commands, changelogEmbed],
			ephemeral: true,
		});
	},
};
