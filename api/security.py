"""
StormPrint :: security.py
Hardened security layer: API-key auth (RBAC), rate limiting (slowapi),
strict security headers and CORS policy, OWASP Top 10 mitigations.
"""

import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# ---------------------------------------------------------------------------
# API Key configuration
# ---------------------------------------------------------------------------
_API_KEY_SALT = os.environ.get("STORMPRINT_KEY_SALT", "storm-print-manga-static-salt-v1")
_RAW_API_KEY = os.environ.get("STORMPRINT_API_KEY", "sp_live_manga_default_change_me")


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(f"{_API_KEY_SALT}:{raw_key}".encode("utf-8")).hexdigest()


_EXPECTED_KEY_HASH = _hash_key(_RAW_API_KEY)


def generate_admin_credentials(username: str, password: str) -> dict:
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        100_000,
    )
    return {
        "username": username,
        "salt": salt,
        "password_hash": derived.hex(),
    }


def verify_admin_credentials(password: str, salt: str, password_hash: str) -> bool:
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        100_000,
    )
    return hmac.compare_digest(derived.hex(), password_hash)


async def verify_api_key(x_stormprint_key: Optional[str] = Header(default=None)) -> str:
    if not x_stormprint_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    supplied_hash = _hash_key(x_stormprint_key)
    if not hmac.compare_digest(supplied_hash, _EXPECTED_KEY_HASH):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return x_stormprint_key


# ---------------------------------------------------------------------------
# Rate limiting (slowapi)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

RATE_LIMIT_PREDICT = "10/minute"
RATE_LIMIT_PREDECIR = "30/minute"


def rate_limit_exceeded_handler(request: Request, exc) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"error": "rate_limit_exceeded", "message": "Too many requests. Please slow down."},
    )


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        if "Server" in response.headers:
            del response.headers["Server"]
        response.headers["Cache-Control"] = response.headers.get(
            "Cache-Control", "no-store, no-cache, must-revalidate"
        )
        return response


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
def get_allowed_origins() -> list:
    raw = os.environ.get(
        "STORMPRINT_ALLOWED_ORIGINS",
        "https://stormprint.vercel.app,http://localhost:3000",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


# ---------------------------------------------------------------------------
# Public routes (no auth required)
# ---------------------------------------------------------------------------
PUBLIC_ROUTES = {
    "/api/v1/health",
    "/api/v1/predecir",
    "/api/v1/predicciones",
}


def is_public_route(path: str) -> bool:
    return path.rstrip("/") in PUBLIC_ROUTES


# ---------------------------------------------------------------------------
# Generic, sanitized error responses
# ---------------------------------------------------------------------------
IS_PRODUCTION = os.environ.get("VERCEL_ENV", os.environ.get("ENV", "production")) != "development"


def sanitize_exception_response(exc: Exception) -> dict:
    if IS_PRODUCTION:
        return {"error": "internal_server_error", "message": "An unexpected error occurred."}
    return {"error": "internal_server_error", "message": str(exc)}
