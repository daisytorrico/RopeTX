"""Módulo API de FastAPI: endpoints HTTP y WebSockets."""
from app.api.routes_auth import router as auth_router
from app.api.routes_rooms import router as rooms_router
from app.api.routes_exports import router as exports_router
from app.api.routes_audio import router as audio_router
from app.api.routes_telemetry import router as telemetry_router
from app.api.routes_ws import router as ws_router
from app.api.routes_sse import router as sse_router

__all__ = [
    "auth_router",
    "rooms_router",
    "exports_router",
    "audio_router",
    "telemetry_router",
    "ws_router",
    "sse_router",
]