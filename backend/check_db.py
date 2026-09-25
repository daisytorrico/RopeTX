import sqlite3
from pathlib import Path

db_path = Path("ropetx.db")
if not db_path.exists():
    print("NO_DB_FILE")
    exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

tables = [t[0] for t in cur.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
print("TABLAS:", tables)

if "rooms" in tables:
    rooms = cur.execute("SELECT * FROM rooms;").fetchall()
    print("SALAS EN DB:", rooms)
else:
    print("NO_ROOMS_TABLE")

if "sessions" in tables:
    sessions = cur.execute("SELECT * FROM sessions;").fetchall()
    print("SESIONES EN DB:", sessions)

conn.close()
