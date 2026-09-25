"""Rutas de telemetría y observabilidad en tiempo real."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import verify_admin_token
from app.db.database import get_db
from app.db.models import RoomModel
from app.schemas.schemas import TelemetryResponse
from app.services.connection_manager import manager

router = APIRouter(prefix="/api", tags=["telemetry"])

@router.get("/status", response_model=TelemetryResponse)
async def get_status(
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> TelemetryResponse:
    """Métricas en tiempo real protegidas para la consola de monitoreo."""
    
    db_rooms = db.query(RoomModel).all()
    db_room_ids = {r.id for r in db_rooms}
    db_hidden_ids = {r.id for r in db_rooms if not getattr(r, 'is_visible', True)}

    telemetry = await manager.get_telemetry(db_room_ids=db_room_ids, db_hidden_ids=db_hidden_ids)
    active_count = sum(1 for v in manager.stream_active.values() if v)

    return TelemetryResponse(
        telemetry=telemetry,
        total_active_streams=active_count,
    )