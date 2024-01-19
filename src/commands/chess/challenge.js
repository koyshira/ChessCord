/** @format */

const axios = require('axios');
const qs = require('qs');

const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');
const { displayBoard } = require('./board.js');
const {
	DecryptToken,
	getLinkedUser,
} = require('../../handlers/data/encryption.js');
const pool = require('../../handlers/data/pool.js');
const path = require('path');

const CHALLENGE_EXPIRATION_TIME = 20 * 1000;
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

let params;

const rankedParams = {
	rated: true,
	'clock.limit': 10800,
	'clock.increment': 60,
	color: 'black',
	variant: 'standard',
};

const unrankedParams = {
	rated: false,
	color: 'white',
	days: 14,
	variant: 'standard',
};

// Function to handle AI challenges
async function handleAiChallenge(interaction, params) {
	const challengerToken = await DecryptToken(interaction.user.id);

	if (!challengerToken) return;

	const botName = `Yansaito`;

	let AIGameData;

	try {
		AIGameData = await axios.post(
			`https://lichess.org/api/challenge/${botName}`,
			params,
			{
				headers: {
					Authorization: `Bearer ${challengerToken}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		);

		await axios.post(
			`https://lichess.org/api/challenge/${AIGameData.data.challenge.id}/accept`,
			null,
			{
				headers: {
					Authorization: `Bearer ${process.env.LICHESS_BOT_TOKEN}`,
				},
			}
		);

		// Get a random message from array
		const chatMessages = [
			'Greetings! Let the chess battle begin!',
			'Hello there! Ready to test your chess skills?',
			'Greetings, challenger! May the best strategist win!',
			"Hi! I hope you're ready for an exciting game of chess!",
			"Salutations! Let's make this chess match a memorable one!",
			'Hello, fellow chess enthusiast! May our game be filled with interesting moves!',
			'Greetings, opponent! Wishing you a challenging and enjoyable match!',
			"Hey! Chessboard is set, and the pieces are ready to dance. Let's do this!",
			'Hello! Brace yourself for an epic clash of minds on the chessboard!',
			'Greetings, worthy adversary! Prepare for a battle of wits in the world of chess!',
			'Hello, challenger! May the best strategist win!',
		];

		const randomMessage =
			chatMessages[Math.floor(Math.random() * chatMessages.length)];

		await axios.post(
			`https://lichess.org/api/bot/game/${AIGameData.data.challenge.id}/chat`,
			{
				room: 'player',
				text: randomMessage,
			},
			{
				headers: {
					Authorization: `Bearer ${process.env.LICHESS_BOT_TOKEN}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		);

		await axios.post(
			`https://lichess.org/api/challenge/${AIGameData.data.challenge.id}/start-clocks?token1=${challengerToken}&token2=${process.env.LICHESS_BOT_TOKEN}`,
			null,
			{
				headers: {
					Authorization: `Bearer ${process.env.LICHESS_BOT_TOKEN}`,
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
async function handlePlayerChallenge(
	interaction,
	challengedUser,
	params = unrankedParams
) {
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

	const challengerToken = await DecryptToken(interaction.user.id);

	let playerChallengeData;

	try {
		playerChallengeData = await axios.post(
			`https://lichess.org/api/challenge/${challengedData.lichess_username}`,
			params,
			{
				headers: {
					Authorization: `Bearer ${challengerToken}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		);
	} catch (error) {
		console.error('Error creating player challenge:', error);
	}

	if (playerChallengeData) {
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
			.reply({
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

							const challengerToken = await DecryptToken(interaction.user.id);

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
										'Challenge expired, user took longer than 20 seconds to respond.',
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
	} else {
		const filename = 'privacysettings.png';
		const filepath = path.join(__dirname, filename);

		const attachment = {
			attachment: filepath,
			name: filename,
		};

		const doesNotAcceptChallengesEmbed = {
			color: ERROR_Color,
			description: `You don't accept challenges from anyone, due to your account settings.\nChage your account settings here: https://lichess.org/account/preferences/privacy`,
			image: { url: `attachment://${attachment.name}` },
		};

		return interaction.reply({
			content: `Hey, <@${challengedUser.id}>`,
			files: [attachment],
			embeds: [doesNotAcceptChallengesEmbed],
		});
	}
}

// Function to handle self challenges
async function handleSelfChallenge(interaction) {
	const selfChallengeEmbed = {
		color: ERROR_Color,
		description: 'You cannot challenge yourself.',
	};

	return interaction.reply({
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

	return interaction.reply({
		embeds: [botChallengeEmbed],
		ephemeral: true,
	});
}

// Function to save challenge to the database
async function saveChallenge(challengeData) {
	const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

function opponentCheck(
	interaction,
	challengedUser,
	opponentType = unrankedParams
) {
	if (opponentType === 'ai') {
		return handleAiChallenge(interaction, params);
	}

	if (challengedUser.id === interaction.user.id) {
		return handleSelfChallenge(interaction);
	}

	if (challengedUser.bot) {
		return handleBotChallenge(interaction);
	}

	if (opponentType === 'player') {
		return handlePlayerChallenge(interaction, challengedUser, params);
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

	let challengedData;

	if (challengedUser !== null) {
		[challengedData] = await getLinkedUser(challengedUser.id);

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
					description: "Your linked Lichess account doesn't exist anymore.",
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
				required: false,
			},
			{
				name: 'ranked',
				description: 'Whether the game should be ranked or not',
				type: 5, // 5 corresponds to BOOLEAN type
				required: false,
			},
		],
	},

	async execute(interaction) {
		const challengedUser = interaction.options.getUser('player');
		if (interaction.options.getBoolean('ranked') === true) {
			params = rankedParams;
		} else {
			params = unrankedParams;
		}

		checkLichessData(interaction, interaction.user.id, challengedUser);

		const opponentType = challengedUser ? 'player' : 'ai';

		opponentCheck(interaction, challengedUser, opponentType, params);
	},
	opponentCheck,
};
