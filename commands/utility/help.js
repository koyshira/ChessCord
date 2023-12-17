/** @format */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Get help with the bot'),

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
					name: 'Accept a challenge',
					value: '`/accept (challenge_id)`',
					inline: true,
				},
				{
					name: 'Reject a challenge',
					value: '`/reject (challenge_id)`',
					inline: true,
				},
				{
					name: 'Resign from a game',
					value: '`/resign (challenge_id)`',
					inline: true,
				},
				{
					name: 'Make a move',
					value: '`/move (challenge_id) (piece move)`',
					inline: true,
				},
				{
					name: 'View the board',
					value: '`/board (challenge_id)`',
					inline: true,
				},
				{ name: 'View the leaderboard', value: '`/leaderboard`', inline: true },
			],
		};

		const utilityCommands = {
			color: 0x007aff,
			title: 'Utility Commands',
			fields: [
				{ name: 'Get help with the bot', value: '`/help`', inline: true },
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
		});
	},
};
