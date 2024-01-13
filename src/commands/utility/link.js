/** @format */

const { SUCCESS_Color } = require('../../data/config.json');

module.exports = {
	data: {
		name: 'link',
		description: 'Link your account to your lichess account',
	},

	async execute(interaction) {
		const linkEmbed = {
			color: SUCCESS_Color,
			title: 'Link your account',
			description:
				'Click the button below to link your account to your lichess account',
		};

		const buttonRow = {
			type: 1,
			components: [
				{
					type: 2,
					style: 5,
					label: 'Link',
					url: `http://auth.chesscord.com?id=${interaction.user.id}`,
				},
			],
		};

		await interaction.reply({
			embeds: [linkEmbed],
			components: [buttonRow],
			ephemeral: true,
		});
	},
};
