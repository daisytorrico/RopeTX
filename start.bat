@echo off
title RopeTX Launcher

echo ===================================================
echo   Iniciando RopeTX - Nerdearla Live Transcription
echo ===================================================

:: Limpiar instancias previas colgadas en puerto 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Iniciar Backend
start "Backend (FastAPI)" cmd /k "cd backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --ws-ping-interval 20 --ws-ping-timeout 20"

:: Iniciar Frontend
start "Frontend (Vite)" cmd /k "cd frontend && npm run dev"

:: Breve espera para que levanten los puertos y abrir navegador
timeout /t 2 /nobreak > nul
start http://localhost:5173
start http://localhost:5173/monitor
