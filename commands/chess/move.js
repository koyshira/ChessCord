const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCES_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');

const pool = require('../../handlers/data/pool.js');
const eloCalculator = require('../../handlers/calculateElo.js');

const Chance = require('chance');
const chance = new Chance();

let errorOccurred = false;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Make a move in a game of chess')
    .addStringOption(option =>
      option
        .setName('challenge_id')
        .setDescription('The ID of the challenge you want to accept')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('piece')
        .setDescription("The piece's current position on the board (e.g., a3, b1)")
        .setRequired(true)
    )
    .addStringOption(option =>
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
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};

async function makeMove(interaction) {
  const { challenge, chess } = await getChallengeAndChessInstance(interaction);
  const pieceAtPos = chess.get(interaction.options.getString('piece')?.toLowerCase());

  checkTurnValidity(interaction, challenge);
  checkPieceOwnership(interaction, challenge, pieceAtPos);

  const moveValidation = validateMove(chess, interaction.options.getString('piece')?.toLowerCase(), interaction.options.getString('move')?.toLowerCase());
  if (moveValidation) {
    const invalidMoveEmbed = {
      color: ERROR_Color,
      description: moveValidation,
    };
    return interaction.reply({ embeds: [invalidMoveEmbed], ephemeral: true });
  }

  if (challenge.opponentType === 'ai') {
    if (challenge.challenged !== interaction.user.id) {
      const notYourChallengeEmbed = {
        color: ERROR_Color,
        description: 'This is not your challenge.',
      };
      errorOccurred = true;
      return interaction.reply({ embeds: [notYourChallengeEmbed], ephemeral: true });
    }
    
    try {
      await makeAIMove(interaction,challenge, chess);
    } catch (error) {
      console.error('Error making AI move:', error);
      const aiErrorEmbed = {
        color: ERROR_Color,
        description: 'An error occurred while processing the AI move.',
      };
      errorOccurred = true;
      return interaction.reply({ embeds: [aiErrorEmbed], ephemeral: true });
    }
  }

  if (!errorOccurred) { 
    handleGameEndingConditions(interaction, challenge, chess);
    await updateChallengeInDatabase(challenge);
    await updateBoard(interaction, challenge, chess);
  }
}

async function makeAIMove(interaction, challenge, chess) {
  return new Promise(async (resolve, reject) => {
    const moves = chess.moves();
    const randomMove = chance.pickone(moves);

    try {
      chess.move(randomMove, { sloppy: true });
      challenge.lastPlayer = interaction.client.user.id;
    } catch (error) {
      console.error('Error making AI move:', error);
      interaction.reply({ content: 'There was an error making the AI move.', ephemeral: true });
      reject(error);
    }
    resolve();
  });
}

async function getChallengeAndChessInstance(interaction) {
  const challengeId = interaction.options.getString('challenge_id');

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM challenges WHERE id = ?', [challengeId]);
    connection.release();

    if (rows.length === 0) {
      const challengeNotFoundEmbed = {
        color: ERROR_Color,
        description: 'Challenge not found. Please make sure to provide the correct challenge ID.',
      };
      errorOccurred = true;
      return interaction.reply({ embeds: [challengeNotFoundEmbed], ephemeral: true });
    }

    const challenge = rows[0];
    const chess = new Chess(challenge.fen);

    return { challenge, chess };
  } catch (error) {
    console.error('Error getting challenge from database:', error);
    const errorReadEmbed = {
      color: ERROR_Color,
      description: 'There was an error reading the challenge from the database.',
      error,
    };
    errorOccurred = true;
    return interaction.reply({ embeds: [errorReadEmbed], ephemeral: true });
  }
}

async function updateChallengeInDatabase(challenge) {
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE challenges SET ? WHERE id = ?', [challenge, challenge.id]);
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
    return interaction.reply({ embeds: [notYourTurnEmbed], ephemeral: true });
  }
}

function checkPieceOwnership(interaction, challenge, pieceAtPos) {
  if (
    (interaction.user.id === challenge.challenger && pieceAtPos.color !== 'b') ||
    (interaction.user.id === challenge.challenged && pieceAtPos.color !== 'w')
  ) {
    const notYourPieceEmbed = {
      color: ERROR_Color,
      description: `You can only move ${pieceAtPos.color === 'b' ? 'white' : 'black'} pieces.`,
    };
    errorOccurred = true;
    return interaction.reply({ embeds: [notYourPieceEmbed], ephemeral: true });
  }
}

