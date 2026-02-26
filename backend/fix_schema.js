const db = require('./db');
async function fixSchema() {
    try {
        console.log("Adding product_id_str...");
        await db.query('ALTER TABLE medicines ADD COLUMN IF NOT EXISTS product_id_str VARCHAR(50);');
        console.log("Adding is_deleted...");
        await db.query('ALTER TABLE medicines ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;');
        console.log("Adding prescription_required...");
        await db.query('ALTER TABLE medicines ADD COLUMN IF NOT EXISTS prescription_required BOOLEAN DEFAULT FALSE;');
        console.log("Schema fixed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Schema fix error:", err);
        process.exit(1);
    }
}
fixSchema();
