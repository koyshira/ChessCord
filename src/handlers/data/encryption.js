/** @format */

const crypto = require('crypto');
const pool = require('../../handlers/data/pool.js');

async function getLinkedUser(id) {
	const [data] = await pool.query('SELECT * FROM linked_users WHERE id = ?', [
		id,
	]);

	return data;
}

async function DecryptToken(id) {
	const [data] = await getLinkedUser(id);

	if (!data) return;

	const ivBuffer = Buffer.from(process.env.ENCRYPTION_IV, 'hex');
	const decipher = crypto.createDecipheriv(
		'aes-256-cbc',
		Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
		ivBuffer
	);

	let decrypted = decipher.update(data.lichess_token, 'hex', 'utf8');

	decrypted += decipher.final('utf8');

	return decrypted;
}

module.exports = { getLinkedUser, DecryptToken };
