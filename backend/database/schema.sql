-- PharmaBuddy Database Schema

-- 1. Medicines Table
CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    brand VARCHAR(255),
    stock_packets INTEGER NOT NULL DEFAULT 0,
    tablets_per_packet INTEGER NOT NULL DEFAULT 1,
    total_tablets INTEGER GENERATED ALWAYS AS (stock_packets * tablets_per_packet) STORED,
    price_per_tablet DECIMAL(10, 2) NOT NULL,
    expiry_date DATE,
    low_stock_threshold INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255),
    mobile VARCHAR(20),
    total_price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    medicine_id INTEGER REFERENCES medicines(id),
    quantity INTEGER NOT NULL, -- quantity in tablets
    price_at_time DECIMAL(10, 2) NOT NULL
);

-- 4. Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    medicine_id INTEGER REFERENCES medicines(id),
    message TEXT NOT NULL,
    type VARCHAR(50), -- 'Stock', 'Expiry', 'User'
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data for Hackathon
INSERT INTO medicines (name, category, stock_packets, tablets_per_packet, price_per_tablet, expiry_date)
VALUES 
('Crocin', 'Painkiller', 10, 15, 2.50, '2026-12-31'),
('Dolo 650', 'Fever', 5, 10, 3.00, '2025-06-30'),
('Vicks Action 500', 'Cold', 20, 10, 5.00, '2025-08-15');
