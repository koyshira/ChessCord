const { SlashCommandBuilder } = require('discord.js');
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
        .setDescription('The piece\'s current position on the board (e.g., a3, b1)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('move')
        .setDescription('The destination square for the move (e.g., a4, c6)')
        .setRequired(true)
    ),
  
  async execute(interaction) {
    const challengeId = interaction.options.getString('challenge_id');
    const piecePos = interaction.options.getString('piece').toLowerCase();
    const movePos = interaction.options.getString('move').toLowerCase();

    console.log('Received piece position:', piecePos);
    console.log('Received move position:', movePos);

    // Load the current game state from challenges.json
    let challenges;
    try {
      const data = await fs.readFile('data/challenges.json');
      challenges = JSON.parse(data);
    } catch (error) {
      console.error('Error reading challenges:', error);
      return interaction.reply('There was an error reading the challenges.');
    }

    // Find the specific challenge
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) {
      return interaction.reply('Challenge not found.');
    }

    // Fixed assignment of colors (challenger as 'b' and challenged as 'w')
    const userColor = interaction.user.id === challenge.challenger.id ? 'b' : 'w';
    console.log('User color:', userColor);

    // Initialize chess.js with the stored FEN
    const chess = new Chess(challenge.fen);

    // Convert user inputs to algebraic notation
    const userMove = piecePos + movePos;

    const pieceAtPos = chess.get(piecePos);
    console.log('Piece at position:', pieceAtPos);

    if (!pieceAtPos || pieceAtPos.color !== userColor) {
      return interaction.reply('It is not your turn or you are moving the wrong piece.');
    }

    if (!chess.move(userMove)) {
      return interaction.reply('Invalid move.');
    }

    // Update FEN after the move
    const updatedFEN = chess.fen();
    challenge.fen = updatedFEN;

    // Store the updated game state back to challenges.json
    try {
      await fs.writeFile('data/challenges.json', JSON.stringify(challenges, null, 2));
    } catch (error) {
      console.error('Error writing challenges:', error);
      return interaction.reply('There was an error updating the challenges.');
    }

    // Generate ASCII board from the updated FEN
    const updatedBoard = chess.ascii();

    // Send a message with the updated board
    const nextPlayer = userColor === 'b' ? `<@${challenge.challenged}>` : `<@${challenge.challenger}>`;
    const message = `It's your turn, ${nextPlayer}! View the updated board below:\n\`\`\`${updatedBoard}\`\`\``;
    
    interaction.reply(message);
  }
};
