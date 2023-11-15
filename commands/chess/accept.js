const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color, INFO_Color } = require('../../data/config.json');
const { Chess } = require('chess.js');
const fs = require('fs').promises;
const path = require('path');

// Extracted function to handle the process of accepting a chess challenge
async function acceptChessChallenge(interaction, challengeId, challenger) {
  const userId = interaction.user.id;

  try {
    const challengesData = await fs.readFile(path.join(__dirname, '../../data/challenges.json'), 'utf-8');
    const challenges = JSON.parse(challengesData);

    const matchedChallengeIndex = challenges.findIndex(
      (challenge) => challenge.id === challengeId && challenge.challenged === userId
    );

    if (interaction.user.id == challenger) {
      const selfChallengeEmbed = {
        color: ERROR_Color,
        description: 'You cannot accept your own challenge.',
      };
      await interaction.reply({ embeds: [selfChallengeEmbed], ephemeral: true });
      return;
    }

    if (matchedChallengeIndex !== -1) {
      if (challenges[matchedChallengeIndex].status === 'Accepted') {
        const alreadyAcceptedEmbed = {
          color: ERROR_Color,
          description: 'This challenge has already been accepted.',
        };

        await interaction.reply({ embeds: [alreadyAcceptedEmbed], ephemeral: true });
        return;
      }

      challenges[matchedChallengeIndex].status = 'Accepted';

      const chess = new Chess();
      const fen = chess.fen();

      challenges[matchedChallengeIndex].fen = fen;

      await fs.writeFile(path.join(__dirname, '../../data/challenges.json'), JSON.stringify(challenges, null, 2), 'utf-8');

      const embed = {
        color: SUCCESS_Color,
        title: 'Challenge Accepted',
        description: 'You have successfully accepted the challenge.',
        fields: [
          { name: 'Challenger', value: `<@${challenges[matchedChallengeIndex].challenger}>`, inline: true },
          { name: 'Challenged Player', value: `<@${challenges[matchedChallengeIndex].challenged}>`, inline: true },
        ],
        footer: { text: `Challenge ID: ${challengeId}` },
      };

      await interaction.reply({ embeds: [embed] });

      const encodedFen = encodeURIComponent(challenges[matchedChallengeIndex].fen);
      const link = `https://fen2image.chessvision.ai/${encodedFen}`;

      const boardEmbed = {
        color: INFO_Color,
        title: 'Chess Board',
        description: `The chess board for the challenge, \`/move challenge_id:${challengeId} piece: move:\` to move a piece.`,
        image: { url: `${link}` },
        fields: [
          { name: 'Challenger (Black)', value: `<@${challenges[matchedChallengeIndex].challenger}>`, inline: true },
          { name: 'Challenged Player (White)', value: `<@${challenges[matchedChallengeIndex].challenged}>`, inline: true },
        ],
        footer: { text: `Challenge ID: ${challengeId}` },
      };

      await interaction.followUp({ embeds: [boardEmbed] });
    } else {
      const noMatchEmbed = {
        color: ERROR_Color,
        description: 'No matching challenge found for the given ID or user.',
      };

      await interaction.reply({ embeds: [noMatchEmbed], ephemeral: true });
    }
  } catch (error) {
    const errorEmbed = {
      color: ERROR_Color,
      description: 'An error occurred while processing the challenges.',
    };

    await interaction.deferReply({ ephemeral: true });
    await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    console.error('Error occurred while reading or processing challenges:', error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('accept')
    .setDescription('Accept a chess challenge')
    .addStringOption((option) =>
      option.setName('challenge_id').setDescription('The ID of the challenge you want to accept').setRequired(true)
    ),

  async execute(interaction) {
    const challengeId = interaction.options.getString('challenge_id');
    const challenger = interaction.user.id;

    await acceptChessChallenge(interaction, challengeId, challenger);
  },

  acceptChessChallenge, // Export the acceptChessChallenge function
};
