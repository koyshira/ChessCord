/** @format */

const { SlashCommandBuilder } = require('discord.js');
const {
	ERROR_Color,
	SUCCESS_Color,
	INFO_Color,
} = require('../../data/config.json');

const pool = require('../../handlers/data/pool.js');
const { displayBoard } = require('./board.js');

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
		footer: { text: `Challenge ID: ${challengeID}` },
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

// Function to handle AI challenges
async function handleAiChallenge(interaction, challengeID) {
	saveChallenge({
		id: challengeID,
		challenger: interaction.client.user.id,
		challenged: interaction.user.id,
		lastPlayer: interaction.client.user.id,
		status: 'AIGame',
		opponentType: 'ai',
	});

	displayBoard(interaction, challengeID, interaction.user.id);
}

// Function to handle player challenges
async function handlePlayerChallenge(interaction, challengedUser, challengeID) {
	const embedData = generateChallengeEmbed(
		interaction,
		challengedUser,
		challengeID,
		SUCCESS_Color
	);

	const challengerUser = await interaction.user.id;
	const buttonRow = createButtonRow(
		challengeID,
		challengerUser,
		challengedUser
	);

	let challenger = challengedUser
		? interaction.user.id
		: interaction.client.user.id;
	let challenged = challengedUser ? challengedUser.id : interaction.user.id;

	saveChallenge({
		id: challengeID,
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
			pendingChallenges[challengeID] = {
				message: sent,
				timeout: setTimeout(async () => {
					if (pendingChallenges[challengeID]) {
						delete pendingChallenges[challengeID];
						updateChallengeStatus(challengeID, 'Expired');

						const expirationEmbed = {
							color: ERROR_Color,
							description: `The challenge (ID: ${challengeID}) has expired. The invitation is no longer valid.`,
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
									delete pendingChallenges[challengeID];
									updateChallengeStatus(challengeID, 'Expired');
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

// Function to shuffle a string
function shuffleString(str) {
	const array = str.split('');
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array.join('');
}

// Function to generate a short and unique ID
function generateUniqueID(username) {
	const shuffledUsername = shuffleString(username);
	const randomNumbers = Math.floor(Math.random() * 100);

	// Combine the shuffled username and random numbers
	const uniqueID = `${shuffledUsername.substr(
		0,
		5
	)}-${randomNumbers}-${shuffledUsername.substr(5, 5)}`;

	return uniqueID;
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

function opponentCheck(interaction, challengedUser, opponentType, challengeID) {
	if (opponentType === 'ai') {
		return handleAiChallenge(interaction, challengeID);
	}

	if (opponentType === 'player') {
		return handlePlayerChallenge(interaction, challengedUser, challengeID);
	}

	if (challengedUser && challengedUser.id === interaction.user.id) {
		return handleSelfChallenge(interaction);
	}

	if (challengedUser.bot) {
		return handleBotChallenge(interaction);
	}
}

// Export the necessary functions
module.exports = {
	data: new SlashCommandBuilder()
		.setName('challenge')
		.setDescription(
			'Challenge a player to a game of chess (or the AI if no player is specified)'
		)
		.addUserOption((option) =>
			option
				.setName('player')
				.setDescription('The player you want to challenge')
		),

	async execute(interaction) {
		const challengedUser = interaction.options.getUser('player');
		const opponentType = challengedUser ? 'player' : 'ai';

		const username = interaction.user.username;
		const challengeID = generateUniqueID(username);

		opponentCheck(interaction, challengedUser, opponentType, challengeID);
	},
};
