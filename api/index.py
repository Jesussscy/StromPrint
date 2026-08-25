"""
StormPrint :: index.py
FastAPI serverless entrypoint (Vercel-compatible).
"La huella que deja cada tormenta en el territorio" — Barrio Manga, Cartagena.
"""

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from .database import (
    clear_old_records,
    fetch_recent_records,
    get_session,
    init_db,
    persist_records,
)
from .physics_engine import PhysicalParameters, run_simulation
from .security import (
    RATE_LIMIT_PREDICT,
    SecurityHeadersMiddleware,
    get_allowed_origins,
    limiter,
    rate_limit_exceeded_handler,
    sanitize_exception_response,
    verify_api_key,
)

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("stormprint")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="StormPrint API",
    description="La huella que deja cada tormenta en el territorio — Manga, Cartagena",
    version="1.0.0",
    docs_url=None,  # disabled in production to reduce attack surface
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Security middleware stack
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-StormPrint-Key"],
    max_age=600,
)


# ---------------------------------------------------------------------------
# Pydantic V2 request/response schemas (strict validation & sanitization)
# ---------------------------------------------------------------------------
class SimulationRequest(BaseModel):
    duration_hours: float = Field(default=168.0, ge=1.0, le=336.0)
    resolution_hours: float = Field(default=1.0, ge=0.25, le=6.0)
    storm_peak_hour: float = Field(default=36.0, ge=0.0, le=336.0)
    storm_intensity: float = Field(default=42.0, ge=0.0, le=200.0)
    storm_width: float = Field(default=6.0, ge=0.5, le=48.0)
    mean_sea_level: float = Field(default=8.0, ge=0.0, le=50.0)
    mass: float = Field(default=1.0, ge=0.1, le=10.0)
    damping: float = Field(default=0.45, ge=0.01, le=5.0)
    stiffness: float = Field(default=0.65, ge=0.01, le=5.0)

    @field_validator("storm_peak_hour")
    @classmethod
    def peak_within_duration(cls, v: float, info) -> float:
        duration = info.data.get("duration_hours", 168.0)
        if v > duration:
            raise ValueError("storm_peak_hour must not exceed duration_hours")
        return v


class FloodRecordResponse(BaseModel):
    hour: float
    water_level_cm: float
    rain_intensity: float
    tide_level: float
    risk_level: str


class SimulationResponse(BaseModel):
    territory: str = "Manga, Cartagena de Indias"
    total_points: int
    max_water_level_cm: float
    peak_hour: float
    records: list[FloodRecordResponse]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/v1/health")
@limiter.limit("30/minute")
async def health(request: Request):
    return {"status": "operational", "service": "stormprint-api", "territory": "manga-cartagena"}


@app.post("/api/v1/predict", response_model=SimulationResponse)
@limiter.limit(RATE_LIMIT_PREDICT)
async def predict(
    request: Request,
    payload: SimulationRequest,
    session: AsyncSession = Depends(get_session),
    _api_key: str = Depends(verify_api_key),
):
    try:
        params = PhysicalParameters(
            mass=payload.mass,
            damping=payload.damping,
            stiffness=payload.stiffness,
        )
        records = run_simulation(
            duration_hours=payload.duration_hours,
            resolution_hours=payload.resolution_hours,
            storm_peak_hour=payload.storm_peak_hour,
            storm_intensity=payload.storm_intensity,
            storm_width=payload.storm_width,
            mean_sea_level=payload.mean_sea_level,
            params=params,
        )

        await persist_records(session, records)
        await clear_old_records(session)

        peak_record = max(records, key=lambda r: r["water_level_cm"])

        return SimulationResponse(
            total_points=len(records),
            max_water_level_cm=round(peak_record["water_level_cm"], 3),
            peak_hour=peak_record["hour"],
            records=[FloodRecordResponse(**r) for r in records],
        )
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"error": "validation_error", "message": str(exc)})
    except Exception as exc:  # noqa: BLE001 — deliberate top-level guard
        logger.exception("Unhandled error in /predict")
        return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


@app.get("/api/v1/history", response_model=list[FloodRecordResponse])
@limiter.limit("30/minute")
async def history(
    request: Request,
    limit: int = 168,
    session: AsyncSession = Depends(get_session),
    _api_key: str = Depends(verify_api_key),
):
    safe_limit = max(1, min(limit, 1000))
    try:
        records = await fetch_recent_records(session, limit=safe_limit)
        return [FloodRecordResponse(**r) for r in records]
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in /history")
        return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={"error": "not_found", "message": "Resource not found."})


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.exception("Unhandled 500")
    return JSONResponse(status_code=500, content=sanitize_exception_response(exc))
