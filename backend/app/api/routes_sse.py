"""Endpoint SSE para la vista de audiencia.

Envía el mismo objeto de subtítulo completo que ya usa el canal WebSocket
(text, original, translations, speaker_lang, transcription, etc.) para que
el filtrado por idioma lo resuelva el cliente con getSubtitleContent(),
igual que ya hace SubtitleDisplay. Así una sola conexión SSE sirve para
cualquier idioma que el usuario elija, sin tener que reconectar.

No usa Redis Streams: reutiliza la misma lista `ropetx:history:{room_id}`
y el mismo campo `seq` que ya usa el sistema de WebSockets.
"""
import asyncio
import json
import logging
from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.services.connection_manager import manager

logger = logging.getLogger("routes_sse")
router = APIRouter(tags=["sse"])


async def _subtitle_generator(request: Request, room_id: str, last_seq: int):
    # 1. Catch-up: reconstruir objetos Subtitle-compatibles desde el historial (Redis o memoria)
    history = await manager._get_history(room_id)
    highest_seq = last_seq

    for item in history:
        seq = item.get("seq", 0)
        if seq <= last_seq:
            continue

        subtitle = {
            "id": f"hist-{seq}",
            "seq": seq,
            "text": item.get("text", ""),
            "original": item.get("original", ""),
            "translations": item.get("translations", {}),
            "speaker_lang": item.get("speaker_lang", ""),
            "is_final": True,
            "translation_error": item.get("translation_error", False),
            "timestamp": item.get("timestamp", 0),
        }
        yield {"id": str(seq), "event": "subtitle", "data": json.dumps(subtitle)}
        highest_seq = max(highest_seq, seq)

    # 2. Notificación inicial de estado de sala
    initial_status = {
        "type": "room_state",
        "room": room_id,
        "is_live": manager.stream_active.get(room_id, False),
        "status": "ONLINE" if manager.stream_active.get(room_id, False) else "IDLE",
    }
    yield {"id": "0", "event": "status", "data": json.dumps(initial_status)}
    yield {"id": "0", "event": "subtitle", "data": json.dumps(initial_status)}

    # 3. Vivo: nos suscribimos a la cola de distribución de la sala.
    queue = manager.connect_sse(room_id)
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=15.0)
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": ""}
                continue

            if payload.get("type") in ("clear", "clear_history"):
                highest_seq = 0
                yield {"id": "", "event": "clear", "data": json.dumps(payload)}
                yield {"id": "", "event": "subtitle", "data": json.dumps(payload)}
                continue

            if payload.get("type") in ("room_state", "status"):
                yield {"id": "", "event": "status", "data": json.dumps(payload)}
                yield {"id": "", "event": "subtitle", "data": json.dumps(payload)}
                continue

            seq = payload.get("seq", 0)
            is_final = payload.get("is_final", True)

            # Si es un evento nuevo con seq superior, actualizamos highest_seq
            if is_final and seq and seq > highest_seq:
                highest_seq = seq

            event_id = str(seq) if seq else ""
            yield {"id": event_id, "event": "subtitle", "data": json.dumps(payload)}
    finally:
        manager.disconnect_sse(room_id, queue)


@router.get("/sse/audience/{room_id}")
async def sse_audience(request: Request, room_id: str):
    """Stream SSE con el historial + subtítulos en vivo de una sala.
    El filtrado por idioma lo hace el cliente (getSubtitleContent), no este endpoint.
    """
    if not manager.is_room_visible(room_id):
        async def _empty():
            return
            yield  # pragma: no cover
        return EventSourceResponse(_empty())

    last_event_id = request.headers.get("last-event-id")
    last_seq = int(last_event_id) if last_event_id and last_event_id.isdigit() else 0

    return EventSourceResponse(_subtitle_generator(request, room_id, last_seq))