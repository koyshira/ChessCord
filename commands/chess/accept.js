/** @format */

const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');
const { displayBoard } = require('./board.js');
const pool = require('../../handlers/data/pool.js');

async function isValidChallenge(challengeId, challenger, interaction) {
	try {
		const [challenges] = await pool.query(
			'SELECT * FROM challenges WHERE id = ?',
			[challengeId]
		);

		if (challenges.length === 0) {
			const noMatchEmbed = {
				color: ERROR_Color,
				description: 'No matching challenge found for the given ID or user.',
			};
			await interaction.followUp({ embeds: [noMatchEmbed], ephemeral: true });
			return false;
		}

		const matchedChallenge = challenges[0];

		if (matchedChallenge.opponentType === 'ai') {
			const aiChallengeEmbed = {
				color: ERROR_Color,
				description: 'You cannot accept an AI challenge.',
			};
			await interaction.followUp({
				embeds: [aiChallengeEmbed],
				ephemeral: true,
			});
			return false;
		}

		if (interaction.user.id == challenger) {
			const selfChallengeEmbed = {
				color: ERROR_Color,
				description: 'You cannot accept your own challenge.',
			};
			await interaction.followUp({
				embeds: [selfChallengeEmbed],
				ephemeral: true,
			});
			return false;
		}

		if (matchedChallenge.status === 'Accepted') {
			const alreadyAcceptedEmbed = {
				color: ERROR_Color,
				description: 'This challenge has already been accepted.',
			};
			await interaction.followUp({
				embeds: [alreadyAcceptedEmbed],
				ephemeral: true,
			});
			return false;
		}

		return true;
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
		return false;
	}
}

async function updateChallengeStatus(challengeId) {
	await pool.query('UPDATE challenges SET status = ? WHERE id = ?', [
		'Accepted',
		challengeId,
	]);
}

async function updateChallengeFEN(challengeId) {
	const chess = new Chess();
	const fen = chess.fen();
	await pool.query('UPDATE challenges SET fen = ? WHERE id = ?', [
		fen,
		challengeId,
	]);
}

async function acceptChessChallenge(interaction, challengeId, challenger) {
	if (!interaction.replied && !interaction.deferred) {
		await interaction.deferReply();
	}

	if (!(await isValidChallenge(challengeId, challenger, interaction))) {
		return;
	}

	try {
		await updateChallengeStatus(challengeId);
		await updateChallengeFEN(challengeId);

		await displayBoard(interaction, challengeId); // Updated: Call displayBoard with await
	} catch (error) {
		console.error('Error occurred while accepting the challenge:', error);
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
