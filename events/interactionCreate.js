const { Events, Constants } = require('discord.js');
const { handleButtonInteraction } = require('../commands/chess/challenge.js');
const pool = require('../handlers/data/pool.js');

// Function expressions
const isUserBlacklisted = async (userId) => {
    const [rows] = await pool.execute('SELECT * FROM blacklisted_users WHERE user_id = ?', [userId]);
    return rows.length > 0;
};

const isServerBlacklisted = async (serverId) => {
    const [rows] = await pool.execute('SELECT * FROM blacklisted_servers WHERE server_id = ?', [serverId]);
    return rows.length > 0;
};

const handleErrorInteraction = async (interaction) => {
    let errorMessage = 'There was an error while executing this command!';

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
    }

    // Handle specific DiscordAPIError with code 10062 (Unknown interaction)
    if (interaction instanceof Constants.DiscordAPIError && interaction.code === 10062) {
        console.error('Unknown interaction error:', interaction.message);
    } else {
        console.error('Unhandled error:', interaction instanceof Constants.DiscordAPIError ? interaction.message : interaction);
    }
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // Wrap the entire try-catch block to catch any unhandled errors
            try {
                // Check if the user or server is blacklisted
                const isUserBlacklistedValue = await isUserBlacklisted(interaction.user.id);
                const isServerBlacklistedValue = interaction.guildId ? await isServerBlacklisted(interaction.guildId) : false;

                if (isServerBlacklistedValue) {
                    await interaction.reply("Members of this guild are unable to access commands.");
                    return;
                }

                if (isUserBlacklistedValue) {
                    await interaction.reply("You are blacklisted and unable to use commands.");
                    return;
                }

                if (interaction.isCommand()) {
                    const command = interaction.client.commands.get(interaction.commandName);
                    if (!command) {
                        console.error(`No command matching ${interaction.commandName} was found.`);
                        return;
                    }

                    await command.execute(interaction);
                } else if (interaction.isButton()) {
                    const button = interaction.customId;
                    if (!button) {
                        console.error(`No button matching ${interaction.customId} was found.`);
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
