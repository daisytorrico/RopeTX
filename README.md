# RopeTX — Real-Time Subtitling & Translation

Solución open-source para transcripción y traducción en tiempo real de conferencias, eventos y transmisiones en vivo con múltiples salas en paralelo.

Desarrollada para el desafío **Vibeathon Nerdearla 2026**, integrando la **API Live de Gemini** para reconocimiento de voz (ASR) con glosarios técnicos, traducción simultánea en streaming, backend en **FastAPI (Python)** y frontend en **React + TypeScript**.

---

## Características Principales

- **Multi-sala:** Soporte para más de 30 salas simultáneas con estado independiente.
- **Idiomas:** Transcripción y traducción entre Español (`es`), Inglés (`en`) y Portugués (`pt`).
- **Glosario Técnico:** Glosario base configurable y adición de términos en vivo desde el panel de control.
- **Acceso para Audiencia:** Interfaz web móvil con selector de idioma accesible mediante código QR.
- **Integración Broadcast:** Overlays transparentes listos para OBS Studio y vMix.
- **Exportación SRT:** Generación automática de archivos `.srt` al finalizar cada sesión.

---

## Enlaces y Acceso

- **Frontend (Audiencia):** `https://ropetx-9bcde.web.app` (Local: `http://localhost:5173`)
- **Panel de Control / Monitoreo:** `https://ropetx-9bcde.web.app/monitor` (Local: `http://localhost:5173/monitor`)
- **Overlay para OBS / vMix:** `https://ropetx-9bcde.web.app/overlay?room=main-stage`
- **Documentación API:** `https://ropetx-backend-450227135111.us-central1.run.app/docs` (Local: `http://localhost:8000/docs`)

### Inicio de Sesión en el Panel (`/monitor`)

Para acceder al panel de administración y control de salas:
- **URL:** `https://ropetx-9bcde.web.app/monitor`
- **Clave de acceso (Access Key):** `AdminSecret2026`

---

## Requisitos Previos

1. **API Key de Gemini:** [Google AI Studio](https://aistudio.google.com/app/apikey).
2. **Python 3.11+** y **Node.js 18+** (para desarrollo local).
3. **FFmpeg** (para ingesta de audio/streams).

---

## Instalación y Ejecución Local

### Opción 1: Scripts de Inicio Rápido (Windows)

```powershell
# En PowerShell
.\start.ps1

# O en CMD
start.bat
```

### Opción 2: Ejecución Manual

#### 1. Backend (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
# Configurar GEMINI_API_KEY en backend/.env o variables de entorno
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## Integración con vMix y OBS Studio

Los subtítulos se integran mediante fuentes de navegador (*Browser Source*):

### Configuración en vMix:
1. En el panel de control (`/monitor`), abrí la pestaña **OBS y vMix**, seleccioná la sala y copiá el enlace del overlay.
2. En vMix, hacé clic en **Add Input** ➔ **Web Browser**.
3. Pegá la URL del overlay y configurá la resolución en `1920x1080`.
4. Usá el botón **Cut** para enviar la entrada a la salida principal (**Program**).
5. Activá **Fullscreen** hacia el segundo monitor para proyectar en sala con fondo transparente.

### Configuración en OBS Studio:
1. Agregá una fuente de tipo **Navegador (Browser)** en tu escena.
2. Pegá la URL del overlay y configurá resolución `1920x1080`.

---

## Despliegue en Google Cloud

### Backend (Google Cloud Run)
```bash
gcloud run deploy ropetx-backend \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "ADMIN_TOKEN=AdminSecret2026,GEMINI_API_KEY=tu_api_key"
```

### Frontend (Firebase Hosting)
```bash
cd frontend
npm run build
npx firebase deploy --only hosting
```

---

## Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.