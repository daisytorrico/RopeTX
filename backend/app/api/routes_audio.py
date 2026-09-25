"""Rutas para control de audio, simulación y detención de streams en vivo."""

import asyncio
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR
from app.core.security import verify_admin_token
from app.db.database import get_db
from app.db.models import SessionModel
from app.services.connection_manager import manager
from app.services.audio_service import (
    stream_wav_buffer,
    stream_url_buffer,
    convert_audio_to_wav_pcm,
    simulation_tasks,
    stream_tasks,
    room_queues,
)

router = APIRouter(prefix="/api", tags=["audio"])

@router.get("/demo-audios")
def list_demo_audios(_: bool = Depends(verify_admin_token)) -> Dict[str, Any]:
    """Devuelve los archivos de audio de prueba disponibles en la carpeta test_audio."""
    test_dir = BASE_DIR / "test_audio"
    if not test_dir.exists():
        return {"files": []}
    
    valid_exts = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"}
    files = []
    for p in test_dir.iterdir():
        if p.is_file() and p.suffix.lower() in valid_exts:
            size_mb = round(p.stat().st_size / (1024 * 1024), 2)
            files.append({
                "filename": p.name,
                "size_mb": size_mb,
                "format": p.suffix.lower().replace(".", "").upper()
            })
    files.sort(key=lambda x: x["filename"])
    return {"files": files}

@router.post("/simulate-stream/{room_id}")
async def simulate_stream(
    room_id: str,
    filename: Optional[str] = Query(None),
    source_lang: str = Query("auto"),
    _: bool = Depends(verify_admin_token),
) -> Dict[str, Any]:
    if manager.stream_active.get(room_id, False):
        raise HTTPException(
            status_code=400,
            detail=f"Stage '{room_id}' is already streaming.",
        )

    test_dir = BASE_DIR / "test_audio"
    target_filename = Path(filename.strip()).name if filename and filename.strip() else "charla_prueba.wav"
    test_audio_path = test_dir / target_filename

    if not test_audio_path.exists():
        default_path = test_dir / "charla_prueba.wav"
        if default_path.exists():
            test_audio_path = default_path
            target_filename = "charla_prueba.wav"
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Test audio file '{target_filename}' not found.",
            )

    with open(test_audio_path, "rb") as f:
        raw_bytes = f.read()

    wav_bytes = await convert_audio_to_wav_pcm(raw_bytes, target_filename)

    manager.set_room_language(room_id, source_lang)
    manager.set_stream_status(room_id, True)
    simulation_tasks[room_id] = asyncio.create_task(
        stream_wav_buffer(room_id, wav_bytes, source_lang=source_lang)
    )

    return {
        "status": "started",
        "room_id": room_id,
        "audio_file": target_filename,
    }

@router.post("/upload-audio/{room_id}")
@router.post("/upload-stream/{room_id}")
async def upload_audio(
    room_id: str,
    file: UploadFile = File(...),
    source_lang: str = Query("auto"),
    _: bool = Depends(verify_admin_token),
):
    if manager.stream_active.get(room_id, False):
        raise HTTPException(
            status_code=400,
            detail=f"Stage '{room_id}' is already streaming.",
        )

    allowed_exts = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format ({ext}). Allowed: .mp3, .wav, .m4a, .ogg, .flac",
        )

    raw_bytes = await file.read()
    try:
        wav_bytes = await convert_audio_to_wav_pcm(raw_bytes, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    manager.set_room_language(room_id, source_lang)
    manager.set_stream_status(room_id, True)
    simulation_tasks[room_id] = asyncio.create_task(
        stream_wav_buffer(room_id, wav_bytes, source_lang=source_lang)
    )

    return {
        "status": "started",
        "room_id": room_id,
        "filename": file.filename,
    }


@router.post("/stream-url/{room_id}")
async def stream_from_url(
    room_id: str,
    stream_url: str = Query(..., description="Remote streaming URL (RTSP, RTMP, HLS .m3u8, Web Radio, YouTube)"),
    source_lang: str = Query("auto"),
    _: bool = Depends(verify_admin_token),
):
    """Starts live streaming from external URL using FFmpeg."""
    if manager.stream_active.get(room_id, False):
        raise HTTPException(
            status_code=400,
            detail=f"Stage '{room_id}' is already streaming.",
        )

    clean_url = stream_url.strip()
    if not clean_url.startswith(("http://", "https://", "rtmp://", "rtsp://")):
        raise HTTPException(
            status_code=400,
            detail="Invalid stream URL. Must begin with http://, https://, rtmp://, or rtsp://",
        )

    manager.set_room_language(room_id, source_lang)
    manager.set_stream_status(room_id, True)
    simulation_tasks[room_id] = asyncio.create_task(
        stream_url_buffer(room_id, clean_url, source_lang=source_lang)
    )

    return {
        "status": "started",
        "room_id": room_id,
        "stream_url": clean_url,
    }


@router.post("/stop-stream/{room_id}")
@router.post("/stream/stop/{room_id}")
async def stop_stream(
    room_id: str,
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Detiene forzosamente cualquier streaming activo en la sala y persiste la sesión en la base de datos."""
    was_active = False

    if room_id in simulation_tasks:
        simulation_tasks[room_id].cancel()
        del simulation_tasks[room_id]
        was_active = True

    if room_id in stream_tasks:
        stream_tasks[room_id].cancel()
        del stream_tasks[room_id]
        was_active = True

    if room_id in room_queues:
        del room_queues[room_id]

    await manager.close_broadcasters(room_id)
    manager.set_stream_status(room_id, False)

    srt_path = await manager.export_srt(room_id, clear_history=False)
    srt_filename = Path(srt_path).name if srt_path else None

    try:
        start_ts = manager.stream_start_times.get(room_id, time.time())
        db_session = SessionModel(
            room_id=room_id,
            start_time=datetime.fromtimestamp(start_ts),
            end_time=datetime.utcnow(),
            peak_audience=len(manager.active_rooms.get(room_id, set())) + len(manager.sse_queues.get(room_id, set())),
            srt_file=srt_filename,
        )
        db.add(db_session)
        db.commit()
    except Exception:
        pass

    return {
        "status": "stopped",
        "room_id": room_id,
        "was_active": was_active,
        "srt_file": srt_filename,
    }