const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Invite the bot to your server'),

  async execute(interaction) {
    const baseURL = 'https://koy.ltd/chessbot/';

    const inviteLink = `${baseURL}invite`;
    const serverLink = `${baseURL}discord`;

    const InfoEmbed = {
      color: 0x7289da,
      title: 'Invitation Link',
      fields: [
        {
          name: 'Invite the bot to your server',
          value: `[Click here](${inviteLink})`,
        },
        {
          name: 'Join the support server',
          value: `[Click here](${serverLink})`,
        },
        {
          name: 'View the changelog',
          value: '[Click here](https://koy.ltd/chessbot/changelog)',
        },
      ],
      footer: {
        text: `Powered by ${interaction.client.user.username}`,
      },
    };

    await interaction.reply({ embeds: [InfoEmbed], ephemeral: true });
  },
};
