const { Events } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Bot is now online. Logged in as ${client.user.tag}.`);
		console.log(`Currently in ${client.guilds.cache.size} server(s).`);
		console.log(`Total users: ${client.users.cache.size}`);
	},
};
