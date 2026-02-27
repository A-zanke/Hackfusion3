const db = require('./db');

async function migrate() {
  try {
    console.log('Adding individual_tablets column...');
    
    // Add the column
    await db.query(`
      ALTER TABLE medicines 
      ADD COLUMN IF NOT EXISTS individual_tablets INTEGER DEFAULT 0
    `);
    
    console.log('Column added successfully!');
    
    // Update existing records
    await db.query(`
      UPDATE medicines 
      SET individual_tablets = 0 
      WHERE individual_tablets IS NULL
    `);
    
    console.log('Existing records updated!');
    
    // Check the schema
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'medicines'
      ORDER BY ordinal_position
    `);
    
    console.log('Updated medicines table schema:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    console.log('Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
