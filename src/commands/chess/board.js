/** @format */

const { ERROR_Color, INFO_Color } = require('../../data/config.json');
const pool = require('../../handlers/data/pool.js');
const FTI = require('fen-to-image');
const path = require('path');

async function getChallengeFromDatabase(challengeId) {
	// Introduce a delay before the query (e.g., 1000 milliseconds or 1 second)
	await new Promise((resolve) => setTimeout(resolve, 1000));

	try {
		const [challenges] = await pool.query(
			'SELECT * FROM challenges WHERE id = ? LIMIT 1',
			[challengeId]
		);

		if (challenges.length > 0) {
			return challenges[0];
		} else {
			return 'No matching challenge found.';
		}
	} catch (error) {
		console.error('Error fetching challenge from database:', error);
		throw error;
	}
}

function determinePieceColor(challenge) {
	return challenge.lastPlayer === challenge.challenger ? 'white' : 'black';
}

function determineLastMove(challenge) {
	return challenge.lastMove === null ? false : challenge.lastMove;
}

let filename = 'board.png';
let filepath = path.join(__dirname, filename);

async function generateChessBoard(fen, pieceColor, lastMove) {
	try {
		await FTI({
			fen,
			color: pieceColor,
			whiteCheck: false,
			blackCheck: false,
			lastMove,
			dirsave: filepath,
		});
	} catch (err) {
		// console.error('Error occurred while generating the chess board:', err); // This is a known issue, but it doesn't affect functionality
		filepath = `https://chessboardimage.com/${fen}-${lastMove}.png`;
		filename = 'fallback-board.png';
	}
}

function createBoardEmbed(
	interaction,
	challengeId,
	matchedChallenge,
	attachment
) {
	const isAiGame = matchedChallenge.opponentType === 'ai';
	const boardEmbed = {
		color: INFO_Color,
		title: 'Chess Board',
		image: { url: `attachment://${attachment.name}` },
		fields: [],
		footer: { text: `Challenge ID: ${challengeId}` },
	};

	if (isAiGame) {
		boardEmbed.fields.push(
			{
				name: 'AI (Black)',
				value: `<@${interaction.client.user.id}>`,
				inline: true,
			},
			{
				name: 'Player (White)',
				value: `<@${interaction.user.id}>`,
				inline: true,
			}
		);
	} else {
		boardEmbed.fields.push(
			{
				name: 'Challenger (Black)',
				value: `<@${matchedChallenge.challenger}>`,
				inline: true,
			},
			{
				name: 'Challenged Player (White)',
				value: `<@${matchedChallenge.challenged}>`,
				inline: true,
			}
		);
	}

	return boardEmbed;
}

async function handleNoMatchFound(interaction) {
	const noMatchEmbed = {
		color: ERROR_Color,
		description: 'No matching challenge found for the given ID.',
	};
	interaction.followUp({ embeds: [noMatchEmbed], ephemeral: true });
}

async function displayBoard(interaction, challengeId) {
	if (!interaction.replied && !interaction.deferred) {
		await interaction.deferReply();
	}

	try {
		const matchedChallenge = await getChallengeFromDatabase(challengeId);

		if (!matchedChallenge) {
			return handleNoMatchFound(interaction);
		}

		const pieceColor = determinePieceColor(matchedChallenge);
		const lastMove = determineLastMove(matchedChallenge);

		await generateChessBoard(matchedChallenge.fen, pieceColor, lastMove);

		const attachment = {
			attachment: filepath,
			name: filename,
		};

		const boardEmbed = createBoardEmbed(
			interaction,
			challengeId,
			matchedChallenge,
			attachment
		);

		const buttonRow = {
			type: 1,
			components: [
				{
					type: 2,
					style: 1,
					label: 'Make Move',
					custom_id: `move:${challengeId}`,
				},
				{
					type: 2,
					style: 4,
					label: 'Resign',
					custom_id: `resign:${challengeId}`,
				},
			],
		};

		await interaction.followUp({
			embeds: [boardEmbed],
			files: [attachment],
			components: [buttonRow],
		});
	} catch (error) {
		console.error('Error occurred while processing the chess board:', error);
	}
}

module.exports = {
	data: {
		name: 'board',
		description: 'View the board of a game of chess',
		options: [
			{
				name: 'challenge_id',
				description: 'The ID of the challenge you want to view the board of',
				type: 3,
				required: true,
			},
		],
	},

	async execute(interaction) {
		const challengeId = interaction.options.getString('challenge_id');

		try {
			await displayBoard(interaction, challengeId);
		} catch (error) {
			console.error('Error occurred during command execution:', error);
			const errorEmbed = {
				color: ERROR_Color,
				description: 'An unexpected error occurred.',
			};
			interaction.deferReply({ ephemeral: true });
			return interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
		}
	},
	displayBoard,
};
