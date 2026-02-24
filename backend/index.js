const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// --- MEDICINE ROUTES ---

// Get all medicines (Active only)
app.get('/api/medicines', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM medicines WHERE is_deleted = FALSE ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create new medicine
app.post('/api/medicines', async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            brand,
            total_packets,
            tablets_per_packet,
            packet_price_inr,
            expiry_date
        } = req.body;

        console.log('Creating medicine with data:', req.body);

        // Generate unique product ID
        const product_id_str = 'MED' + Date.now().toString().slice(-6);

        const query = `
            INSERT INTO medicines (
                name, description, category, brand, product_id_str,
                stock_packets, tablets_per_packet, price_per_packet, expiry_date, is_deleted
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
            RETURNING *
        `;

        const values = [
            name,
            description || null,
            category || null,
            brand || null,
            product_id_str,
            parseInt(total_packets) || 0,
            parseInt(tablets_per_packet) || 0,
            parseFloat(packet_price_inr) || 0,
            expiry_date || null
        ];

        const result = await db.query(query, values);
        console.log('Medicine created successfully:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating medicine:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Get deleted medicines (Bin)
app.get('/api/medicines/bin', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM medicines WHERE is_deleted = TRUE ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Soft delete medicine(s)
app.post('/api/medicines/soft-delete', async (req, res) => {
    const { ids } = req.body; // Array of IDs
    try {
        await db.query('UPDATE medicines SET is_deleted = TRUE WHERE id = ANY($1)', [ids]);
        res.json({ message: 'Moved to bin' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Restore medicine(s)
app.post('/api/medicines/restore', async (req, res) => {
    const { ids } = req.body;
    try {
        await db.query('UPDATE medicines SET is_deleted = FALSE WHERE id = ANY($1)', [ids]);
        res.json({ message: 'Restored from bin' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Permanent delete medicine(s)
app.post('/api/medicines/permanent-delete', async (req, res) => {
    const { ids } = req.body;
    try {
        await db.query('DELETE FROM medicines WHERE id = ANY($1)', [ids]);
        res.json({ message: 'Permanently deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get low stock medicines
app.get('/api/medicines/low-stock', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM medicines WHERE total_tablets < low_stock_threshold AND is_deleted = FALSE');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- ALERT ROUTES ---

// Get active alerts
app.get('/api/alerts', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM alerts WHERE is_resolved = FALSE ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get recent orders
app.get('/api/orders/recent', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- CATEGORY AND BRAND ROUTES ---

// Get all unique categories
app.get('/api/categories', async (req, res) => {
    try {
        // Disable caching for search functionality
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        const { search } = req.query;
        if (search) {
            console.log('Categories API called with search:', search);
        } else {
            console.log('Categories API called - loading all categories');
        }
        
        let query = 'SELECT DISTINCT category FROM medicines WHERE category IS NOT NULL AND category != \'\'';
        let params = [];
        
        if (search) {
            query += ' AND category ILIKE $1';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY category ASC';
        const result = await db.query(query, params);
        console.log('Categories result count:', result.rows.length);
        res.json(result.rows.map(row => row.category));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get all unique brands
app.get('/api/brands', async (req, res) => {
    try {
        // Disable caching for search functionality
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        const { search } = req.query;
        if (search) {
            console.log('Brands API called with search:', search);
        } else {
            console.log('Brands API called - loading all brands');
        }
        
        let query = 'SELECT DISTINCT brand FROM medicines WHERE brand IS NOT NULL AND brand != \'\'';
        let params = [];
        
        if (search) {
            query += ' AND brand ILIKE $1';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY brand ASC';
        const result = await db.query(query, params);
        console.log('Brands result count:', result.rows.length);
        res.json(result.rows.map(row => row.brand));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- ORDER ROUTES ---

// Minimalistic Order Creation (Basic logic)
app.post('/api/orders', async (req, res) => {
    const { customer_name, mobile, items } = req.body; // items = [{ medicine_id, quantity }]
    
    try {
        // Start transaction
        await db.query('BEGIN');
        
        let total_price = 0;
        
        // Calculate total and check stock
        for (const item of items) {
            const med = await db.query('SELECT * FROM medicines WHERE id = $1', [item.medicine_id]);
            if (med.rows.length === 0) throw new Error(`Medicine ${item.medicine_id} not found`);
            
            if (med.rows[0].total_tablets < item.quantity) {
                throw new Error(`Insufficient stock for ${med.rows[0].name}`);
            }
            
            total_price += med.rows[0].price_per_tablet * item.quantity;
        }
        
        // Insert order
        const orderResult = await db.query(
            'INSERT INTO orders (customer_name, mobile, total_price) VALUES ($1, $2, $3) RETURNING id',
            [customer_name, mobile, total_price]
        );
        const orderId = orderResult.rows[0].id;
        
        // Insert items and update stock
        for (const item of items) {
            const med = await db.query('SELECT * FROM medicines WHERE id = $1', [item.medicine_id]);
            await db.query(
                'INSERT INTO order_items (order_id, medicine_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
                [orderId, item.medicine_id, item.quantity, med.rows[0].price_per_tablet]
            );
            
            // Reduce stock
            // Note: DB formula handles total_tablets, we need to update stock_packets
            // For simplicity, let's assume we reduce from total_tablets (which is generated). 
            // In a real system, you'd calculate how many packets to open.
            // For now, let's just decrement stock_packets by a fraction or handle tablets separately.
            // Since total_tablets is GENERATED, we update stock_packets.
            const tabletsLeft = med.rows[0].total_tablets - item.quantity;
            const newPackets = Math.floor(tabletsLeft / med.rows[0].tablets_per_packet);
            
            await db.query(
                'UPDATE medicines SET stock_packets = $1 WHERE id = $2',
                [newPackets, item.medicine_id]
            );
        }
        
        await db.query('COMMIT');
        res.json({ message: 'Order created successfully', orderId });
        
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'PharmaBuddy Backend is running with Database connection' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
