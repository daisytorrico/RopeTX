import asyncio
import websockets
import wave
import sys
import os


async def stream_audio_file(file_path: str, room_id: str):
    uri = f"ws://localhost:8000/ws/stream/{room_id}"
    print(f"[INFO] Abriendo archivo de audio de prueba: {file_path}")
    
    try:
        # Abrimos el archivo de audio (.wav)
        with wave.open(file_path, 'rb') as wf:
            # Verificamos formato básico
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
                print("[ALERTA] Para mejor precisión con Gemini, se recomienda audio Mono de 16-bit PCM.")

            async with websockets.connect(uri) as websocket:
                print(f"[OK] Conectado al backend. Transmitiendo a la sala '{room_id}' en tiempo real...")
                
                # Leemos el audio en fragmentos de 100ms para simular streaming en tiempo real continuo
                chunk_size = int(wf.getframerate() * 0.1)
                data = wf.readframes(chunk_size)
                
                while len(data) > 0:
                    # Enviamos los bytes crudos por el WebSocket
                    await websocket.send(data)
                    await asyncio.sleep(0.1)
                    data = wf.readframes(chunk_size)
                    
                print("[OK] Transmisión del audio de prueba enviada. Esperando 5s para recepción final...")
                await asyncio.sleep(5.0)
                
    except FileNotFoundError:
        print(f"[ERROR] No se encontró el archivo en '{file_path}'.")
    except Exception as e:
        print(f"[ERROR] Error en la conexión: {e}")


if __name__ == "__main__":
    # Configuraciones por defecto o por argumentos de terminal
    ruta_directa = "./test_audio/charla_prueba.wav"
    ruta_script = os.path.join(os.path.dirname(__file__), "test_audio", "charla_prueba.wav")
    ruta_audio = ruta_directa if os.path.exists(ruta_directa) else ruta_script
    sala = sys.argv[1] if len(sys.argv) > 1 else "sala-1"
    
    asyncio.run(stream_audio_file(ruta_audio, sala))
