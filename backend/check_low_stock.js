const db = require('./db');

async function checkLowStock() {
  try {
    const result = await db.query('SELECT name, total_tablets FROM medicines WHERE is_deleted = false ORDER BY total_tablets ASC LIMIT 10');
    console.log('Medicines with lowest tablet counts:');
    result.rows.forEach(row => {
      console.log(`${row.name}: ${row.total_tablets} tablets`);
    });
    
    const lowStockCount = await db.query('SELECT COUNT(*) FROM medicines WHERE is_deleted = false AND total_tablets < 30');
    console.log(`\nTotal medicines with < 30 tablets: ${lowStockCount.rows[0].count}`);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

checkLowStock();
