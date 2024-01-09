/** @format */

const { INFO_Color } = require('../../data/config.json');

module.exports = {
	data: {
		name: 'changelog',
		description: 'Get the latest changelog',
	},

	async execute(interaction) {
		const changelogEmbed = {
			color: INFO_Color,
			title: 'Changelog',
			description: 'View the changelog [here](https://chesscord.com/changelog)',
		};

		return interaction.reply({ embeds: [changelogEmbed], ephemeral: true });
	},
};
