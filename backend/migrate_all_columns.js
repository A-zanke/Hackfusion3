const db = require('./db');

async function migrate() {
    try {
        console.log('Starting full schema migration...\n');

        // Get current columns
        const cols = await db.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'medicines'"
        );
        const existing = new Set(cols.rows.map(r => r.column_name));
        console.log('Existing columns:', [...existing].join(', '));

        // Add missing columns
        const migrations = [
            { col: 'is_deleted', sql: "ALTER TABLE medicines ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE" },
            { col: 'description', sql: "ALTER TABLE medicines ADD COLUMN description TEXT" },
            { col: 'brand', sql: "ALTER TABLE medicines ADD COLUMN brand VARCHAR(255)" },
            { col: 'product_id_str', sql: "ALTER TABLE medicines ADD COLUMN product_id_str VARCHAR(50)" },
            { col: 'prescription_required', sql: "ALTER TABLE medicines ADD COLUMN prescription_required BOOLEAN DEFAULT FALSE" },
            { col: 'price_per_packet', sql: "ALTER TABLE medicines ADD COLUMN price_per_packet NUMERIC(10,2) DEFAULT 0" },
        ];

        for (const m of migrations) {
            if (!existing.has(m.col)) {
                console.log(`  Adding column: ${m.col}...`);
                await db.query(m.sql);
                console.log(`  -> Added ${m.col}`);
            } else {
                console.log(`  Column ${m.col} already exists, skipping.`);
            }
        }

        // Verify
        const verify = await db.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'medicines' ORDER BY ordinal_position"
        );
        console.log('\n=== Updated Columns ===');
        verify.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

        // Test the exact API query
        console.log('\n=== Testing API query ===');
        const result = await db.query('SELECT * FROM medicines WHERE is_deleted = FALSE ORDER BY name ASC');
        console.log(`Success! Rows returned: ${result.rows.length}`);

        console.log('\nMigration complete!');
    } catch (e) {
        console.error('Migration failed:', e.message);
    } finally {
        process.exit(0);
    }
}

migrate();
