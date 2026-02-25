const db = require('../db');

async function addAgeToOrders() {
    try {
        // Check if level column already exists
        const result = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'age'
        `);
        
        if (result.rows.length === 0) {
            await db.query(`
                ALTER TABLE orders 
                ADD COLUMN age INTEGER
            `);
            console.log('✅ Added age column to orders table');
        } else {
            console.log('✅ age column already exists in orders table');
        }
        
    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

addAgeToOrders();
