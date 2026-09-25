"""Seguridad y autenticación de operadores para la consola de control.
Permite autenticación por JWT Bearer o acceso directo por Master Admin Token sin tropiezos.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from fastapi import HTTPException, Query, Header, status

from app.core.config import (
    ADMIN_TOKEN,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Genera un JWT Access Token firmado para el operador."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Valida y decodifica un token JWT."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


def verify_admin_token(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
) -> bool:
    """Valida credenciales administrativas mediante encabezado HTTP 'Authorization: Bearer <token>'
    o query param ?token=<token> para descargas directas de archivos en URLs relativas.
    """
    candidate = None
    if authorization and authorization.startswith("Bearer "):
        candidate = authorization.replace("Bearer ", "").strip()
    elif token:
        candidate = token.strip()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Encabezado de autorización o parámetro token requerido.",
        )

    # 1. Validación directa por Master Admin Token
    if candidate == ADMIN_TOKEN:
        return True

    # 2. Validación por JWT Access Token firmado
    decoded = decode_token(candidate)
    if decoded and decoded.get("role") == "admin":
        return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token de operador inválido o expirado.",
    )


def verify_ws_token(token: Optional[str]) -> bool:
    """Valida credenciales administrativas para WebSockets donde la API nativa del navegador no permite cabeceras HTTP personalizadas."""
    if not token:
        return False
    if token == ADMIN_TOKEN:
        return True
    decoded = decode_token(token)
    return bool(decoded and decoded.get("role") == "admin")
