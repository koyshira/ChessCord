/** @format */

const { opponentCheck } = require('./challenge.js');

module.exports = {
	data: {
		name: 'Chess Challenge',
		type: 2,
	},

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

		opponentCheck(interaction, challengedUser, opponentType);
	},
};
