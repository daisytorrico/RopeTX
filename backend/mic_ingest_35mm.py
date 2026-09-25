"""Capturador de audio de micrófono / Jack 3.5mm para Mini PC dedicado.
Transmite paquetes PCM 16kHz Mono de baja latencia por WebSocket hacia el backend.
No requiere microservicios y opera de forma autónoma por sala.
"""
import sys
import os
import argparse
import asyncio
import subprocess
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("mic_ingest_35mm")


async def stream_pcm_from_ffmpeg(device_name: str, server_url: str, room_id: str):
    """Captura audio del dispositivo 3.5mm usando FFmpeg en tiempo real y lo transmite por WebSocket."""
    import websockets

    ws_url = f"{server_url.rstrip('/')}/ws/stream/{room_id}"
    logger.info(f"Iniciando ingesta de audio 3.5mm para sala '{room_id}'")
    logger.info(f"Conectando a {ws_url}...")

    # Comando FFmpeg multiplataforma para capturar 16kHz mono 16-bit PCM crudo
    if sys.platform == "win32":
        # Windows DirectShow
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-f", "dshow",
            "-i", f"audio={device_name}",
            "-ar", "16000",
            "-ac", "1",
            "-f", "s16le",
            "-bufsize", "64k",
            "pipe:1",
        ]
    elif sys.platform == "darwin":
        # macOS AVFoundation
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-f", "avfoundation",
            "-i", f":{device_name}",
            "-ar", "16000",
            "-ac", "1",
            "-f", "s16le",
            "pipe:1",
        ]
    else:
        # Linux ALSA / PulseAudio
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-f", "pulse" if device_name == "default" else "alsa",
            "-i", device_name,
            "-ar", "16000",
            "-ac", "1",
            "-f", "s16le",
            "pipe:1",
        ]

    # Chunk de 100ms = 16000 samples/sec * 2 bytes * 0.100s = 3200 bytes
    CHUNK_SIZE = 3200

    while True:
        try:
            logger.info(f"Conectando WebSocket a {ws_url}...")
            async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
                logger.info(f"[CONECTADO] Transmitiendo audio 3.5mm en vivo para sala '{room_id}'")
                
                # Lanzar subproceso FFmpeg
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                try:
                    while True:
                        data = await proc.stdout.read(CHUNK_SIZE)
                        if not data:
                            logger.warning("No se recibieron datos de audio del dispositivo.")
                            break
                        await ws.send(data)
                finally:
                    if proc.returncode is None:
                        try:
                            proc.terminate()
                            await proc.wait()
                        except Exception:
                            pass

        except (websockets.exceptions.ConnectionClosed, OSError) as exc:
            logger.warning(f"Conexión perdida con el backend ({exc}). Reintentando en 3s...")
            await asyncio.sleep(3.0)
        except Exception as exc:
            logger.error(f"Error inesperado en captura de audio: {exc}")
            await asyncio.sleep(3.0)


def list_audio_devices():
    """Lista dispositivos de audio disponibles en Windows vía FFmpeg dshow."""
    if sys.platform == "win32":
        cmd = ["ffmpeg", "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"]
        print("Dispositivos de audio disponibles en Windows:")
        subprocess.run(cmd)
    else:
        print("En Linux podés listar con: arecord -l o pactl list sources short")


def main():
    parser = argparse.ArgumentParser(description="Ingesta de Audio 3.5mm para RopeTX / Nerdearla")
    parser.add_argument("--room", default="main-stage", help="ID de la sala (default: main-stage)")
    parser.add_argument("--server", default="ws://localhost:8000", help="URL base del backend RopeTX")
    parser.add_argument("--device", default="Microphone (Realtek(R) Audio)", help="Nombre del dispositivo de audio (Line-in / Jack 3.5mm)")
    parser.add_argument("--list-devices", action="store_true", help="Listar dispositivos de audio y salir")
    args = parser.parse_args()

    if args.list_devices:
        list_audio_devices()
        return

    try:
        asyncio.run(stream_pcm_from_ffmpeg(args.device, args.server, args.room))
    except KeyboardInterrupt:
        logger.info("Ingesta detenida por el usuario.")


if __name__ == "__main__":
    main()
