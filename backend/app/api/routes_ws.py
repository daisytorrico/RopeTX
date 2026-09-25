"""Endpoints WebSocket para ingesta de audio binario y recepción de subtítulos."""

import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session

from app.core.security import verify_ws_token
from app.services.connection_manager import manager
from app.services.audio_service import ensure_room_stream, delayed_stream_cleanup
from app.db.database import get_db
from app.db.models import RoomModel

logger = logging.getLogger("routes_ws")
router = APIRouter(tags=["websockets"])

@router.websocket("/ws/stream/{room_id}")
async def ws_stream(
    websocket: WebSocket,
    room_id: str,
    source_lang: str = "es",
):
    """Ingesta de audio binario en tiempo real desde micrófonos o emisores CLI con backpressure (Drop-Oldest).

    Ya no recibe target_lang/lang: el backend traduce siempre a todos los
    idiomas soportados menos source_lang, y cada viewer elige el suyo en su
    propia vista (SSE), sin depender del idioma con que se conectó el emisor.
    """
    await websocket.accept()
    manager.connect_broadcaster(room_id, websocket)
    logger.info("Broadcaster conectado a la sala: %s (source_lang=%s)", room_id, source_lang)

    queue = ensure_room_stream(room_id, source_lang=source_lang)

    try:
        while True:
            data = await websocket.receive_bytes()
            manager.record_audio_packet(room_id)

            try:
                queue.put_nowait(data)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                    queue.put_nowait(data)
                except Exception:
                    pass
    except WebSocketDisconnect:
        logger.info("Broadcaster desconectado de sala: %s", room_id)
    except Exception as exc:
        logger.warning("Error en conexión WebSocket stream sala %s: %s", room_id, exc)
    finally:
        manager.disconnect_broadcaster(room_id, websocket)
        logger.info("Streaming finalizado para la sala: %s", room_id)
        manager.set_stream_status(room_id, False)
        asyncio.create_task(delayed_stream_cleanup(room_id))

@router.websocket("/ws/audience/{room_id}")
async def ws_audience(
    websocket: WebSocket,
    room_id: str,
    role: str = Query("audience"),
    token: str = Query(None),
    db: Session = Depends(get_db),
):
    """Canal de distribución de subtítulos en tiempo real para la audiencia y la cabina."""
    if role not in {"audience", "monitor"}:
        await websocket.close(code=1008, reason="Invalid role")
        return

    is_monitor = role == "monitor"

    if is_monitor and not verify_ws_token(token):
        await websocket.close(code=1008, reason="Authentication required")
        return

    if not is_monitor:
        room = db.query(RoomModel).filter(RoomModel.id == room_id).first()
        db_visible = getattr(room, "is_visible", True) if room else True
        if not manager.is_room_visible(room_id) or not db_visible:
            await websocket.close(code=1008, reason="Room is not public")
            return

    await manager.connect_audience(room_id, websocket, is_monitor=is_monitor)

    # Estado inicial de la sala en tiempo real
    try:
        await websocket.send_json({
            "type": "room_state",
            "room": room_id,
            "is_live": manager.stream_active.get(room_id, False),
            "status": "ONLINE" if manager.stream_active.get(room_id, False) else "IDLE",
        })
    except Exception:
        pass

    # Entregar historial circular de la sala al conectarse desde Redis o memoria
    history = await manager._get_history(room_id)
    if history:
        try:
            for sub in history:
                await websocket.send_json({
                    "id": f"hist-{sub.get('seq', 0)}",
                    "seq": sub.get("seq"),
                    "room": room_id,
                    "text": sub["text"],
                    "original": sub.get("original"),
                    "translations": sub.get("translations", {}),
                    "speaker_lang": sub.get("speaker_lang", ""),
                    "timestamp": sub["timestamp"],
                    "is_final": True,
                    "translation_error": sub.get("translation_error", False),
                })
        except Exception as exc:
            logger.warning("Error enviando historial a sala %s: %s", room_id, exc)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("Cliente desconectado de sala %s (monitor=%s)", room_id, is_monitor)
    except Exception as exc:
        logger.warning("Excepción en websocket audiencia sala %s: %s", room_id, exc)
    finally:
        manager.disconnect_audience(room_id, websocket, is_monitor=is_monitor)