"""Cliente GenAI con Pool de API Keys, Round-Robin y Failover automático para alta concurrencia de salas."""
import logging
import time
from typing import Optional, List, Tuple
from google import genai

from app.core.config import GEMINI_API_KEYS, GEMINI_API_KEY

logger = logging.getLogger("genai_client")


class KeyClientEntry:
    def __init__(self, key: str, index: int):
        self.key = key
        self.index = index
        self.masked_key = f"{key[:6]}...{key[-4:]}" if len(key) > 10 else "***"
        self.client = genai.Client(api_key=key)
        self.cooldown_until: float = 0.0
        self.last_call_timestamp: float = 0.0

    def is_available(self) -> bool:
        return time.time() >= self.cooldown_until

    def mark_rate_limited(self, cooldown_sec: float = 12.0):
        self.cooldown_until = time.time() + max(3.0, cooldown_sec)
        logger.warning(
            "API Key #%d (%s) en cooldown por %.1fs debido a 429/RateLimit.",
            self.index + 1,
            self.masked_key,
            cooldown_sec,
        )


class GenAIClientPool:
    def __init__(self):
        self._entries: List[KeyClientEntry] = []
        self._next_index: int = 0
        self._init_pool()

    def _init_pool(self):
        keys = GEMINI_API_KEYS if GEMINI_API_KEYS else ([GEMINI_API_KEY] if GEMINI_API_KEY else [])
        self._entries = [KeyClientEntry(k, i) for i, k in enumerate(keys) if k]
        if self._entries:
            logger.info("Pool de GenAI inicializado con %d API Key(s)", len(self._entries))

    def get_client_for_room(self, room_id: str) -> Optional[genai.Client]:
        """Asigna un cliente determinista o round-robin para una sala específica."""
        if not self._entries:
            return None
        # Hash determinista por sala para distribuir salas fijas entre las keys disponibles
        room_hash = sum(ord(c) for c in room_id)
        for attempt in range(len(self._entries)):
            idx = (room_hash + attempt) % len(self._entries)
            entry = self._entries[idx]
            if entry.is_available():
                return entry.client
        # Si todas están en cooldown, devuelve la que esté más cerca de salir
        best_entry = min(self._entries, key=lambda e: e.cooldown_until)
        return best_entry.client

    def get_available_entry(self) -> Tuple[Optional[genai.Client], Optional[KeyClientEntry]]:
        """Obtiene el siguiente cliente disponible en Round-Robin con failover."""
        if not self._entries:
            return None, None

        total = len(self._entries)
        for _ in range(total):
            idx = self._next_index
            self._next_index = (self._next_index + 1) % total
            entry = self._entries[idx]
            if entry.is_available():
                return entry.client, entry

        # Si todas las keys están en cooldown, retornar None para no bloquear
        return None, None

    def get_primary_client(self) -> Optional[genai.Client]:
        """Obtiene el primer cliente configurado (compatibilidad)."""
        return self._entries[0].client if self._entries else None


_pool = GenAIClientPool()


def get_genai_pool() -> GenAIClientPool:
    return _pool


def get_genai_client(room_id: Optional[str] = None) -> Optional[genai.Client]:
    """Obtiene un cliente GenAI activo, balanceado para la sala o el pool general."""
    if room_id:
        return _pool.get_client_for_room(room_id)
    client, _ = _pool.get_available_entry()
    return client or _pool.get_primary_client()

