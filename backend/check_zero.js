const db = require('./db');

async function checkZero() {
    try {
        // Count total active medicines
        const total = await db.query('SELECT COUNT(*) as count FROM medicines WHERE is_deleted = FALSE');
        console.log('Total active:', total.rows[0].count);
        
        // Count ones with null price_per_packet
        const nullPkt = await db.query('SELECT COUNT(*) as count FROM medicines WHERE is_deleted = FALSE AND price_per_packet IS NULL');
        console.log('With null price_per_packet:', nullPkt.rows[0].count);

        // Count ones with zero price_per_packet
        const zeroPkt = await db.query('SELECT COUNT(*) as count FROM medicines WHERE is_deleted = FALSE AND price_per_packet = 0');
        console.log('With zero price_per_packet:', zeroPkt.rows[0].count);

        // Show first 5 sorted by name
        const sample = await db.query('SELECT name, price_per_packet, price_per_tablet, tablets_per_packet FROM medicines WHERE is_deleted = FALSE ORDER BY name ASC LIMIT 5');
        console.log('First 5 by name:', JSON.stringify(sample.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkZero();
