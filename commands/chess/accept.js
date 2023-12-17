/** @format */

const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');

const { Chess } = require('chess.js');
const { displayBoard } = require('./board.js'); // Import the displayBoard function

const pool = require('../../handlers/data/pool.js');

// Extracted function to handle the process of accepting a chess challenge
async function acceptChessChallenge(interaction, challengeId, challenger) {
	try {
		// Fetch the challenge from the database
		const [challenges] = await pool.query(
			'SELECT * FROM challenges WHERE id = ?',
			[challengeId]
		);

		if (challenges.length > 0) {
			const matchedChallenge = challenges[0];

			if (matchedChallenge.opponentType === 'ai') {
				const aiChallengeEmbed = {
					color: ERROR_Color,
					description: 'You cannot accept an AI challenge.',
				};

				await interaction.reply({
					embeds: [aiChallengeEmbed],
					ephemeral: true,
				});
				return;
			}

			if (interaction.user.id == challenger) {
				const selfChallengeEmbed = {
					color: ERROR_Color,
					description: 'You cannot accept your own challenge.',
				};
				await interaction.reply({
					embeds: [selfChallengeEmbed],
					ephemeral: true,
				});
				return;
			}

			if (matchedChallenge.status === 'Accepted') {
				const alreadyAcceptedEmbed = {
					color: ERROR_Color,
					description: 'This challenge has already been accepted.',
				};

				await interaction.reply({
					embeds: [alreadyAcceptedEmbed],
					ephemeral: true,
				});
				return;
			}

			// Update the challenge status to 'Accepted' in the database
			await pool.query('UPDATE challenges SET status = ? WHERE id = ?', [
				'Accepted',
				challengeId,
			]);

			const chess = new Chess();
			const fen = chess.fen();

			// Update the challenge FEN in the database
			await pool.query('UPDATE challenges SET fen = ? WHERE id = ?', [
				fen,
				challengeId,
			]);

			const embed = {
				color: SUCCESS_Color,
				title: 'Challenge Accepted',
				description: 'You have successfully accepted the challenge.',
				fields: [
					{
						name: 'Challenger',
						value: `<@${matchedChallenge.challenger}>`,
						inline: true,
					},
					{
						name: 'Challenged Player',
						value: `<@${matchedChallenge.challenged}>`,
						inline: true,
					},
				],
				footer: { text: `Challenge ID: ${challengeId}` },
			};

			await interaction.reply({ embeds: [embed], ephemeral: true });

			await displayBoard(interaction, challengeId); // Updated: Call displayBoard with await
		} else {
			const noMatchEmbed = {
				color: ERROR_Color,
				description: 'No matching challenge found for the given ID or user.',
			};

			await interaction.reply({ embeds: [noMatchEmbed], ephemeral: true });
		}
	} catch (error) {
		const errorEmbed = {
			color: ERROR_Color,
			description: 'An error occurred while processing the challenges.',
		};
		await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
		console.error(
			'Error occurred while reading or processing challenges:',
			error
		);
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('accept')
		.setDescription('Accept a chess challenge')
		.addStringOption((option) =>
			option
				.setName('challenge_id')
				.setDescription('The ID of the challenge you want to accept')
				.setRequired(true)
		),

	async execute(interaction) {
		const challengeId = interaction.options.getString('challenge_id');
		const challenger = interaction.user.id;

		await acceptChessChallenge(interaction, challengeId, challenger);
	},
	acceptChessChallenge, // Export the acceptChessChallenge function
};
