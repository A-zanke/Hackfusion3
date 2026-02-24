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
        const body = req.body;

        // Support both manual form field "name" and Excel field "medicine_name"
        const name = body.name || body.medicine_name;
        const description = body.description || null;
        const category = body.category || null;
        const brand = body.brand || null;
        const total_packets = parseFloat(body.total_packets) || 0;
        const tablets_per_packet = parseFloat(body.tablets_per_packet) || 1;
        const packet_price_inr = parseFloat(body.packet_price_inr) || 0;
        const expiry_date = body.expiry_date;
        const prescription_required = body.prescription_required;
        
        // Calculate price per tablet
        const price_per_tablet = tablets_per_packet > 0 ? (packet_price_inr / tablets_per_packet) : 0;

        console.log('Creating medicine:', name);

        if (!name || String(name).trim() === '') {
            return res.status(400).json({ error: 'Medicine name is required' });
        }

        const parseDate = (raw) => {
            if (raw === null || raw === undefined || raw === '') return null;
            if (typeof raw === 'number') {
                const excelEpoch = new Date(1899, 11, 30);
                const msPerDay = 24 * 60 * 60 * 1000;
                const date = new Date(excelEpoch.getTime() + raw * msPerDay);
                if (isNaN(date)) return null;
                return date.toISOString().split('T')[0];
            }
            const dateStr = String(raw).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
            const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2, '0')}-${mmddyyyy[2].padStart(2, '0')}`;
            const ddmmyyyy = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
            const p = new Date(dateStr);
            return isNaN(p) ? null : p.toISOString().split('T')[0];
        };

        const normalisePrescription = (val) => {
            if (typeof val === 'boolean') return val;
            const s = String(val || '').toLowerCase().trim();
            return s === 'yes' || s === 'true' || s === '1';
        };

        const product_id_str = 'MED' + Date.now().toString().slice(-6);
        const parsedExpiryDate = parseDate(expiry_date);
        const prescriptionBool = normalisePrescription(prescription_required);

        const query = `
            INSERT INTO medicines (
                name, description, category, brand, product_id_str,
                stock_packets, tablets_per_packet, price_per_packet,
                expiry_date, prescription_required, is_deleted
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)
            RETURNING *
        `;

        const values = [
            String(name).trim(),
            description,
            category,
            brand,
            product_id_str,
            total_packets,
            tablets_per_packet,
            packet_price_inr,
            parsedExpiryDate,
            prescriptionBool
        ];

        const result = await db.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating medicine:', err.message);
        res.status(500).json({ error: 'Database error', message: err.message });
    }
});

// Update medicine
app.put('/api/medicines/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            category,
            brand,
            stock_packets,
            tablets_per_packet,
            packet_price_inr,
            expiry_date,
            prescription_required
        } = req.body;

        console.log('Updating medicine with data:', req.body);

        // Function to parse various date formats
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            
            // Handle MM/DD/YYYY format
            const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mmddyyyy) {
                const [_, month, day, year] = mmddyyyy;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            // Handle DD/MM/YYYY format
            const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmmyyyy) {
                const [_, day, month, year] = ddmmyyyy;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            // Handle YYYY-MM-DD format (already correct)
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return dateStr;
            }
            
            return null;
        };

        // Normalise prescription_required to boolean
        const normalizePrescription = (val) => {
            if (val === null || val === undefined) return false;
            if (typeof val === 'boolean') return val;
            const s = String(val).toLowerCase().trim();
            return s === 'yes' || s === 'true' || s === '1';
        };

        // Parse the expiry date
        const parsedExpiryDate = parseDate(expiry_date);

        const query = `
            UPDATE medicines SET 
                name = $1, 
                description = $2, 
                category = $3, 
                brand = $4, 
                stock_packets = $5, 
                tablets_per_packet = $6, 
                price_per_packet = $7, 
                expiry_date = $8, 
                prescription_required = $9,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $10
            RETURNING *
        `;

        const values = [
            name,
            description || null,
            category || null,
            brand || null,
            parseInt(stock_packets) || 0,
            parseInt(tablets_per_packet) || 0,
            parseFloat(packet_price_inr) || 0,
            parsedExpiryDate || null,
            normalizePrescription(prescription_required),
            parseInt(id)
        ];

        const result = await db.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Medicine not found' });
        }

        console.log('Medicine updated successfully:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating medicine:', err);
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
