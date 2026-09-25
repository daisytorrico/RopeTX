"""Microservicio de Traducción Simultánea Concurrente (ms-gemini-translation).
Escucha dinámicamente TODAS las salas activas en Redis (sin ROOM_ID hardcodeado).
Detecta nuevas salas por patrón transcription:stream:* y traduce automáticamente.
"""
import os
import sys
import asyncio
import logging
import time
from typing import Dict, Any

from app.core.config import GEMINI_API_KEY, GEMINI_TRANSLATE_MODEL
from app.core.event_bus import event_bus
from app.services.gemini_translator import translate_multi_targets, SUPPORTED_LANGS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("ms-gemini-translation")

# Workers activos por sala
_active_workers: Dict[str, asyncio.Task] = {}


async def _run_room_translation(room_id: str):
    """Worker de traducción para una sala individual."""
    logger.info("Worker de traducción activo para sala: %s", room_id)

    async def on_transcript_received(transcript: Dict[str, Any]):
        text = transcript.get("text", "").strip()
        if not text:
            return

        is_final = transcript.get("is_final", False)
        source_lang = transcript.get("speaker_lang", "es")
        msg_id = transcript.get("id")
        seq = transcript.get("seq", 0)

        # 1. Si es interim, emitir de inmediato en idioma orador sin bloquear
        if not is_final:
            await event_bus.publish_subtitles(room_id, {
                "id": msg_id,
                "seq": seq,
                "room": room_id,
                "speaker_lang": source_lang,
                "text": text,
                "original": text,
                "is_final": False,
                "translations": {source_lang: text},
                "timestamp": time.time(),
            })
            return

        # 2. Si es final, traducir concurrentemente a todos los idiomas destino
        targets = [l for l in SUPPORTED_LANGS if l != source_lang]
        translations = {source_lang: text}

        if targets:
            translated_map = await translate_multi_targets(
                text=text,
                source_lang=source_lang,
                targets=targets,
            )
            translations.update(translated_map)

        # 3. Publicar subtítulo completo y traducido al bus
        await event_bus.publish_subtitles(room_id, {
            "id": msg_id,
            "seq": seq,
            "room": room_id,
            "speaker_lang": source_lang,
            "text": text,
            "original": text,
            "translations": translations,
            "is_final": True,
            "timestamp": time.time(),
        })

    await event_bus.subscribe_transcripts(room_id, on_transcript_received)


async def _discover_rooms():
    """Descubre salas activas escuchando mensajes en transcription:stream:* por patrón."""
    pubsub = event_bus.redis.pubsub()
    await pubsub.psubscribe("transcription:stream:*")
    logger.info("Descubrimiento dinámico de salas activado (transcription:stream:*)")
    try:
        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                channel = message["channel"]
                if isinstance(channel, bytes):
                    channel = channel.decode("utf-8")
                room_id = channel.replace("transcription:stream:", "")
                if room_id not in _active_workers or _active_workers[room_id].done():
                    logger.info("Nueva sala detectada: %s — levantando worker de traducción", room_id)
                    _active_workers[room_id] = asyncio.create_task(_run_room_translation(room_id))
    finally:
        await pubsub.punsubscribe("transcription:stream:*")
        await pubsub.close()


async def run_translation_service():
    await event_bus.connect()
    logger.info("Microservicio de Traducción multi-sala iniciado (descubrimiento dinámico)")
    await _discover_rooms()


if __name__ == "__main__":
    try:
        asyncio.run(run_translation_service())
    except KeyboardInterrupt:
        pass
