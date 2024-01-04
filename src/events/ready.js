/** @format */

const { Events } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log('----------------------------------------');
		console.log('Client has been initialized.');
		console.log(`Logged in as ${client.user.tag}.`);
		console.log(`Currently in ${client.guilds.cache.size} server(s).`);
		console.log('----------------------------------------');
	},
};
