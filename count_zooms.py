import sqlite3
import math

db_path = "Maidenhead_Cm96_Openstreetmap.htrx"

def get_zoom(key):
    if key == 0: return 0
    # key = (4^z - 1) / 3 + index
    # so 4^z approx 3*key
    # z approx log4(3*key + 1)
    return int(math.log(3*key + 1, 4))

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT key FROM tiles")
    keys = cursor.fetchall()
    
    zooms = {}
    for (key,) in keys:
        z = get_zoom(key)
        zooms[z] = zooms.get(z, 0) + 1
    
    print("Tiles per zoom level:")
    for z in sorted(zooms.keys()):
        print(f"  Z{z}: {zooms[z]}")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
