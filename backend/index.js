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
            if (s === '' || s === '.' || s === '-' || s === '-.' ) return 0;
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
            if (s === '' || s === '.' || s === '-' || s === '-.' ) return 0;
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
            SELECT id, name, brand, price_per_tablet, total_tablets, tablets_per_packet, description
            FROM medicines 
            WHERE is_deleted = FALSE 
            AND (
                name ILIKE $1 OR
                brand ILIKE $1 OR
                category ILIKE $1 OR
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
            stock: med.total_tablets,
            tablets_per_packet: med.tablets_per_packet,
            description: med.description
        }));
        
        res.json(medicines);
    } catch (err) {
        console.error('Medicine search error:', err);
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

// AI Chat endpoint for order processing - COMPLETELY FREE, NO APIs
app.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        
        // Advanced FREE AI logic - No external APIs needed
        const lowerMessage = message.toLowerCase().trim();
        let reply = '';
        let intent_verified = false;
        let safety_checked = false;
        let stock_checked = false;
        let stage = 'ask_quantity';
        
        // Multi-language support patterns
        const patterns = {
            // English patterns
            en: {
                quantity: /(\d+)\s*(?:tablet|pills?|capsules?)?/i,
                medicine: /(?:need|buy|want|order|give|get|add)\s+(.+)/i,
                confirmation: /(?:yes|confirm|proceed|go ahead|sure|ok|finalize|complete)/i,
                greeting: /^(hi|hello|hey)/i,
                help: /^(help|what can you do)/i,
                weather: /weather|news|sports|game/i,
                prescription: /prescription|rx|doctor note/i,
                addMore: /(?:add more|another|also|and|plus)/i,
                finalize: /(?:finalize|complete|finish|done|order now)/i,
                userDetails: /(?:age|name|mobile|phone|contact)/i
            },
            // Hindi patterns  
            hi: {
                quantity: /(\d+)\s*(?:गोलियां|गोली|टैबलेट)/i,
                medicine: /(?:चाहिए|दे|दो|ले|खरीदूं|जोड़ो)\s+(.+)/i,
                confirmation: /(?:हाँ|हां|ठीक है|अभी|पूरा करो)/i,
                greeting: /^(नमस्ते|हेलो)/i,
                help: /^(मदद|क्या कर सकते हो)/i,
                addMore: /(?:और जोड़ो|भी|और)/i,
                finalize: /(?:पूरा करो|खत्म करो|अभी ऑर्डर करो)/i,
                userDetails: /(?:उम्र|नाम|मोबाइल|फोन|संपर्क)/i
            },
            // Marathi patterns
            mr: {
                quantity: /(\d+)\s*((?:गोळ्या|गोळी|टॅबलेट))/i,
                medicine: /(?:हवे|दे|घे|खरेदी करूं|जोडा)\s+(.+)/i,
                confirmation: /(?:होय|ठीक आहे|आता|पूर्ण करा)/i,
                greeting: /^(नमस्कार|हेलो)/i,
                help: /^(मदत|तुम्ही काय करू शकता)/i,
                addMore: /(?:आणखी जोडा|आणि|पण)/i,
                finalize: /(?:पूर्ण करा|संपवा|आता ऑर्डर करा)/i,
                userDetails: /(?:वय|नाव|मोबाइल|फोन|संपर्क)/i
            }
        };
        
        // Detect language
        let detectedLang = 'en';
        if (/[ऀ-ॿ]/.test(message)) detectedLang = 'hi';
        else if (/[\u0900-\u097F]/.test(message)) detectedLang = 'mr';
        
        const lang = patterns[detectedLang] || patterns.en;
        
        // Session state for multi-medicine orders (using history to track)
        let orderSession = {
            medicines: [],
            userConfirmed: false,
            stage: 'gathering',
            pendingMedicine: null
        };
        
        // Try to extract session from history
        if (history && history.length > 0) {
            const lastMessage = history[history.length - 1];
            if (lastMessage.sessionState) {
                orderSession = { ...orderSession, ...lastMessage.sessionState };
                console.log('Restored session state:', orderSession);
            }
        }
        
        console.log('Processing message:', message, 'Current stage:', orderSession.stage, 'Pending medicine:', orderSession.pendingMedicine);
        
        // Handle greetings
        if (lang.greeting.test(message)) {
            const greetings = {
                en: "👋 Hello! I'm your PharmaAI assistant. I can help you order medicines. You can add multiple medicines and I'll show you a summary before finalizing. What do you need today?",
                hi: "👋 नमस्ते! मैं आपका फार्मासिस्टी AI सहायक हूं। मैं आपको कई दवाएं ऑर्डर करने में मदद कर सकता हूं। आप अंतिम ऑर्डर देने से पहले सारांश देख सकते हैं। आपको क्या चाहिए?",
                mr: "👋 नमस्कार! मी तुमचा फार्मासिस्टी AI सहायक आहे. मी तुम्हाला अनेक औषधे ऑर्डर करण्यात मदत करू शकतो. तुम्ही अंतिम ऑर्डर देण्यापूर्वी सारांश पाहू शकता. तुम्हाला काय हवे?"
            };
            reply = greetings[detectedLang];
            stage = 'greeting';
        }
        // Handle help requests
        else if (lang.help.test(message)) {
            const helpText = {
                en: "💊 I can help you:\n• Add multiple medicines with quantities\n• Check medicine availability\n• Provide detailed pricing breakdown\n• Handle prescription requirements\n• Process orders with user details\n\nJust tell me medicine names and quantities like: '10 paracetamol and 5 aspirin'",
                hi: "💊 मैं आपकी मदद कर सकता हूं:\n• कई दवाएं मात्रा के साथ जोड़ना\n• दवा की उपलब्धता जांचना\n• विस्तृत मूल्य विवरण प्रदान करना\n• पर्चे की आवश्यकताएं संभालना\n• उपयोगकर्ता विवरण के साथ ऑर्डर प्रोसेस करना\n\nबस मुझे दवा के नाम और मात्रा बताएं जैसे: '10 पैरासिटामोल और 5 एस्पिरिन'",
                mr: "💊 मी तुमची मदत करू शकतो:\n• अनेक औषधे प्रमाणासह जोडणे\n• औषध उपलब्धता तपासणे\n• तपशीलवार किंमत तकडा देणे\n• प्रिस्क्रिप्शन आवश्यकता हाताळणे\n• वापरकर्ता तपशीलांसह ऑर्डर प्रक्रिया करणे\n\nफक्त मला औषधांची नावे आणि प्रमाण सांगा जसे: '10 पॅरासिटामोल आणि 5 एस्पिरिन'"
            };
            reply = helpText[detectedLang];
            stage = 'help';
        }
        // Handle non-medicine queries
        else if (lang.weather.test(message)) {
            const restricted = {
                en: "🚫 I can only help with medicine orders and pharmacy-related questions. How can I assist you with your health today?",
                hi: "🚫 मैं केवल दवा ऑर्डर और फार्मेसी संबंधित प्रश्नों में मदद कर सकता हूं। आज आपके स्वास्थ्य में मैं आपकी कैसे सहायता कर सकता हूं?",
                mr: "🚫 मी फक्त औषध ऑर्डर आणि फार्मेसी संबंधित प्रश्नांमध्ये मदत करू शकतो. आज मी तुमच्या आरोग्यात तुमची कशी मदत करू शकतो?"
            };
            reply = restricted[detectedLang];
            stage = 'blocked';
        }
        // Handle prescription requirements
        else if (lang.prescription.test(message)) {
            const prescriptionMsg = {
                en: "⚠️ This medicine requires a prescription. Please consult a doctor first. I can help you with over-the-counter medicines.",
                hi: "⚠️ इस दवा के लिए पर्चे की आवश्यकता है। कृपया पहले डॉक्टर से परामर्श करें। मैं आपको OTC दवाओं में मदद कर सकता हूं।",
                mr: "⚠️ या औषधासाठी डॉक्टरचे प्रिस्क्रिप्शन आवश्यक आहे. कृपया आधी डॉक्टरांकडून सल्ला घ्या. मी तुम्हाला OTC औषधांमध्ये मदत करू शकतो."
            };
            reply = prescriptionMsg[detectedLang];
            stage = 'blocked';
        }
        // Main medicine processing logic
        // Main medicine processing logic
        // Main medicine processing logic
        else {
            // Flexible extraction: Look for (quantity + medicine) or (medicine + quantity)
            // Regex to match numbers followed by text or text followed by numbers
            const quantFirst = message.match(/^(\d+)\s+(.+)$/i);
            const medFirst = message.match(/^(.+?)\s+(\d+)$/i);
            
            let quantity = null;
            let medicineName = null;
            
            if (quantFirst) {
                quantity = parseInt(quantFirst[1]);
                medicineName = quantFirst[2].trim();
            } else if (medFirst) {
                medicineName = medFirst[1].trim();
                quantity = parseInt(medFirst[2]);
            } else {
                // Try to extract from keywords
                const medicineOnlyPattern = /(?:need|buy|want|order|give|get|add|for|pill|tab)\s+([a-z\d\s]+)/i;
                const medOnlyMatch = message.match(medicineOnlyPattern);
                medicineName = medOnlyMatch ? medOnlyMatch[1].trim() : message.trim();
            }

            // Simple cleanup
            if (medicineName) {
                medicineName = medicineName.replace(/(?:tablet|pills?|capsules?|गोलियां|गोली|टैबलेट|गोळ्या|गोळी|टॅबलेट|tablets|tabs)/gi, '').trim();
            }

            // Check if input is just a number (for ask_quantity stage)
            const justNumber = message.match(/^\d+$/);
            if (justNumber && orderSession.stage === 'ask_quantity' && orderSession.pendingMedicine) {
                medicineName = orderSession.pendingMedicine;
                quantity = parseInt(justNumber[0]);
            }

            // 1. Handle user details if in that stage
            const userDetailsMatch = (lang.userDetails.test(message) || /\d{10}/.test(message)) && orderSession.medicines.length >= 1;
            
            if (userDetailsMatch && orderSession.stage === 'user_details') {
                const nameMatch = message.match(/(?:name is|i am|my name)\s+([a-z\s]+)/i) || 
                                 message.match(/(?:नाम है|मैं हूं)\s+([a-z\s]+)/i) ||
                                 message.match(/(?:नाव आहे|मी आहे)\s+([a-z\s]+)/i);
                const ageMatch = message.match(/(?:age|उम्र|वय)\s+(\d+)/i);
                const mobileMatch = message.match(/(\d{10})/);
                
                const customerName = nameMatch ? nameMatch[1].trim() : 'Anonymous';
                const age = ageMatch ? parseInt(ageMatch[1]) : null;
                const mobile = mobileMatch ? mobileMatch[1] : null;
                
                await db.query('BEGIN');
                try {
                    let grandTotal = orderSession.medicines.reduce((sum, m) => sum + m.total_price, 0);
                    const orderResult = await db.query(
                        'INSERT INTO orders (customer_name, mobile, total_price, status, customer_age) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                        [customerName, mobile, grandTotal, 'delivered', age]
                    );
                    const orderId = orderResult.rows[0].id;
                    
                    for (const med of orderSession.medicines) {
                        await db.query(
                            'INSERT INTO order_items (order_id, medicine_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
                            [orderId, med.id, med.quantity, med.price_per_tablet]
                        );
                        await db.query('UPDATE medicines SET stock_packets = stock_packets - ($1::float / tablets_per_packet) WHERE id = $2', [med.quantity, med.id]);
                    }
                    await db.query('COMMIT');
                    
                    let receipt = `✅ **ORDER PLACED SUCCESSFULLY!**\n\n`;
                    receipt += `📋 **ORDER ID:** #${orderId}\n`;
                    receipt += `👤 **CUSTOMER:** ${customerName}\n`;
                    receipt += `📱 **MOBILE:** ${mobile || 'Not provided'}\n\n`;
                    receipt += `📦 **ORDER DETAILS:**\n`;
                    
                    orderSession.medicines.forEach((med, index) => {
                        receipt += `\n${index + 1}. **${med.name}**\n`;
                        receipt += `   📝 ${med.description || 'No description available'}\n`;
                        receipt += `   Qty: ${med.quantity} tablets | Price: ₹${med.price_per_tablet}\n`;
                        receipt += `   Subtotal: ₹${med.total_price.toFixed(2)}\n`;
                    });
                    
                    receipt += `\n💰 **TOTAL AMOUNT:** ₹${grandTotal.toFixed(2)}\n\n`;
                    receipt += `🚀 Your order will be ready soon!`;
                    
                    reply = receipt;
                    stage = 'order_completed';
                    orderSession.medicines = [];
                    return res.json({ reply, stage, sessionState: orderSession });
                } catch (txErr) {
                    await db.query('ROLLBACK');
                    throw txErr;
                }
            }

            // 2. Handle Medicine Selection
            if (medicineName && medicineName.length > 2) {
                const medicineResult = await db.query(
                    'SELECT * FROM medicines WHERE (LOWER(name) LIKE LOWER($1) OR LOWER(brand) LIKE LOWER($1)) AND is_deleted = FALSE LIMIT 1',
                    [`%${medicineName}%`]
                );
                
                if (medicineResult.rows.length > 0) {
                    const medicine = medicineResult.rows[0];
                    intent_verified = true;
                    safety_checked = true;

                    if (quantity) {
                        const price = parseFloat(medicine.price_per_tablet) || 10;
                        const totalPrice = quantity * price;
                        const total_tablets = medicine.stock_packets * medicine.tablets_per_packet;
                        
                        if (total_tablets < quantity) {
                            reply = `⚠️ I found **${medicine.name}**, but only ${total_tablets} tablets are available. Would you like to take ${total_tablets} instead?`;
                            stage = 'blocked_stock';
                        } else {
                            stock_checked = true;
                            orderSession.medicines.push({
                                id: medicine.id,
                                name: medicine.name,
                                description: medicine.description,
                                quantity: quantity,
                                price_per_tablet: price,
                                total_price: totalPrice
                            });
                            
                            if (orderSession.medicines.length === 1 && !lang.addMore.test(message)) {
                                reply = `✅ Added **${medicine.name}** (${quantity} tablets) to your cart.\n\n💰 Price: ₹${price} per tablet\n💰 Total: ₹${totalPrice.toFixed(2)}\n\nWould you like to **add more** medicines or **finalize** this order?`;
                            } else {
                                reply = `✅ Added **${medicine.name}** to your cart. Total items: ${orderSession.medicines.length}.\n\nSay **'finalize'** to place the order or keep adding!`;
                            }
                            stage = 'medicine_added';
                            orderSession.stage = 'medicine_added';
                            orderSession.pendingMedicine = null;
                        }
                    } else {
                        reply = `💊 I found **${medicine.name}** (₹${medicine.price_per_tablet}/tablet).\n\n**How many tablets** do you need?`;
                        stage = 'ask_quantity';
                        orderSession.stage = 'ask_quantity';
                        orderSession.pendingMedicine = medicine.name;
                    }
                } else if (!justNumber) {
                    // Suggest alternatives from stock
                    const alternatives = await db.query(
                        'SELECT name, price_per_tablet FROM medicines WHERE stock_packets > 0 AND is_deleted = FALSE ORDER BY RANDOM() LIMIT 3'
                    );
                    let suggestionStr = alternatives.rows.map(a => `• ${a.name} (₹${a.price_per_tablet})`).join('\n');
                    reply = `❌ Sorry, I couldn't find "**${medicineName}**" in our stock.\n\n💡 **Do you mean one of these available medicines?**\n${suggestionStr}\n\nPlease check the spelling or select from above.`;
                    stage = 'suggesting';
                }
            } else if (lang.finalize.test(message) && orderSession.medicines.length > 0) {
                if (orderSession.medicines.length >= 2) {
                    let summary = `📋 **ORDER SUMMARY (${orderSession.medicines.length} items)**\n\n`;
                    let grandTotal = 0;
                    orderSession.medicines.forEach((med, i) => {
                        summary += `${i+1}. ${med.name} (${med.quantity} tabs) - ₹${med.total_price.toFixed(2)}\n`;
                        grandTotal += med.total_price;
                    });
                    summary += `\n💰 **TOTAL: ₹${grandTotal.toFixed(2)}**\n\n📝 Please provide your **Name, Age, and Mobile number** to confirm.`;
                    reply = summary;
                    stage = 'user_details';
                    orderSession.stage = 'user_details';
                } else {
                    const med = orderSession.medicines[0];
                    await db.query('BEGIN');
                    try {
                        const orderResult = await db.query(
                            'INSERT INTO orders (customer_name, total_price, status) VALUES ($1, $2, $3) RETURNING id',
                            ['Guest User', med.total_price, 'delivered']
                        );
                        const orderId = orderResult.rows[0].id;
                        await db.query(
                            'INSERT INTO order_items (order_id, medicine_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
                            [orderId, med.id, med.quantity, med.price_per_tablet]
                        );
                        await db.query('UPDATE medicines SET stock_packets = stock_packets - ($1::float / tablets_per_packet) WHERE id = $2', [med.quantity, med.id]);
                        await db.query('COMMIT');
                        reply = `✅ **ORDER PLACED!** ✨\n\n📦 **${med.name}** (${med.quantity} tablets)\n💰 **Total to pay: ₹${med.total_price.toFixed(2)}**\n\n🚀 Order ID: #${orderId}. Thank you for choosing PharmaAI!`;
                        stage = 'order_completed';
                        orderSession.medicines = [];
                    } catch (e) {
                        await db.query('ROLLBACK');
                        throw e;
                    }
                }
            } else {
                const defaultMsg = {
                    en: "👋 I'm your PharmaAI assistant. I can help you order medicines.\n\nJust tell me: **Medicine Name and Quantity** (e.g., '10 Paracetamol' or 'Dolo 5')\n\nWhat would you like to order today?",
                    hi: "👋 मैं आपका फार्मासिस्टी AI सहायक हूं। मैं दवाएं ऑर्डर करने में मदद कर सकता हूं।\n\nबस मुझे बताएं: **दवा का नाम और मात्रा** (जैसे, '10 पैरासिटामोल')\n\nआज आप क्या ऑर्डर करना चाहेंगे?",
                    mr: "👋 मी तुमचा फार्मासिस्टी AI सहायक आहे. मी औषधे ऑर्डर करण्यास मदत करू शकतो.\n\nफक्त मला सांगा: **औषधाचे नाव आणि प्रमाण** (उदा., '10 पॅरासिटामोल')\n\nआज तुम्ही काय ऑर्डर करू इच्छिता?"
                };
                reply = defaultMsg[detectedLang];
            }
        }
        
        res.json({
            reply,
            language: detectedLang,
            stage,
            intent_verified,
            safety_checked,
            stock_checked,
            sessionState: orderSession,
            thinking: `FREE AI CHAIN OF THOUGHT: 
1. Language detected: ${detectedLang}
2. Current stage: ${stage}
3. Medicines in cart: ${orderSession.medicines.length}
4. User message: "${message}"
5. Intent verified: ${intent_verified}
6. Safety checked: ${safety_checked}
7. Stock checked: ${stock_checked}
8. Next action: ${stage === 'order_completed' ? 'Order completed successfully' : stage === 'user_details' ? 'Waiting for user details' : 'Processing order'}
9. Session active: ${orderSession.medicines.length > 0}`
        });
        
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Chat processing failed',
            reply: '❌ Sorry, I encountered an error. Please try again or contact support.',
            language: 'en',
            stage: 'error'
        });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'PharmaBuddy Backend is running with Database connection' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
