const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color, INFO_Color } = require('../../data/config.json');
const fs = require('fs').promises;
const path = require('path');

// Extracted function to display the chess board
async function displayBoard(interaction, challengeId) {
  try {
    const challengesData = await fs.readFile(path.join(__dirname, '../../data/challenges.json'), 'utf-8');
    const challenges = JSON.parse(challengesData);

    const matchedChallenge = challenges.find((challenge) => challenge.id === challengeId);

    if (!matchedChallenge) {
      const noMatchEmbed = {
        color: ERROR_Color,
        description: 'No matching challenge found for the given ID.',
      };

      return interaction.followUp({ embeds: [noMatchEmbed] });
    }

    const encodedFen = encodeURIComponent(matchedChallenge.fen);
    const link = `https://fen2image.chessvision.ai/${encodedFen}`;

    const boardEmbed = {
      color: INFO_Color,
      title: 'Chess Board',
      description: `The chess board for the challenge, \`/move challenge_id:${challengeId} piece: move:\` to move a piece.`,
      image: { url: `${link}` },
      fields: [],
      footer: { text: `Challenge ID: ${challengeId}` },
    };

    const isAiGame = matchedChallenge.gametype === 'ai';

    boardEmbed.fields.push(
      {
        name: isAiGame ? 'AI (Black)' : 'Challenger (Black)',
        value: `<@${isAiGame ? interaction.client.user.id : matchedChallenge.challenger}>`,
        inline: true,
      },
      {
        name: isAiGame ? 'Player (White)' : 'Challenged Player (White)',
        value: `<@${isAiGame ? interaction.user.id : matchedChallenge.challenged}>`,
        inline: true,
      }
    );

    await interaction.followUp({ embeds: [boardEmbed] });

    return;
  } catch (error) {
    console.error('Error occurred while reading or processing challenges:', error);
    const errorEmbed = {
      color: ERROR_Color,
      description: 'An error occurred while processing the chess board.',
    };
    interaction.deferReply({ ephemeral: true });
    return interaction.followUp({ embeds: [errorEmbed] });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('board')
    .setDescription('View the board of a game of chess')
    .addStringOption(option =>
      option
        .setName('challenge_id')
        .setDescription('The ID of the challenge you want to view the board of')
        .setRequired(true)
    ),
  
  async execute(interaction) { 
    const challengeId = interaction.options.getString('challenge_id');

    const embed = {
      color: SUCCESS_Color,
      description: `Fetching the board for challenge ID: ${challengeId}`,
      author: {
        name: `${interaction.client.user.username}`,
        icon_url: `${interaction.client.user.avatarURL()}`
      },
    };

    await interaction.reply({ embeds: [embed], ephemeral: true });

    await displayBoard(interaction, challengeId); 
  },
  displayBoard,
};
