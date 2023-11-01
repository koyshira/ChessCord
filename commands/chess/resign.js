const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCES_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');
const fs = require('fs').promises;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resign')
    .setDescription('Resign from a game of chess')
    .addStringOption(option =>
      option
        .setName('challenge_id')
        .setDescription('The ID of the challenge you want to resign from')
        .setRequired(true)
    ),
  async execute(interaction) {
    const challengeId = interaction.options.getString('challenge_id');
    let challenges;
    try {
      const data = await fs.readFile('data/challenges.json');
      challenges = JSON.parse(data);
    } catch (error) {
      console.error('Error reading challenges:', error);
      return interaction.reply({ content: 'There was an error reading the challenges.', ephemeral: true });
    }

    const foundIndex = challenges.findIndex(c => c.id === challengeId);

    if (foundIndex === -1) {
      const challengeNotFoundEmbed = {
        color: ERROR_Color,
        description: 'Challenge not found. Please make sure to provide the correct challenge ID.',
      };
      return interaction.reply({ embeds: [challengeNotFoundEmbed], ephemeral: true });
    }

    const challenge = challenges[foundIndex];
    const chess = new Chess(challenge.fen);

    if (challenge.lastPlayer === interaction.user.id) {
      const notYourTurnEmbed = {
        color: ERROR_Color,
        description: 'It is not your turn.',
      };
      return interaction.reply({ embeds: [notYourTurnEmbed], ephemeral: true });
    }

    if (chess.isGameOver()) {
      const gameOverEmbed = {
        color: ERROR_Color,
        description: 'The game is already over.',
      };
      return interaction.reply({ embeds: [gameOverEmbed], ephemeral: true });
    }

    if (chess.inCheck()) {
      const inCheckEmbed = {
        color: ERROR_Color,
        description: 'You cannot resign while in check.',
      };
      return interaction.reply({ embeds: [inCheckEmbed], ephemeral: true });
    }

    challenge.status = 'Resigned';
    challenges[foundIndex] = challenge;

    try {
      await fs.writeFile('data/challenges.json', JSON.stringify(challenges));
    } catch (error) {
      console.error('Error saving challenges:', error);
      const saveErrorEmbed = {
        color: ERROR_Color,
        description: 'There was an error saving the challenges.',
      };
      return interaction.reply({ embeds: [saveErrorEmbed], ephemeral: true });
    }

    const resignedEmbed = {
      color: SUCCES_Color,
      description: 'You have resigned from the game.',
    };
    return interaction.reply({ embeds: [resignedEmbed] });
  }
};
