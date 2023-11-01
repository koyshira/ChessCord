const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;

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
        color: 0xFF0000,
        description: 'Challenge not found. Please make sure to provide the correct challenge ID.',
      };
      return interaction.reply({ embeds: [challengeNotFoundEmbed], ephemeral: true });
    }

    const challenge = challenges[foundIndex];
    
    const encodedFen = encodeURIComponent(challenge.fen);
    const link = `https://fen2image.chessvision.ai/${encodedFen}`;

    const boardEmbed = {
      color: 0x34c759,
      title: 'Chess Board',
      image: { url: `${link}` },
      fields:[
        { name: 'Challenger (Black)', value: `<@${challenge.challenger}>`, inline: true },
        { name: 'Challenged Player (White)', value: `<@${challenge.challenged}>`, inline: true },
        { name: '', value: '\u200B' },
        { name: 'Status', value: challenge.status, inline: true },
        { name: 'Last Turn', value: `<@${challenge.lastPlayer}>`, inline: true },
      ],
      footer: { text: `Challenge ID: ${challengeId}` },
    };
        
    await interaction.reply({ embeds: [boardEmbed] });
  }
};
