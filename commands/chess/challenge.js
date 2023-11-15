const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');
const fs = require('fs').promises;

const { acceptChessChallenge } = require('./accept.js');
const { rejectChessChallenge } = require('./reject.js');

const CHALLENGE_EXPIRATION_TIME = 5 * 60 * 1000;

let pendingChallenges = {};

async function handleButtonInteraction(interaction) {
  const [action, challengeID, user] = interaction.customId.split(':');

  if (action === 'accept') {
    acceptChessChallenge(interaction, challengeID, user);
  } else if (action === 'reject') {
    rejectChessChallenge(interaction, challengeID, user);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Challenge a player to a game of chess')
    .addUserOption((option) =>
      option
        .setName('player')
        .setDescription('The player you want to challenge')
        .setRequired(true)
  ),

  async execute(interaction) {
    const challengedUser = interaction.options.getUser('player');

    if (challengedUser.id === interaction.user.id) {
      const selfChallengeEmbed = {
        color: ERROR_Color,
        description: 'You cannot challenge yourself.',
      };

      return interaction.reply({
        embeds: [selfChallengeEmbed],
        ephemeral: true,
      });
    }

    const challengeID = generateUniqueID();

    const embedData = {
      color: SUCCESS_Color,
      title: 'Chess Challenge',
      description: `You have been challenged to a game of chess by <@${interaction.user.id}>`,
      fields: [
        {
          name: 'Challenger (Black)',
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: 'Challenged Player (White)',
          value: `<@${challengedUser.id}>`,
          inline: true,
        },
      ],
      footer: { text: `Challenge ID: ${challengeID}` },
    };

    saveChallenge(
      challengeID,
      interaction.user.id,
      challengedUser.id,
      'Pending'
    );

    const challengerUser = await interaction.user.id;

    const buttonRow = {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: 'Accept',
          custom_id: `accept:${challengeID}:${challengerUser}`,
        },
        {
          type: 2,
          style: 4,
          label: 'Reject',
          custom_id: `reject:${challengeID}:${challengedUser.id}`,
        },
      ],
    };

    await interaction.reply({
      content: `Hey, <@${challengedUser.id}>\nAre you up for a game of chess?, the invitation will expire <t:${Math.round((Date.now() + CHALLENGE_EXPIRATION_TIME) / 1000)}:R>.`,
      embeds: [embedData],
      components: [buttonRow],
    })
      .then(sent => {
        // Storing message ID in the pendingChallenges object
        pendingChallenges[challengeID] = {
          message: sent,
          timeout: setTimeout(async () => {
            if (pendingChallenges[challengeID]) {
              delete pendingChallenges[challengeID];
              updateChallengeStatus(challengeID, 'Expired');

              const expirationEmbed = {
                color: ERROR_Color,
                description: `The challenge (ID: ${challengeID}) has expired. The invitation is no longer valid.`,
              };

              // Edit the original message when it expires
              sent.edit({ content: 'Challenge expired, user took longer than 5 minutes to respond.', embeds: [expirationEmbed], components: [] })
                .catch(error => {
                  if (error.code === 10008) {
                    console.error("Message not found, it might have been deleted.");
                    delete pendingChallenges[challengeID];
                    updateChallengeStatus(challengeID, 'Expired');
                  } else {
                    console.error("Error editing message:", error);
                  }
                });
            }
          }, CHALLENGE_EXPIRATION_TIME)
        };
      });
  },

  handleButtonInteraction, // Export the handleButtonInteraction function
};

// Function to generate a unique ID
function generateUniqueID() {
  return Math.random().toString(36).substring(2, 8);
}

// Function to save challenge to challenges.json
async function saveChallenge(challengeID, challengerID, challengedID, status) {
  const challengeData = {
    id: challengeID,
    challenger: challengerID,
    challenged: challengedID,
    status: status,
    fen: null,
    lastPlayer: challengerID,
    dateTime: new Date().toISOString(),
  };

  const challengesFilePath = 'data/challenges.json'; // Path to the challenges file

  try {
    let challenges = [];

    try {
      const fileData = await fs.readFile(challengesFilePath, 'utf8');
      challenges = JSON.parse(fileData);
    } catch (readError) {
      if (readError.code !== 'ENOENT') {
        console.error('Error reading challenges file:', readError);
      }
    }

    if (!Array.isArray(challenges)) {
      challenges = [];
    }

    const updatedChallenges = [...challenges, challengeData];

    await fs.writeFile(
      challengesFilePath,
      JSON.stringify(updatedChallenges, null, 2)
    );
  } catch (error) {
    console.error('Error handling challenges:', error);
  }
}

// Function to update challenge status
async function updateChallengeStatus(challengeID, newStatus) {
  try {
    const challengesFilePath = 'data/challenges.json';
    let challenges = [];

    try {
      const fileData = await fs.readFile(challengesFilePath, 'utf8');
      challenges = JSON.parse(fileData);
    } catch (readError) {
      if (readError.code !== 'ENOENT') {
        console.error('Error reading challenges file:', readError);
      }
    }

    const updatedChallenges = challenges.map((challenge) => {
      if (challenge.id === challengeID) {
        return { ...challenge, status: newStatus };
      }
      return challenge;
    });

    await fs.writeFile(
      challengesFilePath,
      JSON.stringify(updatedChallenges, null, 2)
    );
  } catch (error) {
    console.error('Error updating challenge status:', error);
  }
}
