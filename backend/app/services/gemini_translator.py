"""Servicio de traducción en streaming con Gemini Flash-Lite (RF-05, RNF-01).
Diseño simple y de alto rendimiento:
- Máximo 1 traducción activa por sala para evitar saturación (429/503).
- Coalescing automático: mientras traduce, acumula el último texto recibido.
- Caché de última traducción: evita re-traducir frases confirmadas por ASR.
- Traduce a todos los idiomas soportados (menos el del orador) en paralelo,
  así cualquier viewer puede elegir su idioma sin depender de un target_lang
  fijo por sala.
"""

import asyncio
import logging
import time
from typing import Optional, Dict, Callable, Awaitable, List, Tuple

from google import genai
from google.genai import types

from app.core.config import GEMINI_API_KEY, GEMINI_TRANSLATE_MODEL
from app.core.glossary import build_system_instruction
from app.core.genai_client import get_genai_client

logger = logging.getLogger("gemini_translator")

# Idiomas soportados por la plataforma. Cada línea final se traduce a todos
# estos menos el idioma del orador (effective_source).
SUPPORTED_LANGS = ["es", "en", "pt"]


def get_auto_tool_config() -> types.ToolConfig:
    """Genera la configuración de llamadas automáticas a funciones (Automatic Function Calling) en modo AUTO."""
    try:
        return types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode="AUTO")
        )
    except Exception:
        mode = getattr(types.FunctionCallingConfigMode, "AUTO", "AUTO")
        return types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode=mode)
        )


async def _stream_gemini_translation(
    client: genai.Client,
    prompt: str,
    system_instruction: str,
    on_chunk: Optional[Callable[[str], Awaitable[None]]] = None,
) -> str:
    """Ejecuta send_message_stream en una sesión AsyncChat con Automatic Function Calling activo."""
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.2,
        tool_config=get_auto_tool_config(),
    )
    
    chat = client.aio.chats.create(
        model=GEMINI_TRANSLATE_MODEL,
        config=config,
    )
    
    response = await chat.send_message_stream(message=prompt)

    accumulated = ""
    last_emit = 0.0

    async for chunk in response:
        text = chunk.text or ""
        if text:
            accumulated += text
            now = time.time()
            if on_chunk and (now - last_emit >= 0.08):  # Throttle ~80ms
                last_emit = now
                try:
                    await on_chunk(accumulated.strip())
                except Exception:
                    pass

    return accumulated.strip()


# Alias de compatibilidad
translate_text_stream = _stream_gemini_translation


from app.core.glossary import build_multi_target_instruction, build_system_instruction
import json
import re

_rate_limit_cooldown_until: float = 0.0
_last_rate_limit_log_time: float = 0.0
_last_call_timestamp: float = 0.0
MIN_CALL_INTERVAL_SEC: float = 1.5  # Respeta el límite de 15 RPM de la capa gratuita / estándar de Gemini


def _extract_retry_delay(error_str: str) -> float:
    """Extrae el tiempo de espera sugerido por la API de Gemini (429/ResourceExhausted)."""
    # Buscar 'retryDelay': '12s' o 'retry in 12.03s'
    match = re.search(r"retry(?:Delay| in)\s*['\"]?\s*:?\s*(\d+(?:\.\d+)?)s?", error_str, re.IGNORECASE)
    if match:
        try:
            return max(3.0, min(60.0, float(match.group(1))))
        except Exception:
            pass
    return 10.0


from app.core.genai_client import get_genai_pool, get_genai_client

