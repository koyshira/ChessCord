/** @format */

const { ERROR_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');

const pool = require('../../handlers/data/pool.js');
const { displayBoard } = require('./board.js');
const { DecryptToken } = require('../../handlers/data/encryption.js');

const axios = require('axios');

let errorOccurred = false;

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

let pieceAtPos;
let movePos;

async function makeMove(interaction, challengeId, piece, move) {
	const { challenge, chess } = await getChallengeAndChessInstance(
		interaction,
		challengeId
	);

	if (piece === undefined && move === undefined) {
		pieceAtPos = interaction.options.getString('piece')?.toLowerCase();
		movePos = interaction.options.getString('move')?.toLowerCase();
	} else {
		pieceAtPos = piece;
		movePos = move;
	}

	checkTurnValidity(interaction, challenge);
	checkPieceOwnership(interaction, challenge, pieceAtPos);

	const moveValidation = await validateMove(
		chess,
		pieceAtPos,
		movePos,
		challengeId,
		interaction
	);
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
			await makeAIMove(interaction, challenge, chess, challengeId);
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
		await updateBoard(
			interaction,
			challengeId,
			challenge,
			chess,
			pieceAtPos,
			movePos
		);
	}
}

let bestMove;

async function makeAIMove(interaction, challenge, chess, challengeId) {
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
			console.log(
				'No valid move found in the response. (Most likely end of game)'
			);
			return; // Return without making a move
		}

		// Make the move in the chess game
		chess.move(bestMove, { sloppy: true });

		await axios.post(
			`https://lichess.org/api/board/game/${challengeId}/move/${bestMove}`,
			null,
			{
				headers: {
					Authorization: `Bearer ${process.env.LICHESS_BOT_TOKEN}`,
				},
			}
		);

		challenge.lastPlayer = interaction.client.user.id;
	} catch (error) {
		try {
			handleGameEndingConditions(interaction, challenge, chess);
		} catch (error) {
			console.error('Error making AI move:', error);
			interaction.followUp({
				content: 'There was an error making the AI move.',
				ephemeral: true,
			});
		}
	}
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

		// TODO: Get elo of the players and store thenm

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

		// TODO: Get elo of the players and store thenm

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

		// TODO: Get elo of the players and store thenm

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

		// TODO: Get elo of the players and store thenm

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
		lastMove = pieceAtPos + movePos;
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

async function validateMove(
	chessInstance,
	piecePosition,
	movePosition,
	challengeId,
	interaction
) {
	const userMove = {
		from: piecePosition,
		to: movePosition,
	};

	if (userMove.from === userMove.to) {
		return 'You must move the piece to a different square.';
	} else {
		try {
			chessInstance.move({
				from: piecePosition,
				to: movePosition,
				sloppy: true,
			});

			const move = userMove.from + userMove.to;

			const token = await DecryptToken(interaction.user.id);

			axios.post(
				`https://lichess.org/api/board/game/${challengeId}/move/${move}`,
				null,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);
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
				return 'Missing promotion: You must provide a promotion piece (q, r, b, or n).';
			}
		}

		const validPromotions = ['q', 'r', 'b', 'n'];

		if (promotionPiece && !validPromotions.includes(promotionPiece)) {
			console.error('Invalid promotion details:', userMove);
			return `Invalid promotion: ${promotionPiece}. Please promote to a valid piece (q, r, b, or n).`;
		}
	}
}

module.exports = {
	data: {
		name: 'move',
		description: 'Make a move in a game of chess',
		options: [
			{
				name: 'challenge_id',
				description: 'The ID of the challenge you want to accept',
				type: 3,
				required: true,
			},
			{
				name: 'piece',
				description: "The piece's current position on the board (e.g., a3, b1)",
				type: 3,
				required: true,
			},
			{
				name: 'move',
				description: 'The destination square for the move (e.g., a4, c6)',
				type: 3,
				required: true,
			},
		],
	},

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
