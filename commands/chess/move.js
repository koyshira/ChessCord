const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCES_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');
const fs = require('fs').promises;
const Chance = require('chance');
const chance = new Chance();

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

  // Create the move string and get the piece at the specified position
  const userMove = interaction.options.getString('piece')?.toLowerCase() + interaction.options.getString('move')?.toLowerCase();
  const pieceAtPos = chess.get(interaction.options.getString('piece')?.toLowerCase());

  // Check if it's the correct player's turn
  checkTurnValidity(interaction, challenge);

  // Check if the player can move the selected piece
  checkPieceOwnership(interaction, challenge, pieceAtPos);

  // Attempt to make the move and validate it
  const moveValidation = validateMove(chess, interaction.options.getString('piece')?.toLowerCase(), interaction.options.getString('move')?.toLowerCase());
  if (moveValidation) {
    const invalidMoveEmbed = {
      color: ERROR_Color,
      description: moveValidation + `, Please try again with a valid move.`,
    };
    return interaction.reply({ embeds: [invalidMoveEmbed], ephemeral: true });
  }

  // Handle AI move
  if (challenge.opponentType === 'ai') {
    try {
      await makeAIMove(interaction, challenge, chess);
    } catch (error) {
      console.error('Error making AI move:', error);
      const aiErrorEmbed = {
        color: ERROR_Color,
        description: 'An error occurred while processing the AI move.',
      };
      return interaction.reply({ embeds: [aiErrorEmbed], ephemeral: true });
    }
  }

  // Continue with normal flow
  handleGameEndingConditions(interaction, challenge, chess);
  await updateBoard(interaction, chess);
}

async function makeAIMove(interaction, challenge, chess) {
  return new Promise((resolve, reject) => {
    const userColor = challenge.challenger === interaction.user.id ? 'b' : 'w';

    // Generate a random move for the AI
    const moves = chess.moves();
    const randomMove = chance.pickone(moves);
    
    try {
      chess.move(randomMove, { sloppy: true });
    } catch (error) {
      console.error('Error making AI move:', error);
      reject(error);
    }

    resolve();
  });
}

async function getChallengeAndChessInstance(interaction) {
  // Read challenges from file
  let challenges;
  try {
    const data = await fs.readFile('data/challenges.json');
    challenges = JSON.parse(data);
  } catch (error) {
    console.error('Error reading challenges:', error);

    const errorReadEmbed = {
      color: ERROR_Color,
      description: 'There was an error reading the challenges.',
      error,
    };

    return interaction.reply({ embeds: [errorReadEmbed], ephemeral: true });
  }

  // Find the index of the challenge with the given ID
  const foundIndex = challenges.findIndex(c => c.id === interaction.options.getString('challenge_id'));

  if (foundIndex === -1) {
    const challengeNotFoundEmbed = {
      color: ERROR_Color,
      description: 'Challenge not found. Please make sure to provide the correct challenge ID.',
    };
    return interaction.reply({ embeds: [challengeNotFoundEmbed], ephemeral: true });
  }

  // Get the challenge from the challenges array
  const challenge = challenges[foundIndex];
  const chess = new Chess(challenge.fen);

  return { challenge, chess };
}

function checkTurnValidity(interaction, challenge) {
  if (challenge.lastPlayer === interaction.user.id) {
    const notYourTurnEmbed = {
      color: ERROR_Color,
      description: 'It is not your turn.',
    };
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
      description: `You can only move ${pieceAtPos.color === 'b' ? 'black' : 'white'} pieces.`,
    };
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
    return interaction.reply({ embeds: [inCheckmateEmbed], ephemeral: true });
  }

  if (chess.isStalemate()) {
    const inStalemateEmbed = {
      color: ERROR_Color,
      description: 'Stalemate! The game is over.',
    };
    challenge.status = 'completed';
    return interaction.reply({ embeds: [inStalemateEmbed], ephemeral: true });
  }

  if (chess.isDraw()) {
    const inDrawEmbed = {
      color: ERROR_Color,
      description: 'Draw! The game is over.',
    };
    challenge.status = 'completed';
    return interaction.reply({ embeds: [inDrawEmbed], ephemeral: true });
  }

  if (chess.isThreefoldRepetition()) {
    const inThreefoldRepetitionEmbed = {
      color: ERROR_Color,
      description: 'Threefold repetition! The game is over.',
    };
    challenge.status = 'completed';
    return interaction.reply({ embeds: [inThreefoldRepetitionEmbed], ephemeral: true });
  }

  if (chess.isInsufficientMaterial()) {
    const insufficientMaterialEmbed = {
      color: ERROR_Color,
      description: 'Insufficient material! The game is over.',
    };
    challenge.status = 'completed';
    return interaction.reply({ embeds: [insufficientMaterialEmbed], ephemeral: true });
  }
}

