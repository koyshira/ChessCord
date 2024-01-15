/** @format */

const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');

const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');
const { displayBoard } = require('./board.js');
const pool = require('../../handlers/data/pool.js');

const CHALLENGE_EXPIRATION_TIME = 5 * 60 * 1000;
let pendingChallenges = {};

// Function to generate a challenge embed
function generateChallengeEmbed(
	interaction,
	challengedUser,
	challengeID,
	color
) {
	const fields = [
		{
			name: 'Challenger (Black)',
			value: `<@${interaction.user.id}>`,
			inline: true,
		},
		{
			name: 'Challenged Player (White)',
			value: challengedUser ? `<@${challengedUser.id}>` : 'AI',
			inline: true,
		},
	];

	return {
		color: color,
		title: 'Chess Challenge',
		description: `You have been challenged to a game of chess by <@${interaction.user.id}>`,
		fields: fields,
		footer: { text: `Challenge: https://lichess.org/${challengeID}` },
	};
}

// Function to create a button row
function createButtonRow(challengeID, challengerUser, challengedUser) {
	return {
		type: 1,
		components: [
			{
				type: 2,
				style: 3,
				label: 'Accept',
				custom_id: `accept:${challengeID}:${challengerUser}`,
			},
			{
				type: 2,
				style: 4,
				label: 'Reject',
				custom_id: `reject:${challengeID}:${
					challengedUser ? challengedUser.id : 'ai'
				}`,
			},
		],
	};
}

async function getLinkedUser(id) {
	const [data] = await pool.query('SELECT * FROM linked_users WHERE id = ?', [
		id,
	]);

	if (!data) {
		return [];
	}

	return data;
}

async function DecryptChallengerToken(interaction) {
	const [challengerData] = await getLinkedUser(interaction.user.id);

	const ivBuffer = Buffer.from(process.env.ENCRYPTION_IV, 'hex');
	const decipher = crypto.createDecipheriv(
		'aes-256-cbc',
		Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
		ivBuffer
	);

	let decrypted = decipher.update(challengerData.lichess_token, 'hex', 'utf8');

	decrypted += decipher.final('utf8');

	return decrypted;
}

const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// TODO: Add a way to change the settings
const params = qs.stringify({
	rated: true,
	color: 'black',
	variant: 'standard',
	fen: defaultFen,
	keepAliveStream: true,
	rules: 'noGiveTime,noClaimWin,noEarlyDraw',
});

// Function to handle AI challenges
async function handleAiChallenge(interaction) {
	// Fake AI challenge through bot account and not /challenge/ai endpoint because, I'm too lazy to rewrite the code I already have :kek:
	// TODO: Rewrite the code to use the /challenge/ai endpoint

	const [challengerData] = await getLinkedUser(interaction.user.id);

	const challengerToken = await DecryptChallengerToken(interaction);

	let AIGameData;

	try {
		AIGameData = await axios.post(
			`https://lichess.org/api/challenge/${challengerData.lichess_username}?${params}`,
			null,
			{
				headers: {
					Authorization: `Bearer ${process.env.LICHESS_BOT_TOKEN}`,
				},
			}
		);

		// First make the challenge and then immediately accept it, I know it's stupid
		await axios.post(
			`https://lichess.org/api/challenge/${AIGameData.data.challenge.id}/accept`,
			null,
			{
				headers: {
					Authorization: `Bearer ${challengerToken}`,
				},
			}
		);
	} catch (error) {
		console.error('Error creating AI challenge:', error);
	}

	saveChallenge({
		id: AIGameData.data.challenge.id,
		challenger: interaction.client.user.id,
		challenged: interaction.user.id,
		lastPlayer: interaction.client.user.id,
		status: 'AIGame',
		opponentType: 'ai',
	});

	displayBoard(interaction, AIGameData.data.challenge.id, interaction.user.id);
}

