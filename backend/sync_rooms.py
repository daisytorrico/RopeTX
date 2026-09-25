import sqlite3

conn = sqlite3.connect("ropetx.db")
cur = conn.cursor()

# Obtener todas las salas que existen en sessions o rooms
cur.execute("SELECT DISTINCT room_id FROM sessions WHERE room_id IS NOT NULL")
session_rooms = [r[0] for r in cur.fetchall()]

cur.execute("SELECT id FROM rooms")
existing_rooms = {r[0] for r in cur.fetchall()}

all_to_ensure = {"sala-1", "sala-2", "sala-principal"}.union(session_rooms)

for r_id in all_to_ensure:
    if r_id not in existing_rooms:
        friendly = r_id.replace("-", " ").title()
        cur.execute("INSERT INTO rooms (id, name, is_visible) VALUES (?, ?, ?)", (r_id, f"Sala: {friendly}", 1))
        print(f"Restaurada sala a la base de datos: {r_id}")

conn.commit()

cur.execute("SELECT id, name, is_visible FROM rooms")
print("SALAS ACTUALES EN BASE DE DATOS:", cur.fetchall())

conn.close()
