import sqlite3
import os

db_path = "Maidenhead_Cm96_Openstreetmap.htrx"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print(f"Tables: {tables}")
    for tname in tables:
        print(f"\nTable: {tname}")
        cursor.execute(f"PRAGMA table_info({tname});")
        cols = [f"{c[1]} ({c[2]})" for c in cursor.fetchall()]
        print(f"  Cols: {', '.join(cols)}")
        cursor.execute(f"SELECT * FROM {tname} LIMIT 1;")
        print(f"  Sample: {cursor.fetchone()}")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
