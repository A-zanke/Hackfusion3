const db = require('./db.js');

async function createUsersTable() {
    try {
        // Create users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Users table created successfully');
        
        // Verify table exists
        const result = await db.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'users\' ORDER BY ordinal_position');
        console.log('Users table columns:', result.rows);
        
    } catch (error) {
        console.error('Error creating users table:', error);
    } finally {
        process.exit();
    }
}

createUsersTable();
