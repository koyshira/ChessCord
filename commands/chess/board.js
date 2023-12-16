const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { ERROR_Color, SUCCESS_Color, INFO_Color } = require('../../data/config.json');

const pool = require('../../handlers/data/pool.js'); 

const FTI = require('fen-to-image')
const path = require('path')

// Extracted function to display the chess board
async function displayBoard(interaction, challengeId) {
  try {
    // Fetch the challenge from the database
    const [challenges] = await pool.query('SELECT * FROM challenges WHERE id = ?', [challengeId]);

    if (challenges.length === 0) {
      const noMatchEmbed = {
        color: ERROR_Color,
        description: 'No matching challenge found for the given ID.',
      };

      return interaction.followUp({ embeds: [noMatchEmbed], ephemeral: true });
    }

    const matchedChallenge = challenges[0];

    let pieceColor;

    if (matchedChallenge.lastPlayer === matchedChallenge.challenger) {
      pieceColor = 'white';
    }
    else {
      pieceColor = 'black';
    }

    await FTI({
      fen: matchedChallenge.fen,
      color: pieceColor,
      whiteCheck: false,
      blackCheck: false,
      lastMove: matchedChallenge.lastMove,
      dirsave: path.join(__dirname, "board.png")
    }).catch((err) => {
      console.error('Error occurred while generating the chess board:', err);
      const errorEmbed = {
        color: ERROR_Color,
        description: 'An error occurred while generating the chess board.',
      };
      interaction.deferReply({ ephemeral: true });
      return interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    }).then(() => {
      setTimeout(() => {}, 1000);
    });

    const attachment = new AttachmentBuilder(__dirname + '/board.png', { name: 'board.png'})
    const moveInstruction = `Write \`/move challenge_id:${challengeId} piece: move:\` to move a piece.`

    const boardEmbed = {
      color: INFO_Color,
      title: 'Chess Board',
      image: { url: `attachment://${attachment.name}` },
      fields: [],
      footer: { text: `Challenge ID: ${challengeId}` },
    };

    const isAiGame = matchedChallenge.opponentType === 'ai';

    if (isAiGame) {
      boardEmbed.fields.push(
        {
          name: 'AI (Black)',
          value: `<@${interaction.client.user.id}>`,
          inline: true,
        },
        {
          name: 'Player (White)',
          value: `<@${interaction.user.id}>`,
          inline: true,
        }
      );
    } else {
      boardEmbed.fields.push(
        {
          name: 'Challenger (Black)',
          value: `<@${matchedChallenge.challenger}>`,
          inline: true,
        },
        {
          name: 'Challenged Player (White)',
          value: `<@${matchedChallenge.challenged}>`,
          inline: true,
        }
      );
    }

    await interaction.followUp({ content: moveInstruction, embeds: [boardEmbed], files: [attachment] });

    return;
  } catch (error) {
    console.error('Error occurred while reading or processing challenges:', error);
    const errorEmbed = {
      color: ERROR_Color,
      description: 'An error occurred while processing the chess board.',
    };
    interaction.deferReply({ ephemeral: true });
    return interaction.followUp({ embeds: [errorEmbed], ephemeral: true});
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('board')
    .setDescription('View the board of a game of chess')
    .addStringOption(option =>
      option
        .setName('challenge_id')
        .setDescription('The ID of the challenge you want to view the board of')
        .setRequired(true)
    ),
  
  async execute(interaction) { 
    const challengeId = interaction.options.getString('challenge_id');

    const embed = {
      color: SUCCESS_Color,
      description: `Fetching the board for challenge ID: ${challengeId}`,
      author: {
        name: `${interaction.client.user.username}`,
        icon_url: `${interaction.client.user.avatarURL()}`
      },
    };

    await interaction.reply({ embeds: [embed], ephemeral: true });

    await displayBoard(interaction, challengeId); 
  },
  displayBoard,
};
