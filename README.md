# RopeTX Enterprise — Real-Time Subtitling & Translation

> **Vibeathon Nerdearla 2026 Challenge:** Construir una solución open source de transcripción y traducción simultánea a escala para conferencias con más de 30 sesiones en paralelo, con baja latencia, glosario técnico y acceso para audiencia mediante QR y overlays OBS.

**RopeTX** es una solución open-source de nivel empresarial para transcripción y traducción simultánea en tiempo real de conferencias, eventos presenciales y transmisiones en vivo de alta concurrencia.

Potenciada por la **API Live de Gemini (`gemini-2.5-flash` / `gemini-2.0-flash`)** para ASR nativo con glosario técnico (`customVocabulary`), **Gemini Flash-Lite** para traducción simultánea concurrente en streaming con contexto deslizante, y un backend asincrónico en **FastAPI (Python 3.11+)** con frontend reactivo en **React 19 + TypeScript + Vite**.

---

## Semántica de Idiomas y Pipeline de Traducción

El sistema opera bajo un modelo dinámico y determinista por sesión de sala:
- **Idioma del Orador (`speaker_lang`)**: Selección explícita por charla o sala (`es`, `en`, `pt`). Elimina la detección automática ambigua y garantiza ASR optimizado para la variante del hablante (`es-419`, `en-US`, `pt-BR`).
- **Idiomas de Audiencia Soportados (`es`, `en`, `pt`)**: Cada espectador puede elegir libremente el idioma en el que desea recibir los subtítulos desde la WebApp o el reproductor.
- **Traducción Concurrente No Bloqueante (0ms Lag Peribido)**: El backend emite la transcripción confirmada al instante en el idioma del orador y dispara tareas asíncronas (`asyncio.create_task`) para traducir en paralelo a los idiomas destino restantes con contexto previo (*Sliding Window*).
- **Glosario Término en 2 Niveles**:
  - **Glosario Base Persistente (`backend/app/data/glossary.json`)**: Versionado en Git por categorías (`cloud_devops`, `databases_streaming`, `languages_frameworks`, `ai_machine_learning`, `architecture_networking`, `development_git_ops`).
  - **Glosario Dinámico de la Charla (Admin UI)**: Los operadores u oradores pueden agregar términos específicos desde la consola de monitoreo (`StageTerminal`), integrándolos en vivo al vocabulario de Gemini.

---

## Requisitos Previos

