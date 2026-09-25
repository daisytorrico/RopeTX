"""Servicio de transcripción ASR en tiempo real con Gemini Live API (RF-03, RF-04, RF-11).
Maneja streaming bidireccional continuo de audio PCM (16kHz, 16-bit mono) exclusivamente con audio real.
"""
import asyncio
import logging
import time
import uuid
from typing import Optional
from google import genai
from google.genai import types

from app.core.config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_SOURCE_LANG
from app.core.glossary import TECHNICAL_GLOSSARY
from app.core.genai_client import get_genai_client
from app.services.connection_manager import manager
from app.services.gemini_translator import get_room_coordinator, reset_room_coordinator

logger = logging.getLogger("gemini_asr")


async def _drain_queue(audio_queue: asyncio.Queue) -> None:
    """Consume la cola para evitar saturación de memoria si el ASR está desconectado."""
    try:
        while True:
            await audio_queue.get()
            audio_queue.task_done()
    except asyncio.CancelledError:
        pass


async def _send_audio_loop(session, audio_queue: asyncio.Queue):
    """Bucle de envío continuo de fragmentos PCM a la sesión activa de Gemini Live."""
    while True:
        chunk = await audio_queue.get()
        try:
            await session.send_realtime_input(
                audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
            )
        finally:
            audio_queue.task_done()


async def _receive_subtitles_loop(
    session,
    room_id: str,
    source_lang: str,
    coordinator,
):
    """Bucle de recepción de transcripciones ASR de Gemini Live.

    Flujo:
      - interim (parcial) → broadcast directo en el idioma del orador
        (sin llamar al traductor; el viewer que mira en ese idioma lo ve
        en vivo, los demás ven "esperando" hasta el final).
      - final confirmado   → coordinator.submit() traduce SIEMPRE a todos
        los idiomas soportados (menos el del orador) y llena 'translations'
        completo, para que cualquier viewer pueda elegir su idioma.
    """
    # Continuar la secuencia desde el historial previo de la sala para mantener orden estricto
    history = await manager._get_history(room_id)
    current_seq = len(history)
    current_msg_id = uuid.uuid4().hex[:12]
    async for response in session.receive():
        if not response.server_content:
            continue

        current_room_lang = manager.get_room_language(room_id)
        effective_source = current_room_lang if current_room_lang in {"es", "en", "pt"} else (clean_source if clean_source in {"es", "en", "pt"} else "es")

        sc = response.server_content
        final = sc.input_transcription
        interim = sc.interim_input_transcription

        # Medir y registrar latencia en tiempo real ASR
        if (final and getattr(final, "text", None)) or (interim and getattr(interim, "text", None)):
            last_audio_t = manager.last_audio_packet_times.get(room_id)
            if last_audio_t:
                delta_ms = int((time.time() - last_audio_t) * 1000)
                if 40 <= delta_ms <= 4000:
                    manager.record_latency(room_id, delta_ms)

        # ── 1. Transcripción PARCIAL (Interim) en tiempo real ──
        if interim and getattr(interim, "text", None):
            interim_text = interim.text.strip()
            if interim_text:
                payload = {
                    "id": current_msg_id,
                    "seq": current_seq + 1,
                    "room": room_id,
                    "text": interim_text,
                    "original": interim_text,
                    "speaker_lang": effective_source,
                    "timestamp": time.time(),
                    "is_final": False,
                    "translations": {},
                }
                await manager.broadcast_subtitles(room_id, payload)

        # ── 2. Transcripción FINAL confirmada por ASR (Calidad cine/conferencia) ──
        if final and final.text:
            raw_text = final.text.strip()
            if not raw_text:
                continue

            current_seq += 1
            seq = current_seq
            current_msg_id = uuid.uuid4().hex[:12]
            msg_id = current_msg_id

            await coordinator.submit(
                seq=seq,
                msg_id=msg_id,
                text=raw_text,
                is_final=True,
                source_lang=effective_source,
                broadcaster=lambda p: manager.broadcast_subtitles(room_id, p),
            )


async def stream_audio_to_gemini(
    room_id: str,
    audio_queue: asyncio.Queue,
    source_lang: str = "es",
) -> None:
    client = get_genai_client(room_id)
    if not client:
        logger.error("GEMINI_API_KEY no configurada. Transcripción ASR no disponible en sala %s", room_id)
        await manager.broadcast_subtitles(
            room_id,
            {"type": "status", "code": "asr_unavailable", "room": room_id, "timestamp": time.time()},
        )
        await _drain_queue(audio_queue)
        return

    room_custom_vocab = list(dict.fromkeys(TECHNICAL_GLOSSARY + manager.get_room_glossary(room_id)))

    # Configurar language_codes según el idioma explícito del orador:
    # - "es": priorizar español neutro / latino
    # - "en": priorizar inglés americano
    # - "pt": priorizar portugués brasileño
    sl = source_lang.lower().strip()
    if sl.startswith("en"):
        lang_codes = ["en-US"]
    elif sl.startswith("pt"):
        lang_codes = ["pt-BR", "pt-PT"]
    else:
        lang_codes = ["es-419", "es-ES"]

    asr_config = types.AudioTranscriptionConfig(custom_vocabulary=room_custom_vocab)
    if lang_codes:
        asr_config = types.AudioTranscriptionConfig(
            language_codes=lang_codes,
            custom_vocabulary=room_custom_vocab,
        )

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.TEXT],
        input_audio_transcription=asr_config,
    )

    max_retries = 3
    coordinator = get_room_coordinator(room_id)

    while True:
        connected_session = None

        for attempt in range(1, max_retries + 1):
            try:
                session_ctx = client.aio.live.connect(model=GEMINI_MODEL, config=config)
                session = await session_ctx.__aenter__()
                connected_session = (session_ctx, session)
                logger.info("Gemini Live conectado para sala: %s (intento %d)", room_id, attempt)
                manager.set_session_ready(room_id)
                break
            except Exception as exc:
                logger.error("Fallo al conectar Gemini Live para sala %s: %s", room_id, exc)
                if attempt < max_retries:
                    await asyncio.sleep(min(8.0, float(2 ** (attempt - 1))))

        if not connected_session:
            logger.error("No se pudo conectar a Gemini Live tras reintentos para sala %s", room_id)
            await manager.broadcast_subtitles(
                room_id,
                {"type": "status", "code": "asr_unavailable", "room": room_id, "timestamp": time.time()},
            )
            await _drain_queue(audio_queue)
            return

        session_ctx, session = connected_session

        try:
            send_task = asyncio.create_task(_send_audio_loop(session, audio_queue))
            recv_task = asyncio.create_task(
                _receive_subtitles_loop(session, room_id, source_lang, coordinator)
            )

            done, pending = await asyncio.wait([send_task, recv_task], return_when=asyncio.FIRST_EXCEPTION)
            for t in pending:
                t.cancel()
                await asyncio.gather(t, return_exceptions=True)

            for t in done:
                exc = t.exception()
                if exc and not isinstance(exc, asyncio.CancelledError):
                    logger.warning("Excepción en streaming sala %s: %s", room_id, exc)

        except asyncio.CancelledError:
            reset_room_coordinator(room_id)
            raise
        except Exception as exc:
            logger.warning("Reconectando sesión en sala %s: %s", room_id, exc)
            await asyncio.sleep(1.0)
        finally:
            try:
                await session_ctx.__aexit__(None, None, None)
            except Exception:
                pass