// Function to handle player challenges
async function handlePlayerChallenge(interaction, challengedUser) {
	const [challengedData] = await getLinkedUser(
		interaction.options.getUser('player').id
	);

	if (!challengedData) {
		return interaction.reply({
			content: `Hey, <@${challengedUser.id}>`,
			embeds: [
				{
					color: ERROR_Color,
					description:
						'The challenged user has not linked their Lichess account yet. Please ask them to use the `/link` command to link their Lichess account.',
				},
			],
		});
	}

	const challengerToken = await DecryptChallengerToken(interaction);

	let playerChallengeData;

	try {
		playerChallengeData = await axios.post(
			`https://lichess.org/api/challenge/${challengedData.lichess_username}?${params}`,
			null,
			{
				headers: {
					Authorization: `Bearer ${challengerToken}`,
				},
			}
		);
	} catch (error) {
		console.error('Error creating player challenge:', error);
	}

	console.log(playerChallengeData.data.challenge.id);

	const embedData = generateChallengeEmbed(
		interaction,
		challengedUser,
		playerChallengeData.data.challenge.id,
		SUCCESS_Color
	);

	const challengerUser = await interaction.user.id;
	const buttonRow = createButtonRow(
		playerChallengeData.data.challenge.id,
		challengerUser,
		challengedUser
	);

	let challenger = challengedUser
		? interaction.user.id
		: interaction.client.user.id;
	let challenged = challengedUser ? challengedUser.id : interaction.user.id;

	saveChallenge({
		id: playerChallengeData.data.challenge.id,
		challenger: challenger,
		challenged: challenged,
		lastPlayer: challenger,
		status: 'Pending',
		opponentType: 'player',
	});

	await interaction
		.followUp({
			content: `Hey, ${
				challengedUser ? `<@${challengedUser.id}>` : 'AI'
			}\nAre you up for a game of chess?, the invitation will expire <t:${Math.round(
				(Date.now() + CHALLENGE_EXPIRATION_TIME) / 1000
			)}:R>.`,
			embeds: [embedData],
			components: [buttonRow],
		})
		.then((sent) => {
			// Storing message ID in the pendingChallenges object
			pendingChallenges[playerChallengeData.data.challenge.id] = {
				message: sent,
				timeout: setTimeout(async () => {
					if (pendingChallenges[playerChallengeData.data.challenge.id]) {
						delete pendingChallenges[playerChallengeData.data.challenge.id];
						updateChallengeStatus(
							playerChallengeData.data.challenge.id,
							'Expired'
						);

						const challengerToken = await DecryptChallengerToken(interaction);

						axios.post(
							`https://lichess.org/api/challenge/${playerChallengeData.data.challenge.id}/cancel`,
							null,
							{
								headers: {
									Authorization: `Bearer ${challengerToken}`,
								},
							}
						);

						const expirationEmbed = {
							color: ERROR_Color,
							description: `The challenge (ID: ${playerChallengeData.data.challenge.id}) has expired. The invitation is no longer valid.`,
						};

						// Edit the original message when it expires
						sent
							.edit({
								content:
									'Challenge expired, user took longer than 5 minutes to respond.',
								embeds: [expirationEmbed],
								components: [],
							})
							.catch((error) => {
								if (error.code === 10008) {
									console.error(
										'Message not found, it might have been deleted.'
									);
								} else {
									console.error('Error editing message:', error);
								}
							});
					}
				}, CHALLENGE_EXPIRATION_TIME),
			};
		});
}

// Function to handle self challenges
async function handleSelfChallenge(interaction) {
	const selfChallengeEmbed = {
		color: ERROR_Color,
		description: 'You cannot challenge yourself.',
	};

	return interaction.followUp({
		embeds: [selfChallengeEmbed],
		ephemeral: true,
	});
}

// Function to handle bot challenges
async function handleBotChallenge(interaction) {
	const botChallengeEmbed = {
		color: ERROR_Color,
		description:
			'You cannot challenge a bot. If you want to play against the AI, use the `/challenge` command without a user mention.',
	};

	return interaction.followUp({
		embeds: [botChallengeEmbed],
		ephemeral: true,
	});
}