async def translate_multi_targets(
    text: str,
    source_lang: str = "auto",
    targets: Optional[List[str]] = None,
    extra_terms: Optional[List[str]] = None,
) -> Dict[str, str]:
    """Traduce a todos los idiomas objetivo usando el pool de API keys con failover automático y sin bloqueo entre salas."""
    trimmed = text.strip()
    if not trimmed:
        return {}

    is_auto = (not source_lang) or source_lang.lower() == "auto"
    target_langs = targets or (["es", "en", "pt"] if is_auto else [l for l in SUPPORTED_LANGS if l.lower() != source_lang.lower()])
    translations: Dict[str, str] = {l: trimmed for l in SUPPORTED_LANGS} if is_auto else {source_lang: trimmed}

    if not target_langs:
        return translations

    pool = get_genai_pool()
    client, entry = pool.get_available_entry()
    if not client:
        # Si todas las keys están temporalmente en enfriamiento, devolver original sin bloquear
        return translations

    system_instruction = build_multi_target_instruction(
        source_lang=source_lang,
        targets=target_langs,
        extra_terms=extra_terms,
    )

    prompt = f"Texto a traducir:\n<speaker_text>\n{trimmed}\n</speaker_text>"

    model_to_use = GEMINI_TRANSLATE_MODEL
    # Intentar con el cliente disponible o con fallback a otra key si da 429
    for attempt in range(2):
        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
                response_mime_type="application/json",
                tool_config=get_auto_tool_config(),
            )
            chat = client.aio.chats.create(
                model=model_to_use,
                config=config,
            )
            response = await asyncio.wait_for(
                chat.send_message(
                    message=prompt,
                ),
                timeout=8.0,
            )

            raw_text = (response.text or "").strip()
            if raw_text:
                try:
                    parsed = json.loads(raw_text)
                    trans_map = parsed.get("translations", parsed)
                    for t_lang in target_langs:
                        if t_lang in trans_map and isinstance(trans_map[t_lang], str):
                            translations[t_lang] = trans_map[t_lang].strip()
                    return translations
                except Exception:
                    for t_lang in target_langs:
                        match = re.search(rf'"{t_lang}"\s*:\s*"([^"]+)"', raw_text)
                        if match:
                            translations[t_lang] = match.group(1).strip()
                    if any(t_lang in translations for t_lang in target_langs):
                        return translations
        except asyncio.TimeoutError:
            logger.warning("Timeout (>8s) en llamada de traducción")
            break
        except Exception as exc:
            err_msg = str(exc)
            if "404" in err_msg and model_to_use != "gemini-3.6-flash":
                model_to_use = "gemini-3.6-flash"
                continue
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "Quota exceeded" in err_msg:
                cooldown = _extract_retry_delay(err_msg)
                if entry:
                    entry.mark_rate_limited(cooldown)
                # Intentar de inmediato con otra key del pool si existe
                next_client, next_entry = pool.get_available_entry()
                if next_client and next_client != client:
                    client, entry = next_client, next_entry
                    continue
                else:
                    break
            else:
                logger.warning("Error en traducción multi-destino: %s", exc)
                break

    return translations


async def translate_text(
    text: str,
    target_lang: str = "es",
    source_lang: str = "auto",
    prev_source: str = "",
    prev_target: str = "",
    on_chunk: Optional[Callable[[str], Awaitable[None]]] = None,
    extra_terms: Optional[List[str]] = None,
) -> Optional[str]:
    res = await translate_multi_targets(text=text, source_lang=source_lang, targets=[target_lang], extra_terms=extra_terms)
    return res.get(target_lang)


