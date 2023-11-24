const { SlashCommandBuilder } = require('discord.js');
const { INFO_Color } = require('../../data/config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Get the latest changelog'),

  async execute(interaction) {
    const changelogEmbed = {
      color: INFO_Color,
      title: 'Changelog',
      description: 'You can find the latest changelog [here](https://koy.ltd/chessbot/changelog.html)',
      footer: { text: 'Chess Bot' },
    };

    return interaction.reply({ embeds: [changelogEmbed] , ephemeral: true});
  },
};
