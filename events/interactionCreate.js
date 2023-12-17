/** @format */

const { Events } = require('discord.js');
const { handleButtonInteraction } = require('../commands/chess/challenge.js');
const pool = require('../handlers/data/pool.js');

// Function expressions
const isUserBlacklisted = async (userId) => {
	const [rows] = await pool.execute(
		'SELECT * FROM blacklisted_users WHERE user_id = ?',
		[userId]
	);
	return rows.length > 0;
};

const isServerBlacklisted = async (serverId) => {
	const [rows] = await pool.execute(
		'SELECT * FROM blacklisted_servers WHERE server_id = ?',
		[serverId]
	);
	return rows.length > 0;
};

const handleErrorInteraction = async (interaction) => {
	let errorMessage =
		'There was an error while executing this command!\nPlease try again later. If the issue persists, please contact the bot owner.\n\nhttps://koy.ltd/chessbot/discord\n\nSorry for the inconvenience.\n\n~Koyshira <3 (Developer)';

	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: errorMessage, ephemeral: true });
		} else {
			await interaction.reply({ content: errorMessage, ephemeral: true });
		}
	} catch (error) {
		console.error('Error while handling interaction error:', error);
	}
};

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		try {
			// Wrap the entire try-catch block to catch any unhandled errors
			try {
				// Check if the user or server is blacklisted
				const isUserBlacklistedValue = await isUserBlacklisted(
					interaction.user.id
				);
				const isServerBlacklistedValue = interaction.guildId
					? await isServerBlacklisted(interaction.guildId)
					: false;

				if (isServerBlacklistedValue) {
					await interaction.reply(
						'Members of this guild are unable to access commands.'
					);
					return;
				}

				if (isUserBlacklistedValue) {
					await interaction.reply(
						'You are blacklisted and unable to use commands.'
					);
					return;
				}

				if (interaction.isCommand()) {
					const command = interaction.client.commands.get(
						interaction.commandName
					);
					if (!command) {
						console.error(
							`No command matching ${interaction.commandName} was found.`
						);
						return;
					}

					await command.execute(interaction);
				} else if (interaction.isButton()) {
					const button = interaction.customId;
					if (!button) {
						console.error(
							`No button matching ${interaction.customId} was found.`
						);
						return;
					}

					await handleButtonInteraction(interaction);
				}
			} catch (error) {
				console.error('Error occurred during interaction processing:', error);
				await handleErrorInteraction(interaction);
			}
		} catch (error) {
			console.error('Error occurred while checking blacklist:', error);
			await handleErrorInteraction(interaction);
		}
	},
};
