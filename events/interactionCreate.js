const { Events } = require('discord.js');
const { handleButtonInteraction } = require('../commands/chess/challenge.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
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
    },
};

async function handleErrorInteraction(interaction) {
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
            content: 'There was an error while executing this command!',
            ephemeral: true,
        });
    } else {
        await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true,
        });
    }
}
