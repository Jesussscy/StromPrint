"""
StormPrint :: index.py
FastAPI serverless entrypoint (Vercel-compatible).
"La huella que deja cada tormenta en el territorio" — Barrio Manga, Cartagena.

Endpoints:
  POST /api/v1/predecir   — Prediccion publica con datos meteorologicos (sin auth)
  POST /api/v1/predict    — Simulacion con parametros manuales (requiere API key)
  GET  /api/v1/predicciones — Historial de predicciones guardadas
  GET  /api/v1/history    — Historial de registros de simulacion
  GET  /api/v1/health     — Healthcheck
"""

import json
import logging
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from .database import (
    clear_old_predictions,
    clear_old_records,
    fetch_recent_predictions,
    fetch_recent_records,
    get_session,
    init_db,
    persist_prediction,
    persist_records,
)
from .physics_engine import (
    PhysicalParameters,
    compute_advanced_metrics,
    run_simulation,
)
from .security import (
    RATE_LIMIT_PREDICT,
    RATE_LIMIT_PREDECIR,
    SecurityHeadersMiddleware,
    get_allowed_origins,
    limiter,
    rate_limit_exceeded_handler,
    sanitize_exception_response,
    verify_api_key,
)
from .weather_service import (
    extract_simulation_params,
    fetch_weather_forecast,
    get_weather_summary,
)

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("stormprint")

