"""Microservicio de Ingesta de Audio (ms-audio-ingest).
Captura audio desde Jack 3.5mm, USB, Streams RTMP/RTSP o WebSockets y lo publica en el bus de eventos.
Escalable por sala y desacoplado del procesamiento de IA.
"""
import os
import sys
import asyncio
import logging
from app.core.event_bus import event_bus

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("ms-audio-ingest")

ROOM_ID = os.getenv("ROOM_ID", "main-stage")
SAMPLE_RATE = int(os.getenv("SAMPLE_RATE", "16000"))
CHUNK_SIZE_MS = int(os.getenv("CHUNK_SIZE_MS", "100"))
CHUNK_BYTES = int(SAMPLE_RATE * 2 * (CHUNK_SIZE_MS / 1000.0))  # 16-bit mono = 2 bytes/sample


async def run_ingest_service():
    await event_bus.connect()
    logger.info("Microservicio de Ingesta iniciado para la sala: %s (Chunk: %dms / %d bytes)", ROOM_ID, CHUNK_SIZE_MS, CHUNK_BYTES)

    # El servicio puede leer desde stdin (pipe de FFmpeg), socket o cola local
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin.buffer)

    try:
        while True:
            chunk = await reader.read(CHUNK_BYTES)
            if not chunk:
                await asyncio.sleep(0.01)
                continue
            await event_bus.publish_audio_chunk(ROOM_ID, chunk)
    except asyncio.CancelledError:
        logger.info("Microservicio de Ingesta detenido.")
    finally:
        await event_bus.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(run_ingest_service())
    except KeyboardInterrupt:
        pass
