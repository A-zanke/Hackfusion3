const { Pool } = require('pg');
require('dotenv').config();

let config = { connectionString: process.env.DATABASE_URL };

// If DATABASE_URL is present, try to extract password explicitly to avoid SASL type errors
if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        config = {
            user: url.username,
            password: decodeURIComponent(url.password),
            host: url.hostname,
            port: url.port,
            database: url.pathname.split('/')[1],
            ssl: false // Explicitly disable if not needed
        };
    } catch (e) {
        console.error('Failed to parse DATABASE_URL, falling back to connectionString');
    }
}

const pool = new Pool(config);


pool.on('connect', () => {
    console.log('Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
