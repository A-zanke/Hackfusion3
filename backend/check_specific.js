const db = require('./db');

async function checkSpecific() {
    try {
        const result = await db.query(`
            SELECT name, price_per_packet, tablets_per_packet, price_per_tablet 
            FROM medicines 
            WHERE name ILIKE '%Aceclofenac%' OR name ILIKE '%Albendazole%' OR name ILIKE '%Ambroxol%'
            AND is_deleted = FALSE
        `);
        console.log(JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkSpecific();
