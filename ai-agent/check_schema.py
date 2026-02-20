import psycopg2

conn = psycopg2.connect("postgresql://postgres:sumitjain@localhost:5432/phrmaAi")
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='medicines' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("Current medicines columns:", cols)
cur.close()
conn.close()
