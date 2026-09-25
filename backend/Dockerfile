FROM python:3.11-slim

WORKDIR /app

# Instalar curl para healthchecks y ffmpeg para conversión y streaming de audio
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Directorio persistente de exportaciones SRT
RUN mkdir -p /app/exports

EXPOSE 8000 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Servidor ASGI compatible con Docker local y Google Cloud Run ($PORT)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --ws-ping-interval 20 --ws-ping-timeout 20"]