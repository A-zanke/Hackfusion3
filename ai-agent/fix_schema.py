import psycopg2

import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

# Drop dependent tables first (order_items references medicines)
cur.execute("DROP TABLE IF EXISTS order_items CASCADE")
cur.execute("DROP TABLE IF EXISTS orders CASCADE")
cur.execute("DROP TABLE IF EXISTS alerts CASCADE")
cur.execute("DROP TABLE IF EXISTS medicines CASCADE")

# Recreate with the correct full schema
cur.execute('''
    CREATE TABLE IF NOT EXISTS medicines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        stock_packets INTEGER NOT NULL DEFAULT 0,
        tablets_per_packet INTEGER NOT NULL DEFAULT 1,
        total_tablets INTEGER GENERATED ALWAYS AS (stock_packets * tablets_per_packet) STORED,
        price_per_tablet DECIMAL(10, 2) NOT NULL DEFAULT 0,
        expiry_date DATE,
        low_stock_threshold INTEGER DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
''')

cur.execute('''
    CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255),
        mobile VARCHAR(20),
        total_price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
''')

cur.execute('''
    CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        medicine_id INTEGER REFERENCES medicines(id),
        quantity INTEGER NOT NULL,
        price_at_time DECIMAL(10, 2) NOT NULL
    );
''')

cur.execute('''
    CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        medicine_id INTEGER REFERENCES medicines(id),
        message TEXT NOT NULL,
        type VARCHAR(50),
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
''')

conn.commit()

# Verify
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='medicines' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("medicines columns after fix:", cols)

cur.close()
conn.close()
print("Done! Tables recreated with correct schema.")
