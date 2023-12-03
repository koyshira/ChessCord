const { Events } = require('discord.js');
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
    const errorMessage = 'There was an error while executing this command!';
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
    }
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
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

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(error);
                    await handleErrorInteraction(interaction);
                }
            } else if (interaction.isButton()) {
                const button = interaction.customId;
                if (!button) {
                    console.error(`No button matching ${interaction.customId} was found.`);
                    return;
                }

                try {
                    await handleButtonInteraction(interaction);
                } catch (error) {
                    console.error(error);
                    await handleErrorInteraction(interaction);
                }
            }
        } catch (error) {
            console.error('Error occurred while checking blacklist:', error);
            await handleErrorInteraction(interaction);
        }
    },
};
