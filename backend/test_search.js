const db = require('./db.js');

async function testSearch() {
  try {
    const testNames = ['Aceclofenac', 'Amlodipine', 'Paracetamol', 'Crocin'];
    
    for (const name of testNames) {
      console.log(`\n=== Testing search for: "${name}" ===`);
      
      // Try the same search logic as in the chat
      let rs = await db.query('SELECT * FROM medicines WHERE (LOWER(name) LIKE LOWER($1) OR LOWER(brand) LIKE LOWER($1)) AND is_deleted = FALSE LIMIT 1',[`%${name}%`]);
      
      console.log(`Search 1 (LIKE): Found ${rs.rows.length} results`);
      if (rs.rows.length > 0) {
        console.log(`Found: ${rs.rows[0].name}`);
      }
      
      // If not found, try exact match
      if(rs.rows.length===0){
        rs = await db.query('SELECT * FROM medicines WHERE LOWER(name) = LOWER($1) AND is_deleted = FALSE LIMIT 1',[name.trim()]);
        console.log(`Search 2 (EXACT): Found ${rs.rows.length} results`);
        if (rs.rows.length > 0) {
          console.log(`Found: ${rs.rows[0].name}`);
        }
      }
      
      // If still not found, try without common suffixes
      if(rs.rows.length===0){
        const cleanName = name.replace(/(?:tablet|tablets|tabs?|pills?|capsules?|mg|mcg|g)\b/gi, '').trim();
        rs = await db.query('SELECT * FROM medicines WHERE (LOWER(name) LIKE LOWER($1) OR LOWER(brand) LIKE LOWER($1)) AND is_deleted = FALSE LIMIT 1',[`%${cleanName}%`]);
        console.log(`Search 3 (CLEAN): Found ${rs.rows.length} results for "${cleanName}"`);
        if (rs.rows.length > 0) {
          console.log(`Found: ${rs.rows[0].name}`);
        }
      }
    }
    
    process.exit();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testSearch();
