const db = require('./db.js');

async function checkMeds() {
  try {
    const result = await db.query('SELECT name, brand FROM medicines WHERE is_deleted = FALSE ORDER BY name LIMIT 10');
    console.log('Available medicines:');
    result.rows.forEach(row => {
      console.log('- ' + row.name + (row.brand ? ' (' + row.brand + ')' : ''));
    });
    process.exit();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkMeds();
