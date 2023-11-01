const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with the bot'),
  
  async execute(interaction) {

    const helpEmbed = {
      color: 0x34c759,
      title: 'Help',
      description: 'Here is a list of commands you can use with this bot.',
      fields: [
        { name: 'Challenge a player', value: '`/challenge @player`', inline: true },
        { name: 'Accept a challenge', value: '`/accept challenge_id`', inline: true },
        { name: 'Resign from a game', value: '`/resign challenge_id`', inline: true },
        { name: 'Make a move', value: '`/move challenge_id piece move`', inline: true },
        { name: 'View the board', value: '`/board challenge_id`', inline: true },
      ],
    };

    await interaction.reply({ embeds: [helpEmbed] });
  }
};
