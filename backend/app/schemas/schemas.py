import time
from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["online", "degraded", "offline"]
    service: str
    event: str


class RoomTelemetry(BaseModel):
    room_id: str
    status: Literal["ONLINE", "IDLE"]
    audience_count: int = Field(ge=0, description="Cantidad de espectadores reales (excluye monitores)")
    latency_ms: int = Field(default=0, ge=0)
    has_srt: bool
    srt_file: str = ""
    is_visible: bool = True


class RoomVisibilityRequest(BaseModel):
    is_visible: bool


class TelemetryResponse(BaseModel):
    telemetry: List[RoomTelemetry]
    total_active_streams: int


class SubtitlePayload(BaseModel):
    id: str
    room: str
    text: str
    speaker_lang: str = "es"
    transcription: Optional[str] = None
    translations: Dict[str, str] = Field(default_factory=dict)
    original: Optional[str] = None
    timestamp: float = Field(default_factory=time.time)
    seq: Optional[int] = None
    is_final: bool = True
    translation_error: bool = False

    def to_dict(self) -> dict:
        data = self.model_dump()
        if not data.get("original") and data.get("text"):
            data["original"] = data["text"]
        return data


class LoginRequest(BaseModel):
    secret: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = ""


class RoomGlossaryRequest(BaseModel):
    terms: List[str]


class RoomGlossaryResponse(BaseModel):
    room_id: str
    terms: List[str]
    total: int
