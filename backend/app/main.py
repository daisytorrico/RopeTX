"""RopeTX — Plataforma Empresarial de Transcripción y Traducción en Tiempo Real."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.schemas import HealthResponse
from app.api.routes_auth import router as auth_router
from app.api.routes_rooms import router as rooms_router
from app.api.routes_exports import router as exports_router
from app.api.routes_audio import router as audio_router
from app.api.routes_telemetry import router as telemetry_router
from app.api.routes_ws import router as ws_router
from app.api.routes_sse import router as sse_router  # NUEVO: vista de audiencia vía SSE
from app.db.database import init_db, SessionLocal
from app.db.models import RoomModel
from app.services.connection_manager import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ropetx")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Inicializa la base de datos y carga las salas persistidas al arrancar el servicio."""
    init_db()
    
    # Cargar todas las salas persistidas de la base de datos en ConnectionManager
    db = SessionLocal()
    try:
        db_rooms = db.query(RoomModel).all()
        if not db_rooms:
            from app.core.config import DEFAULT_ROOMS
            for def_r in DEFAULT_ROOMS:
                new_r = RoomModel(id=def_r, name=f"Sala: {def_r.replace('-', ' ').title()}", is_visible=True)
                db.add(new_r)
            db.commit()
            db_rooms = db.query(RoomModel).all()

        for r in db_rooms:
            manager.add_room(r.id)
            manager.set_room_visibility(r.id, getattr(r, "is_visible", True))
            if getattr(r, "custom_glossary", None):
                terms = [t.strip() for t in r.custom_glossary.split(",") if t.strip()]
                manager.set_room_glossary(r.id, terms)
        logger.info("Base de datos lista: %d salas cargadas en memoria.", len(db_rooms))
    finally:
        db.close()

    yield


app = FastAPI(
    title="RopeTX ASR Enterprise",
    description="Motor asincrónico de transcripción y traducción en tiempo real con Gemini Live API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montaje de routers con separación estricta de responsabilidades
app.include_router(auth_router)
app.include_router(rooms_router)
app.include_router(exports_router)
app.include_router(audio_router)
app.include_router(telemetry_router)
app.include_router(ws_router)
app.include_router(sse_router)  # NUEVO


@app.get("/", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
def read_root() -> HealthResponse:
    """Chequeo de salud del servicio."""
    return HealthResponse(
        status="online",
        service="RopeTX ASR Enterprise",
        event="Live Broadcast & Conference Streaming",
    )