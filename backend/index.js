const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Initialize database tables on startup
async function initializeDatabase() {
    try {
        // Create users table if it doesn't exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table initialized');

        // Add customer_age column to orders table if it doesn't exist
        try {
            await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_age INTEGER');
            await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE');
            await db.query('ALTER TABLE medicines ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE');
            await db.query('ALTER TABLE medicines ADD COLUMN IF NOT EXISTS individual_tablets INTEGER DEFAULT 0');
            console.log('✅ Database columns updated');
        } catch (alterError) {
            console.log('Columns may already exist:', alterError.message);
        }

    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Initialize database on startup
initializeDatabase();

// Authentication endpoints
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User with this email or username already exists' });
        }

        // Hash password
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.query(
            'INSERT INTO users (username, email, password_hash, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, username, email',
            [username, email, hashedPassword]
        );

        const user = result.rows[0];
        res.json({
            message: 'User created successfully',
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const result = await db.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Check password
        const bcrypt = require('bcrypt');
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        res.json({
            message: 'Login successful',
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create users table if not exists
db.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )
`).catch(console.error);

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
        const cleanNumber = (val) => {
            const s = String(val ?? '').replace(/[^0-9.\-]/g, '').trim();
            if (s === '' || s === '.' || s === '-' || s === '-.') return 0;
            const n = parseFloat(s);
            return Number.isFinite(n) ? n : 0;
        };
        const cleanInt = (val) => {
            const s = String(val ?? '').replace(/[^0-9\-]/g, '').trim();
            const n = parseInt(s, 10);
            return Number.isFinite(n) ? n : 0;
        };

        // Support both manual form field "name" and Excel field "medicine_name"
        const name = body.name || body.medicine_name;
        const description = body.description || null;
        const category = body.category || null;
        const brand = body.brand || null;
        const total_packets = cleanInt(body.total_packets);
        const tablets_per_packet = Math.max(0, cleanInt(body.tablets_per_packet) || 1);
        const packet_price_inr = cleanNumber(body.packet_price_inr);
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
        const cleanNumber = (val) => {
            const s = String(val ?? '').replace(/[^0-9.\-]/g, '').trim();
            if (s === '' || s === '.' || s === '-' || s === '-.') return 0;
            const n = parseFloat(s);
            return Number.isFinite(n) ? n : 0;
        };
        const cleanInt = (val) => {
            const s = String(val ?? '').replace(/[^0-9\-]/g, '').trim();
            const n = parseInt(s, 10);
            return Number.isFinite(n) ? n : 0;
        };

        console.log('Updating medicine with data:', req.body);

        // Function to parse various date formats (aligned with create route)
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
            const ddmmyyyy_dash = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            if (ddmmyyyy_dash) return `${ddmmyyyy_dash[3]}-${ddmmyyyy_dash[2].padStart(2, '0')}-${ddmmyyyy_dash[1].padStart(2, '0')}`;
            const p = new Date(dateStr);
            return isNaN(p) ? null : p.toISOString().split('T')[0];
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
                prescription_required = $9
            WHERE id = $10
            RETURNING *
        `;

        const values = [
            name,
            description || null,
            category || null,
            brand || null,
            cleanInt(stock_packets),
            cleanInt(tablets_per_packet),
            cleanNumber(packet_price_inr),
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

// Search medicines for AI chat suggestions
app.get('/api/medicines/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        const searchQuery = `
            SELECT id, name, brand, price_per_tablet, description
            FROM medicines 
            WHERE is_deleted = FALSE 
            AND (
                name ILIKE $1 OR
                brand ILIKE $1 OR
                description ILIKE $1
            )
            ORDER BY 
                CASE WHEN name ILIKE $1 THEN 1 ELSE 2 END,
                name ASC
            LIMIT 10
        `;

        const searchTerm = `%${q}%`;
        const result = await db.query(searchQuery, [searchTerm]);

        // Format results for frontend
        const medicines = result.rows.map(med => ({
            id: med.id,
            name: med.name,
            brand: med.brand,
            price: med.price_per_tablet,
            description: med.description
        }));

        res.json(medicines);
    } catch (err) {
        console.error('Medicine search error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get single medicine with full pricing from DB
app.get('/api/medicines/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Validate that id is a valid integer
        const medicineId = parseInt(id, 10);
        if (isNaN(medicineId)) {
            return res.status(400).json({ error: 'Invalid medicine ID' });
        }

        const result = await db.query(
            'SELECT * FROM medicines WHERE id = $1 AND is_deleted = FALSE',
            [medicineId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Medicine not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching medicine by id:', err);
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
    const { customer_name, mobile, age, items } = req.body; // items = [{ medicine_id, quantity }]

    try {
        // Start transaction
        await db.query('BEGIN');

        let total_price = 0;

        // Calculate total and check stock
        for (const item of items) {
            const med = await db.query('SELECT * FROM medicines WHERE id = $1', [item.medicine_id]);
            if (med.rows.length === 0) throw new Error(`Medicine ${item.medicine_id} not found`);

            // Note: DB schema seems to use total_tablets which is GENERATED. 
            // We should check the real stock column if available or use the logic in the script.
            const currentStock = med.rows[0].stock_packets * med.rows[0].tablets_per_packet;

            if (currentStock < item.quantity) {
                throw new Error(`Insufficient stock for ${med.rows[0].name}`);
            }

            total_price += med.rows[0].price_per_tablet * item.quantity;
        }

        // Insert order
        const orderResult = await db.query(
            'INSERT INTO orders (customer_name, mobile, age, total_price) VALUES ($1, $2, $3, $4) RETURNING id',
            [customer_name || 'Anonymous', mobile || null, age || null, total_price]
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

// --- CUSTOMER ORDER SEARCH API ---

// Search customers by name, mobile, or date
app.get('/api/customers/search', async (req, res) => {
    try {
        const { query: searchQuery, type } = req.query;

        if (!searchQuery || searchQuery.trim() === '') {
            return res.json([]);
        }

        let query;
        let params;
        const searchTerm = `%${searchQuery.trim()}%`;

        if (type === 'mobile') {
            query = `
                SELECT 
                    COALESCE(o.customer_name, 'Unknown') as name,
                    COALESCE(o.mobile, 'No Mobile') as mobile,
                    COUNT(o.id) as total_orders,
                    SUM(o.total_price) as total_spent,
                    MAX(o.created_at) as last_order_date
                FROM orders o
                WHERE o.mobile ILIKE $1
                GROUP BY o.customer_name, o.mobile
                ORDER BY last_order_date DESC
            `;
            params = [searchTerm];
        } else if (type === 'name') {
            query = `
                SELECT 
                    COALESCE(o.customer_name, 'Unknown') as name,
                    COALESCE(o.mobile, 'No Mobile') as mobile,
                    COUNT(o.id) as total_orders,
                    SUM(o.total_price) as total_spent,
                    MAX(o.created_at) as last_order_date
                FROM orders o
                WHERE o.customer_name ILIKE $1
                GROUP BY o.customer_name, o.mobile
                ORDER BY last_order_date DESC
            `;
            params = [searchTerm];
        } else {
            // Unified search: name, mobile, or date
            query = `
                SELECT 
                    COALESCE(o.customer_name, 'Unknown') as name,
                    COALESCE(o.mobile, 'No Mobile') as mobile,
                    COUNT(o.id) as total_orders,
                    SUM(o.total_price) as total_spent,
                    MAX(o.created_at) as last_order_date
                FROM orders o
                WHERE 
                    o.customer_name ILIKE $1 OR 
                    o.mobile ILIKE $1 OR 
                    o.created_at::text ILIKE $1
                GROUP BY o.customer_name, o.mobile
                ORDER BY last_order_date DESC
            `;
            params = [searchTerm];
        }

        const result = await db.query(query, params);

        const customers = result.rows.map(row => ({
            id: row.mobile !== 'No Mobile' ? row.mobile.replace(/\D/g, '').slice(-10) : `ID-${Math.random().toString(36).substr(2, 9)}`,
            name: row.name,
            mobile: row.mobile,
            totalOrders: parseInt(row.total_orders) || 0,
            totalSpent: parseFloat(row.total_spent) || 0,
            lastOrderDate: row.last_order_date ? new Date(row.last_order_date).toISOString().split('T')[0] : null,
            status: 'active'
        }));

        res.json(customers);
    } catch (err) {
        console.error('Error searching customers:', err);
        res.status(500).json({ error: 'Database error', message: err.message });
    }
});

// Get all unique customers
app.get('/api/customers', async (req, res) => {
    try {
        const query = `
            SELECT 
                COALESCE(o.customer_name, 'Unknown') as name,
                COALESCE(o.mobile, 'No Mobile') as mobile,
                COUNT(o.id) as total_orders,
                SUM(o.total_price) as total_spent,
                MAX(o.created_at) as last_order_date
            FROM orders o
            GROUP BY o.customer_name, o.mobile
            ORDER BY last_order_date DESC
            LIMIT 50
        `;

        const result = await db.query(query);

        const customers = result.rows.map(row => ({
            id: row.mobile !== 'No Mobile' ? row.mobile.replace(/\D/g, '').slice(-10) : `ID-${Math.random().toString(36).substr(2, 9)}`,
            name: row.name,
            mobile: row.mobile,
            totalOrders: parseInt(row.total_orders) || 0,
            totalSpent: parseFloat(row.total_spent) || 0,
            lastOrderDate: row.last_order_date ? new Date(row.last_order_date).toISOString().split('T')[0] : null,
            status: 'active'
        }));

        res.json(customers);
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({ error: 'Database error', message: err.message });
    }
});

// Get customer order history by mobile or name
app.get('/api/customers/orders', async (req, res) => {
    try {
        const { mobile, name } = req.query;

        if (!mobile && !name) {
            return res.status(400).json({ error: 'Mobile number or Name is required' });
        }

        // Get orders for the customer - check both mobile and name
        let ordersQuery;
        let params;

        if (mobile && mobile !== 'No Mobile') {
            ordersQuery = `
                SELECT 
                    o.id as order_id,
                    o.customer_name,
                    o.mobile,
                    o.total_price,
                    o.status,
                    o.created_at
                FROM orders o
                WHERE o.mobile = $1
                ORDER BY o.created_at DESC
            `;
            params = [mobile];
        } else {
            ordersQuery = `
                SELECT 
                    o.id as order_id,
                    o.customer_name,
                    o.mobile,
                    o.total_price,
                    o.status,
                    o.created_at
                FROM orders o
                WHERE o.customer_name = $1
                ORDER BY o.created_at DESC
            `;
            params = [name];
        }

        const ordersResult = await db.query(ordersQuery, params);

        // Get order items for each order
        const orders = await Promise.all(ordersResult.rows.map(async (order) => {
            const itemsQuery = `
                SELECT 
                    oi.quantity,
                    oi.price_at_time,
                    m.name as medicine_name,
                    m.brand
                FROM order_items oi
                JOIN medicines m ON oi.medicine_id = m.id
                WHERE oi.order_id = $1
            `;

            const itemsResult = await db.query(itemsQuery, [order.order_id]);

            const items = itemsResult.rows.map(item => ({
                name: item.medicine_name,
                brand: item.brand || 'Generic',
                quantity: parseInt(item.quantity),
                price: parseFloat(item.price_at_time),
                total: parseFloat(item.price_at_time) * parseInt(item.quantity)
            }));

            const subtotal = items.reduce((sum, item) => sum + item.total, 0);
            const cgst = 0; // Removed as per user request for straightforward math
            const sgst = 0;

            return {
                orderId: `ORD-${order.order_id}`,
                userId: order.mobile?.replace(/\D/g, '').slice(-6) || 1,
                userName: order.customer_name,
                userMobile: order.mobile,
                date: order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : '',
                items: items,
                subtotal: subtotal,
                cgst: cgst,
                sgst: sgst,
                grandTotal: subtotal,
                status: order.status || 'completed',
                paymentMethod: 'COD'
            };
        }));

        res.json(orders);
    } catch (err) {
        console.error('Error fetching customer orders:', err);
        res.status(500).json({ error: 'Database error', message: err.message });
    }
});

// Enhanced AI Chat endpoint for order processing - COMPLETELY FREE, NO APIs
const { simpleChatHandler } = require('./simple-chat');

app.post('/chat', (req, res) => {
    console.log('=== CHAT ENDPOINT HIT ===');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    fs.writeFileSync('test.log', `Chat endpoint hit at ${new Date().toISOString()}\n`);
    try {
        simpleChatHandler(req, res);
    } catch (error) {
        console.error('Error in chat handler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint for debugging
app.post('/test', (req, res) => {
    console.log('=== TEST ENDPOINT HIT ===');
    fs.writeFileSync('test.log', `Test endpoint hit at ${new Date().toISOString()}\n`);
    res.json({ message: 'Test endpoint working' });
});

// --- DASHBOARD STATS ROUTE ---
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        // All Sales (for filtering)
        const allSalesQuery = `
            SELECT o.id as order_id, m.name as medicine_name, oi.quantity, oi.price_at_time as price, (oi.quantity * oi.price_at_time) as total, o.created_at
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN medicines m ON oi.medicine_id = m.id
            WHERE o.status = 'completed'
            ORDER BY o.created_at DESC
        `;
        const allSalesResult = await db.query(allSalesQuery);

        // Today's Sales
        const todaySalesQuery = `
            SELECT o.id as order_id, m.name as medicine_name, oi.quantity, oi.price_at_time as price, (oi.quantity * oi.price_at_time) as total, o.created_at
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN medicines m ON oi.medicine_id = m.id
            WHERE DATE(o.created_at) = CURRENT_DATE AND o.status = 'completed'
            ORDER BY o.created_at DESC
        `;
        const todaySalesResult = await db.query(todaySalesQuery);

        // All Orders
        const allOrdersQuery = `
            SELECT o.id as order_id, o.customer_name, o.status, o.created_at,
            (SELECT string_agg(m.name || ' (' || oi.quantity || ')', ', ') 
             FROM order_items oi 
             JOIN medicines m ON oi.medicine_id = m.id 
             WHERE oi.order_id = o.id) as medicines
            FROM orders o
            ORDER BY o.created_at DESC
        `;
        const allOrdersResult = await db.query(allOrdersQuery);

        // Low Stock
        const lowStockQuery = `
            SELECT id, name, total_tablets as remaining_quantity, low_stock_threshold
            FROM medicines
            WHERE total_tablets < low_stock_threshold AND is_deleted = FALSE
            ORDER BY total_tablets ASC
        `;
        const lowStockResult = await db.query(lowStockQuery);

        // Repeat Customers
        const repeatCustomersQuery = `
            SELECT customer_name as name, mobile, COUNT(id) as order_count 
            FROM orders 
            WHERE customer_name IS NOT NULL
            GROUP BY customer_name, mobile 
            HAVING COUNT(id) > 1 
            ORDER BY order_count DESC
        `;
        const repeatCustomersResult = await db.query(repeatCustomersQuery);

        // Fast Moving Medicines
        const fastMovingQuery = `
            SELECT m.id, m.name, SUM(oi.quantity) as total_sold
            FROM order_items oi
            JOIN medicines m ON oi.medicine_id = m.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status = 'completed' AND m.is_deleted = FALSE
            GROUP BY m.id, m.name
            ORDER BY total_sold DESC
            LIMIT 10
        `;
        const fastMovingResult = await db.query(fastMovingQuery);

        // Near Expiry Medicines
        const nearExpiryQuery = `
            SELECT id, name, expiry_date 
            FROM medicines 
            WHERE is_deleted = FALSE 
            AND expiry_date IS NOT NULL 
            AND expiry_date <= CURRENT_DATE + INTERVAL '60 days'
            AND expiry_date >= CURRENT_DATE
            ORDER BY expiry_date ASC
        `;
        const nearExpiryResult = await db.query(nearExpiryQuery);

        res.json({
            allSales: allSalesResult.rows,
            todaySales: todaySalesResult.rows,
            allOrders: allOrdersResult.rows,
            lowStock: lowStockResult.rows,
            repeatCustomers: repeatCustomersResult.rows,
            fastMoving: fastMovingResult.rows,
            nearExpiry: nearExpiryResult.rows
        });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'PharmaBuddy Backend is running with Database connection' });
});

app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});



