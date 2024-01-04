/** @format */

const { acceptChessChallenge } = require('../../commands/chess/accept.js');
const { rejectChessChallenge } = require('../../commands/chess/reject.js');
const { resignChessChallenge } = require('../../commands/chess/resign.js');
const { showMoveModal } = require('../../commands/chess/move.js');

// Function to handle button interactions
async function handleButtonInteraction(interaction) {
	const [action, challengeID, user] = interaction.customId.split(':');

	if (action === 'accept') {
		acceptChessChallenge(interaction, challengeID, user);
	} else if (action === 'reject') {
		rejectChessChallenge(interaction, challengeID, user);
	} else if (action === 'move') {
		showMoveModal(interaction, challengeID);
	} else if (action === 'resign') {
		resignChessChallenge(interaction, challengeID);
	} else {
		console.log('Invalid action');
	}
}

module.exports = { handleButtonInteraction };
