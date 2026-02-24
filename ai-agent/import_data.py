import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
import numpy as np
from dotenv import load_dotenv

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))
# Load .env from the backend directory
load_dotenv(dotenv_path=os.path.join(script_dir, "../Backend/.env"))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cursor = conn.cursor()

# DATABASE INITIALIZATION
def init_db():
    conn = get_db_connection()
    if not conn: return
    cursor = conn.cursor()
    
    # 1. Medicines Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS medicines (
            id SERIAL PRIMARY KEY,
            product_id_str VARCHAR(50),
            name VARCHAR(255) UNIQUE NOT NULL,
            category VARCHAR(100),
            brand VARCHAR(255),
            description TEXT,
            stock_packets INTEGER NOT NULL DEFAULT 0,
            tablets_per_packet INTEGER NOT NULL DEFAULT 1,
            total_tablets INTEGER GENERATED ALWAYS AS (stock_packets * tablets_per_packet) STORED,
            price_per_tablet DECIMAL(10, 2) NOT NULL DEFAULT 0,
            expiry_date DATE,
            low_stock_threshold INTEGER DEFAULT 30,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

    # 2. Orders Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            customer_name VARCHAR(255),
            mobile VARCHAR(20),
            total_price DECIMAL(10, 2) NOT NULL,
            status VARCHAR(50) DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

    # 3. Order Items Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id),
            medicine_id INTEGER REFERENCES medicines(id),
            quantity INTEGER NOT NULL,
            price_at_time DECIMAL(10, 2) NOT NULL
        );
    ''')

    # 4. Alerts Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id SERIAL PRIMARY KEY,
            medicine_id INTEGER REFERENCES medicines(id),
            message TEXT NOT NULL,
            type VARCHAR(50),
            is_resolved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    
    # Truncate tables to ensure a clean slate
    print("Clearing existing data...")
    cursor.execute('TRUNCATE TABLE alerts, order_items, orders, medicines CASCADE;')
    conn.commit()

    # Ensure UNIQUE constraint
    cursor.execute("""
        SELECT 1 FROM pg_constraint WHERE conname = 'medicines_name_key'
    """)
    if not cursor.fetchone():
        try:
            print("Adding UNIQUE constraint to medicines(name)...")
            cursor.execute('ALTER TABLE medicines ADD CONSTRAINT medicines_name_key UNIQUE (name);')
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Note on constraint: {e}")
    
    cursor.close()
    conn.close()
    print("Database tables initialized and cleared.")

def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def clean_val(val, default=None):
    if pd.isna(val) or val is pd.NaT or (isinstance(val, str) and val.strip().lower() == 'nan'):
        return default
    if isinstance(val, str):
        return val.strip()
    return val

def import_products(file_path):
    print(f"--- Importing Products from {file_path} ---")
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return

    try:
        df = pd.read_excel(file_path)
        # Robustly clean column names: strip spaces and remove quotes
        df.columns = [c.strip().replace('"', '').replace("'", "") for c in df.columns]
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return

    conn = get_db_connection()
    if not conn: return
    cur = conn.cursor()

    data_list = []
    for _, row in df.iterrows():
        try:
            name = clean_val(row.get('Product Name'))
            if not name: continue
            
            tabs_per_packet = int(clean_val(row.get('Tablets Per Packet'), 1))
            price_per_tablet = float(clean_val(row.get('Price Per Tablet'), 0.0))
            
            # If price_per_tablet is still 0, try calculating from Price Per Packet
            if price_per_tablet == 0:
                price_per_packet = float(clean_val(row.get('Price Per Packet'), 0.0))
                if tabs_per_packet > 0:
                    price_per_tablet = price_per_packet / tabs_per_packet

            data_list.append((
                clean_val(row.get('Product ID')),
                name,
                clean_val(row.get('Category')),
                clean_val(row.get('Brand'), 'Generic'),
                clean_val(row.get('Description')),
                int(clean_val(row.get('Total Packets'), 0)),
                tabs_per_packet,
                price_per_tablet,
                clean_val(row.get('Expiray Date'))
            ))
        except Exception as e:
            print(f"Skipping product row due to error: {e}")

    query = """
        INSERT INTO medicines (product_id_str, name, category, brand, description, stock_packets, tablets_per_packet, price_per_tablet, expiry_date)
        VALUES %s
        ON CONFLICT (name) DO UPDATE SET
            product_id_str = EXCLUDED.product_id_str,
            category = EXCLUDED.category,
            brand = EXCLUDED.brand,
            description = EXCLUDED.description,
            stock_packets = EXCLUDED.stock_packets,
            tablets_per_packet = EXCLUDED.tablets_per_packet,
            price_per_tablet = EXCLUDED.price_per_tablet,
            expiry_date = EXCLUDED.expiry_date;
    """
    
    try:
        execute_values(cur, query, data_list)
        conn.commit()
        print(f"Successfully imported {len(data_list)} products.")
    except Exception as e:
        conn.rollback()
        print(f"Error importing products: {e}")
    finally:
        cur.close()
        conn.close()

def import_orders(file_path):
    print(f"--- Importing Orders from {file_path} ---")
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return

    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return

    conn = get_db_connection()
    if not conn: return
    cur = conn.cursor()

    success_count = 0
    try:
        for i, row in df.iterrows():
            # Use SAVEPOINT to handle errors per row
            cur.execute(f"SAVEPOINT row_{i}")
            try:
                prod_name = clean_val(row.get('Product Name'))
                if not prod_name: continue

                # 1. Look up medicine_id
                cur.execute("SELECT id, price_per_tablet FROM medicines WHERE name = %s", (prod_name,))
                med = cur.fetchone()
                
                if not med:
                    # Create if doesn't exist (basic info)
                    cur.execute("INSERT INTO medicines (name, category) VALUES (%s, %s) RETURNING id, price_per_tablet", (prod_name, 'Imported History'))
                    med = cur.fetchone()
                
                med_id = med[0]
                price_at_time = float(med[1]) if med[1] else 0.0

                # Date parsing robustness
                raw_date = row.get('Purchase Date')
                purchase_date = None
                if not pd.isna(raw_date):
                    try:
                        dt = pd.to_datetime(raw_date)
                        if not pd.isna(dt):
                            purchase_date = dt.to_pydatetime()
                    except:
                        pass

                # 2. Insert into orders
                cur.execute("""
                    INSERT INTO orders (customer_name, mobile, total_price, created_at)
                    VALUES (%s, %s, %s, %s) RETURNING id
                """, (
                    clean_val(row.get('Name')), 
                    str(clean_val(row.get('Mobile number'), '')), 
                    float(clean_val(row.get('Total Price (EUR)'), 0.0)), 
                    purchase_date
                ))
                
                order_id = cur.fetchone()[0]

                # 3. Insert into order_items
                cur.execute("""
                    INSERT INTO order_items (order_id, medicine_id, quantity, price_at_time)
                    VALUES (%s, %s, %s, %s)
                """, (order_id, med_id, int(clean_val(row.get('Quantity'), 1)), price_at_time))
                
                cur.execute(f"RELEASE SAVEPOINT row_{i}")
                success_count += 1
            except Exception as e:
                cur.execute(f"ROLLBACK TO SAVEPOINT row_{i}")
                print(f"Error on order row {i} ({prod_name}): {e}")

        conn.commit()
        print(f"Successfully imported {success_count} orders.")
    except Exception as e:
        conn.rollback()
        print(f"Error importing orders: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    init_db()
    import_products(os.path.join(script_dir, "Product_Export.xlsx"))
    import_orders(os.path.join(script_dir, "Consumer Order History 1  .xlsx"))