async function updateBoard(interaction, chess) {
  // Get the updated FEN after the move
  const updatedFEN = chess.fen();

  // Read challenges from file
  let challenges;
  try {
    const data = await fs.readFile('data/challenges.json');
    challenges = JSON.parse(data);
  } catch (error) {
    console.error('Error reading challenges:', error);

    const errorReadEmbed = {
      color: ERROR_Color,
      description: 'There was an error reading the challenges.',
      error,
    };

    return interaction.reply({ embeds: [errorReadEmbed], ephemeral: true });
  }

  // Find the index of the challenge with the given ID
  const foundIndex = challenges.findIndex(c => c.id === interaction.options.getString('challenge_id'));

  if (foundIndex === -1) {
    const challengeNotFoundEmbed = {
      color: ERROR_Color,
      description: 'Challenge not found. Please make sure to provide the correct challenge ID.',
    };
    return interaction.reply({ embeds: [challengeNotFoundEmbed], ephemeral: true });
  }

  // Update challenge data with the new FEN and the player who made the last move
  const challenge =   challenges[foundIndex]

  if (challenge.opponentType === 'ai') {
    challenge.lastPlayer = interaction.client.user.id;
  }
  else {
    challenge.lastPlayer = interaction.user.id;
  }
  challenge.fen = updatedFEN;

  // Write the updated challenges back to the file
  try {
    await fs.writeFile('data/challenges.json', JSON.stringify(challenges, null, 2));
  } catch (error) {
    console.error('Error writing challenges:', error);

    const errorWriteEmbed = {
      color: ERROR_Color,
      description: 'There was an error writing the challenges.',
      error,
    };
    return interaction.reply({ embeds: [errorWriteEmbed], ephemeral: true });
  }

  // Generate the updated board and determine the next turn
  let nextTurn = challenges[foundIndex].lastPlayer === challenges[foundIndex].challenger ? challenges[foundIndex].challenged : challenges[foundIndex].challenger;
  const encodedFen = encodeURIComponent(challenges[foundIndex].fen);
  const link = `https://fen2image.chessvision.ai/${encodedFen}`;

  // Compose the message for the next turn with the updated board
  let message = '';
  const boardEmbed = {
    color: SUCCES_Color,
    title: 'Chess Board',
    description: `The chess board for the challenge, \`/move challenge_id:${interaction.options.getString('challenge_id')} piece: move:\` to move a piece.`,
    image: { url: `${link}` },
    fields: [],
    footer: { text: `Challenge ID: ${interaction.options.getString('challenge_id')}` },
  };

  if (challenges[foundIndex].opponentType === 'ai') {
    message = 'AI made a move! It is now your turn.'
    boardEmbed.fields.push(
      { name: 'AI (Black)', value: `<@${interaction.client.user.id}>`, inline: true },
      { name: 'Player (White)', value: `<@${interaction.user.id}>`, inline: true }
    );
  } else {
    message = `It's <@${nextTurn}>'s turn! View the updated board below:`;
    boardEmbed.fields.push(
      { name: 'Challenger (Black)', value: `<@${challenges[foundIndex].challenger}>`, inline: true },
      { name: 'Challenged Player (White)', value: `<@${challenges[foundIndex].challenged}>`, inline: true }
    );
  }
  // Reply with the next turn message and the updated board
  await interaction.reply({ content: message, embeds: [boardEmbed] });
}

function validateMove(chessInstance, piecePosition, movePosition) {
  const userMove = piecePosition + movePosition;
  try {
    chessInstance.move(userMove, { sloppy: true });
  } catch (error) {
    return `${error.message}`;
  }
  return null;
}
