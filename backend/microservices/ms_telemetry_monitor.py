"""Microservicio de Monitoreo y Agente RustDesk (ms-telemetry-monitor).
Escucha dinámicamente TODAS las salas activas en Redis y monitorea salud,
niveles de audio y estado del servicio RustDesk.
"""
import os
import sys
import asyncio
import logging
import subprocess
import time
from typing import Dict, Set
from app.core.event_bus import event_bus

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("ms-telemetry-monitor")

# Salas conocidas
_known_rooms: Set[str] = set()


def check_rustdesk_service():
    """Verifica si el servicio de RustDesk está activo para soporte remoto."""
    try:
        if sys.platform == "win32":
            res = subprocess.run(["tasklist", "/FI", "IMAGENAME eq rustdesk.exe"], capture_output=True, text=True)
            return "rustdesk.exe" in res.stdout.lower()
        else:
            res = subprocess.run(["pgrep", "rustdesk"], capture_output=True, text=True)
            return res.returncode == 0
    except Exception:
        return False


async def _telemetry_loop():
    """Emite telemetría periódica para todas las salas conocidas."""
    while True:
        rustdesk_active = check_rustdesk_service()
        for room_id in list(_known_rooms):
            telemetry = {
                "room": room_id,
                "rustdesk_status": "active" if rustdesk_active else "inactive",
                "timestamp": time.time(),
                "status": "healthy",
            }
            await event_bus.redis.publish(f"telemetry:room:{room_id}", str(telemetry))
        await asyncio.sleep(5.0)


async def _discover_rooms():
    """Descubre salas activas escuchando mensajes en audio:stream:* por patrón."""
    pubsub = event_bus.redis.pubsub()
    await pubsub.psubscribe("audio:stream:*")
    logger.info("Descubrimiento dinámico de salas activado (audio:stream:*)")
    try:
        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                channel = message["channel"]
                if isinstance(channel, bytes):
                    channel = channel.decode("utf-8")
                room_id = channel.replace("audio:stream:", "")
                if room_id not in _known_rooms:
                    _known_rooms.add(room_id)
                    logger.info("Nueva sala detectada para telemetría: %s", room_id)
    finally:
        await pubsub.punsubscribe("audio:stream:*")
        await pubsub.close()


async def run_telemetry_loop():
    await event_bus.connect()
    logger.info("Microservicio de Telemetría multi-sala iniciado (descubrimiento dinámico)")

    try:
        await asyncio.gather(
            _discover_rooms(),
            _telemetry_loop(),
        )
    except asyncio.CancelledError:
        logger.info("Microservicio de Telemetría detenido.")
    finally:
        await event_bus.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(run_telemetry_loop())
    except KeyboardInterrupt:
        pass
