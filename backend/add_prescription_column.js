const db = require('./db');

async function addPrescriptionColumn() {
    try {
        console.log('Adding prescription_required column to medicines table...');
        
        // Add the column
        await db.query(`
            ALTER TABLE medicines 
            ADD COLUMN prescription_required BOOLEAN DEFAULT FALSE
        `);
        
        console.log('Column added successfully!');
        
        // Update some sample medicines to require prescription
        await db.query(`
            UPDATE medicines 
            SET prescription_required = TRUE 
            WHERE name ILIKE '%paracetamol%' OR name ILIKE '%ibuprofen%' OR category = 'Pain Relief'
        `);
        
        console.log('Updated pain relief medicines to require prescription');
        
        // Get updated count
        const result = await db.query(`
            SELECT COUNT(*) as count, 
                   COUNT(CASE WHEN prescription_required = TRUE THEN 1 END) as prescription_count
            FROM medicines 
            WHERE is_deleted = FALSE
        `);
        
        console.log(`Total medicines: ${result.rows[0].count}`);
        console.log(`Prescription required: ${result.rows[0].prescription_count}`);
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

addPrescriptionColumn();
