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
            stage: 'gathering'
        };
        
        // Try to extract session from history
        if (history && history.length > 0) {
            const lastMessage = history[history.length - 1];
            if (lastMessage.sessionState) {
                orderSession = lastMessage.sessionState;
            }
        }
        
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
        else {
            // Extract quantity and medicine
            const quantityMatch = message.match(lang.quantity);
            const medicineMatch = message.match(lang.medicine);
            
            if (quantityMatch && medicineMatch) {
                const quantity = parseInt(quantityMatch[1]);
                let medicineName = medicineMatch[1].trim();
                
                // Clean medicine name
                medicineName = medicineName.replace(/\d+/g, '').replace(/(?:tablet|pills?|capsules?|गोलियां|गोली|टैबलेट|गोळ्या|गोळी|टॅबलेट)/gi, '').trim();
                
                if (quantity > 0 && medicineName.length > 0) {
                    // Check database for medicine
                    const medicineResult = await db.query(
                        'SELECT * FROM medicines WHERE LOWER(name) LIKE LOWER($1) AND is_deleted = FALSE LIMIT 1',
                        [`%${medicineName}%`]
                    );
                    
                    if (medicineResult.rows.length > 0) {
                        const medicine = medicineResult.rows[0];
                        const price = medicine.price_per_tablet || 10;
                        const totalPrice = quantity * price;
                        const stockAvailable = medicine.total_tablets >= quantity;
                        
                        intent_verified = true;
                        safety_checked = true;
                        stock_checked = stockAvailable;
                        
                        if (!stockAvailable) {
                            const outOfStockMsg = {
                                en: `⚠️ I found ${medicine.name}, but only ${medicine.total_tablets} tablets are available. Would you like ${medicine.total_tablets} tablets instead?`,
                                hi: `⚠️ मुझे ${medicine.name} मिली, लेकिन केवल ${medicine.total_tablets} गोलियां उपलब्ध हैं। क्या आप ${medicine.total_tablets} गोलियां लेना चाहेंगे?`,
                                mr: `⚠️ मला ${medicine.name} सापडली, पण केवळ ${medicine.total_tablets} गोळ्या उपलब्ध आहेत. तुम्हाला ${medicine.total_tablets} गोळ्या हव्यात का?`
                            };
                            reply = outOfStockMsg[detectedLang];
                            stage = 'blocked_stock';
                        } else {
                            // Add to session
                            orderSession.medicines.push({
                                id: medicine.id,
                                name: medicine.name,
                                quantity: quantity,
                                price_per_tablet: price,
                                total_price: totalPrice,
                                brand: medicine.brand || 'Generic'
                            });
                            
                            const confirmationMsg = {
                                en: `✅ Added to cart!\n\n💊 ${medicine.name} (${quantity} tablets)\n💰 Price: ₹${price} × ${quantity} = ₹${totalPrice.toFixed(2)}\n\nWould you like to:\n• Add more medicines? (e.g., "add 5 aspirin")\n• Finalize order? (e.g., "finalize order")`,
                                hi: `✅ कार्ट में जोड़ा गया!\n\n💊 ${medicine.name} (${quantity} गोलियां)\n💰 कीमत: ₹${price} × ${quantity} = ₹${totalPrice.toFixed(2)}\n\nआप क्या करना चाहेंगे:\n• और दवाएं जोड़ें? (जैसे, "add 5 aspirin")\n• ऑर्डर अंतिम करें? (जैसे, "finalize order")`,
                                mr: `✅ कार्टमध्ये जोडले!\n\n💊 ${medicine.name} (${quantity} गोळ्या)\n💰 किंमत: ₹${price} × ${quantity} = ₹${totalPrice.toFixed(2)}\n\nतुम्ही काय करू इच्छिता:\n• आणखी औषधे जोडायचे? (उदा., "add 5 aspirin")\n• ऑर्डर पूर्ण करायचा? (उदा., "finalize order")`
                            };
                            reply = confirmationMsg[detectedLang];
                            stage = 'medicine_added';
                        }
                        
                        // Check for user details in message
                        const namePatterns = {
                            en: /(?:my name is|i am)\s+([a-z\s]+)/i,
                            hi: /(?:मेरा नाम है|मैं हूं)\s+([a-z\s]+)/i,
                            mr: /(?:माझे नाव आहे|मी आहे)\s+([a-z\s]+)/i
                        };
                        
                        const mobilePattern = /(\d{10})/;
                        const nameMatch = message.match(namePatterns[detectedLang]);
                        const mobileMatch = message.match(mobilePattern);
                        const isConfirmation = lang.confirmation.test(message);
                        
                        if ((nameMatch || mobileMatch || isConfirmation) && stockAvailable) {
                            const customerName = nameMatch ? nameMatch[1].trim() : 'Anonymous';
                            const mobile = mobileMatch ? mobileMatch[1] : null;
                            
                            // Create order in database
                            await db.query('BEGIN');
                            try {
                                const orderResult = await db.query(
                                    'INSERT INTO orders (customer_name, mobile, total_price, status) VALUES ($1, $2, $3, $4) RETURNING id',
                                    [customerName, mobile, totalPrice, 'delivered']
                                );
                                const orderId = orderResult.rows[0].id;
                                
                                await db.query(
                                    'INSERT INTO order_items (order_id, medicine_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
                                    [orderId, medicine.id, quantity, price]
                                );
                                
                                // Update stock
                                const tabletsLeft = medicine.total_tablets - quantity;
                                const newPackets = Math.floor(tabletsLeft / medicine.tablets_per_packet);
                                
                                await db.query(
                                    'UPDATE medicines SET stock_packets = $1 WHERE id = $2',
                                    [newPackets, medicine.id]
                                );
                                
                                await db.query('COMMIT');
                                
                                const successMsg = {
                                    en: `✅ Order placed successfully!\n\n📦 ${quantity} tablets of ${medicine.name}\n💰 Total: ₹${totalPrice.toFixed(2)}\n👤 Customer: ${customerName}\n📱 Mobile: ${mobile || 'Not provided'}\n\n🚀 Your order will be ready soon!`,
                                    hi: `✅ ऑर्डर सफलतापूर्वक दिया गया!\n\n📦 ${medicine.name} की ${quantity} गोलियां\n💰 कुल: ₹${totalPrice.toFixed(2)}\n👤 ग्राहक: ${customerName}\n📱 मोबाइल: ${mobile || 'प्रदान नहीं किया गया'}\n\n🚀 आपका ऑर्डर जल्द ही तैयार हो जाएगा!`,
                                    mr: `✅ ऑर्डर यशस्वीरित्या दिला!\n\n📦 ${medicine.name} च्या ${quantity} गोळ्या\n💰 एकूण: ₹${totalPrice.toFixed(2)}\n👤 ग्राहक: ${customerName}\n📱 मोबाइल: ${mobile || 'पुरवले नाही'}\n\n🚀 तुमचा ऑर्डर लवकरच तयार होईल!`
                                };
                                reply = successMsg[detectedLang];
                                stage = 'placed';
                            } catch (txErr) {
                                await db.query('ROLLBACK');
                                throw txErr;
                            }
                        }
                    } else {
                        // Use medicineName which is in scope here
                        const notFoundMsg = {
                            en: `❌ Sorry, "${medicineName}" is not available in our inventory.\n\n💡 Available medicines include: Paracetamol, Aspirin, Crocin, Dolo, etc.\n\nPlease check the spelling or ask for another medicine.`,
                            hi: `❌ क्षमा करें, "${medicineName}" हमारे इन्वेंटरी में उपलब्ध नहीं है।\n\n💡 उपलब्ध दवाएं: पैरासिटामोल, एस्पिरिन, क्रोसिन, डोलो, आदि।\n\nकृपया वर्तनी जांचें या कोई दूसरी दवा पूछें।`,
                            mr: `❌ क्षमस्वर, "${medicineName}" आमच्या इन्व्हेन्टरीमध्ये उपलब्ध नाही.\n\n💡 उपलब्ध औषधे: पॅरासिटामोल, एस्पिरिन, क्रोसिन, डोलो, इत्यादी.\n\nकृपया स्पेलिंग तपासा किंवा दुसरे औषध विचारा.`
                        };
                        reply = notFoundMsg[detectedLang];
                        stage = 'blocked';
                    }
                } else {
                    const quantityMsg = {
                        en: "🤔 I need more specific information. Please tell me both the medicine name and quantity.\n\nExample: '10 paracetamol' or 'paracetamol 10 tablets'",
                        hi: "🤔 मुझे अधिक विशिष्ट जानकारी चाहिए। कृपया मुझे दवा का नाम और मात्रा दोनों बताएं।\n\nउदाहरण: '10 पैरासिटामोल' या 'पैरासिटामोल 10 गोलियां'",
                        mr: "🤔 मला अधिक विशिष्ट माहिती आवश्यक आहे. कृपया मला औषधाचे नाव आणि प्रमाण दोन्ही सांगा.\n\nउदाहरण: '10 पॅरासिटामोल' किंवा 'पॅरासिटामोल 10 गोळ्या'"
                    };
                    reply = quantityMsg[detectedLang];
                }
            } else if (lang.finalize.test(message) && orderSession.medicines.length > 0) {
                // Show order summary and ask for user details
                let summary = "📋 ORDER SUMMARY\n\n";
                let grandTotal = 0;
                
                orderSession.medicines.forEach((med, index) => {
                    summary += `${index + 1}. 💊 ${med.name} (${med.quantity} tablets)\n`;
                    summary += `   Price: ₹${med.price_per_tablet} × ${med.quantity} = ₹${med.total_price.toFixed(2)}\n`;
                    grandTotal += med.total_price;
                });
                
                summary += `\n💰 GRAND TOTAL: ₹${grandTotal.toFixed(2)}\n\n`;
                summary += "📝 Please provide your details:\n";
                summary += "• Name\n";
                summary += "• Age\n";
                summary += "• Mobile number\n\n";
                summary += "Example: 'My name is Rahul, age 25, mobile 9876543210'";
                
                reply = summary;
                stage = 'user_details';
            } else if (lang.userDetails.test(message) && orderSession.medicines.length > 0) {
                // Extract user details and finalize order
                const nameMatch = message.match(/(?:name is|i am|my name)\s+([a-z\s]+)/i) || 
                                 message.match(/(?:नाम है|मैं हूं)\s+([a-z\s]+)/i) ||
                                 message.match(/(?:नाव आहे|मी आहे)\s+([a-z\s]+)/i);
                const ageMatch = message.match(/(?:age|उम्र|वय)\s+(\d+)/i);
                const mobileMatch = message.match(/(\d{10})/);
                
                const customerName = nameMatch ? nameMatch[1].trim() : 'Anonymous';
                const age = ageMatch ? parseInt(ageMatch[1]) : null;
                const mobile = mobileMatch ? mobileMatch[1] : null;
                
                // Calculate total
                let grandTotal = 0;
                orderSession.medicines.forEach(med => {
                    grandTotal += med.total_price;
                });
                
                // Create order in database
                await db.query('BEGIN');
                try {
                    const orderResult = await db.query(
                        'INSERT INTO orders (customer_name, mobile, total_price, status, customer_age) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                        [customerName, mobile, grandTotal, 'delivered', age]
                    );
                    const orderId = orderResult.rows[0].id;
                    
                    // Add order items
                    for (const med of orderSession.medicines) {
                        await db.query(
                            'INSERT INTO order_items (order_id, medicine_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
                            [orderId, med.id, med.quantity, med.price_per_tablet]
                        );
                        
                        // Update stock
                        const medicineResult = await db.query('SELECT * FROM medicines WHERE id = $1', [med.id]);
                        const medicine = medicineResult.rows[0];
                        const tabletsLeft = medicine.total_tablets - med.quantity;
                        const newPackets = Math.floor(tabletsLeft / medicine.tablets_per_packet);
                        
                        await db.query(
                            'UPDATE medicines SET stock_packets = $1 WHERE id = $2',
                            [newPackets, med.id]
                        );
                    }
                    
                    await db.query('COMMIT');
                    
                    // Generate detailed receipt
                    let receipt = `✅ ORDER PLACED SUCCESSFULLY!\n\n`;
                    receipt += `📋 ORDER ID: #${orderId}\n`;
                    receipt += `👤 CUSTOMER: ${customerName}\n`;
                    receipt += `📱 MOBILE: ${mobile || 'Not provided'}\n`;
                    receipt += `🎂 AGE: ${age || 'Not provided'}\n`;
                    receipt += `📅 DATE: ${new Date().toLocaleDateString()}\n\n`;
                    receipt += `📦 ORDER DETAILS:\n`;
                    
                    orderSession.medicines.forEach((med, index) => {
                        receipt += `\n${index + 1}. ${med.name}\n`;
                        receipt += `   Quantity: ${med.quantity} tablets\n`;
                        receipt += `   Unit Price: ₹${med.price_per_tablet}\n`;
                        receipt += `   Subtotal: ₹${med.total_price.toFixed(2)}\n`;
                    });
                    
                    receipt += `\n💰 TOTAL AMOUNT: ₹${grandTotal.toFixed(2)}\n\n`;
                    receipt += `🚀 Your order will be ready soon!\n`;
                    receipt += `📞 For any queries, please contact: 9876543210`;
                    
                    reply = receipt;
                    stage = 'order_completed';
                    
                    // Reset session
                    orderSession.medicines = [];
                    orderSession.userConfirmed = false;
                    
                } catch (txErr) {
                    await db.query('ROLLBACK');
                    throw txErr;
                }
            } else {
                const defaultMsg = {
                    en: "👋 Welcome! I'm your PharmaAI assistant.\n\n💊 I can help you order medicines. Just tell me:\n• Medicine name and quantity (e.g., '10 paracetamol')\n• Your name and mobile number\n\nWhat would you like to order today?",
                    hi: "👋 स्वागत है! मैं आपका फार्मासिस्टी AI सहायक हूं।\n\n💊 मैं आपको दवाएं ऑर्डर करने में मदद कर सकता हूं। बस मुझे बताएं:\n• दवा का नाम और मात्रा (जैसे, '10 पैरासिटामोल')\n• आपका नाम और मोबाइल नंबर\n\nआज आप क्या ऑर्डर करना चाहेंगे?",
                    mr: "👋 स्वागत! मी तुमचा फार्मासिस्टी AI सहायक आहे.\n\n💊 मी तुम्हाला औषधे ऑर्डर करण्यात मदत करू शकतो. फक्त मला सांगा:\n• औषधाचे नाव आणि प्रमाण (उदा., '10 पॅरासिटामोल')\n• तुमचे नाव आणि मोबाइल क्रमांक\n\nआज तुम्ही काय ऑर्डर करू इच्छिता?"
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
            thinking: `FREE AI: Lang=${detectedLang}, Stage=${stage}, Medicines in cart: ${orderSession.medicines.length}, Processed successfully`
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
