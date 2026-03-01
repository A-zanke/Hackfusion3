const db = require('./db');

async function migrate() {
    try {
        await db.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS expiry_time TIMESTAMP;
        `);
        console.log("Migration successful");
    } catch(e) {
        console.error("Migration failed:", e);
    } finally {
        process.exit();
    }
}
migrate();
