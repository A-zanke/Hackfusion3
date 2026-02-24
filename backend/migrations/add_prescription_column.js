const db = require('../db');

async function addPrescriptionColumn() {
    try {
        // Check if column already exists
        const result = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'medicines' 
            AND column_name = 'prescription_required'
        `);
        
        if (result.rows.length === 0) {
            // Add the prescription_required column
            await db.query(`
                ALTER TABLE medicines 
                ADD COLUMN prescription_required BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Added prescription_required column to medicines table');
            
            // Update existing medicines to have prescription_required = FALSE (OTC)
            await db.query(`
                UPDATE medicines 
                SET prescription_required = FALSE 
                WHERE prescription_required IS NULL
            `);
            console.log('✅ Updated existing medicines to have prescription_required = FALSE');
        } else {
            console.log('✅ prescription_required column already exists');
        }
        
        // Add is_deleted column if it doesn't exist (for soft delete functionality)
        const deletedResult = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'medicines' 
            AND column_name = 'is_deleted'
        `);
        
        if (deletedResult.rows.length === 0) {
            await db.query(`
                ALTER TABLE medicines 
                ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Added is_deleted column to medicines table');
        } else {
            console.log('✅ is_deleted column already exists');
        }
        
        console.log('🎉 Database migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

addPrescriptionColumn();
