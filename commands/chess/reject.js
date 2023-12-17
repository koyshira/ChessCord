/** @format */

const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');

const pool = require('../../handlers/data/pool.js');

async function rejectChessChallenge(interaction, challengeId, challenged) {
	try {
		const connection = await pool.getConnection();

		const [challengesRows] = await connection.execute(
			'SELECT * FROM challenges WHERE id = ?',
			[challengeId]
		);
		const challenge = challengesRows[0];

		if (!challenge) {
			const noMatchEmbed = {
				color: ERROR_Color,
				description: 'No matching challenge found for the given ID or user.',
			};

			await interaction.reply({ embeds: [noMatchEmbed], ephemeral: true });
			return;
		}

		if (challenge.opponentType === 'ai') {
			const aiChallengeEmbed = {
				color: ERROR_Color,
				description: 'You cannot reject an AI challenge.',
			};

			await interaction.reply({ embeds: [aiChallengeEmbed], ephemeral: true });
			return;
		}

		if (interaction.user.id !== challenged) {
			const selfChallengeEmbed = {
				color: ERROR_Color,
				description: 'You cannot reject your own challenge.',
			};

			await interaction.reply({
				embeds: [selfChallengeEmbed],
				ephemeral: true,
			});
			return;
		}

		if (challenge.status === 'Rejected') {
			const alreadyRejectedEmbed = {
				color: ERROR_Color,
				description: 'This challenge has already been rejected.',
			};

			await interaction.reply({
				embeds: [alreadyRejectedEmbed],
				ephemeral: true,
			});
			return;
		}

		await connection.execute('UPDATE challenges SET status = ? WHERE id = ?', [
			'Rejected',
			challengeId,
		]);

		connection.release();

		const embed = {
			color: SUCCESS_Color,
			title: 'Challenge Rejected',
			description: 'You have rejected the challenge.',
			fields: [
				{
					name: 'Challenger',
					value: `<@${challenge.challenger}>`,
					inline: true,
				},
				{
					name: 'Challenged Player',
					value: `<@${challenge.challenged}>`,
					inline: true,
				},
			],
			footer: { text: `Challenge ID: ${challengeId}` },
		};

		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		const errorEmbed = {
			color: ERROR_Color,
			description: 'An error occurred while processing the challenges.',
		};

		await interaction.deferReply({ ephemeral: true });
		await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
		console.error(
			'Error occurred while reading or processing challenges:',
			error
		);
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reject')
		.setDescription('Reject a chess challenge')
		.addStringOption((option) =>
			option
				.setName('challenge_id')
				.setDescription('The ID of the challenge you want to reject')
				.setRequired(true)
		),

	async execute(interaction) {
		const challengeId = interaction.options.getString('challenge_id');
		const challenger = interaction.user.id;

		await rejectChessChallenge(interaction, challengeId, challenger);
	},

	rejectChessChallenge,
};
