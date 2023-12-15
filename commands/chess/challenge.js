const { SlashCommandBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color, INFO_Color } = require('../../data/config.json');

const pool = require('../../handlers/data/pool.js'); 

const { acceptChessChallenge } = require('./accept.js');
const { rejectChessChallenge } = require('./reject.js');
const { displayBoard } = require('./board.js');

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
    .setDescription('Challenge a player to a game of chess (or the AI if no player is specified)')
    .addUserOption((option) =>
      option
        .setName('player')
        .setDescription('The player you want to challenge')
    ),

  async execute(interaction) {
    const challengedUser = interaction.options.getUser('player');
    const opponentType = challengedUser ? 'player' : 'ai';

    const username = interaction.user.username;
    const challengeID = generateUniqueID(username);

    if (opponentType === 'ai') {
      const aiChallengeEmbed = {
        color: INFO_Color,
        title: 'AI Challenge (Work in Progress)',
        description: 'You have successfully challenged the AI, this is a work in progress feature.\nIf you want to play against a player, use the `/challenge` command with a user mention.\n\nElse, you may attempt to play against the AI.\n(Not recommended, it can\'t play properly yet. But it can move pieces around!)',
        footer: { text: `Challenge ID: ${challengeID}` },
      };

      saveChallenge(
        challengeID,
        interaction.client.user.id,
        interaction.user.id,
        interaction.client.user.id,
        'AIGame',
        opponentType
      );

      return interaction.reply({
        embeds: [aiChallengeEmbed], ephemeral: true,
      }).then(() => {
        displayBoard(interaction, challengeID, interaction.user.id);
      });

    }

    if (challengedUser && challengedUser.id === interaction.user.id) {
      const selfChallengeEmbed = {
        color: ERROR_Color,
        description: 'You cannot challenge yourself.',
      };

      return interaction.reply({
        embeds: [selfChallengeEmbed],
        ephemeral: true,
      });
    }

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
          value: challengedUser ? `<@${challengedUser.id}>` : 'AI',
          inline: true,
        },
      ],
      footer: { text: `Challenge ID: ${challengeID}` },
    };

    saveChallenge(
      challengeID,
      interaction.user.id,
      challengedUser.id,
      interaction.user.id,
      'Pending',
      opponentType
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
          custom_id: `reject:${challengeID}:${challengedUser ? challengedUser.id : 'ai'}`,
        },
      ],
    };

    await interaction.reply({
      content: `Hey, ${challengedUser ? `<@${challengedUser.id}>` : 'AI'}\nAre you up for a game of chess?, the invitation will expire <t:${Math.round((Date.now() + CHALLENGE_EXPIRATION_TIME) / 1000)}:R>.`,
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

// Function to shuffle a string
function shuffleString(str) {
  const array = str.split('');
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.join('');
}

// Function to generate a short and unique ID
function generateUniqueID(username) {
  const shuffledUsername = shuffleString(username);
  const randomNumbers = Math.floor(Math.random() * 100);

  // Combine the shuffled username and random numbers
  const uniqueID = `${shuffledUsername.substr(0, 5)}-${randomNumbers}-${shuffledUsername.substr(5, 5)}`;

  return uniqueID;
}

// Function to save challenge to the database
async function saveChallenge(challengeID, challengerID, challengedID, lastPlayer, status, opponentType) {
  const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const challengeData = {
    id: challengeID,
    challenger: challengerID,
    challenged: challengedID,
    status: status,
    fen: defaultFen,
    lastPlayer: lastPlayer,
    dateTime: new Date().toISOString(),
    opponentType: opponentType,
  };

  try {
    const query = 'INSERT INTO challenges SET ?';
    await pool.query(query, challengeData);
  } catch (error) {
    console.error('Error saving challenge to the database:', error);
  }
}

// Function to update challenge status in the database
async function updateChallengeStatus(challengeID, newStatus) {
  try {
    const query = 'UPDATE challenges SET status = ? WHERE id = ?';
    await pool.query(query, [newStatus, challengeID]);
  } catch (error) {
    console.error('Error updating challenge status in the database:', error);
  }
}
