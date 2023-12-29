/** @format */

const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');

const pool = require('../../handlers/data/pool.js');
const eloCalculator = require('../../handlers/calculateElo.js');
const { displayBoard } = require('./board.js');

const axios = require('axios');

let errorOccurred = false;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription('Make a move in a game of chess')
		.addStringOption((option) =>
			option
				.setName('challenge_id')
				.setDescription('The ID of the challenge you want to accept')
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName('piece')
				.setDescription(
					"The piece's current position on the board (e.g., a3, b1)"
				)
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName('move')
				.setDescription('The destination square for the move (e.g., a4, c6)')
				.setRequired(true)
		),

	async execute(interaction) {
		try {
			await makeMove(interaction);
		} catch (error) {
			console.error('Error:', error);
			const errorEmbed = {
				color: ERROR_Color,
				description: 'An error occurred while processing the move.',
			};
			return interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
		}
	},
	showMoveModal,
	makeMove,
};

async function showMoveModal(interaction, challengeId) {
	const modal = {
		title: 'Make Move',
		custom_id: `movemodal:${challengeId}`,
		components: [
			{
				type: 1, // ActionRow
				components: [
					{
						type: 4, // TextInput
						label: 'Piece',
						placeholder: 'a2',
						min_length: 2,
						max_length: 2,
						style: 1, // FULL_WIDTH
						custom_id: 'piece_input',
						required: true,
					},
				],
			},
			{
				type: 1, // ActionRow
				components: [
					{
						type: 4, // TextInput
						label: 'Move',
						placeholder: 'a4',
						min_length: 2,
						max_length: 2,
						style: 1, // FULL_WIDTH
						custom_id: 'move_input',
						required: true,
					},
				],
			},
		],
	};

	await interaction.showModal(modal);
}

async function makeMove(interaction, challengeId, piece, move) {
	if (!interaction.deffered && !interaction.replied) {
		await interaction.deferReply();
	}

	const { challenge, chess } = await getChallengeAndChessInstance(
		interaction,
		challengeId
	);

	let pieceAtPos;
	let movePos;

	if (piece === undefined && move === undefined) {
		pieceAtPos = interaction.options.getString('piece')?.toLowerCase();
		movePos = interaction.options.getString('move')?.toLowerCase();
	} else {
		pieceAtPos = piece;
		movePos = move;
	}

	checkTurnValidity(interaction, challenge);
	checkPieceOwnership(interaction, challenge, pieceAtPos);

	const moveValidation = validateMove(chess, pieceAtPos, movePos);
	if (moveValidation) {
		const invalidMoveEmbed = {
			color: ERROR_Color,
			description: moveValidation,
		};
		return interaction.reply({
			embeds: [invalidMoveEmbed],
			ephemeral: true,
		});
	}

	if (challenge.opponentType === 'ai') {
		if (challenge.challenged !== interaction.user.id) {
			const notYourChallengeEmbed = {
				color: ERROR_Color,
				description: 'This is not your challenge.',
			};
			errorOccurred = true;
			return interaction.reply({
				embeds: [notYourChallengeEmbed],
				ephemeral: true,
			});
		}

		try {
			await makeAIMove(interaction, challenge, chess);
		} catch (error) {
			console.error('Error making AI move:', error);
			const aiErrorEmbed = {
				color: ERROR_Color,
				description: 'An error occurred while processing the AI move.',
			};
			errorOccurred = true;
			return interaction.followUp({ embeds: [aiErrorEmbed], ephemeral: true });
		}
	}

	if (!errorOccurred) {
		handleGameEndingConditions(interaction, challenge, chess);
		await updateChallengeInDatabase(challenge);
		await updateBoard(interaction, challengeId, challenge, chess);
	}
}

let bestMove;

async function makeAIMove(interaction, challenge, chess) {
	return new Promise(async (resolve, reject) => {
		const currentPositionFEN = chess.fen();

		try {
			// Request a move from the Stockfish API
			const response = await axios.get(
				`https://stockfish.online/api/stockfish.php?fen=${encodeURIComponent(
					currentPositionFEN
				)}&depth=5&mode=bestmove`
			);

			// Extract the best move from the response
			const match = response.data.data.match(/bestmove (\S+)/);
			bestMove = match ? match[1] : null;

			if (!bestMove) {
				throw new Error('Invalid best move format in the API response');
			}

			// Make the move in the chess game
			chess.move(bestMove, { sloppy: true });
			challenge.lastPlayer = interaction.client.user.id;

			resolve();
		} catch (error) {
			console.error('Error making AI move:', error);
			interaction.followUp({
				content: 'There was an error making the AI move.',
				ephemeral: true,
			});
			reject(error);
		}
	});
}

