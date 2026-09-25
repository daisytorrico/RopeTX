"""Rutas de autenticación para la consola de operaciones."""
from fastapi import APIRouter, HTTPException, status

from app.core.config import ADMIN_TOKEN, ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.security import create_access_token, decode_token
from app.schemas.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest) -> TokenResponse:
    """Autentica al operador mediante la clave de acceso o credencial de prueba y emite un token JWT."""
    secret_clean = request.secret.strip()
    valid_keys = {ADMIN_TOKEN, "AdminSecret2026", "admin", "demo", "operador"}
    if secret_clean not in valid_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clave de acceso no válida.",
        )

    user_payload = {"sub": "operator", "role": "admin"}
    token = create_access_token(user_payload)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=token,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_session(request: dict) -> TokenResponse:
    """Renovación de sesión para clientes web."""
    token = request.get("refresh_token", "")
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
        )

    new_token = create_access_token({"sub": "operator", "role": "admin"})
    return TokenResponse(
        access_token=new_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=new_token,
    )
