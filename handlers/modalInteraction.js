/** @format */
const { makeMove } = require('../commands/chess/move.js');

// Function to handle modal interactions
async function handleModalInteraction(interaction) {
	const [object, challengeID] = interaction.customId.split(':');

	if (object === 'movemodal') {
		const fields = interaction.fields.fields;

		const piece = fields.get('piece_input').value;
		const move = fields.get('move_input').value;

		makeMove(interaction, challengeID, piece, move);
	}
}

module.exports = { handleModalInteraction };
