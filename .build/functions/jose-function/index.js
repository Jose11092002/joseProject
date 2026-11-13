'use strict';

const { IncomingMessage, ServerResponse } = require('http');
const { zcAuth } = require('@zcatalyst/auth');
const { Cache } = require('@zcatalyst/cache');
const { Datastore } = require('@zcatalyst/datastore');

// Name of the Catalyst Data Store table
const TABLE_NAME = 'Users';

/**
 * Helper to parse JSON body from incoming HTTP request
 * @param {IncomingMessage} req 
 * @returns {Promise<any>}
 */
function parseRequestBody(req) {
	return new Promise((resolve, reject) => {
		let body = '';
		req.on('data', chunk => {
			body += chunk;
		});
		req.on('end', () => {
			if (!body) return resolve({});
			try {
				resolve(JSON.parse(body));
			} catch (e) {
				resolve({ raw: body });
			}
		});
		req.on('error', err => reject(err));
	});
}

/**
 * Helper to send standardized JSON responses with CORS headers
 * @param {ServerResponse} res 
 * @param {number} statusCode 
 * @param {object} payload 
 */
function sendJson(res, statusCode, payload) {
	res.writeHead(statusCode, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization'
	});
	res.end(JSON.stringify(payload));
}

/**
 * Main Advanced I/O function handler
 * @param {IncomingMessage} req 
 * @param {ServerResponse} res 
 */
module.exports = async (req, res) => {
	// Handle CORS preflight options request
	if (req.method === 'OPTIONS') {
		res.writeHead(204, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		});
		res.end();
		return;
	}

	// Normalize incoming URL path
	const parsedUrl = new URL(req.url, 'http://localhost');
	let pathname = parsedUrl.pathname;
	// Strip function path prefix if present (e.g., /server/jose-function/login -> /login)
	pathname = pathname.replace(/^\/server\/[^\/]+/, '') || '/';

	try {
		// Initialize Catalyst Authentication context
		const auth = await zcAuth.init(req);

		// Route: GET /
		if (req.method === 'GET' && pathname === '/') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.write('<h2>Catalyst Backend API is running!</h2><p>Endpoints available: <code>/login</code> (POST), <code>/users</code> (GET), <code>/cache</code> (GET)</p>');
			res.end();
			return;
		}

		// Route: GET /cache
		if (req.method === 'GET' && pathname === '/cache') {
			const cache = new Cache();
			const cacheResponse = await cache.getAllSegment();
			console.log('Cache Response:', cacheResponse);
			return sendJson(res, 200, cacheResponse);
		}

		// Route: POST /login or POST /register (Insert user login data into Data Store)
		if (req.method === 'POST' && (pathname === '/login' || pathname === '/register')) {
			const body = await parseRequestBody(req);
			const { email, password, name } = body;

			if (!email || !password) {
				return sendJson(res, 400, {
					success: false,
					message: 'Email and password are required fields.'
				});
			}

			try {
				const datastore = new Datastore(auth);
				const table = datastore.table(TABLE_NAME);

				const rowData = {
					Name: name || email.split('@')[0],
					Email: email,
					Password: password, // Note: In production, consider hashing passwords using bcrypt or Catalyst Auth
					LoginTime: new Date().toISOString()
				};

				const insertedRow = await table.insertRow(rowData);

				return sendJson(res, 200, {
					success: true,
					message: 'User data inserted into Catalyst Data Store successfully!',
					data: insertedRow
				});
			} catch (dbErr) {
				console.error('Catalyst Data Store insert error:', dbErr);
				return sendJson(res, 500, {
					success: false,
					message: 'Failed to insert row into Catalyst Data Store.',
					error: dbErr.message || String(dbErr),
					hint: `Ensure the table '${TABLE_NAME}' with columns 'Name', 'Email', 'Password', and 'LoginTime' is created in Catalyst Console > Data Store.`
				});
			}
		}

		// Route: GET /users (Retrieve stored users to display in the frontend)
		if (req.method === 'GET' && pathname === '/users') {
			try {
				const datastore = new Datastore(auth);
				const table = datastore.table(TABLE_NAME);
				const rows = await table.getAllRows();

				return sendJson(res, 200, {
					success: true,
					data: rows || []
				});
			} catch (dbErr) {
				console.error('Catalyst Data Store fetch error:', dbErr);
				return sendJson(res, 500, {
					success: false,
					message: 'Failed to retrieve rows from Catalyst Data Store.',
					error: dbErr.message || String(dbErr),
					hint: `Ensure the table '${TABLE_NAME}' is created in Catalyst Console > Data Store.`
				});
			}
		}

		// Fallback 404 for unhandled routes
		return sendJson(res, 404, {
			success: false,
			message: `Route '${pathname}' not found. Available endpoints: /login (POST), /users (GET), /cache (GET)`
		});

	} catch (err) {
		console.error('Handler execution error:', err);
		return sendJson(res, 500, {
			success: false,
			message: 'Internal server error occurred.',
			error: err.message || String(err)
		});
	}
};
