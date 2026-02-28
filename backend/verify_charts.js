const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

async function verify() {
    const endpoints = [
        '/dashboard/stats',
        '/dashboard/sales-trend',
        '/dashboard/fast-moving',
        '/dashboard/category-stats'
    ];

    for (const endpoint of endpoints) {
        try {
            const res = await axios.get(`${API_BASE}${endpoint}`);
            console.log(`✅ ${endpoint}: SUCCESS (${res.data.length || Object.keys(res.data).length} items)`);
            if (res.data.length > 0) {
                console.log(`   Sample:`, JSON.stringify(res.data[0]));
            }
        } catch (err) {
            console.error(`❌ ${endpoint}: FAILED - ${err.message}`);
        }
    }
}

verify();