1. **API Key(s) de Gemini:** [Google AI Studio](https://aistudio.google.com/app/apikey).
   * **Multi-Key Pool (Opcional):** Podés poner varias claves separadas por coma para sumar cuota (`15 RPM` por proyecto gratis):
     ```env
     GEMINI_API_KEYS=AIzaSyClave1...,AIzaSyClave2...
     ```
     *(Tip: Para cuotas independientes gratis con la misma cuenta de Google, creá cada clave en un **proyecto nuevo**).*
2. **Python 3.11+ y Node.js 18+** para desarrollo local.
3. **Redis (Opcional)**: Si no está disponible, el backend opera en **memoria RAM** automáticamente.

---

## Despliegue Rápido (Quickstart)

### Opción 1: Ejecución con Scripts de Inicio (Windows / PowerShell)

En la raíz del proyecto podés ejecutar el script de inicio rápido:

```powershell
# En PowerShell
.\start.ps1

# O en CMD de Windows
start.bat
```

### Opción 3: Despliegue en Google Cloud Run (Producción)

Despliegue directo del contenedor backend en Google Cloud Run con soporte nativo de WebSockets y HTTPS automático:

```bash
# 1. Login en Google Cloud
gcloud auth login
gcloud config set project TU_PROYECTO_ID

# 2. Desplegar backend en Cloud Run
gcloud run deploy ropetx-backend \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "ADMIN_TOKEN=AdminSecret2026,GEMINI_API_KEY=tu_api_key"

# 3. Desplegar frontend en Firebase Hosting (o Vercel)
cd frontend
npm run build
npx firebase deploy --only hosting
```

#### 1. Backend (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
# Configurar GEMINI_API_KEY en backend/.env o variables de entorno
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ws-ping-interval 20 --ws-ping-timeout 20
```

#### 2. Frontend (React 19 + TypeScript + Vite)
```bash
cd frontend
npm install
npm run dev
```

* **Frontend (Audiencia):** `http://localhost:5173`
* **Consola de Operador & Ingesta:** `http://localhost:5173/monitor?token=AdminSecret2026`
* **Overlay Transparente OBS / vMix:** `http://localhost:5173/overlay?room=main-stage`
* **Backend API Docs:** `http://localhost:8000/docs`

---

## Integración con OBS y vMix

La integración gráfica se realiza mediante **fuente de navegador** transparente (Browser Source):

1. Abrí la consola en `/monitor` y seleccioná la pestaña **OBS y vMix**.
2. Elegí la sala y el idioma objetivo de los subtítulos.
3. Copiá el enlace de overlay generado (`http://localhost:5173/overlay?room=main-stage&lang=es`).
4. En OBS o vMix, agregá una **Browser Source**, pegá la URL y usá resolución de `1920x1080`.

La capa tiene fondo transparente y renderiza los subtítulos en tiempo real vía WebSocket.

---

## Telemetría y Métricas: Justificación y Herramientas

Las métricas mostradas en la consola de operador (`/monitor`) y en el endpoint `/api/status` reflejan el rendimiento real del pipeline de transmisión:

| Métrica | ¿Qué mide y cómo se calcula? | Herramientas y Justificación en la Industria |
| :--- | :--- | :--- |
| **Latencia E2E (`latency_ms`)** | Tiempo real transcurrido entre la captura/ingesta del paquete de audio y la confirmación final de la frase por ASR (`time.perf_counter()`). | **Monotonic Timestamps + WebSockets/SSE**: Estándar en sistemas de *live-captioning* (SMPTE/SRT) para verificar que el retardo se mantenga por debajo del umbral de percepción humana (<300ms). |
| **Audiencia en Vivo (`audience_count`)** | Espectadores activos conectados en tiempo real por sala sumando sockets WebSocket y clientes SSE. | **FastAPI `ConnectionManager` + SSE/WS Heartbeats**: Detección determinista de conexiones vivas con *ping-pong* a 20s, evitando conteos fantasma. Compatible con escalado horizontal vía Redis Pub/Sub. |
| **Ingesta de Audio (`48kHz/16kHz PCM`)** | Tasa de muestreo y estado del buffer de decodificación de audio continuo. | **FFmpeg Subprocess Ingest**: El estándar de facto de la industria broadcast para ingesta y conversión en memoria de streams HLS (.m3u8), RTSP, RTMP, Web Radio o archivos locales. |
| **Salud del Pool de API Keys** | Rotación *Round-Robin* y conmutación por error ante límites de cuota (HTTP 429). | **Client Pool Failover**: Patrón de resiliencia estándar en producción para distribuir carga entre múltiples proyectos y garantizar disponibilidad continua en eventos de alta demanda. |
| **Exportación SRT (`.srt`)** | Generación de subtítulos estandarizados con sincronización precisa de inicio y fin. | **Estándar SubRip / WebVTT (W3C)**: Compatible universalmente con reproductores, plataformas de streaming (YouTube, Twitch) y suites de edición/broadcast (OBS, vMix, Premiere). |

---

## Guía de Demostración en Vivo (Demo Highlights)

Para realizar una presentación o *pitch* efectivo del sistema, se recomienda mostrar los siguientes 5 puntos:

1. **Latencia 0ms Percibida**: Hablar por micrófono y mostrar cómo la transcripción aparece al instante en el idioma del orador.
2. **Selector Multilingüe de Audiencia**: Cambiar en tiempo real entre `Español`, `Inglés` y `Portugués` desde el selector de audiencia.
3. **Glosario Técnico en Vivo**: Agregar una palabra técnica o el nombre de tu proyecto en el modal de **Glosario de la Charla** del monitor y decirla al micrófono para verificar que Gemini la reconoce sin traducirla literalmente.
4. **Simulación de Charla (1-Clic)**: Hacer clic en **"Iniciar Demo"** en el panel de monitoreo para proyectar subtítulos de prueba sin necesidad de micrófono.
5. **Exportación Instantánea de SRT**: Finalizar la transmisión, hacer clic en **"Descargar SRT"** y obtener el archivo de subtítulos estandarizado listo para producción.

---

## Licencia

Este proyecto está liberado bajo la Licencia **MIT** aprobada por la Open Source Initiative (OSI). Consulta el archivo [LICENSE](LICENSE) para más información.