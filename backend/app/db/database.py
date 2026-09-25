"""Conexión y sesión de base de datos con SQLAlchemy.
Compatible con SQLite, MySQL, SQL Server y PostgreSQL mediante DATABASE_URL.
"""
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

from app.core.config import DATABASE_URL

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Generador de sesión de base de datos para dependencias de FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Crea las tablas en la base de datos si no existen y migra columnas nuevas automáticamente."""
    from app.db.models import RoomModel
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)

    # Migración liviana automática para SQLite
    try:
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(rooms)")).fetchall()
            column_names = [row[1] for row in result]
            if "is_visible" not in column_names and len(column_names) > 0:
                conn.execute(text("ALTER TABLE rooms ADD COLUMN is_visible BOOLEAN DEFAULT 1"))
                conn.commit()
    except Exception:
        pass

    # Garantizar que existan salas iniciales si la base de datos está vacía
    db = SessionLocal()
    try:
        if db.query(RoomModel).count() == 0:
            default_seeds = [
                RoomModel(id="sala-1", name="Sala 1", is_visible=True),
                RoomModel(id="sala-2", name="Sala 2", is_visible=True),
            ]
            db.add_all(default_seeds)
            db.commit()
    except Exception:
        pass
    finally:
        db.close()
