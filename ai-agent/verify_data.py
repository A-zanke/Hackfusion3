import psycopg2

conn = psycopg2.connect("postgresql://postgres:sumitjain@localhost:5432/phrmaAi")
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM medicines")
print(f"Medicines count: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM orders")
print(f"Orders count: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM order_items")
print(f"Order items count: {cur.fetchone()[0]}")

cur.execute("SELECT name, category, stock_packets, tablets_per_packet, price_per_tablet FROM medicines LIMIT 5")
print("\nSample medicines:")
for row in cur.fetchall():
    print(f"  {row}")

cur.close()
conn.close()