ECUACION_DISPLAY = (
    "m\u00b7H''(t) + c(t)\u00b7H'(t) + k(t)\u00b7H(t) "
    "= F_lluvia(t) + F_marea(t) + F_viento(t)"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="StormPrint API",
    description="La huella que deja cada tormenta en el territorio — Manga, Cartagena",
    version="2.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

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
# Pydantic schemas — Simulacion (legacy)
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
# Pydantic schemas — Prediccion publica
# ---------------------------------------------------------------------------
class PrediccionRequest(BaseModel):
    horas_pronostico: int = Field(default=72, ge=1, le=168)
    intensidad_lluvia_mm_h: Optional[float] = Field(default=None, ge=0.0, le=200.0)
    nivel_marea_cm: float = Field(default=8.0, ge=0.0, le=100.0)
    usar_datos_meteo: bool = Field(default=True)


class PuntoPrediccion(BaseModel):
    tiempo_hora: int
    nivel_agua_cm: float
    estado: Literal["Normal", "Alerta", "Emergencia", "Critico"]
    lluvia_mm_h: float
    marea_cm: float
    viento_efecto_cm: float
    f_lluvia: float = 0.0
    f_marea: float = 0.0
    f_viento: float = 0.0
    saturacion_suelo: float
    eficiencia_drenaje: float
    velocidad_cambio: float


class MeteorologiaResumen(BaseModel):
    lluvia_total_mm: float
    temp_max_c: float
    temp_min_c: float
    humedad_promedio: float
    viento_max_kmh: float
    dias_lluviosos: int
    horas_con_lluvia: int


class PrediccionResponse(BaseModel):
    territorio: str = "Manga, Cartagena de Indias"
    horas_pronostico: int
    puntos: list[PuntoPrediccion]
    meteorologia_resumen: MeteorologiaResumen
    ecuacion: str = ECUACION_DISPLAY
    nivel_actual_cm: float = 0.0
    nivel_maximo_cm: float = 0.0
    hora_pico: float = 0.0
    tendencia: str = "estable"
    narrativa: str = ""
    recomendacion: str = ""


# ---------------------------------------------------------------------------
# Routes — Healthcheck
# ---------------------------------------------------------------------------
@app.get("/api/v1/health")
@limiter.limit("30/minute")
async def health(request: Request):
    return {"status": "operational", "service": "stormprint-api", "territory": "manga-cartagena", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# Routes — Prediccion publica (sin auth)
# ---------------------------------------------------------------------------
@app.post("/api/v1/predecir", response_model=PrediccionResponse)
@limiter.limit(RATE_LIMIT_PREDECIR)
async def predecir(
    request: Request,
    payload: PrediccionRequest,
    session: AsyncSession = Depends(get_session),
):
    try:
        # 1. Obtener datos meteorologicos si se solicita
        weather_data = None
        if payload.usar_datos_meteo:
            forecast = await fetch_weather_forecast(forecast_days=7)
            weather_data = extract_simulation_params(
                hourly_data=forecast["hourly"],
                horas_pronostico=payload.horas_pronostico,
                nivel_marea_cm=payload.nivel_marea_cm,
            )
            meteo_summary = get_weather_summary(
                hourly_data=forecast["hourly"],
                horas=payload.horas_pronostico,
            )
        else:
            # Modo manual: usar intensidad proporcionada
            meteo_summary = {
                "lluvia_total_mm": 0,
                "temp_max_c": 30.0,
                "temp_min_c": 24.0,
                "humedad_promedio": 80.0,
                "viento_max_kmh": 0.0,
                "dias_lluviosos": 0,
                "horas_con_lluvia": 0,
            }
            if payload.intensidad_lluvia_mm_h is not None:
                # Estimar pico e intensidad a partir del valor manual
                estimated_peak = payload.horas_pronostico * 0.25
                weather_data = {
                    "storm_peak_hour": estimated_peak,
                    "storm_intensity": payload.intensidad_lluvia_mm_h,
                    "rain_duration_h": 6.0,
                    "mean_sea_level": payload.nivel_marea_cm,
                    "wind_direction_deg": 0.0,
                    "wind_speed_kmh": 0.0,
                    "soil_humidity": 0.3,
                    "consecutive_rainy_days": 0,
                }
                meteo_summary["lluvia_total_mm"] = payload.intensidad_lluvia_mm_h * 6.0
                meteo_summary["horas_con_lluvia"] = 6

        # 2. Configurar parametros fisicos
        params = PhysicalParameters(
            soil_humidity=weather_data.get("soil_humidity", 0.3),
            consecutive_rainy_days=weather_data.get("consecutive_rainy_days", 0),
            rain_duration_h=weather_data.get("rain_duration_h", 6.0),
            wind_direction_deg=weather_data.get("wind_direction_deg", 0.0),
            wind_speed_kmh=weather_data.get("wind_speed_kmh", 0.0),
            mean_sea_level=weather_data.get("mean_sea_level", payload.nivel_marea_cm),
        )

        # 3. Resolver la EDO de segundo orden
        records = run_simulation(
            duration_hours=float(payload.horas_pronostico),
            resolution_hours=1.0,
            storm_peak_hour=weather_data.get("storm_peak_hour", payload.horas_pronostico * 0.25),
            storm_intensity=weather_data.get("storm_intensity", 20.0),
            mean_sea_level=weather_data.get("mean_sea_level", payload.nivel_marea_cm),
            params=params,
        )

        # 4. Mapear a puntos de prediccion
        puntos = []
        for r in records:
            puntos.append(PuntoPrediccion(
                tiempo_hora=int(r["hour"]),
                nivel_agua_cm=round(r["water_level_cm"], 2),
                estado=r["risk_level"],
                lluvia_mm_h=round(r["rain_intensity"], 2),
                marea_cm=round(r["tide_level"], 2),
                viento_efecto_cm=round(r.get("wind_effect", 0.0), 2),
                f_lluvia=round(r.get("f_lluvia", 0.0), 2),
                f_marea=round(r.get("f_marea", 0.0), 2),
                f_viento=round(r.get("f_viento", 0.0), 2),
                saturacion_suelo=round(r.get("soil_saturation", 0.3), 3),
                eficiencia_drenaje=round(r.get("drainage_efficiency", 1.0), 3),
                velocidad_cambio=round(r.get("dH_dt", 0.0), 3),
            ))

        # 5. Metricas para el resumen
        max_record = max(records, key=lambda r: r["water_level_cm"])
        current = records[min(1, len(records) - 1)]
        peak_idx = records.index(max_record)

        # Tendencia: comparar nivel actual con nivel en +6h
        future_idx = min(6, len(records) - 1)
        current_level = records[0]["water_level_cm"]
        future_level = records[future_idx]["water_level_cm"]
        delta = future_level - current_level
        if delta > 2.0:
            tendencia = "creciente"
        elif delta < -2.0:
            tendencia = "decreciente"
        else:
            tendencia = "estable"

        # Narrativa dinamica
        nivel_actual = current["water_level_cm"]
        nivel_max = max_record["water_level_cm"]
        hora_pico = max_record["hour"]
        estado_max = max_record["risk_level"]

        if estado_max == "Normal":
            recomendacion = "Drene sus patios y mantenga limpias las alcantarillas para prevenir acumulacion."
        elif estado_max == "Alerta":
            recomendacion = "Evite transitar por calles bajas. El nivel del agua puede inundar aceras y huecos."
        elif estado_max == "Emergencia":
            recomendacion = "Desaloje temporalmente las zonas mas bajas. Proteja pertenencias en plantas bajas."
        else:
            recomendacion = "EVACUE inmediatamente las zonas inundables. Dirijase a los puntos de alta en Manga."

        if nivel_max > 5:
            narrativa = (
                f"Segun el modelo, el nivel del agua alcanzara {nivel_max:.0f} cm en la hora "
                f"{hora_pico:.0f} ({hora_pico/24:.1f} dias). "
            )
            if tendencia == "creciente":
                narrativa += "La tendencia es creciente por la combinacion de lluvia y marea alta. "
            elif tendencia == "decreciente":
                narrativa += "El nivel esta en descenso. La lluvia disminuye y el drenaje actua. "
            else:
                narrativa += "El nivel se mantiene estable en este periodo. "
            narrativa += f"Se recomienda: {recomendacion}"
        else:
            narrativa = (
                "El modelo indica condiciones normales sin acumulacion significativa de agua. "
                "El drenaje territorial funciona adecuadamente. "
                f"Recomendacion: {recomendacion}"
            )

        # 6. Guardar prediccion en SQLite
        try:
            await persist_prediction(
                session=session,
                horas_pronostico=payload.horas_pronostico,
                puntos=[p.model_dump() for p in puntos],
                meteorologia=meteo_summary,
                max_water_level_cm=max_record["water_level_cm"],
                peak_hour=max_record["hour"],
                risk_level=max_record["risk_level"],
                ecuacion=ECUACION_DISPLAY,
            )
            await clear_old_predictions(session)
        except Exception as persist_exc:
            logger.warning("Could not persist prediction: %s", persist_exc)

        return PrediccionResponse(
            horas_pronostico=payload.horas_pronostico,
            puntos=puntos,
            meteorologia_resumen=MeteorologiaResumen(**meteo_summary),
            ecuacion=ECUACION_DISPLAY,
            nivel_actual_cm=round(nivel_actual, 2),
            nivel_maximo_cm=round(nivel_max, 2),
            hora_pico=round(hora_pico, 1),
            tendencia=tendencia,
            narrativa=narrativa,
            recomendacion=recomendacion,
        )

    except ValueError as exc:
        return JSONResponse(status_code=422, content={"error": "validation_error", "message": str(exc)})
    except Exception as exc:
        logger.exception("Unhandled error in /predecir")
        return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


# ---------------------------------------------------------------------------
# Routes — Predicciones guardadas (publico)
# ---------------------------------------------------------------------------
@app.get("/api/v1/predicciones")
@limiter.limit("30/minute")
async def predicciones(
    request: Request,
    limit: int = 10,
    session: AsyncSession = Depends(get_session),
):
    safe_limit = max(1, min(limit, 50))
    try:
        preds = await fetch_recent_predictions(session, limit=safe_limit)
        return {"predicciones": preds}
    except Exception as exc:
        logger.exception("Unhandled error in /predicciones")
        return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


# ---------------------------------------------------------------------------
# Routes — Simulacion legacy (con auth)
# ---------------------------------------------------------------------------
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
            records=[
                FloodRecordResponse(
                    hour=r["hour"],
                    water_level_cm=r["water_level_cm"],
                    rain_intensity=r["rain_intensity"],
                    tide_level=r["tide_level"],
                    risk_level=r["risk_level"],
                )
                for r in records
            ],
        )
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"error": "validation_error", "message": str(exc)})
    except Exception as exc:
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
    except Exception as exc:
        logger.exception("Unhandled error in /history")
        return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={"error": "not_found", "message": "Resource not found."})


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.exception("Unhandled 500")
    return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


# ---------------------------------------------------------------------------
# Vercel serverless handler
# ---------------------------------------------------------------------------
app_handler = app
