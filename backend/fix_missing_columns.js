const db = require('./db');

async function fix() {
    const columnsToAdd = [
        'is_deleted BOOLEAN DEFAULT FALSE',
        'description TEXT',
        'brand VARCHAR(255)',
        'product_id_str VARCHAR(100)',
        'prescription_required BOOLEAN DEFAULT FALSE',
        'price_per_packet DECIMAL(10, 2) DEFAULT 0'
    ];

    for (let col of columnsToAdd) {
        try {
            await db.query(`ALTER TABLE medicines ADD COLUMN IF NOT EXISTS ${col.split(' ')[0]} ${col.substring(col.indexOf(' ') + 1)}`);
            console.log(`Added ${col}`);
        } catch (e) {
            console.error(`Error adding ${col}:`, e.message);
        }
    }
    process.exit(0);
}

fix();
