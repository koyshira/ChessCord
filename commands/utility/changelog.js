/** @format */

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
			description:
				'View the full changelog [here](https://koy.ltd/chessbot/changelog)',
			fields: [
				{
					name: 'Latest Change',
					value: 'Added the ability to play against the bot (somewhat)',
				},
			],
		};

		return interaction.reply({ embeds: [changelogEmbed], ephemeral: true });
	},
};