// Function to save challenge to the database
async function saveChallenge(challengeData) {
	challengeData.fen = defaultFen;
	challengeData.dateTime = new Date().toISOString();

	try {
		const query = 'INSERT INTO challenges SET ?';
		await pool.query(query, challengeData);
	} catch (error) {
		console.error('Error saving challenge to the database:', error);
	}
}

// Function to update challenge status in the database
async function updateChallengeStatus(challengeID, newStatus) {
	try {
		const query = 'UPDATE challenges SET status = ? WHERE id = ?';
		await pool.query(query, [newStatus, challengeID]);
	} catch (error) {
		console.error('Error updating challenge status in the database:', error);
	}
}

function opponentCheck(interaction, challengedUser, opponentType) {
	if (opponentType === 'ai') {
		return handleAiChallenge(interaction);
	}

	if (challengedUser.id === interaction.user.id) {
		return handleSelfChallenge(interaction);
	}

	if (challengedUser.bot) {
		return handleBotChallenge(interaction);
	}

	if (opponentType === 'player') {
		return handlePlayerChallenge(interaction, challengedUser);
	}
}

async function checkLichessData(
	interaction,
	challengerUserID,
	challengedUser = null
) {
	const [challengerData] = await getLinkedUser(challengerUserID);

	if (!challengerData || challengerData <= 0) {
		const noDataEmbed = {
			color: ERROR_Color,
			description:
				'You have not linked your Lichess account yet. Please use the `/link` command to link your Lichess account.',
		};

		return interaction.reply({ embeds: [noDataEmbed], ephemeral: true });
	}

	if (challengedUser !== null) {
		const [challengedData] = await getLinkedUser(challengedUser.id);

		if (!challengedData || challengedData.length <= 0) {
			const noChallengedDataEmbed = {
				color: ERROR_Color,
				description:
					'The challenged user has not linked their Lichess account yet. Please ask them to use the `/link` command to link their Lichess account.',
			};

			return interaction.reply({
				content: `Hey, <@${challengedUser.id}>`,
				embeds: [noChallengedDataEmbed],
				ephemeral: true,
			});
		}
	}

	try {
		const challengerResponse = await axios.get(
			`https://lichess.org/api/user/${challengerData.lichess_username}`
		);

		if (challengerResponse.data.id === 'undefined') {
			const noChallengerDataEmbed = {
				color: ERROR_Color,
				description: "Your linked Lichess account doesn't exist anymore.",
			};

			return interaction.reply({
				embeds: [noChallengerDataEmbed],
				ephemeral: true,
			});
		}

		if (challengedUser !== null) {
			const challengedResponse = await axios.get(
				`https://lichess.org/api/user/${challengedData.lichess_username}`
			);

			if (challengedResponse.data.id === 'undefined') {
				const noChallengedDataEmbed = {
					color: ERROR_Color,
					description:
						"The challenged user's linked Lichess account doesn't exist anymore.",
				};

				return interaction.reply({
					content: `Hey, <@${challengedUser.id}>`,
					embeds: [noChallengedDataEmbed],
					ephemeral: true,
				});
			}
		}
	} catch (error) {
		console.error('Error fetching Lichess data:', error.message);
	}
}

// Export the necessary functions
module.exports = {
	data: {
		name: 'challenge',
		description:
			'Challenge a player to a game of chess (or the AI if no player is specified)',
		options: [
			{
				name: 'player',
				description: 'The player you want to challenge',
				type: 6, // 6 corresponds to USER type, as it represents a Discord user
				required: false, // Set to true if you want this option to be mandatory
			},
		],
	},

	async execute(interaction) {
		const challengedUser = interaction.options.getUser('player');

		checkLichessData(interaction, interaction.user.id, challengedUser);

		const opponentType = challengedUser ? 'player' : 'ai';

		opponentCheck(interaction, challengedUser, opponentType);
	},
	opponentCheck,
};
