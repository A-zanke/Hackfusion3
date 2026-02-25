const db = require('./db');

async function checkOrdersColumns() {
    try {
        const result = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'orders'
            ORDER BY ordinal_position
        `);
        console.log('Orders columns:');
        console.log(JSON.stringify(result.rows, null, 2));

        const itemResult = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'order_items'
            ORDER BY ordinal_position
        `);
        console.log('Order Items columns:');
        console.log(JSON.stringify(itemResult.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkOrdersColumns();
