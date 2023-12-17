/** @format */

const { SlashCommandBuilder } = require('discord.js');
const { INFO_Color } = require('../../data/config.json');

const pool = require('../../handlers/data/pool.js');

// Constants for top player count and leaderboard link
const TOP_PLAYERS_COUNT = 10;
const LEADERBOARD_LINK = 'https://koy.ltd/chessbot/leaderboard';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Get the leaderboard for chess'),

	async execute(interaction) {
		try {
			// Fetch leaderboard data from the database and sort by elo in descending order
			const result = await pool.query(
				'SELECT * FROM leaderboard ORDER BY elo DESC'
			);
			const leaderboardData = result[0];

			// Generate and send the leaderboard embed
			const leaderboardEmbed = generateLeaderboardEmbed(leaderboardData);
			return interaction.reply({ embeds: [leaderboardEmbed] });
		} catch (error) {
			console.error('Error fetching or processing leaderboard data:', error);
			return interaction.reply({
				content: `There was an error: \`${error.message}\``,
				ephemeral: true,
			});
		}
	},
};

function generateLeaderboardEmbed(leaderboardData) {
	const trophyEmojis = new Map([
		[0, ':first_place:'],
		[1, ':second_place:'],
		[2, ':third_place:'],
	]);

	const topPlayers = leaderboardData.slice(0, TOP_PLAYERS_COUNT);

	const leaderboardEmbed = {
		color: INFO_Color,
		title: 'Chess Leaderboard',
		description: `View the full leaderboard [here](${LEADERBOARD_LINK})`,
		fields: [
			{
				name: 'Top 10',
				value: topPlayers
					.map((user, index) => {
						const trophyEmoji = trophyEmojis.get(index) || ':chess_pawn:';
						return `${trophyEmoji} <@${user.user_id}> - **ELO:** ${user.elo}`;
					})
					.join('\n'),
			},
		],
	};

	return leaderboardEmbed;
}
