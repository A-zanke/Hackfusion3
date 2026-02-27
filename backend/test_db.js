const db = require('./db');

async function check() {
    try {
        const res = await db.query('SELECT count(*), is_deleted FROM medicines GROUP BY is_deleted');
        console.log('Counts by is_deleted:', res.rows);

        const meds = await db.query('SELECT * FROM medicines LIMIT 1');
        console.log('Sample medicine:', meds.rows[0]);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
check();
