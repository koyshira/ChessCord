/** @format */

const axios = require('axios');
const { INFO_Color } = require('../../data/config.json');
const pool = require('../../handlers/data/pool.js');

const TOP_PLAYERS_COUNT = 10;
const LEADERBOARD_LINK = 'https://chesscord.com/leaderboard';

async function getLichessUserData(username) {
	try {
		const response = await axios.get(
			`https://lichess.org/api/user/${username}`
		);

		const userData = response.data;

		return userData;
	} catch (error) {
		throw new Error(`Error fetching Lichess data: ${error.message}`);
	}
}

async function updateLeaderboardWithLichessRatings() {
	// Fetch all linked users from the database
	const [linked_users] = await pool.query('SELECT * FROM linked_users');

	try {
		for (const linkedUser of linked_users) {
			// Skip users with specific ids
			if (
				linkedUser.id === '1168936311743328417' ||
				linkedUser.id === '1170686198314979348'
			) {
				continue;
			}

			const lichessUserData = await getLichessUserData(
				linkedUser.lichess_username
			);
			const lichessRating = lichessUserData.perfs.correspondence.rating;

			await pool.query(
				'INSERT INTO leaderboard (user_id, elo) VALUES (?, ?) ON DUPLICATE KEY UPDATE elo = VALUES(elo)',
				[linkedUser.id, lichessRating]
			);
		}
	} catch (error) {
		console.error('Error updating leaderboard with Lichess ratings:', error);
	}
}

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
						return `${trophyEmoji} <@${user.user_id}> - **ELO:** ${parseInt(
							user.elo
						)}`;
					})
					.join('\n'),
			},
		],
	};

	return leaderboardEmbed;
}

module.exports = {
	data: {
		name: 'leaderboard',
		description: 'Get the leaderboard for chess',
	},

	async execute(interaction) {
		try {
			// Fetch Lichess data and update the database with ratings for all linked users
			await updateLeaderboardWithLichessRatings();

			// Fetch leaderboard data from the database and sort by elo in descending order
			const result = await pool.query(
				'SELECT * FROM leaderboard ORDER BY elo DESC'
			);
			const leaderboardData = result[0];

			// Generate and send the leaderboard embed
			const leaderboardEmbed = generateLeaderboardEmbed(leaderboardData);
			await interaction.reply({ embeds: [leaderboardEmbed] });
		} catch (error) {
			console.error('Error fetching or processing leaderboard data:', error);
			await interaction.reply({
				content: `There was an error: \`${error.message}\``,
				ephemeral: true,
			});
		}
	},
};
