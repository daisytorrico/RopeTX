"""Microservicio de Transcripción ASR (ms-gemini-asr).
Escucha dinámicamente TODAS las salas activas en Redis (sin ROOM_ID hardcodeado).
Detecta nuevas salas por patrón audio:stream:* y levanta workers ASR automáticamente.
"""
import os
import sys
import asyncio
import logging
import time
import uuid
from typing import Dict
from google import genai
from google.genai import types

from app.core.config import GEMINI_API_KEY, GEMINI_MODEL
from app.core.glossary import TECHNICAL_GLOSSARY
from app.core.genai_client import get_genai_client
from app.core.event_bus import event_bus

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("ms-gemini-asr")

# Workers activos por sala
_active_workers: Dict[str, asyncio.Task] = {}


async def _run_room_asr(room_id: str, source_lang: str = "es"):
    """Worker ASR para una sala individual."""
    client = get_genai_client(room_id)
    if not client:
        logger.error("GEMINI_API_KEY no configurada para sala %s", room_id)
        return

    audio_queue: asyncio.Queue = asyncio.Queue(maxsize=100)

    async def on_audio_chunk(chunk: bytes):
        if not audio_queue.full():
            await audio_queue.put(chunk)

    sub_task = asyncio.create_task(event_bus.subscribe_audio_stream(room_id, on_audio_chunk))

    lang_codes = ["es-419", "es-ES"] if source_lang.startswith("es") else (["en-US"] if source_lang.startswith("en") else ["pt-BR"])
    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.TEXT],
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=lang_codes,
            custom_vocabulary=TECHNICAL_GLOSSARY,
        ),
    )

    try:
        session_ctx = client.aio.live.connect(model=GEMINI_MODEL, config=config)
        session = await session_ctx.__aenter__()
        logger.info("[CONECTADO] ASR activo para sala %s", room_id)

        async def send_loop():
            while True:
                chunk = await audio_queue.get()
                try:
                    await session.send_realtime_input(audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000"))
                finally:
                    audio_queue.task_done()

        async def recv_loop():
            seq = 0
            async for response in session.receive():
                if not response.server_content:
                    continue
                sc = response.server_content
                final = sc.input_transcription
                interim = sc.interim_input_transcription

                if interim and getattr(interim, "text", None):
                    await event_bus.publish_transcript(room_id, {
                        "id": uuid.uuid4().hex[:12],
                        "seq": seq + 1,
                        "room": room_id,
                        "text": interim.text.strip(),
                        "original": interim.text.strip(),
                        "speaker_lang": source_lang,
                        "is_final": False,
                        "timestamp": time.time(),
                    })

                if final and getattr(final, "text", None) and final.text.strip():
                    seq += 1
                    await event_bus.publish_transcript(room_id, {
                        "id": uuid.uuid4().hex[:12],
                        "seq": seq,
                        "room": room_id,
                        "text": final.text.strip(),
                        "original": final.text.strip(),
                        "speaker_lang": source_lang,
                        "is_final": True,
                        "timestamp": time.time(),
                    })

        await asyncio.gather(send_loop(), recv_loop())

    except asyncio.CancelledError:
        logger.info("Worker ASR detenido para sala %s", room_id)
    finally:
        sub_task.cancel()


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
                # Extraer room_id del canal: audio:stream:<room_id>
                room_id = channel.replace("audio:stream:", "")
                if room_id not in _active_workers or _active_workers[room_id].done():
                    logger.info("Nueva sala detectada: %s — levantando worker ASR", room_id)
                    _active_workers[room_id] = asyncio.create_task(_run_room_asr(room_id))
    finally:
        await pubsub.punsubscribe("audio:stream:*")
        await pubsub.close()


async def run_asr_service():
    await event_bus.connect()
    logger.info("Microservicio ASR multi-sala iniciado (descubrimiento dinámico)")
    await _discover_rooms()


if __name__ == "__main__":
    try:
        asyncio.run(run_asr_service())
    except KeyboardInterrupt:
        pass
