"""Bus de eventos de alta velocidad basado en Redis Streams / PubSub.
Permite comunicación asincrónica desacoplada entre los microservicios de Ingesta, ASR, Traducción y Gateway.
"""
import os
import json
import logging
import asyncio
from typing import Optional, Dict, Any, Callable, Awaitable
import redis.asyncio as aioredis

logger = logging.getLogger("event_bus")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


class EventBus:
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None

    async def connect(self):
        if not self._redis:
            self._redis = aioredis.from_url(self.redis_url, decode_responses=False)
            logger.info("EventBus conectado a Redis en %s", self.redis_url)

    async def disconnect(self):
        if self._redis:
            await self._redis.close()
            self._redis = None

    @property
    def redis(self) -> aioredis.Redis:
        if not self._redis:
            raise RuntimeError("EventBus no está conectado. Llame a connect() primero.")
        return self._redis

    # ── 1. Ingesta de Audio (Canal binario PCM) ──
    async def publish_audio_chunk(self, room_id: str, chunk: bytes):
        """Publica fragmento PCM (16kHz Mono) en el canal de la sala."""
        channel = f"audio:stream:{room_id}"
        await self.redis.publish(channel, chunk)

    async def subscribe_audio_stream(self, room_id: str, callback: Callable[[bytes], Awaitable[None]]):
        """Escucha el flujo continuo de audio de una sala."""
        pubsub = self.redis.pubsub()
        channel = f"audio:stream:{room_id}"
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await callback(message["data"])
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    # ── 2. Transcripciones ASR (Interim & Final) ──
    async def publish_transcript(self, room_id: str, transcript_data: Dict[str, Any]):
        """Publica transcripción en el idioma original del orador."""
        channel = f"transcription:stream:{room_id}"
        payload = json.dumps(transcript_data).encode("utf-8")
        await self.redis.publish(channel, payload)

    async def subscribe_transcripts(self, room_id: str, callback: Callable[[Dict[str, Any]], Awaitable[None]]):
        """Escucha transcripciones de la sala para alimentar el microservicio de traducción."""
        pubsub = self.redis.pubsub()
        channel = f"transcription:stream:{room_id}"
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"].decode("utf-8"))
                    await callback(data)
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    # ── 3. Subtítulos Multilingües Finales ──
    async def publish_subtitles(self, room_id: str, subtitle_payload: Dict[str, Any]):
        """Publica subtítulo traducido (ES, EN, PT) hacia el Gateway de Distribución."""
        channel = f"subtitles:broadcast:{room_id}"
        payload = json.dumps(subtitle_payload).encode("utf-8")
        await self.redis.publish(channel, payload)

    async def subscribe_subtitles(self, room_id: str, callback: Callable[[Dict[str, Any]], Awaitable[None]]):
        """Gateway escucha subtítulos procesados para emitir por WebSockets y SSE a la audiencia."""
        pubsub = self.redis.pubsub()
        channel = f"subtitles:broadcast:{room_id}"
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"].decode("utf-8"))
                    await callback(data)
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()


event_bus = EventBus()
