/** @format */

const { Events } = require('discord.js');

module.exports = {
	name: Events.GuildDelete,

	async execute(guild) {
		console.log(`Left guild: ${guild.name} (${guild.id})`);
	},
};
