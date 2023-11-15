const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');
const fs = require('fs').promises;
const path = require('path');

async function rejectChessChallenge(interaction, challengeId, challenged) {
  const userId = interaction.user.id;

  try {
    const challengesData = await fs.readFile(path.join(__dirname, '../../data/challenges.json'), 'utf-8');
    const challenges = JSON.parse(challengesData);

    const matchedChallengeIndex = challenges.findIndex(
      (challenge) => challenge.id === challengeId && challenge.challenged === userId
    );

    if (interaction.user.id != challenged) {
      const selfChallengeEmbed = {
        color: ERROR_Color,
        description: 'You cannot reject your own challenge.',
      };

      await interaction.reply({ embeds: [selfChallengeEmbed], ephemeral: true });
      return;
    }

    if (matchedChallengeIndex !== -1) {
      if (challenges[matchedChallengeIndex].status === 'Rejected') {
        const alreadyRejectedEmbed = {
          color: ERROR_Color,
          description: 'This challenge has already been rejected.',
        };

        await interaction.reply({ embeds: [alreadyRejectedEmbed], ephemeral: true });
        return;
      }

      challenges[matchedChallengeIndex].status = 'Rejected';

      await fs.writeFile(path.join(__dirname, '../../data/challenges.json'), JSON.stringify(challenges, null, 2), 'utf-8');

      const embed = {
        color: SUCCESS_Color,
        title: 'Challenge Rejected',
        description: 'You have rejected the challenge.',
        fields: [
          { name: 'Challenger', value: `<@${challenges[matchedChallengeIndex].challenger}>`, inline: true },
          { name: 'Challenged Player', value: `<@${challenges[matchedChallengeIndex].challenged}>`, inline: true },
        ],
        footer: { text: `Challenge ID: ${challengeId}` },
      };

      await interaction.reply({ embeds: [embed] });
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
    .setName('reject')
    .setDescription('Reject a chess challenge')
    .addStringOption((option) =>
      option.setName('challenge_id').setDescription('The ID of the challenge you want to reject').setRequired(true)
    ),

  async execute(interaction) {
    const challengeId = interaction.options.getString('challenge_id');
    const challenger = interaction.user.id;

    await rejectChessChallenge(interaction, challengeId, challenger);
  },

  rejectChessChallenge, // Export the rejectChessChallenge function
};