class RoomTranslationCoordinator:
    """Coordinador ligero por sala:
    - 1 sola llamada API unificada por bloque (traduce a EN y PT en simultáneo con JSON).
    - Rate limit y consumo de cuota reducidos a 1/3.
    """

    def __init__(self, room_id: str):
        self.room_id = room_id
        self.lock = asyncio.Lock()
        self.is_busy = False
        self.pending_text: Optional[str] = None
        self.pending_is_final = False
        self.pending_seq = 0
        self.pending_msg_id = ""
        self.pending_source_lang = "auto"

        self.last_source = ""
        self.last_confirmed_source = ""
        self.last_confirmed_targets: Dict[str, str] = {}
        self.last_translations: Dict[str, Dict[str, str]] = {}
        self.last_had_error: Dict[str, bool] = {}

    async def _translate_all_targets(
        self,
        text: str,
        source_lang: str,
        extra_terms: Optional[List[str]],
    ) -> Tuple[Dict[str, str], bool]:
        """Traduce en 1 sola llamada API a todos los idiomas destino."""
        is_auto = (not source_lang) or source_lang.lower() == "auto"
        targets = ["es", "en", "pt"] if is_auto else [l for l in SUPPORTED_LANGS if l.lower() != source_lang.lower()]
        translations = await translate_multi_targets(
            text=text,
            source_lang=source_lang,
            targets=targets,
            extra_terms=extra_terms,
        )
        had_error = any(not translations.get(lang) for lang in targets)
        return translations, had_error

    async def _process_loop(
        self,
        broadcaster: Callable[[dict], Awaitable[None]],
    ):
        """Bucle worker que consume la traducción activa y la última pendiente."""
        while True:
            async with self.lock:
                if not self.pending_text:
                    self.is_busy = False
                    break

                text_to_translate = self.pending_text
                is_final = self.pending_is_final
                seq = self.pending_seq
                msg_id = self.pending_msg_id
                source_lang = self.pending_source_lang or "auto"
                self.pending_text = None

            cached = self.last_translations.get(msg_id)
            if cached and text_to_translate == self.last_source:
                translations = cached
                had_error = self.last_had_error.get(msg_id, False)
            else:
                from app.services.connection_manager import manager
                extra_terms = manager.get_room_glossary(self.room_id)

                t_start = time.time()
                translations, had_error = await self._translate_all_targets(
                    text_to_translate, source_lang, extra_terms
                )
                duration_ms = int((time.time() - t_start) * 1000)
                if duration_ms > 0:
                    manager.record_latency(self.room_id, duration_ms)

            self.last_translations[msg_id] = translations
            self.last_had_error[msg_id] = had_error
            if is_final:
                self.last_source = text_to_translate
                self.last_confirmed_source = text_to_translate
                self.last_confirmed_targets = translations

            await broadcaster({
                "id": msg_id,
                "seq": seq,
                "room": self.room_id,
                "speaker_lang": source_lang,
                "transcription": text_to_translate,
                "translations": translations,
                "text": text_to_translate,
                "original": text_to_translate,
                "is_final": is_final,
                "translation_error": had_error,
                "timestamp": time.time(),
            })

    async def submit(
        self,
        seq: int,
        msg_id: str,
        text: str,
        is_final: bool,
        source_lang: str,
        broadcaster: Callable[[dict], Awaitable[None]],
    ):
        """Encola o actualiza la petición de traducción para la sala."""
        trimmed = text.strip()
        if not trimmed:
            return

        effective_lang = source_lang or "auto"
        is_auto = effective_lang.lower() == "auto"

        # 1. EMISIÓN INMEDIATA DEL TEXTO (0ms LAG)
        if is_auto:
            initial_translations = {l: trimmed for l in SUPPORTED_LANGS}
        else:
            initial_translations = {effective_lang: trimmed}
            
        cached = self.last_translations.get(msg_id)
        if cached:
            initial_translations.update(cached)

        await broadcaster({
            "id": msg_id,
            "seq": seq,
            "room": self.room_id,
            "speaker_lang": effective_lang,
            "transcription": trimmed,
            "translations": initial_translations,
            "text": trimmed,
            "original": trimmed,
            "is_final": is_final,
            "translation_error": self.last_had_error.get(msg_id, False),
            "timestamp": time.time(),
        })

        # Si ya teníamos esta frase traducida en caché, terminamos de inmediato
        if is_final and cached and trimmed == self.last_source:
            return

        # 2. PROCESAMIENTO ASÍNCRONO DE TRADUCCIÓN A OTROS IDIOMAS
        async with self.lock:
            self.pending_text = trimmed
            self.pending_is_final = is_final
            self.pending_seq = seq
            self.pending_msg_id = msg_id
            self.pending_source_lang = effective_lang

            if not self.is_busy:
                self.is_busy = True
                asyncio.create_task(self._process_loop(broadcaster))


_room_coordinators: Dict[str, RoomTranslationCoordinator] = {}


def get_room_coordinator(room_id: str) -> RoomTranslationCoordinator:
    """Obtiene o instancia el coordinador de traducción de la sala."""
    if room_id not in _room_coordinators:
        _room_coordinators[room_id] = RoomTranslationCoordinator(room_id)
    return _room_coordinators[room_id]


def reset_room_coordinator(room_id: str) -> None:
    """Limpia el coordinador al cerrar la sala."""
    _room_coordinators.pop(room_id, None)