function handleGameEndingConditions(interaction, challenge, chess) {
  if (chess.inCheck()) {
    const inCheckEmbed = {
      color: ERROR_Color,
      description: 'You are in check.',
    };
    return interaction.reply({ embeds: [inCheckEmbed], ephemeral: true });
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
      challenge.lastPlayer === challenge.challenged ? challenge.challenger : challenge.challenged
    );
    console.log(`New Elo Ratings - White: ${whiteNewElo}, Black: ${blackNewElo}`);
    return interaction.reply({ embeds: [inCheckmateEmbed], ephemeral: true });
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
    console.log(`New Elo Ratings - White: ${whiteNewElo}, Black: ${blackNewElo}`);
    return interaction.reply({ embeds: [inStalemateEmbed], ephemeral: true });
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
    console.log(`New Elo Ratings - White: ${whiteNewElo}, Black: ${blackNewElo}`);
    return interaction.reply({ embeds: [inThreefoldRepetitionEmbed], ephemeral: true });
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
    console.log(`New Elo Ratings - White: ${whiteNewElo}, Black: ${blackNewElo}`);
    return interaction.reply({ embeds: [inInsufficientMaterialEmbed], ephemeral: true });
  }
}

async function updateBoard(interaction, challenge, chess) {
  const updatedFEN = chess.fen();
  const challengeId = interaction.options.getString('challenge_id');

  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE challenges SET fen = ? WHERE id = ?', [updatedFEN, challengeId]);
    connection.release();
  } catch (error) {
    console.error('Error updating challenge in database:', error);
    const errorWriteEmbed = {
      color: ERROR_Color,
      description: 'There was an error updating the challenge in the database.',
      error,
    };
    return interaction.reply({ embeds: [errorWriteEmbed], ephemeral: true });
  }

  const nextTurn = challenge.lastPlayer === challenge.challenger ? challenge.challenged : challenge.challenger;
  const encodedFen = encodeURIComponent(updatedFEN);
  const link = `https://fen2png.com/api/?fen=${encodedFen}&raw=true`;

  const boardEmbed = {
    color: SUCCES_Color,
    title: 'Chess Board',
    description: `The chess board for the challenge, \`/move challenge_id:${interaction.options.getString('challenge_id')} piece: move:\` to move a piece.`,
    image: { url: `${link}` },
    fields: [],
    footer: { text: `Challenge ID: ${interaction.options.getString('challenge_id')}` },
  };

  if (challenge.opponentType === 'ai') {
    const message = 'AI made a move! It is now your turn.';
    boardEmbed.fields.push(
      { name: 'AI (Black)', value: `<@${interaction.client.user.id}>`, inline: true },
      { name: 'Player (White)', value: `<@${interaction.user.id}>`, inline: true }
    );
    await interaction.reply({ content: message, embeds: [boardEmbed] });
  } else {
    const message = `It's <@${nextTurn}>'s turn! View the updated board below:`;
    boardEmbed.fields.push(
      { name: 'Challenger (Black)', value: `<@${challenge.challenger}>`, inline: true },
      { name: 'Challenged Player (White)', value: `<@${challenge.challenged}>`, inline: true }
    );
    await interaction.reply({ content: message, embeds: [boardEmbed] });
  }
}

function validateMove(chessInstance, piecePosition, movePosition) {
  const availableMoves = chessInstance.moves({ verbose: true }).map(move => move.san.toLowerCase());

  const userMove = chessInstance.move({ from: piecePosition, to: movePosition, sloppy: true });

  if (!userMove || !availableMoves.includes(userMove.san.toLowerCase())) {
    console.error('Invalid move details:', userMove);
    return `Invalid move: ${userMove.san}, Please try again with a valid move.`;
  }

  // Validate specific conditions for sideways pawn capture
  const piece = chessInstance.get(piecePosition);
  const targetPiece = chessInstance.get(movePosition);

  if (
    piece.type === 'p' &&
    piecePosition[0] !== movePosition[0] && // Different file (sideways move)
    targetPiece === null // Capturing an empty square (capture move)
  ) {
    // This is a sideways pawn capture
    chessInstance.remove(movePosition); // Remove the captured piece
  }

  // Check for pawn promotion
  if (piece.type === 'p') {
    const promotionPiece = userMove.promotion ? userMove.promotion.toLowerCase() : null;

    // Check if the pawn moved to the 8th rank without promotion
    if ((piece.color === 'w' && movePosition[1] === '8') || (piece.color === 'b' && movePosition[1] === '1')) {
      if (!promotionPiece) {
        console.error('Missing promotion details:', userMove);
        return `Missing promotion: You must provide a promotion piece (q, r, b, or n).`;
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
