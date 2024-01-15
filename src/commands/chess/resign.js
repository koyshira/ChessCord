/** @format */

// Import necessary modules and dependencies;
const { Chess } = require('chess.js');
const axios = require('axios');
const qs = require('qs');

const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');
const pool = require('../../handlers/data/pool.js');
const { calculateElo } = require('../../handlers/calculateElo.js');
const { DecryptToken } = require('../../handlers/data/encryption.js');

// Function to reject a chess challenge
async function resignChessChallenge(interaction, challengeId) {
	try {
		// Fetch challenge from the database
		const [rows] = await pool.execute('SELECT * FROM challenges WHERE id = ?', [
			challengeId,
		]);

		// If challenge not found, send an error message
		if (rows.length === 0) {
			const challengeNotFoundEmbed = {
				color: ERROR_Color,
				description:
					'Challenge not found. Please make sure to provide the correct challenge ID.',
			};
			return interaction.reply({
				embeds: [challengeNotFoundEmbed],
				ephemeral: true,
			});
		}

		const challenge = rows[0];
		const chess = new Chess(challenge.fen);

		if (challenge.status === 'Resigned') {
			const alreadyResignedEmbed = {
				color: ERROR_Color,
				description: 'This game has already been resigned.',
			};
			return interaction.reply({
				embeds: [alreadyResignedEmbed],
				ephemeral: true,
			});
		}

		// Check if it's the player's turn
		if (challenge.lastPlayer === interaction.user.id) {
			const notYourTurnEmbed = {
				color: ERROR_Color,
				description: 'It is not your turn.',
			};
			return interaction.reply({
				embeds: [notYourTurnEmbed],
				ephemeral: true,
			});
		}

		// Check if the game is already over
		if (chess.isGameOver()) {
			const gameOverEmbed = {
				color: ERROR_Color,
				description: 'The game is already over.',
			};
			return interaction.reply({ embeds: [gameOverEmbed], ephemeral: true });
		}

		// Check if the player is in check
		if (chess.inCheck()) {
			const inCheckEmbed = {
				color: ERROR_Color,
				description: 'You cannot resign while in check.',
			};
			return interaction.reply({ embeds: [inCheckEmbed], ephemeral: true });
		}

		const [challenges] = await pool.query(
			'SELECT * FROM challenges WHERE id = ?',
			[challengeId]
		);

		// Update the status of the challenge to Rejected
		const challengerToken = await DecryptToken(challenges[0].challenger);
		const challengedToken = await DecryptToken(challenges[0].challenged);

		const params = qs.stringify({
			opponentToken: challengerToken,
		});

		axios.post(
			`https://lichess.org/api/challenge/${challengeId}/cancel?${params}`,
			null,
			{
				headers: {
					Authorization: `Bearer ${challengedToken}`,
				},
			}
		);

		// Update the challenge status to 'Resigned'
		await pool.execute('UPDATE challenges SET status = ? WHERE id = ?', [
			'Resigned',
			challengeId,
		]);

		let winner, winnerElo, loser, loserElo;
		let winnerDiff, loserDiff;

		// Calculate the new elo
		try {
			const eloResult = await calculateElo(
				challenge.challenger,
				challenge.challenged,
				'end-resign',
				challenge.lastPlayer
			);

			if (Array.isArray(eloResult) && eloResult.length === 6) {
				const [
					winnerOldElo,
					winnerNewElo,
					winnerPlayer,
					loserOldElo,
					loserNewElo,
					loserPlayer,
				] = eloResult;

				winnerDiff = (
					parseFloat(winnerNewElo) - parseFloat(winnerOldElo)
				).toFixed(3);
				loserDiff = (parseFloat(loserNewElo) - parseFloat(loserOldElo)).toFixed(
					3
				);

				winner = winnerPlayer;
				winnerElo = parseInt(winnerNewElo);
				loser = loserPlayer;
				loserElo = parseInt(loserNewElo);
			} else {
				throw new Error('Invalid Elo result structure');
			}
		} catch (error) {
			console.error(`Error processing Elo ratings: ${error.message}`);
		}

		const resignedEmbed = {
			color: SUCCESS_Color,
			description: 'Resigned successfully.',
			fields: [
				{
					name: 'Resigned by',
					value: `<@${interaction.user.id}>`,
					inline: true,
				},
				{
					name: '',
					value: '\u200b',
					inline: true,
				},
				{
					name: 'Winner',
					value: `<@${winner}>`,
					inline: true,
				},
				{
					name: 'New Elo Ratings',
					value: `<@${winner}>: ${winnerElo} (Diff: ${winnerDiff})\n<@${loser}>: ${loserElo} (Diff: ${loserDiff})`,
					inline: false,
				},
			],
			footer: {
				text: 'Check the leaderboard, maybe you are on it.',
			},
		};
		return interaction.reply({ embeds: [resignedEmbed] });
	} catch (error) {
		console.error('Error occurred while processing the resignation:', error);

		const errorEmbed = {
			color: ERROR_Color,
			description: 'An error occurred while processing the resignation.',
		};
		return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}
}

// Export the slash command and the function
module.exports = {
	data: {
		name: 'resign',
		description: 'Resign from a game of chess',
		options: [
			{
				name: 'challenge_id',
				description: 'The ID of the challenge you want to resign from',
				type: 3,
				required: true,
			},
		],
	},

	async execute(interaction) {
		const challengeId = interaction.options.getString('challenge_id');
		// Call the extracted function
		return resignChessChallenge(interaction, challengeId);
	},
	resignChessChallenge, // Export the function for external use if needed
};
