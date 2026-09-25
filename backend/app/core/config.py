"""Configuración central del servicio RopeTX ASR.
Carga variables de entorno, rutas base y parámetros de modelos Gemini.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Rutas del proyecto
APP_DIR = Path(__file__).resolve().parent.parent
BASE_DIR = APP_DIR.parent
ROOT_DIR = BASE_DIR.parent

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BASE_DIR / ".env")

# Modelos Gemini y Pool de API Keys
raw_keys = os.getenv("GEMINI_API_KEYS", os.getenv("GEMINI_API_KEY", ""))
GEMINI_API_KEYS: list[str] = [k.strip() for k in raw_keys.split(",") if k.strip()]
GEMINI_API_KEY: str = GEMINI_API_KEYS[0] if GEMINI_API_KEYS else ""
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-transcribe-live")
GEMINI_TRANSLATE_MODEL: str = os.getenv("GEMINI_TRANSLATE_MODEL", "gemini-flash-lite-latest")
GEMINI_SOURCE_LANG: str = os.getenv("GEMINI_SOURCE_LANG", "en")

# Seguridad y Operador
ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "AdminSecret2026")
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", f"{ADMIN_TOKEN}-jwt-secret-enterprise-2026")
JWT_ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h para evitar desconexiones en vivo

# Red y Servidor
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))

# Directorios de salida
EXPORTS_DIR = BASE_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Base de datos (Por defecto SQLite local, compatible con MySQL/SQLServer/PostgreSQL vía DATABASE_URL)
DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'ropetx.db'}")

# Salas predeterminadas (configurables vía variable de entorno DEFAULT_ROOMS o fallback inicial a sala-1,sala-2)
DEFAULT_ROOMS = [r.strip() for r in os.getenv("DEFAULT_ROOMS", "sala-1,sala-2").split(",") if r.strip()]

# Parámetros de streaming y debouncing de traducción
TRANSLATION_DEBOUNCE_MS: int = int(os.getenv("TRANSLATION_DEBOUNCE_MS", "350"))
STABLE_PARTIAL_MS: int = int(os.getenv("STABLE_PARTIAL_MS", "600"))
MAX_TRANSLATIONS_PER_SEC: float = float(os.getenv("MAX_TRANSLATIONS_PER_SEC", "3.0"))

