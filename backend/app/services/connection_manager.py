"""Servicio de gestión de conexiones WebSocket, salas en memoria y exportación SRT.
Aísla completamente el estado de cada sala en memoria RAM y Redis."""
import os
import asyncio
import logging
import time
import json
import redis.asyncio as redis
from pathlib import Path
from typing import Dict, Set, List, Optional
from fastapi import WebSocket

from app.core.config import EXPORTS_DIR, DEFAULT_ROOMS
from app.schemas.schemas import RoomTelemetry

logger = logging.getLogger("connection_manager")

class ConnectionManager:
    """Gestiona conexiones activas de audiencia, monitores, streaming y persistencia SRT."""

    def __init__(self) -> None:
        self.active_rooms: Dict[str, Set[WebSocket]] = {}
        self.monitor_rooms: Dict[str, Set[WebSocket]] = {}

        # Fallback de memoria RAM si Redis no está disponible
        self.memory_history: Dict[str, List[dict]] = {}

        # Estado histórico externalizado a Redis (opcional)
        try:
            self.redis = redis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
                decode_responses=True
            )
        except Exception:
            self.redis = None

        self.stream_active: Dict[str, bool] = {}
        self.stream_start_times: Dict[str, float] = {}
        self.last_exported_srt: Dict[str, str] = {}
        self.session_ready_events: Dict[str, asyncio.Event] = {}
        self.custom_rooms: Set[str] = set()
        self.room_glossaries: Dict[str, List[str]] = {}
        self.hidden_rooms: Set[str] = set()
        self.broadcaster_rooms: Dict[str, Set[WebSocket]] = {}
        self.room_languages: Dict[str, str] = {}
        self.room_latencies: Dict[str, int] = {}
        self.last_audio_packet_times: Dict[str, float] = {}

        # colas de distribución para clientes SSE (vista de audiencia)
        self.sse_queues: Dict[str, Set[asyncio.Queue]] = {}

        # Buffer de audio en memoria RAM por sala (preserva el audio íntegro de la sesión)
        self.room_audio_buffers: Dict[str, bytearray] = {}

    def append_audio(self, room_id: str, chunk: bytes) -> None:
        """Guarda fragmentos de audio en memoria para preservar el flujo acústico íntegro."""
        clean = room_id.strip().lower()
        if clean not in self.room_audio_buffers:
            self.room_audio_buffers[clean] = bytearray()
        self.room_audio_buffers[clean].extend(chunk)

    def get_audio_buffer(self, room_id: str) -> bytes:
        """Obtiene el buffer de audio acumulado en memoria de la sala."""
        clean = room_id.strip().lower()
        return bytes(self.room_audio_buffers.get(clean, b""))

    def clear_audio_buffer(self, room_id: str) -> None:
        """Limpia el buffer de audio en memoria de la sala."""
        clean = room_id.strip().lower()
        self.room_audio_buffers.pop(clean, None)

    def get_room_language(self, room_id: str) -> str:
        return self.room_languages.get(room_id.strip().lower(), "auto")

    def set_room_language(self, room_id: str, lang: str) -> str:
        clean_lang = lang.strip().lower() if lang else "auto"
        self.room_languages[room_id.strip().lower()] = clean_lang
        return clean_lang

    def set_room_visibility(self, room_id: str, is_visible: bool) -> bool:
        clean = room_id.strip().lower()
        if not is_visible:
            self.hidden_rooms.add(clean)
        else:
            self.hidden_rooms.discard(clean)
        return clean not in self.hidden_rooms

    def is_room_visible(self, room_id: str) -> bool:
        return room_id.strip().lower() not in self.hidden_rooms

    def get_room_glossary(self, room_id: str) -> List[str]:
        return self.room_glossaries.get(room_id, [])

    def set_room_glossary(self, room_id: str, terms: List[str]) -> List[str]:
        clean_terms = []
        for t in terms:
            s = t.strip()
            if s and s not in clean_terms:
                clean_terms.append(s)
        self.room_glossaries[room_id] = clean_terms
        return clean_terms

    def add_room(self, room_id: str) -> str:
        clean = room_id.strip().lower()
        if clean:
            self.custom_rooms.add(clean)
        return clean

    def get_session_ready_event(self, room_id: str) -> asyncio.Event:
        if room_id not in self.session_ready_events:
            self.session_ready_events[room_id] = asyncio.Event()
        return self.session_ready_events[room_id]

    def set_session_ready(self, room_id: str) -> None:
        self.get_session_ready_event(room_id).set()

    def reset_session_ready(self, room_id: str) -> None:
        if room_id in self.session_ready_events:
            self.session_ready_events[room_id].clear()

    async def connect_audience(self, room_id: str, websocket: WebSocket, is_monitor: bool = False) -> None:
        await websocket.accept()
        target_dict = self.monitor_rooms if is_monitor else self.active_rooms
        if room_id not in target_dict:
            target_dict[room_id] = set()
        target_dict[room_id].add(websocket)

    def disconnect_audience(self, room_id: str, websocket: WebSocket, is_monitor: bool = False) -> None:
        target_dict = self.monitor_rooms if is_monitor else self.active_rooms
        if room_id in target_dict:
            target_dict[room_id].discard(websocket)
            if not target_dict[room_id]:
                del target_dict[room_id]

    def connect_broadcaster(self, room_id: str, websocket: WebSocket) -> None:
        if room_id not in self.broadcaster_rooms:
            self.broadcaster_rooms[room_id] = set()
        self.broadcaster_rooms[room_id].add(websocket)

    def disconnect_broadcaster(self, room_id: str, websocket: WebSocket) -> None:
        if room_id in self.broadcaster_rooms:
            self.broadcaster_rooms[room_id].discard(websocket)
            if not self.broadcaster_rooms[room_id]:
                del self.broadcaster_rooms[room_id]

    async def close_broadcasters(self, room_id: str) -> None:
        sockets = self.broadcaster_rooms.get(room_id, set())
        for ws in list(sockets):
            try:
                await ws.close(code=1000, reason="Stream stopped by operator")
            except Exception:
                pass
        self.broadcaster_rooms.pop(room_id, None)

    # registro/baja de clientes SSE (vista de audiencia sin WebSocket)
    def connect_sse(self, room_id: str) -> asyncio.Queue:
        """Crea y registra una cola de mensajes para un cliente SSE de la sala."""
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.sse_queues.setdefault(room_id, set()).add(q)
        return q

    def disconnect_sse(self, room_id: str, q: asyncio.Queue) -> None:
        """Da de baja la cola de un cliente SSE al desconectarse."""
        if room_id in self.sse_queues:
            self.sse_queues[room_id].discard(q)
            if not self.sse_queues[room_id]:
                del self.sse_queues[room_id]

    async def _add_history_entry(self, room_id: str, entry: dict) -> None:
        """Agrega o actualiza entrada en el historial intentando Redis y cayendo a memoria RAM."""
        seq = entry.get("seq")
        added_to_redis = False
        if self.redis:
            try:
                redis_key = f"ropetx:history:{room_id}"
                # Si es una actualización con el mismo seq, actualizamos la última entrada
                await self.redis.rpush(redis_key, json.dumps(entry))
                await self.redis.expire(redis_key, 86400)
                added_to_redis = True
            except Exception:
                self.redis = None

        if not added_to_redis:
            room_hist = self.memory_history.setdefault(room_id, [])
            if room_hist and seq is not None and room_hist[-1].get("seq") == seq:
                room_hist[-1] = entry
            else:
                room_hist.append(entry)

    async def _get_history(self, room_id: str) -> List[dict]:
        """Obtiene historial probando Redis y cayendo a memoria RAM."""
        if self.redis:
            try:
                redis_key = f"ropetx:history:{room_id}"
                history_raw = await self.redis.lrange(redis_key, 0, -1)
                if history_raw:
                    return [json.loads(s) for s in history_raw]
            except Exception:
                self.redis = None

        return self.memory_history.get(room_id, [])

    async def _clear_history(self, room_id: str, broadcast: bool = True) -> None:
        """Limpia el historial en Redis y memoria RAM, y notifica a los clientes para reiniciar el lienzo."""
        if self.redis:
            try:
                await self.redis.delete(f"ropetx:history:{room_id}")
            except Exception:
                self.redis = None

        self.memory_history.pop(room_id, None)

        if broadcast:
            clear_payload = {"type": "clear", "room_id": room_id, "timestamp": time.time()}
            # Enviar a sockets de audiencia
            for ws in list(self.active_rooms.get(room_id, set())):
                try:
                    await ws.send_json(clear_payload)
                except Exception:
                    self.disconnect_audience(room_id, ws, is_monitor=False)

            # Enviar a sockets de monitoreo / admin
            for ws in list(self.monitor_rooms.get(room_id, set())):
                try:
                    await ws.send_json(clear_payload)
                except Exception:
                    self.disconnect_audience(room_id, ws, is_monitor=True)

            # Enviar a colas SSE de la sala
            for q in list(self.sse_queues.get(room_id, set())):
                try:
                    q.put_nowait(clear_payload)
                except asyncio.QueueFull:
                    pass

    async def broadcast_subtitles(self, room_id: str, payload: dict) -> None:
        is_status = payload.get("type") == "status"
        text = payload.get("text", "").strip()
        orig = payload.get("original", "").strip()
        is_final = payload.get("is_final", True)

        if not is_status and is_final and (text or orig):
            history = await self._get_history(room_id)
            seq_val = payload.get("seq") or (len(history) + 1)

            subtitle_entry = {
                "text": text or orig,
                "original": orig,
                "translations": payload.get("translations", {}),
                "speaker_lang": payload.get("speaker_lang", ""),
                "timestamp": payload.get("timestamp") or time.time(),
                "translation_error": bool(payload.get("translation_error")),
                "seq": seq_val,
            }
            await self._add_history_entry(room_id, subtitle_entry)

        if not is_status and (text or orig) and self.is_room_visible(room_id):
            audience_sockets = self.active_rooms.get(room_id, set())
            for ws in list(audience_sockets):
                try:
                    await ws.send_json(payload)
                except Exception:
                    self.disconnect_audience(room_id, ws, is_monitor=False)

            # mismo payload a las colas de clientes SSE de la sala
            for q in list(self.sse_queues.get(room_id, set())):
                try:
                    q.put_nowait(payload)
                except asyncio.QueueFull:
                    pass  # cliente lento; se salta este mensaje, no bloquea al resto

        monitor_sockets = self.monitor_rooms.get(room_id, set())
        for ws in list(monitor_sockets):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect_audience(room_id, ws, is_monitor=True)

    async def broadcast_to_monitors(self, room_id: str, payload: dict) -> None:
        monitor_sockets = self.monitor_rooms.get(room_id, set())
        for ws in list(monitor_sockets):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect_audience(room_id, ws, is_monitor=True)

    def record_audio_packet(self, room_id: str) -> None:
        self.last_audio_packet_times[room_id] = time.time()

    def record_latency(self, room_id: str, latency_ms: int) -> None:
        if latency_ms > 0:
            prev = self.room_latencies.get(room_id, latency_ms)
            self.room_latencies[room_id] = max(30, int(prev * 0.35 + latency_ms * 0.65))

    def get_room_latency(self, room_id: str) -> int:
        if not self.stream_active.get(room_id, False):
            return 0
        return self.room_latencies.get(room_id, 0)

    async def broadcast_status_event(self, room_id: str, is_active: bool) -> None:
        status_payload = {
            "type": "room_state",
            "room": room_id,
            "is_live": is_active,
            "status": "ONLINE" if is_active else "IDLE",
            "timestamp": time.time(),
        }
        # Enviar a sockets de audiencia de la sala
        for ws in list(self.active_rooms.get(room_id, set())):
            try:
                await ws.send_json(status_payload)
            except Exception:
                self.disconnect_audience(room_id, ws, is_monitor=False)

        # Enviar a colas SSE de la sala
        for q in list(self.sse_queues.get(room_id, set())):
            try:
                q.put_nowait(status_payload)
            except asyncio.QueueFull:
                pass

        # Enviar a monitores de todas las salas para actualización inmediata del mixer
        all_monitors = set()
        for m_set in self.monitor_rooms.values():
            all_monitors.update(m_set)
        for ws in list(all_monitors):
            try:
                await ws.send_json(status_payload)
            except Exception:
                pass

    def set_stream_status(self, room_id: str, is_active: bool) -> None:
        self.stream_active[room_id] = is_active
        if is_active:
            self.stream_start_times[room_id] = time.time()
            self.reset_session_ready(room_id)
            if room_id not in self.room_latencies or self.room_latencies[room_id] <= 0:
                self.room_latencies[room_id] = 185
            # Limpiar historial de forma asíncrona al iniciar stream
            asyncio.create_task(self._clear_history(room_id))
        else:
            self.reset_session_ready(room_id)
            self.room_latencies.pop(room_id, None)
            self.last_audio_packet_times.pop(room_id, None)
            # Exportar SRT preservando el historial en pantalla
            asyncio.create_task(self.export_srt(room_id, clear_history=False))
        # Notificar de inmediato a todas las conexiones WebSocket y SSE
        asyncio.create_task(self.broadcast_status_event(room_id, is_active))

    async def export_srt(self, room_id: str, clear_history: bool = False) -> str:
        """Genera y persiste un archivo .SRT estandarizado leyendo de Redis o memoria."""
        history = await self._get_history(room_id)

        if not history:
            if room_id in self.last_exported_srt and Path(self.last_exported_srt[room_id]).exists():
                return self.last_exported_srt[room_id]
            existing_files = sorted(
                EXPORTS_DIR.glob(f"transcripcion_{room_id}_*.srt"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if existing_files:
                self.last_exported_srt[room_id] = str(existing_files[0])
                return str(existing_files[0])
            return ""

        start_time = self.stream_start_times.get(room_id, history[0]["timestamp"])

        def format_time(seconds: float) -> str:
            millis = int((seconds % 1) * 1000)
            seconds = int(seconds)
            mins, secs = divmod(seconds, 60)
            hours, mins = divmod(mins, 60)
            return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

        srt_lines = []
        total_items = len(history)
        for index, item in enumerate(history):
            rel_start = max(0.0, item["timestamp"] - start_time)
            # Determinar tiempo de finalización sin solaparse con la siguiente línea
            if index < total_items - 1:
                next_rel_start = max(0.0, history[index + 1]["timestamp"] - start_time)
                rel_end = min(rel_start + 3.5, max(rel_start + 0.5, next_rel_start - 0.05))
            else:
                rel_end = rel_start + 3.0

            line_text = item["text"]
            if item.get("translation_error"):
                line_text = f"{line_text} [Traduccion no disponible]"
            srt_lines.append(f"{index + 1}")
            srt_lines.append(f"{format_time(rel_start)} --> {format_time(rel_end)}")
            srt_lines.append(f"{line_text}\n")

        filename = f"transcripcion_{room_id}_{int(start_time)}.srt"
        target_path = EXPORTS_DIR / filename

        with open(target_path, "w", encoding="utf-8") as f:
            f.write("\n".join(srt_lines))

        self.last_exported_srt[room_id] = str(target_path)

        if clear_history:
            await self._clear_history(room_id)

        logger.info("Archivo SRT exportado exitosamente: %s", target_path)
        return str(target_path)

    async def get_telemetry(self, db_room_ids: Optional[Set[str]] = None, db_hidden_ids: Optional[Set[str]] = None) -> List[RoomTelemetry]:
        extra_ids = db_room_ids or set()
        db_hidden = db_hidden_ids or set()
        all_rooms = sorted(
            set(
                list(self.active_rooms.keys())
                + list(self.monitor_rooms.keys())
                + list(self.stream_active.keys())
                + list(self.sse_queues.keys())
                + list(self.custom_rooms)
                + list(extra_ids)
                + DEFAULT_ROOMS
            )
        )

        telemetry: List[RoomTelemetry] = []
        for room_id in all_rooms:
            is_active = self.stream_active.get(room_id, False)
            audience_count = len(self.active_rooms.get(room_id, set())) + len(self.sse_queues.get(room_id, set()))

            srt_path = self.last_exported_srt.get(room_id, "")
            if not srt_path or not Path(srt_path).exists():
                existing_files = sorted(
                    EXPORTS_DIR.glob(f"transcripcion_{room_id}_*.srt"),
                    key=lambda p: p.stat().st_mtime,
                    reverse=True,
                )
                if existing_files:
                    srt_path = str(existing_files[0])
                    self.last_exported_srt[room_id] = srt_path

            history = await self._get_history(room_id)
            has_history = len(history) > 0
            has_srt = bool((srt_path and Path(srt_path).exists()) or has_history or is_active)
            is_visible = (room_id not in self.hidden_rooms) and (room_id not in db_hidden)

            telemetry.append(
                RoomTelemetry(
                    room_id=room_id,
                    status="ONLINE" if is_active else "IDLE",
                    audience_count=audience_count,
                    latency_ms=self.get_room_latency(room_id),
                    has_srt=has_srt,
                    srt_file=Path(srt_path).name if srt_path else "",
                    is_visible=is_visible,
                )
            )

        return telemetry

# Instancia única compartida del gestor de conexiones
manager = ConnectionManager()