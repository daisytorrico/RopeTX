"""Servicio de ingesta y streaming de audio para salas (RF-01, RF-02).
Maneja colas asíncronas por sala, bufferización de archivos WAV y sincronización de sesión.
"""
import asyncio
import io
import logging
import time
import wave
from typing import Dict

from app.services.connection_manager import manager
from app.services.gemini_asr import stream_audio_to_gemini

logger = logging.getLogger("audio_service")

# Registro global de colas y tareas de streaming activas por sala
room_queues: Dict[str, asyncio.Queue] = {}
stream_tasks: Dict[str, asyncio.Task] = {}
simulation_tasks: Dict[str, asyncio.Task] = {}


async def convert_audio_to_wav_pcm(audio_bytes: bytes, filename: str = "audio.wav") -> bytes:
    """Convierte cualquier formato de audio (.mp3, .m4a, .ogg, .flac, .wav, etc.) a WAV PCM 16kHz 16-bit mono."""
    if filename.lower().endswith(".wav"):
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                if wf.getframerate() == 16000 and wf.getnchannels() == 1 and wf.getsampwidth() == 2:
                    return audio_bytes
        except Exception:
            pass

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-i", "pipe:0",
        "-f", "wav",
        "-acodec", "pcm_s16le",
        "-ac", "1",
        "-ar", "16000",
        "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(input=audio_bytes)
    if proc.returncode != 0:
        logger.error("Error convirtiendo audio con ffmpeg: %s", stderr.decode(errors="ignore"))
        raise ValueError("No se pudo procesar el archivo de audio. Verificá que sea un formato válido (.mp3, .wav, .m4a, .ogg, .flac).")
    return stdout


def ensure_room_stream(room_id: str, source_lang: str = "auto") -> asyncio.Queue:
    """Garantiza que la cola y el canal de Gemini Live existan para una sala dada.

    Ya no recibe `lang`/target_lang: el backend traduce siempre a todos los
    idiomas soportados menos source_lang (ver gemini_translator.SUPPORTED_LANGS),
    así que solo hace falta saber el idioma del orador.
    """
    if room_id in stream_tasks and stream_tasks[room_id].done():
        del stream_tasks[room_id]
        room_queues.pop(room_id, None)

    if room_id not in room_queues:
        # LIMITAMOS A 50 PAQUETES (Backpressure)
        queue: asyncio.Queue = asyncio.Queue(maxsize=50)
        room_queues[room_id] = queue
        stream_tasks[room_id] = asyncio.create_task(
            stream_audio_to_gemini(room_id, queue, source_lang=source_lang)
        )
        manager.set_stream_status(room_id, True)
    return room_queues[room_id]


async def stream_wav_buffer(room_id: str, wav_bytes: bytes, source_lang: str = "auto") -> None:
    """Lee bytes de audio WAV y los transmite a la cola en fragmentos de 100ms simulando tiempo real continuo."""
    queue = ensure_room_stream(room_id, source_lang=source_lang)

    ready_evt = manager.get_session_ready_event(room_id)
    try:
        await asyncio.wait_for(ready_evt.wait(), timeout=6.0)
    except asyncio.TimeoutError:
        logger.warning("Timeout esperando conexión de Gemini Live en sala %s", room_id)

    try:
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            framerate = wf.getframerate()
            sample_width = wf.getsampwidth()
            n_channels = wf.getnchannels()
            bytes_per_frame = sample_width * n_channels

            chunk_duration = 0.15
            chunk_size = int(framerate * chunk_duration)

            start_wall = time.monotonic()
            frames_sent = 0

            data = wf.readframes(chunk_size)
            while len(data) > 0:
                manager.record_audio_packet(room_id)
                await queue.put(data)
                frames_sent += len(data) // bytes_per_frame

                expected_time = frames_sent / framerate
                elapsed = time.monotonic() - start_wall
                sleep_needed = expected_time - elapsed

                if sleep_needed > 0:
                    await asyncio.sleep(sleep_needed)
                else:
                    await asyncio.sleep(0)

                data = wf.readframes(chunk_size)

            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        logger.info("Transmisión de audio cancelada para sala: %s", room_id)
    except Exception as exc:
        logger.error("Error al transmitir audio a sala %s: %s", room_id, exc)
    finally:
        logger.info("Fin de transmisión de audio para sala: %s", room_id)
        manager.set_stream_status(room_id, False)
        if room_id in simulation_tasks:
            del simulation_tasks[room_id]


async def delayed_stream_cleanup(room_id: str, delay_seconds: float = 4.0) -> None:
    """Limpieza retardada de la cola y tarea de streaming tras desconexión del emisor."""
    await asyncio.sleep(delay_seconds)
    if not manager.stream_active.get(room_id, False):
        if room_id in stream_tasks:
            stream_tasks[room_id].cancel()
            del stream_tasks[room_id]
        if room_id in room_queues:
            del room_queues[room_id]


async def stream_url_buffer(room_id: str, stream_url: str, source_lang: str = "auto") -> None:
    """Consume una URL de streaming (RTSP, RTMP, HLS .m3u8, Web Radio, YouTube Live) usando FFmpeg y la transmite a la cola en tiempo real."""
    queue = ensure_room_stream(room_id, source_lang=source_lang)

    ready_evt = manager.get_session_ready_event(room_id)
    try:
        await asyncio.wait_for(ready_evt.wait(), timeout=6.0)
    except asyncio.TimeoutError:
        logger.warning("Timeout esperando conexión de Gemini Live en sala %s", room_id)

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-i", stream_url,
        "-f", "s16le",
        "-acodec", "pcm_s16le",
        "-ac", "1",
        "-ar", "16000",
        "pipe:1",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    chunk_size = 4800  # ~150ms de audio PCM (16000 samples/sec * 2 bytes * 0.15s)
    try:
        while True:
            chunk = await proc.stdout.read(chunk_size)
            if not chunk:
                break
            manager.record_audio_packet(room_id)
            await queue.put(chunk)
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        logger.info("Stream URL cancelado para sala: %s", room_id)
    except Exception as exc:
        logger.error("Error transmitiendo desde URL en sala %s: %s", room_id, exc)
    finally:
        if proc.returncode is None:
            try:
                proc.terminate()
                await proc.wait()
            except Exception:
                pass
        manager.set_stream_status(room_id, False)
        if room_id in simulation_tasks:
            del simulation_tasks[room_id]


class AudioStreamFactory:
    """Fábrica (Factory Pattern) para la instanciación limpia de fuentes de audio."""

    @staticmethod
    def ensure_stream(room_id: str, source_lang: str = "auto") -> asyncio.Queue:
        """Obtiene o inicia la cola unificada para micrófono en vivo o ingesta externa."""
        return ensure_room_stream(room_id, source_lang=source_lang)

    @staticmethod
    async def stream_wav(room_id: str, wav_bytes: bytes, source_lang: str = "auto") -> None:
        """Inicia el streaming asíncrono desde un buffer de audio formateado."""
        await stream_wav_buffer(room_id, wav_bytes, source_lang=source_lang)

    @staticmethod
    async def stream_url(room_id: str, stream_url: str, source_lang: str = "auto") -> None:
        """Inicia el streaming asíncrono desde una URL remota de audio/video usando FFmpeg."""
        await stream_url_buffer(room_id, stream_url, source_lang=source_lang)

