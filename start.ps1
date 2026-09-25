$host.UI.RawUI.WindowTitle = "RopeTX Launcher"

Write-Host "Iniciando RopeTX..." -ForegroundColor Cyan

# Iniciar Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --ws-ping-interval 20 --ws-ping-timeout 20"

# Iniciar Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

# Breve espera y abrir navegador (ambas vistas: Asistente y Consola Técnica)
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
Start-Process "http://localhost:5173/monitor"

