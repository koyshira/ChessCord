/** @format */

module.exports = {
	data: {
		name: 'invite',
		description: 'Invite the bot to your server',
	},

	async execute(interaction) {
		const baseURL = 'https:/chesscord.com/';

		const inviteLink = `${baseURL}invite`;
		const serverLink = `${baseURL}discord`;
		const changelogLink = `${baseURL}changelog`;

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
					value: `[Click here](${changelogLink})`,
				},
			],
		};

		await interaction.reply({ embeds: [InfoEmbed], ephemeral: true });
	},
};
