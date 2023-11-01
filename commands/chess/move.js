const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCES_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');
const fs = require('fs').promises;

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
    // Retrieve user input
    const challengeId = interaction.options.getString('challenge_id');
    const piecePos = interaction.options.getString('piece')?.toLowerCase();
    const movePos = interaction.options.getString('move')?.toLowerCase();

    // Read challenges from file
    let challenges;
    try {
      const data = await fs.readFile('data/challenges.json');
      challenges = JSON.parse(data);
    } catch (error) {
      console.error('Error reading challenges:', error);

      const errorReadEmbed = {
        color: ERROR_Color,
        description: 'There was an error reading the challenges.', error,
      };

      return interaction.reply({ embeds: [errorReadEmbed], ephemeral: true });
    }

    // Find the index of the challenge with the given ID
    const foundIndex = challenges.findIndex(c => c.id === challengeId);

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

    // Create the move string and get the piece at the specified position
    const userMove = piecePos + movePos;
    const pieceAtPos = chess.get(piecePos);

    // Check if it's the correct player's turn
    if (challenge.lastPlayer === interaction.user.id) {

      const notYourTurnEmbed = {
        color: ERROR_Color,
        description: 'It is not your turn.',
      };

      return interaction.reply({ embeds: [notYourTurnEmbed], ephemeral: true });
    }

    // Check if the player is the challenger and if the piece is black
    if (interaction.user.id === challenge.challenger && pieceAtPos.color !== 'b') {

      const notYourPieceBlackEmbed = {
        color: ERROR_Color,
        description: 'You can only move black pieces.',
      };

      return interaction.reply({ embeds: [notYourPieceBlackEmbed], ephemeral: true });
    }

    // Check if the player is the challenged and if the piece is white
    if (interaction.user.id === challenge.challenged && pieceAtPos.color !== 'w') {

      const notYourPieceWhiteEmbed = {
        color: ERROR_Color,
        description: 'You can only move white pieces.',
      };

      return interaction.reply({ embeds: [notYourPieceWhiteEmbed], ephemeral: true });
    }

    const chessMove = chess.move(userMove, { sloppy: true });
    if (!chessMove) {

      const invalidMoveEmbed = {
        color: ERROR_Color,
        description: 'Invalid move.',
      };

      return interaction.reply({ embeds: [invalidMoveEmbed], ephemeral: true });
    }

    // Get the updated FEN after the move
    const updatedFEN = chess.fen();

    // Update challenge data with the new FEN and the player who made the last move
    challenge.lastPlayer = interaction.user.id;
    challenge.fen = updatedFEN;

    // Write the updated challenges back to the file
    try {
      await fs.writeFile('data/challenges.json', JSON.stringify(challenges, null, 2));
    } catch (error) {
      console.error('Error writing challenges:', error);

      const errorWriteEmbed = {
        color: ERROR_Color,
        description: 'There was an error writing the challenges.', error,
      };

      return interaction.reply({ embeds: [errorWriteEmbed], ephemeral: true });
    }

    // Generate the updated board and determine the next turn
    let nextTurn = challenge.lastPlayer === challenge.challenger ? challenge.challenged : challenge.challenger;

    const encodedFen = encodeURIComponent(challenge.fen);
    const link = `https://fen2image.chessvision.ai/${encodedFen}`;

    // Compose the message for the next turn with the updated board
    const message = `It's <@${nextTurn}>'s turn! View the updated board below:`;
    const boardEmbed = {
      color: SUCCES_Color,
      title: 'Chess Board',
      description: `The chess board for the challenge, \`/move challenge_id:${challengeId} piece: move:\` to move a piece.`,
      image: { url: `${link}` },
      fields:[
        { name: 'Challenger (Black)', value: `<@${challenge.challenger}>`, inline: true },
        { name: 'Challenged Player (White)', value: `<@${challenge.challenged}>`, inline: true },
      ],
      footer: { text: `Challenge ID: ${challengeId}` },
    }
    
    // Reply with the next turn message and the updated board
    await interaction.reply({ content: message, embeds: [boardEmbed] });
  },
};