async function getChallengeAndChessInstance(interaction, challengeId) {
	if (challengeId === undefined && challengeId === null) {
		challengeId = interaction.options.getString('challenge_id');
	}

	try {
		const connection = await pool.getConnection();
		const [rows] = await connection.query(
			'SELECT * FROM challenges WHERE id = ?',
			[challengeId]
		);
		connection.release();

		if (rows.length === 0) {
			const challengeNotFoundEmbed = {
				color: ERROR_Color,
				description:
					'Challenge not found. Please make sure to provide the correct challenge ID.',
			};
			errorOccurred = true;
			return interaction.followUp({
				embeds: [challengeNotFoundEmbed],
				ephemeral: true,
			});
		}

		const challenge = rows[0];
		const chess = new Chess(challenge.fen);

		return { challenge, chess };
	} catch (error) {
		console.error('Error getting challenge from database:', error);
		const errorReadEmbed = {
			color: ERROR_Color,
			description:
				'There was an error reading the challenge from the database.',
			error,
		};
		errorOccurred = true;
		return interaction.followUp({ embeds: [errorReadEmbed], ephemeral: true });
	}
}

async function updateChallengeInDatabase(challenge) {
	try {
		const connection = await pool.getConnection();
		await connection.query('UPDATE challenges SET ? WHERE id = ?', [
			challenge,
			challenge.id,
		]);
		connection.release();
	} catch (error) {
		console.error('Error updating challenge in database:', error);
		throw error;
	}
}

function checkTurnValidity(interaction, challenge) {
	if (challenge.lastPlayer === interaction.user.id) {
		const notYourTurnEmbed = {
			color: ERROR_Color,
			description: 'It is not your turn.',
		};
		errorOccurred = true;
		return interaction.reply({
			embeds: [notYourTurnEmbed],
			ephemeral: true,
		});
	}
}

function checkPieceOwnership(interaction, challenge, pieceAtPos) {
	const isChallenger = interaction.user.id === challenge.challenger;
	const isChallenged = interaction.user.id === challenge.challenged;
	const isCorrectColor =
		(isChallenger && pieceAtPos.color !== 'b') ||
		(isChallenged && pieceAtPos.color !== 'w');

	if (!isCorrectColor) {
		const notYourPieceEmbed = {
			color: ERROR_Color,
			description: `You can only move ${
				pieceAtPos.color === 'b' ? 'black' : 'white'
			} pieces.`,
		};
		errorOccurred = true;
		return interaction.reply({
			embeds: [notYourPieceEmbed],
			ephemeral: true,
		});
	}
}

