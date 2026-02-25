const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'hackfusion',
    password: 'your_password',
    port: 5432,
});

async function addPrescriptionField() {
    try {
        // Add requires_prescription column to medicines table
        await pool.query(`
            ALTER TABLE medicines 
            ADD COLUMN IF NOT EXISTS requires_prescription BOOLEAN DEFAULT FALSE
        `);
        
        // Add customer_age column to orders table  
        await pool.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS customer_age INTEGER
        `);
        
        console.log('✅ Prescription field and customer_age field added successfully!');
        
        // Update some common medicines to require prescription
        await pool.query(`
            UPDATE medicines 
            SET requires_prescription = TRUE 
            WHERE LOWER(name) LIKE ANY(ARRAY['%antibiotic%', '%steroid%', '%painkiller%', '%antidepressant%'])
        `);
        
        console.log('✅ Updated prescription requirements for common medicines!');
        
    } catch (error) {
        console.error('❌ Error adding prescription field:', error);
    } finally {
        await pool.end();
    }
}

addPrescriptionField();
