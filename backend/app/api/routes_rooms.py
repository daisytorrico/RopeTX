"""Rutas para el ciclo de vida de salas y glosarios técnicos por charla."""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import DEFAULT_ROOMS
from app.core.security import verify_admin_token
from app.db.database import get_db
from app.db.models import RoomModel
from app.schemas.schemas import RoomGlossaryRequest, RoomGlossaryResponse, RoomVisibilityRequest
from app.services.connection_manager import manager

router = APIRouter(prefix="/api", tags=["rooms"])

@router.get("/rooms")
def list_rooms(
    include_hidden: bool = False,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    db_rooms = db.query(RoomModel).all()
    room_ids = {r.id for r in db_rooms}
    
    for active_id in list(manager.stream_active.keys()) + list(manager.custom_rooms) + DEFAULT_ROOMS:
        room_ids.add(active_id)
        
    db_map = {r.id: r.name for r in db_rooms}
    db_visibility = {r.id: getattr(r, "is_visible", True) for r in db_rooms}
    
    results = []
    for r_id in sorted(room_ids):
        is_visible = (r_id not in manager.hidden_rooms) and db_visibility.get(r_id, True)
        if not include_hidden and not is_visible:
            continue
        results.append({
            "id": r_id,
            "label": db_map.get(r_id, f"Sala: {r_id.replace('-', ' ').title()}"),
            "is_live": manager.stream_active.get(r_id, False),
            "is_visible": is_visible,
            "speaker_lang": manager.get_room_language(r_id),
        })
    return results

@router.patch("/rooms/{room_id}/visibility")
def toggle_room_visibility(
    room_id: str,
    payload: RoomVisibilityRequest,
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    clean_id = room_id.strip().lower()
    manager.set_room_visibility(clean_id, payload.is_visible)
    room = db.query(RoomModel).filter(RoomModel.id == clean_id).first()
    if room:
        room.is_visible = payload.is_visible
        db.commit()
    return {"status": "updated", "room_id": clean_id, "is_visible": payload.is_visible}

@router.patch("/rooms/{room_id}/language")
def update_room_language(
    room_id: str,
    payload: dict,
    _: bool = Depends(verify_admin_token),
) -> Dict[str, Any]:
    clean_id = room_id.strip().lower()
    lang = payload.get("language", "auto").strip().lower()
    if lang not in {"auto", "es", "en", "pt"}:
        lang = "auto"
    manager.set_room_language(clean_id, lang)
    return {"status": "updated", "room_id": clean_id, "speaker_lang": lang}

@router.post("/rooms")
def create_room(
    payload: dict,
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
):
    room_id = payload.get("room_id", "").strip().lower()
    room_name = payload.get("name", "").strip()
    is_visible = bool(payload.get("is_visible", True))

    if not room_id:
        raise HTTPException(status_code=400, detail="Stage identifier cannot be empty.")

    safe_id = "".join(c if c.isalnum() or c in "-_" else "-" for c in room_id).strip("-")
    if not safe_id:
        raise HTTPException(status_code=400, detail="Invalid stage identifier.")

    friendly_name = room_name or safe_id.replace("-", " ").title()
    existing = db.query(RoomModel).filter(RoomModel.id == safe_id).first()

    if not existing:
        new_room = RoomModel(id=safe_id, name=friendly_name, is_visible=is_visible)
        db.add(new_room)
        db.commit()
    else:
        existing.is_visible = is_visible
        db.commit()

    manager.add_room(safe_id)
    manager.set_room_visibility(safe_id, is_visible)

    return {"status": "created", "room_id": safe_id, "name": friendly_name, "is_visible": is_visible}

@router.delete("/rooms/{room_id}")
async def delete_room(
    room_id: str,
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
):
    if manager.stream_active.get(room_id, False):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete stage '{room_id}' while active on air.",
        )

    db.query(RoomModel).filter(RoomModel.id == room_id).delete()
    db.commit()

    manager.custom_rooms.discard(room_id)
    manager.active_rooms.pop(room_id, None)
    manager.monitor_rooms.pop(room_id, None)
    manager.stream_active.pop(room_id, None)
    await manager._clear_history(room_id, broadcast=True)
    manager.last_exported_srt.pop(room_id, None)
    manager.hidden_rooms.discard(room_id)

    return {"status": "deleted", "room_id": room_id}

@router.post("/rooms/{room_id}/clear")
async def clear_room_history(
    room_id: str,
    _: bool = Depends(verify_admin_token),
) -> Dict[str, Any]:
    """Limpia el historial de transcripciones de la sala y notifica a la audiencia y monitores."""
    clean_id = room_id.strip().lower()
    await manager._clear_history(clean_id, broadcast=True)
    return {"status": "cleared", "room_id": clean_id}

@router.get("/rooms/{room_id}/glossary", response_model=RoomGlossaryResponse)
def get_room_glossary(room_id: str, db: Session = Depends(get_db)) -> RoomGlossaryResponse:
    clean_id = room_id.strip().lower()
    terms = manager.get_room_glossary(clean_id)
    if not terms:
        room = db.query(RoomModel).filter(RoomModel.id == clean_id).first()
        if room and room.custom_glossary:
            db_terms = [t.strip() for t in room.custom_glossary.split(",") if t.strip()]
            manager.set_room_glossary(clean_id, db_terms)
            terms = db_terms
    return RoomGlossaryResponse(room_id=clean_id, terms=terms, total=len(terms))

@router.post("/rooms/{room_id}/glossary", response_model=RoomGlossaryResponse)
def set_room_glossary(
    room_id: str,
    payload: RoomGlossaryRequest,
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> RoomGlossaryResponse:
    clean_id = room_id.strip().lower()
    updated = manager.set_room_glossary(clean_id, payload.terms)
    
    room = db.query(RoomModel).filter(RoomModel.id == clean_id).first()
    if room:
        room.custom_glossary = ", ".join(updated)
        db.commit()
        
    return RoomGlossaryResponse(room_id=clean_id, terms=updated, total=len(updated))