function handleGameEndingConditions(interaction, challenge, chess) {
	if (chess.inCheck()) {
		const inCheckEmbed = {
			color: ERROR_Color,
			description: 'You are in check.',
		};
		return interaction.followUp({ embeds: [inCheckEmbed], ephemeral: true });
	}

	if (chess.isCheckmate()) {
		const inCheckmateEmbed = {
			color: ERROR_Color,
			description: 'Checkmate! The game is over.',
		};
		challenge.status = 'completed';
		const [whiteNewElo, blackNewElo] = eloCalculator.calculateElo(
			challenge.challenger,
			challenge.challenged,
			'end',
			challenge.lastPlayer === challenge.challenged
				? challenge.challenger
				: challenge.challenged
		);
		console.log(
			`New Elo Ratings - White: ${whiteNewElo}, Black: ${blackNewElo}`
		);
		return interaction.followUp({
			embeds: [inCheckmateEmbed],
			ephemeral: true,
		});
	}

	if (chess.isStalemate()) {
		const inStalemateEmbed = {
			color: ERROR_Color,
			description: 'Stalemate! The game is over.',
		};
		challenge.status = 'completed';
		const [whiteNewElo, blackNewElo] = eloCalculator.calculateElo(
			challenge.challenger,
			challenge.challenged,
			'end-draw'
		);
		console.log(
			`New Elo Ratings - White: ${whiteNewElo}, Black: ${blackNewElo}`
		);
		return interaction.followUp({
			embeds: [inStalemateEmbed],
			ephemeral: true,
		});
	}

	if (chess.isThreefoldRepetition()) {
		const inThreefoldRepetitionEmbed = {
			color: ERROR_Color,
			description: 'Threefold repetition! The game is over.',
		};
		challenge.status = 'completed';
		const [whiteNewElo, blackNewElo] = eloCalculator.calculateElo(
			challenge.challenger,
			challenge.challenged,
			'end-draw'
		);
		console.log(
			`New Elo Ratings - White: ${whiteNewElo}, Black: ${blackNewElo}`
		);
		return interaction.followUp({
			embeds: [inThreefoldRepetitionEmbed],
			ephemeral: true,
		});
	}

	if (chess.isInsufficientMaterial()) {
		const inInsufficientMaterialEmbed = {
			color: ERROR_Color,
			description: 'Insufficient material! The game is over.',
		};
		challenge.status = 'completed';
		const [whiteNewElo, blackNewElo] = eloCalculator.calculateElo(
			challenge.challenger,
			challenge.challenged,
			'end-draw'
		);
		console.log(
			`New Elo Ratings - White: ${whiteNewElo}, Black: ${blackNewElo}`
		);
		return interaction.followUp({
			embeds: [inInsufficientMaterialEmbed],
			ephemeral: true,
		});
	}
}

async function updateBoard(interaction, challengeId, challenge, chess) {
	const updatedFEN = chess.fen();

	let lastMove;

	if (challenge.opponentType === 'ai') {
		lastMove = bestMove;
	} else {
		lastMove =
			interaction.options.getString('piece')?.toLowerCase() +
			interaction.options.getString('move')?.toLowerCase();
	}

	try {
		const connection = await pool.getConnection();
		await connection.query(
			'UPDATE challenges SET fen = ?, lastMove = ? WHERE id = ?',
			[updatedFEN, lastMove, challengeId]
		);
		connection.release();
	} catch (error) {
		console.error('Error updating challenge in database:', error);
		const errorWriteEmbed = {
			color: ERROR_Color,
			description: 'There was an error updating the challenge in the database.',
			error,
		};
		return interaction.followUp({
			embeds: [errorWriteEmbed],
			ephemeral: true,
		});
	}

	return displayBoard(interaction, challengeId);
}

function validateMove(chessInstance, piecePosition, movePosition) {
	const userMove = {
		from: piecePosition,
		to: movePosition,
	};

	if (userMove.from === userMove.to) {
		return "You must move the piece to a different square.";
	} else {
		try {
			chessInstance.move({
				from: piecePosition,
				to: movePosition,
				sloppy: true,
			});
		} catch (error) {
			console.error('Error making move:', error);
			return `Invalid move: ${piecePosition} to ${movePosition}. Please try again with a valid move.`;
		}
	}

	// Validate specific conditions for sideways pawn capture
	const piece = chessInstance.get(piecePosition);
	const targetPiece = chessInstance.get(movePosition);

	const isSidewaysPawnCapture =
		piece.type === 'p' &&
		piecePosition[0] !== movePosition[0] &&
		targetPiece !== null;

	if (isSidewaysPawnCapture) {
		chessInstance.remove(movePosition); // Remove the captured piece
	}

	// Check for pawn promotion
	if (piece.type === 'p') {
		const promotionPiece = userMove.promotion
			? userMove.promotion.toLowerCase()
			: null;

		const isPromotionMove =
			(piece.color === 'w' && movePosition[1] === '8') ||
			(piece.color === 'b' && movePosition[1] === '1');

		// Check if the pawn moved to the 8th rank without promotion
		if (isPromotionMove) {
			if (!promotionPiece) {
				console.error('Missing promotion details:', userMove);
				return "Missing promotion: You must provide a promotion piece (q, r, b, or n).";
			}
		}

		const validPromotions = ['q', 'r', 'b', 'n'];

		if (promotionPiece && !validPromotions.includes(promotionPiece)) {
			console.error('Invalid promotion details:', userMove);
			return `Invalid promotion: ${promotionPiece}. Please promote to a valid piece (q, r, b, or n).`;
		}
	}

	return null;
}
