const db = require('./db');

async function updatePrescriptionData() {
    try {
        console.log('Updating prescription data for medicines...');
        
        // Update some sample medicines to require prescription based on category and name
        await db.query(`
            UPDATE medicines 
            SET prescription_required = TRUE 
            WHERE category = 'Pain Relief' 
            OR name ILIKE '%paracetamol%' 
            OR name ILIKE '%ibuprofen%'
            OR name ILIKE '%antibiotic%'
            OR name ILIKE '%antiallergic%'
        `);
        
        console.log('Updated medicines to require prescription');
        
        // Get updated count
        const result = await db.query(`
            SELECT COUNT(*) as total_count,
                   COUNT(CASE WHEN prescription_required = TRUE THEN 1 END) as prescription_count
            FROM medicines 
            WHERE is_deleted = FALSE
        `);
        
        console.log(`Total medicines: ${result.rows[0].total_count}`);
        console.log(`Prescription required: ${result.rows[0].prescription_count}`);
        
        // Show some examples
        const examples = await db.query(`
            SELECT name, category, prescription_required 
            FROM medicines 
            WHERE is_deleted = FALSE 
            ORDER BY prescription_required DESC, name 
            LIMIT 10
        `);
        
        console.log('\nSample medicines:');
        examples.rows.forEach(med => {
            console.log(`${med.name} - ${med.category} - ${med.prescription_required ? 'PRESCRIPTION' : 'OTC'}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

updatePrescriptionData();
