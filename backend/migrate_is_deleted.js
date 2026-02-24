const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Checking for is_deleted column...");
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='medicines' AND column_name='is_deleted';
        `);

        if (res.rows.length === 0) {
            console.log("Adding is_deleted column to medicines table...");
            await client.query("ALTER TABLE medicines ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;");
            console.log("Column added successfully.");
        } else {
            console.log("is_deleted column already exists.");
        }
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
