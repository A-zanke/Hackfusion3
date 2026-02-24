const db = require('./db');

const fs = require('fs');

async function checkSchema() {
    try {
        const result = await db.query(`
            SELECT column_name, is_generated, generation_expression, column_default, data_type
            FROM information_schema.columns
            WHERE table_name = 'medicines'
            ORDER BY ordinal_position
        `);
        
        const data = await db.query('SELECT * FROM medicines WHERE name IS NOT NULL LIMIT 10');
        
        const output = {
            schema: result.rows,
            sampleData: data.rows
        };
        
        fs.writeFileSync('schema_log.json', JSON.stringify(output, null, 2));
        console.log('Results written to schema_log.json');
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
