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
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
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
    run_simulation,
)
from .notification_service import notification_service
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
from .tide_service import tide_service
from .weather_service import (
    ESTADO_SOLEADO,
    ESTADO_NUBLADO,
    ESTADO_LLUVIOSO,
    ESTADO_TORMENTA,
    ESTADO_SIN_DATOS,
    ESTADO_LABEL,
    extract_simulation_params,
    fetch_weather_forecast,
    get_weather_summary,
    tiene_lluvia_en_horizonte,
    weather_service,
)

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("stormprint")

APP_VERSION = "3.9.0"
_START_TIMESTAMP = time.monotonic()

# Simple in-memory cache for read-only endpoints
_response_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 30  # seconds

ECUACION_DISPLAY = (
    "m\u00b7H''(t) + c(t)\u00b7H'(t) + k(t)\u00b7H(t) "
    "= F_lluvia(t) + F_marea(t) + F_viento(t)"
)


def _drenaje_a_amortiguamiento(eficiencia_drenaje: Optional[float]) -> float:
    """Convierte la eficiencia de drenaje (%) del dashboard en el coeficiente
    de amortiguamiento c_0 del modelo fisico.

    Mejor drenaje (100%) -> mayor amortiguamiento: el agua se evacua rapido.
    Peor drenaje (0%)   -> menor amortiguamiento: el agua se acumula.
    Fuera de rango, se devuelve None para usar el default del modelo."""
    if eficiencia_drenaje is None:
        return 0.45  # default de PhysicalParameters
    eff = max(0.0, min(100.0, float(eficiencia_drenaje)))
    # Mapeo lineal: 0% -> 0.10 · 100% -> 0.90 (dentro del rango valido ge=0.01, le=5.0)
    return round(0.10 + (eff / 100.0) * 0.80, 3)


