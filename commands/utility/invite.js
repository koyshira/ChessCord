const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Invite the bot to your server'),

  async execute(interaction) {
    const InfoEmbed = {
      color: 0x7289da, // You can set the color to whatever you prefer
      title: 'Invitation Link',
      fields: [
        {
          name: 'Invite the bot to your server',
          value: '[Click here](https://discord.com/api/oauth2/authorize?client_id=1168936311743328417&permissions=116736&redirect_uri=https%3A%2F%2Fkoy.ltd%2Fchessbot%2Fdiscord&response_type=code&scope=bot%20applications.commands%20identify%20guilds.join)',
        },
        {
          name: 'Join the support server',
          value: '[Click here](https://discord.gg/wRXSmEnFM6)',
        },
        {
          name: 'View the changelog',
          value: '[Click here](https://koy.ltd/chessbot/changelog.html)',
        },
      ],
      footer: {
        text: `Powered by ${interaction.client.user.username}`,
      },
    };

    await interaction.reply({ embeds: [InfoEmbed], ephemeral: true });
  },
};
