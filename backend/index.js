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

// Get all medicines
app.get('/api/medicines', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM medicines ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get low stock medicines (Threshold set in DB)
app.get('/api/medicines/low-stock', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM medicines WHERE total_tablets < low_stock_threshold');
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
