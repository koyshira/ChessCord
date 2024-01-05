/** @format */

const { ContextMenuCommandBuilder } = require('discord.js');
const { generateUniqueID, opponentCheck } = require('./challenge.js');

module.exports = {
	data: new ContextMenuCommandBuilder().setName('Chess Challenge').setType(2),

	async execute(interaction) {
		if (!interaction.deffered && !interaction.replied) {
			await interaction.deferReply();
		}

		const challengedUser = {
			id: interaction.targetId,
		};

		let opponentType;

		if (challengedUser.id === interaction.client.user.id) {
			opponentType = 'ai';
		} else {
			opponentType = 'player';
		}

		const username = interaction.user.username;
		const challengeID = generateUniqueID(username);

		opponentCheck(interaction, challengedUser, opponentType, challengeID);
	},
};
