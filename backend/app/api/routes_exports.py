"""Rutas para el repositorio y exportación de archivos de subtítulos .SRT."""

from datetime import datetime
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.core.config import EXPORTS_DIR
from app.core.security import verify_admin_token
from app.services.connection_manager import manager

router = APIRouter(prefix="/api", tags=["exports"])

@router.get("/download-srt/{room_id}")
async def download_srt(room_id: str, _: bool = Depends(verify_admin_token)) -> FileResponse:
    """Descarga el archivo .srt generado para una sala al finalizar o durante una charla."""
    
    # 1. Si hay historial activo en Redis, exportar/actualizar SRT al vuelo
    has_history = await manager.redis.exists(f"ropetx:history:{room_id}")
    if has_history:
        await manager.export_srt(room_id, clear_history=False)
        
    filename = manager.last_exported_srt.get(room_id)

    if not filename or not Path(filename).exists():
        # 2. Buscar en EXPORTS_DIR el archivo más reciente para esta sala
        existing_files = sorted(
            EXPORTS_DIR.glob(f"transcripcion_{room_id}_*.srt"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if existing_files:
            filename = str(existing_files[0])
            manager.last_exported_srt[room_id] = filename

    if not filename or not Path(filename).exists():
        raise HTTPException(
            status_code=404,
            detail=f"No .SRT transcript generated yet for stage '{room_id}'. Stream audio first.",
        )

    file_path = Path(filename)
    return FileResponse(
        path=str(file_path),
        media_type="application/x-subrip",
        filename=file_path.name,
        headers={
            "Content-Disposition": f'attachment; filename="{file_path.name}"',
            "Cache-Control": "no-cache",
        },
    )

@router.get("/exports")
def list_exports(_: bool = Depends(verify_admin_token)) -> Dict[str, Any]:
    files = []
    for f in sorted(EXPORTS_DIR.glob("*.srt"), key=lambda p: p.stat().st_mtime, reverse=True):
        files.append({
            "filename": f.name,
            "size_bytes": f.stat().st_size,
            "modified_time": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            "server_path": f"backend/exports/{f.name}",
        })
    return {
        "exports_dir": "backend/exports/",
        "total_files": len(files),
        "files": files,
    }

@router.get("/download-srt-file/{filename}")
def download_srt_by_filename(filename: str, _: bool = Depends(verify_admin_token)) -> FileResponse:
    safe_name = Path(filename).name
    target_path = EXPORTS_DIR / safe_name
    if not target_path.exists() or not safe_name.endswith(".srt"):
        raise HTTPException(status_code=404, detail="SRT transcript file not found.")

    return FileResponse(
        path=str(target_path),
        media_type="application/x-subrip",
        filename=safe_name,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Cache-Control": "no-cache",
        },
    )

@router.delete("/exports/{filename}")
def delete_export_file(filename: str, _: bool = Depends(verify_admin_token)) -> Dict[str, Any]:
    safe_name = Path(filename).name
    target_path = EXPORTS_DIR / safe_name
    if not target_path.exists() or not safe_name.endswith(".srt"):
        raise HTTPException(status_code=404, detail="SRT transcript file not found.")
    try:
        target_path.unlink()
        return {"status": "success", "message": f"File '{safe_name}' deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")

@router.delete("/exports")
def clear_all_exports(_: bool = Depends(verify_admin_token)) -> Dict[str, Any]:
    deleted_count = 0
    errors = []
    for f in EXPORTS_DIR.glob("*.srt"):
        try:
            f.unlink()
            deleted_count += 1
        except Exception as e:
            errors.append(f"{f.name}: {str(e)}")
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "errors": errors if errors else None,
    }