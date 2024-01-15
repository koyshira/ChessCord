/** @format */

const axios = require('axios');

const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');
const { DecryptToken } = require('../../handlers/data/encryption.js');

const pool = require('../../handlers/data/pool.js');

const getChallengeById = async (connection, challengeId) => {
	const [challengesRows] = await connection.execute(
		'SELECT * FROM challenges WHERE id = ?',
		[challengeId]
	);
	return challengesRows[0];
};

const replyWithEmbed = async (interaction, embed) => {
	await interaction.reply({ embeds: [embed], ephemeral: true });
};

const logErrorAndReply = async (interaction, error) => {
	const errorEmbed = {
		color: ERROR_Color,
		description: 'An error occurred while processing the challenges.',
	};
	console.error(
		'Error occurred while reading or processing challenges:',
		error
	);
	await interaction.deferReply({ ephemeral: true });
	await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
};

const updateChallengeStatus = async (connection, challengeId) => {
	const [challenges] = await pool.query(
		'SELECT * FROM challenges WHERE id = ?',
		[challengeId]
	);

	// Update the status of the challenge to Rejected
	const challengedToken = await DecryptToken(challenges[0].challenged);

	axios.post(`https://lichess.org/api/challenge/${challengeId}/decline`, null, {
		headers: {
			Authorization: `Bearer ${challengedToken}`,
		},
	});

	await connection.execute('UPDATE challenges SET status = ? WHERE id = ?', [
		'Rejected',
		challengeId,
	]);
};

async function rejectChessChallenge(interaction, challengeId, challenged) {
	try {
		const connection = await pool.getConnection();
		const challenge = await getChallengeById(connection, challengeId);

		if (!challenge) {
			const noMatchEmbed = {
				color: ERROR_Color,
				description: 'No matching challenge found for the given ID or user.',
			};
			await replyWithEmbed(interaction, noMatchEmbed);
			return;
		}

		if (challenge.opponentType === 'ai') {
			const aiChallengeEmbed = {
				color: ERROR_Color,
				description: 'You cannot reject an AI challenge.',
			};
			await replyWithEmbed(interaction, aiChallengeEmbed);
			return;
		}

		if (interaction.user.id !== challenged) {
			const selfChallengeEmbed = {
				color: ERROR_Color,
				description: 'You cannot reject your own challenge.',
			};
			await replyWithEmbed(interaction, selfChallengeEmbed);
			return;
		}

		if (challenge.status === 'Rejected') {
			const alreadyRejectedEmbed = {
				color: ERROR_Color,
				description: 'This challenge has already been rejected.',
			};
			await replyWithEmbed(interaction, alreadyRejectedEmbed);
			return;
		}

		await updateChallengeStatus(connection, challengeId);
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
		await logErrorAndReply(interaction, error);
	}
}

module.exports = {
	data: {
		name: 'reject',
		description: 'Reject a chess challenge',
		options: [
			{
				name: 'challenge_id',
				description: 'The ID of the challenge you want to reject',
				type: 3,
				required: true,
			},
		],
	},

	async execute(interaction) {
		const challengeId = interaction.options.getString('challenge_id');
		const challenger = interaction.user.id;

		await rejectChessChallenge(interaction, challengeId, challenger);
	},

	rejectChessChallenge,
};