def computar_factores_dominantes(records: list[dict]) -> list[str]:
    """Identifica que forzamientos realmente mueven el nivel durante la corrida.

    Devuelve una lista ('lluvia' | 'marea' | 'viento') con los aportes cuyo pico
    supera un umbral relativo al forzamiento dominante. En dias secos, la lluvia
    simplemente no aparece; el nivel queda dominado por la marea y/o el viento.
    """
    if not records:
        return ["marea"]
    picos = {
        "lluvia": max((abs(r.get("f_lluvia", 0.0)) for r in records), default=0.0),
        "marea": max((abs(r.get("f_marea", 0.0)) for r in records), default=0.0),
        "viento": max((abs(r.get("f_viento", 0.0)) for r in records), default=0.0),
    }
    dominante = max(picos.values())
    # Un factor cuenta si aporta >= 10% del forzamiento dominante y es relevante
    # en terminos absolutos de fuerza (umbral ~0.5 en unidades del modelo).
    umbral = max(0.5, dominante * 0.10)
    activos = [k for k, v in picos.items() if v > umbral]
    return activos or ["marea"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="StormPrint API",
    description="La huella que deja cada tormenta en el territorio — Manga, Cartagena",
    version=APP_VERSION,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.middleware("http")
async def log_request_duration(request: Request, call_next):
    """Log de duracion por request para detectar endpoints lentos, con correlation ID."""
    correlation_id = str(uuid.uuid4())[:8]
    request.state.correlation_id = correlation_id
    start = time.monotonic()
    response = await call_next(request)
    elapsed_ms = (time.monotonic() - start) * 1000.0
    if elapsed_ms >= 1500:
        logger.warning(
            "[%s] Slow request: %s %s -> %d (%.0f ms)",
            correlation_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
    response.headers["X-Correlation-ID"] = correlation_id
    return response


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
    eficiencia_drenaje: Optional[float] = Field(default=None, ge=0.0, le=100.0)
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
    notificaciones: list[dict] = Field(default_factory=list)
    estado_meteorologico: str = "soleado"
    estado_label: str = "Soleado"
    confianza_meteo: float = 1.0
    fuente_meteo: str = "open-meteo"
    es_dia_lluvioso: bool = False
    proxima_pleamar: str = ""
    factores_dominantes: list[str] = Field(default_factory=list)


class InfraResponse(BaseModel):
    status: str
    service: str = "stormprint-api"
    territory: str = "manga-cartagena"
    version: str = APP_VERSION
    timestamp: str = ""
    uptime_seconds: float = 0.0
    database: str = "ok"
    fuentes: dict = Field(default_factory=dict)
    suscripciones: int = 0


# ---------------------------------------------------------------------------
# Routes — Healthcheck
# ---------------------------------------------------------------------------
@app.get("/api/v1/health")
@limiter.limit("30/minute")
async def health(request: Request, session: AsyncSession = Depends(get_session)):
    """Healthcheck ampliado: base de datos, antiguedad de caches y uptime.
    Uses a short-lived in-memory cache to reduce redundant DB queries."""
    # Return cached response if fresh
    cached = _response_cache.get("health")
    if cached and (time.monotonic() - cached[0]) < _CACHE_TTL:
        return cached[1]
    db_status = "ok"
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Healthcheck: database check failed")
        db_status = "error"

    now = time.time()
    fuentes = {}

    def _cache_age(cache_file: str):
        try:
            if not os.path.exists(cache_file):
                return None
            return round(max(0.0, now - os.path.getmtime(cache_file)))
        except (OSError, ValueError, OverflowError):
            return None

    fuentes["open_meteo_cache_age_s"] = _cache_age(weather_service.CACHE_FILE)
    fuentes["mareas_cache_age_s"] = _cache_age(tide_service.CACHE_FILE)

    status = "degraded" if db_status == "error" else "operational"
    result = InfraResponse(
        status=status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptime_seconds=round(time.monotonic() - _START_TIMESTAMP, 1),
        database=db_status,
        fuentes=fuentes,
        suscripciones=len(notification_service.subscriptions),
    ).model_dump()
    _response_cache["health"] = (time.monotonic(), result)
    return result


# ---------------------------------------------------------------------------
# Routes — Meteorologia en vivo (robusta: cache + fallback simulado)
# ---------------------------------------------------------------------------
@app.get("/api/v1/weather")
@limiter.limit("30/minute")
async def get_weather(
    request: Request,
    force_refresh: bool = False,
    _api_key: str = Depends(verify_api_key),
):
    try:
        data = await weather_service.get_weather(force_refresh=force_refresh)
        return {
            "status": "success",
            "weather": data,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as exc:
        logger.exception("Unhandled error in /weather")
        return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


# ---------------------------------------------------------------------------
# Routes — Historial de notificaciones
# ---------------------------------------------------------------------------
@app.get("/api/v1/notifications")
@limiter.limit("30/minute")
async def get_notifications(
    request: Request,
    limit: int = 20,
    nivel_cm: Optional[float] = None,
    tendencia_cm_h: Optional[float] = None,
    nivel_maximo: Optional[float] = None,
):
    """Historial de notificaciones + tarjeta de estado en tiempo real.

    Si el cliente envia `nivel_cm`, el backend genera una tarjeta que
    refleja el nivel REAL actual (todos los niveles, incluido NORMAL ->
    INFO 'Sistema Estable') con timestamp fresco, y devuelve metricas
    agregadas reales del historial.
    """
    safe_limit = max(1, min(limit, 50))
    history = notification_service.notification_history[-safe_limit:]

    if nivel_cm is not None:
        state_card = notification_service.current_state_notification(
            nivel_cm=float(nivel_cm),
            tendencia_cm_h=tendencia_cm_h,
        )
        seen = {state_card["id"]}
        notifications = [state_card]
        for n in history:
            nid = n.get("id") or f"{n.get('timestamp')}-{n.get('riesgo')}"
            if nid in seen:
                continue
            seen.add(nid)
            notifications.append(n)
    else:
        state_card = None
        notifications = history

    metrics = notification_service.build_metrics(nivel_maximo_cm=nivel_maximo)
    return {
        "status": "success",
        "state": state_card,
        "notifications": notifications,
        "total": len(notifications),
        "metrics": metrics,
    }


# ---------------------------------------------------------------------------
# Routes — Suscripcion por email (Centro de Alertas)
# ---------------------------------------------------------------------------
class SubscribeRequest(BaseModel):
    email: str


@app.post("/api/v1/notify/subscribe")
@limiter.limit("10/minute")
async def subscribe(request: Request, payload: SubscribeRequest):
    try:
        total = notification_service.subscribe(payload.email)
        return {
            "status": "success",
            "subscribed": True,
            "total_suscripciones": total,
            "email": payload.email.strip().lower(),
        }
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"error": "validation_error", "message": str(exc)})
    except Exception as exc:
        logger.exception("Unhandled error in /notify/subscribe")
        return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


@app.post("/api/v1/notify/unsubscribe")
@limiter.limit("10/minute")
async def unsubscribe(request: Request, payload: SubscribeRequest):
    try:
        total = notification_service.unsubscribe(payload.email)
        return {
            "status": "success",
            "subscribed": False,
            "total_suscripciones": total,
            "email": payload.email.strip().lower(),
        }
    except Exception as exc:
        logger.exception("Unhandled error in /notify/unsubscribe")
        return JSONResponse(status_code=500, content=sanitize_exception_response(exc))


@app.get("/api/v1/notify/status")
@limiter.limit("30/minute")
async def notify_status(request: Request):
    """Estado del canal de notificaciones para la interfaz."""
    return {
        "status": "success",
        "smtp_configurado": bool(notification_service.smtp_user and notification_service.smtp_password),
        "webhook_configurado": bool(notification_service.webhook_url),
        "total_suscripciones": len(notification_service.subscriptions),
    }



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
        estado_meteo = ESTADO_SOLEADO
        confianza_meteo = 1.0
        fuente_meteo = "open-meteo"
        proxima_pleamar = ""
        hay_lluvia_horizonte = False
        tide_data = {"serie_cm": [], "marea_actual_cm": 8.0, "proxima_pleamar": ""}

        if payload.usar_datos_meteo:
            # Estado/confianza con resiliencia (open-meteo -> historico -> promedio)
            wea = await weather_service.get_weather()
            estado_meteo = wea.get("estado", ESTADO_SOLEADO)
            confianza_meteo = wea.get("confianza", 1.0)
            fuente_meteo = wea.get("fuente", "open-meteo")
            proxima_pleamar = wea.get("proxima_pleamar", "")

            # Marea real (Open-Meteo Marine, nivel del mar que incluye mareas
            # para coordenadas de Manga; NOAA no cubre Cartagena). Con cache y
            # fallback analitico si la API no responde.
            tide_data = await tide_service.get_tide(duration_hours=float(payload.horas_pronostico))
            tide_serie_cm = tide_data.get("serie_cm", [])
            tide_actual_cm = tide_data.get("marea_actual_cm", 8.0)
            if tide_data.get("proxima_pleamar"):
                proxima_pleamar = tide_data["proxima_pleamar"]

            forecast = await fetch_weather_forecast(forecast_days=7)
            # En modo meteo el nivel medio del mar lo decide la meteorologia
            # (marea), NUNCA el deslizador deshabilitado del dashboard.
            nivel_msl = tide_actual_cm or 8.0
            weather_data = extract_simulation_params(
                hourly_data=forecast["hourly"],
                horas_pronostico=payload.horas_pronostico,
                nivel_marea_cm=nivel_msl,
                past_daily=forecast.get("past_daily"),
            )
            meteo_summary = get_weather_summary(
                hourly_data=forecast["hourly"],
                horas=payload.horas_pronostico,
            )

            # La lluvia se anula SOLO si no hay ninguna gota en TODA la ventana
            # de pronostico (puede estar soleado ahora y llover mas tarde).
            # En estado "sin_datos" (fallback sin API) se conserva la lluvia
            # promedio del historial: prudente y conservador, no minimiza riesgo.
            hay_lluvia = tiene_lluvia_en_horizonte(forecast.get("hourly", []), payload.horas_pronostico)
            hay_lluvia_horizonte = hay_lluvia
            if not hay_lluvia and estado_meteo != ESTADO_SIN_DATOS:
                weather_data["storm_intensity"] = 0.0
                weather_data["storm_peak_hour"] = float(payload.horas_pronostico) * 0.25
                weather_data["rain_duration_h"] = 2.0
                meteo_summary["lluvia_total_mm"] = 0.0
                meteo_summary["horas_con_lluvia"] = 0
                meteo_summary["dias_lluviosos"] = 0
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
            hay_lluvia_horizonte = (payload.intensidad_lluvia_mm_h or 0.0) > 0.0
            estimated_peak = payload.horas_pronostico * 0.25
            if payload.intensidad_lluvia_mm_h is not None:
                # Estimar pico e intensidad a partir del valor manual
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
            else:
                # Sin lluvia manual: escenario seco -> marea y drenaje del
                # dashboard. Antes esto dejaba weather_data=None y rompia en 500.
                weather_data = {
                    "storm_peak_hour": estimated_peak,
                    "storm_intensity": 0.0,
                    "rain_duration_h": 2.0,
                    "mean_sea_level": payload.nivel_marea_cm,
                    "wind_direction_deg": 0.0,
                    "wind_speed_kmh": 0.0,
                    "soil_humidity": 0.3,
                    "consecutive_rainy_days": 0,
                }

        # 2. Configurar parametros fisicos
        #   - En modo meteo se ignoran los deslizadores deshabilitados del panel;
        #     el amortiguamiento y el nivel medio del mar los decide el clima/marea.
        drenaje_efectivo = None if payload.usar_datos_meteo else payload.eficiencia_drenaje
        # En modo manual tambien se puede ofrecer la marea real si la serie esta
        # disponible (se calcula bajo demanda abajo); por defecto se usa analitica.
        serie_marea_cm = tide_data.get("serie_cm", []) if payload.usar_datos_meteo else []
        params = PhysicalParameters(
            damping=_drenaje_a_amortiguamiento(drenaje_efectivo),
            soil_humidity=weather_data.get("soil_humidity", 0.3),
            consecutive_rainy_days=weather_data.get("consecutive_rainy_days", 0),
            rain_duration_h=weather_data.get("rain_duration_h", 6.0),
            wind_direction_deg=weather_data.get("wind_direction_deg", 0.0),
            wind_speed_kmh=weather_data.get("wind_speed_kmh", 0.0),
            mean_sea_level=weather_data.get("mean_sea_level", 8.0),
            tide_series_cm=serie_marea_cm,
        )

        # 3. Resolver la EDO de segundo orden
        records = run_simulation(
            duration_hours=float(payload.horas_pronostico),
            resolution_hours=1.0,
            storm_peak_hour=weather_data.get("storm_peak_hour", payload.horas_pronostico * 0.25),
            storm_intensity=weather_data.get("storm_intensity", 0.0),
            mean_sea_level=weather_data.get("mean_sea_level", 8.0),
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
        # "Jornada lluviosa" si esta lloviendo AHORA o si hay lluvia en
        # cualquier punto del horizonte de pronostico (incluso si ahora hace sol).
        dia_lluvioso = estado_meteo == ESTADO_TORMENTA or hay_lluvia_horizonte
        factores = computar_factores_dominantes(records)
        estado_label = ESTADO_LABEL.get(estado_meteo, estado_meteo)

        if estado_max == "Normal":
            recomendacion = "Drene sus patios y mantenga limpias las alcantarillas para prevenir acumulacion."
        elif estado_max == "Alerta":
            recomendacion = "Evite transitar por calles bajas. El nivel del agua puede inundar aceras y huecos."
        elif estado_max == "Emergencia":
            recomendacion = "Desaloje temporalmente las zonas mas bajas. Proteja pertenencias en plantas bajas."
        else:
            recomendacion = "EVACUE inmediatamente las zonas inundables. Dirijase a los puntos de alta en Manga."

        if estado_meteo == ESTADO_TORMENTA:
            narrativa = (
                f"Tormenta en curso ({estado_label}): el modelo estima un nivel maximo de "
                f"{nivel_max:.0f} cm hacia la hora {hora_pico:.0f}. "
            )
            narrativa += (
                "La lluvia intensa se combina con la marea y reduce la capacidad de drenaje. "
                if tendencia == "creciente" else
                "La tormenta va cediendo y el sistema de drenaje recupera terreno. "
            )
        elif dia_lluvioso:
            narrativa = (
                f"Jornada lluviosa ({estado_label}): se prevé acumulacion de hasta "
                f"{nivel_max:.0f} cm hacia la hora {hora_pico:.0f}. "
            )
            narrativa += (
                "El aporte pluvial mantiene el nivel en aumento. "
                if tendencia == "creciente" else
                "Aunque llueve, el nivel se mantiene bajo control por el drenaje. "
            )
        else:
            # Dia soleado o parcialmente nublado: riesgo dominado por marea y viento
            narrativa = (
                f"Dia {estado_label.lower()} sin lluvia significativa: el nivel sigue la marea "
                f"(proxima pleamar {proxima_pleamar or 'hoy'}) con aporte modesto de viento. "
            )
            narrativa += (
                "Máximo previsto de "
                + f"{nivel_max:.0f} cm hacia la hora {hora_pico:.0f}. "
                + ("El nivel crece con la marea entrante. " if tendencia == "creciente" else
                   "El nivel desciende conforme baja la marea. " if tendencia == "decreciente" else
                   "El nivel oscila suavemente con la marea. ")
            )
            narrativa += f"Se recomienda: {recomendacion}"

        # 6. Notificaciones automaticas por umbral de riesgo (solo si se usa meteo)
        notificaciones = []
        try:
            if payload.usar_datos_meteo:
                notificaciones = await notification_service.check_and_notify(
                    nivel_cm=float(nivel_actual),
                    weather_data=weather_data,
                )
        except Exception as notif_exc:
            logger.warning("No se pudieron generar notificaciones: %s", notif_exc)

        # 7. Guardar prediccion en SQLite
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
                data_source="real" if payload.usar_datos_meteo else "simulado",
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
            notificaciones=notificaciones,
            estado_meteorologico=estado_meteo,
            estado_label=estado_label,
            confianza_meteo=confianza_meteo,
            fuente_meteo=fuente_meteo,
            es_dia_lluvioso=dia_lluvioso,
            proxima_pleamar=proxima_pleamar,
            factores_dominantes=factores,
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
            rain_duration_h=payload.storm_width,
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
