"""Modelos de datos relacionales para persistencia de salas, charlas y métricas históricas."""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from app.db.database import Base


class RoomModel(Base):
    """Registro de salas creadas por el operador o por emisores técnicos."""
    __tablename__ = "rooms"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    custom_glossary = Column(String, default="", nullable=True)
    is_visible = Column(Boolean, default=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "custom_glossary": self.custom_glossary or "",
            "is_visible": bool(self.is_visible),
        }


class SessionModel(Base):
    """Registro histórico de cada charla transmitida, con peak de audiencia y archivo SRT."""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(String(64), index=True, nullable=False)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    peak_audience = Column(Integer, default=0)
    srt_file = Column(String(255), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "room_id": self.room_id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "peak_audience": self.peak_audience,
            "srt_file": self.srt_file,
        }


class MetricModel(Base):
    """Registro de métricas por minuto para analítica y auditoría técnica."""
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(String(64), index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    audience_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=False)
