const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Challenge a player to a game of chess')
    .addUserOption(option =>
      option
        .setName('player')
        .setDescription('The player you want to challenge')
        .setRequired(true)
    ),

  async execute(interaction) {
    const challengedUser = interaction.options.getUser('player');

    // Create the embed data
    const embedData = {
      color: 0x0099ff,
      title: 'Chess Challenge',
      description: `You have been challenged to a game of chess by ${interaction.user.username}`,
      fields: [
        { name: 'Challenger', value: interaction.user.username, inline: true },
        { name: 'Challenged Player', value: challengedUser.username, inline: true },
      ],
      footer: { text: 'Challenge ID: UNIQUE_ID_HERE' },
    };

    // Save challenge with a unique ID
    const challengeID = generateUniqueID(); // Function to generate a unique ID
    saveChallenge(challengeID, interaction.user.id, challengedUser.id, 'pending'); // Save challenge with pending status

    // Update the footer with the generated challenge ID
    embedData.footer.text = `Challenge ID: ${challengeID}`;

    // Reply with the embed data in the channel
    await interaction.reply({
      content: `Hey <@${challengedUser.id}>, to accept this challenge, use the command: \`/accept challenge_id:${challengeID}\``,
      embeds: [embedData],
    });
  },
};

// Function to generate a unique ID (Replace with your unique ID generation logic)
function generateUniqueID() {
  return Math.random().toString(36).substring(2, 8);
}

// Function to save challenge to challenges.json (Replace with your file handling logic)
async function saveChallenge(challengeID, challengerID, challengedID, status) {
  const challengeData = {
    id: challengeID,
    challenger: challengerID,
    challenged: challengedID,
    status: status, // Adding challenge status
  };

  const challengesFilePath = 'data/challenges.json'; // Path to the challenges file

  try {
    let challenges = [];

    try {
      // Read the existing challenges data from the JSON file
      const fileData = await fs.readFile(challengesFilePath, 'utf8');
      challenges = JSON.parse(fileData);
    } catch (readError) {
      // If the file doesn't exist or is empty, it will create an empty array of challenges
      if (readError.code !== 'ENOENT') {
        console.error('Error reading challenges file:', readError);
      }
    }

    // Ensure that challenges is always an array
    if (!Array.isArray(challenges)) {
      challenges = [];
    }

    // Create a new array with the existing challenges and the new challenge data
    const updatedChallenges = [...challenges, challengeData];

    // Write the updated challenges array back to the JSON file
    await fs.writeFile(challengesFilePath, JSON.stringify(updatedChallenges, null, 2));
  } catch (error) {
    console.error('Error handling challenges:', error);
  }
}
