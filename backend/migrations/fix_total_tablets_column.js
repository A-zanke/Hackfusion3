const db = require('../db');

async function fixTotalTabletsColumn() {
  try {
    console.log('🔧 Updating medicines.total_tablets to be a normal integer column...');

    // 1. Try to drop generated expression if it exists (older schema)
    try {
      await db.query('ALTER TABLE medicines ALTER COLUMN total_tablets DROP EXPRESSION;');
      console.log('Dropped GENERATED expression from total_tablets.');
    } catch (err) {
      console.log('No GENERATED expression on total_tablets (or already dropped). Proceeding...');
    }

    // 2. Ensure default and NOT NULL
    await db.query(`
      ALTER TABLE medicines
      ALTER COLUMN total_tablets SET DEFAULT 0,
      ALTER COLUMN total_tablets SET NOT NULL;
    `);

    // 3. Backfill current values based on packets/tablets_per_packet
    await db.query(`
      UPDATE medicines
      SET total_tablets = stock_packets * tablets_per_packet
      WHERE total_tablets IS NULL OR total_tablets = 0;
    `);

    console.log('✅ total_tablets column fixed and backfilled.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing total_tablets column:', error);
    process.exit(1);
  }
}

fixTotalTabletsColumn();

