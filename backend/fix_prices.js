const db = require('./db');

async function fixPrices() {
    try {
        // Check how many medicines have null or zero price_per_packet
        const nullPrices = await db.query(`
            SELECT COUNT(*) as count FROM medicines WHERE price_per_packet IS NULL OR price_per_packet = 0
        `);
        console.log('Medicines with null/zero price_per_packet:', nullPrices.rows[0].count);

        // Check how many medicines have null or zero price_per_tablet
        const nullTabletPrices = await db.query(`
            SELECT COUNT(*) as count FROM medicines WHERE price_per_tablet IS NULL OR price_per_tablet = 0
        `);
        console.log('Medicines with null/zero price_per_tablet:', nullTabletPrices.rows[0].count);

        // Sample of medicines with zero prices
        const sample = await db.query(`
            SELECT id, name, price_per_packet, tablets_per_packet, price_per_tablet 
            FROM medicines 
            WHERE price_per_packet IS NULL OR price_per_packet = 0
            LIMIT 5
        `);
        console.log('Sample zero-price medicines:', JSON.stringify(sample.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixPrices();
