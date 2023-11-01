const { SlashCommandBuilder } = require('discord.js');
const { Chess } = require('chess.js');
const fs = require('fs').promises;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('accept')
    .setDescription('Accept a chess challenge')
    .addStringOption(option =>
      option
        .setName('challenge_id')
        .setDescription('The ID of the challenge you want to accept')
        .setRequired(true)
    ),
  
  async execute(interaction) {
    const challengeId = interaction.options.getString('challenge_id');
    const userId = interaction.user.id;

    try {
      const challengesData = await fs.readFile('data/challenges.json', 'utf-8');
      const challenges = JSON.parse(challengesData);

      const matchedChallengeIndex = challenges.findIndex(challenge => challenge.id === challengeId && challenge.challenged === userId);

      if (matchedChallengeIndex !== -1) {
        if (challenges[matchedChallengeIndex].status === 'accepted') {

          const alreadyAcceptedEmbed = {
            color: 0xFF0000,
            description: 'This challenge has already been accepted.',
          };

          await interaction.reply({ embeds: [alreadyAcceptedEmbed] });
          return;
        }

        challenges[matchedChallengeIndex].status = 'accepted';

        const chess = new Chess();

        const fen = chess.fen()

        challenges[matchedChallengeIndex].fen = fen;

        await fs.writeFile('data/challenges.json', JSON.stringify(challenges, null, 2), 'utf-8');

        const embed = {
          color: 0x34c759,
          title: 'Challenge Accepted',
          description: 'You have successfully accepted the challenge.',
          fields:[
            { name: 'Challenger', value: `<@${challenges[matchedChallengeIndex].challenger}>`, inline: true },
            { name: 'Challenged Player', value: `<@${challenges[matchedChallengeIndex].challenged}>`, inline: true },
          ],
          footer: { text: `Challenge ID: ${challengeId}` },
        };

        await interaction.reply({ embeds: [embed] });

        const encodedFen = encodeURIComponent(challenges[matchedChallengeIndex].fen);
        const link = `https://fen2image.chessvision.ai/${encodedFen}`;

        const boardEmbed = {
          color: 0x34c759,
          title: 'Chess Board',
          description: `The chess board for the challenge, \`/move challenge_id:${challengeId} piece: move:\` to move a piece.`,
          image: { url: `${link}` },
          fields:[
            { name: 'Challenger (Black)', value: `<@${challenges[matchedChallengeIndex].challenger}>`, inline: true },
            { name: 'Challenged Player (White)', value: `<@${challenges[matchedChallengeIndex].challenged}>`, inline: true },
          ],
          footer: { text: `Challenge ID: ${challengeId}` },
        }

        
        await interaction.followUp({ embeds: [boardEmbed] });

      } else {

        const noMatchEmbed = {
          color: 0xFF0000,
          description: 'No matching challenge found for the given ID or user.',
        };

        await interaction.reply({ embeds: [noMatchEmbed] });
      }
    } catch (error) {

      const errorEmbed = {
        color: 0xFF0000,
        description: 'An error occurred while processing the challenges.',
      };

      await interaction.followUp({ embeds: [errorEmbed] });
      console.error('Error occurred while reading or processing challenges:', error);
    }
  }
};
