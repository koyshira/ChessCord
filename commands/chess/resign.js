/** @format */

const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCES_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');

const pool = require('../../handlers/data/pool.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('resign')
		.setDescription('Resign from a game of chess')
		.addStringOption((option) =>
			option
				.setName('challenge_id')
				.setDescription('The ID of the challenge you want to resign from')
				.setRequired(true)
		),
	async execute(interaction) {
		const challengeId = interaction.options.getString('challenge_id');

		try {
			const [rows] = await pool.execute(
				'SELECT * FROM challenges WHERE id = ?',
				[challengeId]
			);

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

			if (chess.isGameOver()) {
				const gameOverEmbed = {
					color: ERROR_Color,
					description: 'The game is already over.',
				};
				return interaction.reply({ embeds: [gameOverEmbed], ephemeral: true });
			}

			if (chess.inCheck()) {
				const inCheckEmbed = {
					color: ERROR_Color,
					description: 'You cannot resign while in check.',
				};
				return interaction.reply({ embeds: [inCheckEmbed], ephemeral: true });
			}

			await pool.execute('UPDATE challenges SET status = ? WHERE id = ?', [
				'Resigned',
				challengeId,
			]);

			const resignedEmbed = {
				color: SUCCES_Color,
				description: 'You have resigned from the game.',
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
	},
};
