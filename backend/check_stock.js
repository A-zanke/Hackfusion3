const db = require('./db');

async function checkStock() {
  try {
    const result = await db.query(`
      SELECT name, stock_packets, tablets_per_packet, individual_tablets 
      FROM medicines 
      WHERE name ILIKE '%paracetamol%' OR name ILIKE '%aceclofenac%'
    `);
    
    console.log('Current Stock Status:');
    result.rows.forEach(row => {
      const totalTablets = (row.stock_packets * row.tablets_per_packet) + row.individual_tablets;
      console.log(`${row.name}: ${row.stock_packets} packets + ${row.individual_tablets} tablets = ${totalTablets} total tablets`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkStock();
