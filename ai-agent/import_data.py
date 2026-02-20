import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
import numpy as np
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")

def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def clean_val(val, default=None):
    if pd.isna(val) or val is pd.NaT:
        return default
    return val

def import_products(file_path):
    print(f"--- Importing Products from {file_path} ---")
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

    data_list = []
    for _, row in df.iterrows():
        try:
            data_list.append((
                clean_val(row.get('Product Name')),
                clean_val(row.get('Category')),
                int(clean_val(row.get('Total Packets'), 0)),
                int(clean_val(row.get('Tablets Per Packet'), 1)),
                float(clean_val(row.get('Price Per Tablet'), 0.0)),
                clean_val(row.get('Expiray Date'))
            ))
        except Exception as e:
            print(f"Skipping product row due to error: {e}")

    query = """
        INSERT INTO medicines (name, category, stock_packets, tablets_per_packet, price_per_tablet, expiry_date)
        VALUES %s
        ON CONFLICT (id) DO NOTHING;
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
            try:
                prod_name = clean_val(row.get('Product Name'))
                if not prod_name: continue

                # 1. Look up medicine_id
                cur.execute("SELECT id, price_per_tablet FROM medicines WHERE name = %s", (prod_name,))
                med = cur.fetchone()
                
                if not med:
                    cur.execute("INSERT INTO medicines (name, category) VALUES (%s, %s) RETURNING id, price_per_tablet", (prod_name, 'Imported History'))
                    med = cur.fetchone()
                
                med_id = med[0]
                price_at_time = med[1] if med[1] else 0

                # 2. Insert into orders
                cur.execute("""
                    INSERT INTO orders (customer_name, mobile, total_price, created_at)
                    VALUES (%s, %s, %s, %s) RETURNING id
                """, (
                    clean_val(row.get('Name')), 
                    clean_val(row.get('Mobile number')), 
                    float(clean_val(row.get('Total Price (EUR)'), 0.0)), 
                    clean_val(row.get('Purchase Date'))
                ))
                
                order_id = cur.fetchone()[0]

                # 3. Insert into order_items
                cur.execute("""
                    INSERT INTO order_items (order_id, medicine_id, quantity, price_at_time)
                    VALUES (%s, %s, %s, %s)
                """, (order_id, med_id, int(clean_val(row.get('Quantity'), 1)), price_at_time))
                success_count += 1
            except Exception as e:
                print(f"Error on order row {i}: {e}")

        conn.commit()
        print(f"Successfully imported {success_count} orders.")
    except Exception as e:
        conn.rollback()
        print(f"Error importing orders: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import_products("Product_Export.xlsx")
    import_orders("Consumer Order History 1.xlsx")
