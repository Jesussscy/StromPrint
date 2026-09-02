"""
StormPrint :: weather_service.py
Servicio de datos meteorologicos via Open-Meteo (gratuito, sin API key).

Coordenadas fijas: Barrio Manga, Cartagena de Indias
  lat = 10.4000, lon = -75.5167

Open-Meteo es una API publica, open-source, sin registro requerido.
No comercial: hasta 10,000 llamadas/dia. Attribution: CC BY 4.0.
"""

import json
import logging
import math
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("stormprint.weather")

# Coordenadas de Barrio Manga, Cartagena de Indias
MANGA_LAT = 10.4000
MANGA_LON = -75.5167

OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

# Variables horarias que solicitamos
HOURLY_VARS = [
    "precipitation",
    "rain",
    "temperature_2m",
    "relative_humidity_2m",
    "cloud_cover",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "pressure_msl",
    "dew_point_2m",
    "apparent_temperature",
    "weather_code",
    "soil_moisture_0_1cm",
    "soil_moisture_1_3cm",
]

# Condiciones actuales (bloque current de Open-Meteo): lectura del momento
# exacto, mas fiel que elegir la hora mas cercana del bloque horario.
CURRENT_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "rain",
    "cloud_cover",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "pressure_msl",
    "dew_point_2m",
    "apparent_temperature",
    "weather_code",
    "is_day",
]

# Variables diarias
DAILY_VARS = [
    "precipitation_sum",
    "rain_sum",
    "precipitation_hours",
    "cloud_cover_mean",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
]

# Dias pasados a incluir: permite usar lluvia real reciente para la racha
# consecutiva y la humedad del suelo (en vez de solo forecast futuro).
PAST_DAYS = 7

# ---------------------------------------------------------------------------
# Estado meteorologico
# ---------------------------------------------------------------------------
ESTADO_SOLEADO = "soleado"
ESTADO_PARCIALMENTE_NUBLADO = "parcialmente_nublado"
ESTADO_NUBLADO = "nublado"
ESTADO_LLUVIOSO = "lluvioso"
ESTADO_TORMENTA = "tormenta"
ESTADO_SIN_DATOS = "sin_datos"

ESTADO_LABEL = {
    ESTADO_SOLEADO: "Soleado",
    ESTADO_PARCIALMENTE_NUBLADO: "Parcialmente nublado",
    ESTADO_NUBLADO: "Nublado",
    ESTADO_LLUVIOSO: "Lluvioso",
    ESTADO_TORMENTA: "Tormenta",
    ESTADO_SIN_DATOS: "Sin datos",
}

# Umbrales de estado (basados en lluvia actual en mm/h y nubosidad en %)
LLUVIA_TORMENTA_MMH = 10.0
LLUVIA_LLUVIOSO_MMH = 2.0
LLUVIA_LIGERA_MMH = 0.1
NUBOSIDAD_NUBLADO_PCT = 70.0
NUBOSIDAD_PARCIAL_PCT = 40.0


# Mapeo del codigo meteorologico WMO (weather_code de Open-Meteo) a estado.
# Se usa con precedencia sobre la heuristica de mm/h + nubosidad por ser la
# clasificacion oficial y mas exacta (distingue llovizna, chubasco, tormenta...).
def _estado_por_weather_code(code: Optional[float]) -> Optional[str]:
    if code is None:
        return None
    c = int(code)
    if c == 0 or c == 1:
        return ESTADO_SOLEADO
    if c == 2:
        return ESTADO_PARCIALMENTE_NUBLADO
    if c == 3:
        return ESTADO_NUBLADO
    if c == 45 or c == 48:  # niebla
        return ESTADO_NUBLADO
    if 51 <= c <= 57:  # llovizna
        return ESTADO_LLUVIOSO
    if 61 <= c <= 67:  # lluvia
        return ESTADO_LLUVIOSO
    if 71 <= c <= 77:  # nieve (irrelevante en Cartagena, tratada como lluvia)
        return ESTADO_LLUVIOSO
    if 80 <= c <= 82:  # chubascos
        return ESTADO_LLUVIOSO
    if 85 <= c <= 86:  # chubascos de nieve
        return ESTADO_LLUVIOSO
    if 95 <= c <= 99:  # tormenta electrica
        return ESTADO_TORMENTA
    return None


def determinar_estado(
    precipitacion_actual_mmh: float = 0.0,
    nubosidad_pct: Optional[float] = None,
    weather_code: Optional[float] = None,
) -> str:
    """Clasifica el estado meteorologico.

    Precedencia:
      1. weather_code WMO (si se aporta) -> clasificacion oficial exacta
      2. Lluvia fuerte (tormenta) / moderada (lluvioso)
      3. Nubosidad (nublado / parcialmente nublado)
      4. Sin lluvia ni nubes -> soleado
    """
    por_codigo = _estado_por_weather_code(weather_code)
    if por_codigo is not None:
        return por_codigo
    lluvia = float(precipitacion_actual_mmh or 0.0)
    if lluvia > LLUVIA_TORMENTA_MMH:
        return ESTADO_TORMENTA
    if lluvia > LLUVIA_LLUVIOSO_MMH:
        return ESTADO_LLUVIOSO
    if nubosidad_pct is None:
        return ESTADO_SOLEADO
    nubes = float(nubosidad_pct or 0.0)
    if nubes > NUBOSIDAD_NUBLADO_PCT:
        return ESTADO_NUBLADO
    if nubes > NUBOSIDAD_PARCIAL_PCT:
        return ESTADO_PARCIALMENTE_NUBLADO
    return ESTADO_SOLEADO


def es_dia_lluvioso(estado: str) -> bool:
    """True si el estado implica precipitacion significativa."""
    return estado in (ESTADO_LLUVIOSO, ESTADO_TORMENTA)


def tiene_lluvia_en_horizonte(hourly_data: List[Dict], horas: Optional[int] = None) -> bool:
    """True si hay alguna gota de lluvia dentro de la ventana de pronostico.

    A diferencia de es_dia_lluvioso (que mira solo el estado actual), aqui se
    recorre todo el horizonte de pronostico: puede estar soleado "ahora" y
    llover mas tarde en el dia; en ese caso el modelo debe conservar la lluvia.
    """
    window = hourly_data[:horas] if horas is not None else hourly_data
    for h in window:
        if (h.get("precipitation", 0.0) or 0.0) > LLUVIA_LIGERA_MMH:
            return True
        if (h.get("rain", 0.0) or 0.0) > LLUVIA_LIGERA_MMH:
            return True
    return False


# ---------------------------------------------------------------------------
# Datos historicos promedio (fallback) — Barrio Manga, Cartagena, ultimos 5 anos
# lluvia media mensual en mm/mes, temperatura y humedad tipicas.
# ---------------------------------------------------------------------------
DATOS_HISTORICOS_POR_MES = {
    1:  {"lluvia_mm_mes": 2.0,  "temp_c": 28.0, "humedad_pct": 70.0},
    2:  {"lluvia_mm_mes": 1.0,  "temp_c": 29.0, "humedad_pct": 68.0},
    3:  {"lluvia_mm_mes": 3.0,  "temp_c": 29.0, "humedad_pct": 72.0},
    4:  {"lluvia_mm_mes": 15.0, "temp_c": 30.0, "humedad_pct": 78.0},
    5:  {"lluvia_mm_mes": 40.0, "temp_c": 30.0, "humedad_pct": 82.0},
    6:  {"lluvia_mm_mes": 60.0, "temp_c": 29.0, "humedad_pct": 85.0},
    7:  {"lluvia_mm_mes": 35.0, "temp_c": 29.0, "humedad_pct": 80.0},
    8:  {"lluvia_mm_mes": 30.0, "temp_c": 30.0, "humedad_pct": 79.0},
    9:  {"lluvia_mm_mes": 50.0, "temp_c": 29.0, "humedad_pct": 84.0},
    10: {"lluvia_mm_mes": 80.0, "temp_c": 28.0, "humedad_pct": 86.0},
    11: {"lluvia_mm_mes": 45.0, "temp_c": 28.0, "humedad_pct": 83.0},
    12: {"lluvia_mm_mes": 10.0, "temp_c": 28.0, "humedad_pct": 75.0},
}

# Promedio anual aproximado (usado como ultimo recurso)
DATOS_PROMEDIO = {
    "temp_c": 29.0,
    "humedad_pct": 79.0,
    "lluvia_diaria_mm": 6.0,
    "viento_kmh": 8.0,
}


async def fetch_weather_forecast(
    forecast_days: int = 7,
    lat: float = MANGA_LAT,
    lon: float = MANGA_LON,
) -> Dict[str, Any]:
    """
    Consulta la API de Open-Meteo para obtener pronostico meteorologico.

    Retorna un dict con:
      - hourly: lista de datos horarios
      - daily: lista de datos diarios
      - metadata: lat, lon, timezone, elevation
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ",".join(CURRENT_VARS),
        "hourly": ",".join(HOURLY_VARS),
        "daily": ",".join(DAILY_VARS),
        "timezone": "America/Bogota",
        "past_days": PAST_DAYS,
        "forecast_days": min(forecast_days, 7),
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(OPEN_METEO_BASE, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            logger.error("Open-Meteo HTTP error: %s", exc.response.status_code)
            return _empty_forecast()
        except httpx.RequestError as exc:
            logger.error("Open-Meteo request error: %s", exc)
            return _empty_forecast()

    return _process_forecast(data)


def _process_forecast(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Procesa la respuesta cruda de Open-Meteo en formato util."""
    hourly = raw.get("hourly", {})
    daily = raw.get("daily", {})
    current = raw.get("current", {})

    # Convertir listas horarias a lista de dicts
    times = hourly.get("time", [])
    hourly_records = []
    for i, t in enumerate(times):
        hourly_records.append({
            "time": t,
            "precipitation": hourly.get("precipitation", [0.0])[i] or 0.0,
            "rain": hourly.get("rain", [0.0])[i] or 0.0,
            "temperature_2m": hourly.get("temperature_2m", [25.0])[i] or 25.0,
            "relative_humidity_2m": hourly.get("relative_humidity_2m", [80.0])[i] or 80.0,
            "cloud_cover": hourly.get("cloud_cover", [0.0])[i] or 0.0,
            "wind_speed_10m": hourly.get("wind_speed_10m", [0.0])[i] or 0.0,
            "wind_direction_10m": hourly.get("wind_direction_10m", [0.0])[i] or 0.0,
            "wind_gusts_10m": hourly.get("wind_gusts_10m", [0.0])[i] or 0.0,
            "pressure_msl": hourly.get("pressure_msl", [1013.0])[i] or 1013.0,
            "dew_point_2m": hourly.get("dew_point_2m", [23.0])[i] or 23.0,
            "apparent_temperature": hourly.get("apparent_temperature", [28.0])[i] or 28.0,
            "weather_code": hourly.get("weather_code", [0])[i] or 0,
            "soil_moisture_0_1cm": hourly.get("soil_moisture_0_1cm", [0.0])[i] or 0.0,
            "soil_moisture_1_3cm": hourly.get("soil_moisture_1_3cm", [0.0])[i] or 0.0,
        })

    # Convertir listas diarias a lista de dicts
    daily_times = daily.get("time", [])
    daily_records = []
    for i, t in enumerate(daily_times):
        daily_records.append({
            "date": t,
            "precipitation_sum": daily.get("precipitation_sum", [0.0])[i] or 0.0,
            "rain_sum": daily.get("rain_sum", [0.0])[i] or 0.0,
            "precipitation_hours": daily.get("precipitation_hours", [0.0])[i] or 0.0,
            "cloud_cover_mean": daily.get("cloud_cover_mean", [0.0])[i] or 0.0,
            "temperature_2m_max": daily.get("temperature_2m_max", [30.0])[i] or 30.0,
            "temperature_2m_min": daily.get("temperature_2m_min", [24.0])[i] or 24.0,
            "precipitation_probability_max": daily.get("precipitation_probability_max", [0.0])[i] or 0.0,
        })

    # Bloque "current": condiciones actuales exactas (temp, lluvia, etc.)
    current_record: Dict[str, Any] = {}
    current_time = current.get("time")
    if current_time:
        current_record = {
            "time": current_time,
            "precipitation": current.get("precipitation", 0.0) or 0.0,
            "rain": current.get("rain", 0.0) or 0.0,
            "temperature_2m": current.get("temperature_2m", 25.0) or 25.0,
            "relative_humidity_2m": current.get("relative_humidity_2m", 80.0) or 80.0,
            "cloud_cover": current.get("cloud_cover", 0.0) or 0.0,
            "wind_speed_10m": current.get("wind_speed_10m", 0.0) or 0.0,
            "wind_direction_10m": current.get("wind_direction_10m", 0.0) or 0.0,
            "wind_gusts_10m": current.get("wind_gusts_10m", 0.0) or 0.0,
            "pressure_msl": current.get("pressure_msl", 1013.0) or 1013.0,
            "dew_point_2m": current.get("dew_point_2m", 23.0) or 23.0,
            "apparent_temperature": current.get("apparent_temperature", 28.0) or 28.0,
            "weather_code": current.get("weather_code", 0) or 0,
            "is_day": current.get("is_day", 1) or 1,
            "soil_moisture_0_1cm": current.get("soil_moisture_0_1cm", 0.0) or 0.0,
            "soil_moisture_1_3cm": current.get("soil_moisture_1_3cm", 0.0) or 0.0,
        }

    # Separar pasado (dias previos reales) de presente/futuro para no romper las
    # funciones existentes que asumen hourly[0] = inicio de hoy (extract_simulation_params,
    # get_weather_summary, tiene_lluvia_en_horizonte). El pasado real se expone
    # aparte y alimenta la racha de lluvia y la humedad del suelo.
    today_str = datetime.now().strftime("%Y-%m-%d")
    past_records = [r for r in hourly_records if str(r.get("time", ""))[:10] < today_str]
    forecast_records = [r for r in hourly_records if str(r.get("time", ""))[:10] >= today_str]
    past_daily = _aggregate_daily(past_records)

    # Diario: conservar solo hoy/futuro para que 'pronostico' y 'lluvia_manana'
    # apunten a dias hacia adelante (no a dias pasados de past_days).
    forecast_daily = [d for d in daily_records if str(d.get("date", "")) >= today_str]

    # Utiles en 'forecast' para no alterar la semantica previa: si por algun
    # motivo no hubiera division temporal, dejamos todo en forecast.
    if not forecast_records:
        forecast_records = hourly_records
    if not forecast_daily:
        forecast_daily = daily_records

    return {
        "hourly": forecast_records,
        "daily": forecast_daily,
        "current": current_record,
        "past_daily": past_daily,
        "metadata": {
            "latitude": raw.get("latitude", MANGA_LAT),
            "longitude": raw.get("longitude", MANGA_LON),
            "timezone": raw.get("timezone", "America/Bogota"),
            "elevation": raw.get("elevation", 0.0),
        },
    }


def _empty_forecast() -> Dict[str, Any]:
    """Retorna un forecast vacio en caso de error."""
    return {
        "hourly": [],
        "daily": [],
        "current": {},
        "past_daily": [],
        "metadata": {
            "latitude": MANGA_LAT,
            "longitude": MANGA_LON,
            "timezone": "America/Bogota",
            "elevation": 0.0,
            "error": "No se pudo obtener datos meteorologicos",
        },
    }


def compute_consecutive_rainy_days(daily_data: List[Dict]) -> int:
    """
    Cuenta cuantos dias consecutivos (desde hoy) han tenido lluvia.
    Un dia se considera lluvioso si rain_sum > 0.1 mm.
    """
    count = 0
    for day in reversed(daily_data):
        if day.get("rain_sum", 0) > 0.1:
            count += 1
        else:
            break
    return count


def estimate_soil_humidity(daily_data: List[Dict], base: float = 0.1) -> float:
    """
    Estima la humedad del suelo basado en los dias lluviosos recientes.

    Modelado como:
        h_suelo = min(1.0, base + dias_consecutivos * 0.15)

    Donde base representa la humedad residual del suelo tropical.
    """
    consecutive = compute_consecutive_rainy_days(daily_data)
    return min(1.0, base + consecutive * 0.15)


def extract_simulation_params(
    hourly_data: List[Dict],
    horas_pronostico: int = 72,
    nivel_marea_cm: float = 8.0,
    past_daily: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Extrae los parametros de simulacion a partir de los datos horarios
    de Open-Meteo.

    Retorna un dict con los parametros listos para run_simulation().
    """
    if not hourly_data:
        return {
            "storm_peak_hour": 12.0,
            "storm_intensity": 20.0,
            "rain_duration_h": 6.0,
            "mean_sea_level": nivel_marea_cm,
            "wind_direction_deg": 0.0,
            "wind_speed_kmh": 0.0,
            "soil_humidity": 0.3,
            "consecutive_rainy_days": 0,
        }

    # Tomar solo las horas del pronostico
    forecast_hours = hourly_data[:horas_pronostico]

    # Encontrar hora pico de lluvia
    max_precip = 0.0
    peak_idx = len(forecast_hours) // 4  # default: primer cuarto del dia
    for i, h in enumerate(forecast_hours):
        if h["precipitation"] > max_precip:
            max_precip = h["precipitation"]
            peak_idx = i

    # Calcular duracion de lluvia (horas con precipitacion > 0.1 mm/h)
    rain_hours = sum(1 for h in forecast_hours if h["precipitation"] > 0.1)
    rain_duration = max(1.0, float(rain_hours))

    # Viento promedio en las horas de lluvia
    rain_periods = [h for h in forecast_hours if h["precipitation"] > 0.1]
    if rain_periods:
        avg_wind_dir = sum(h["wind_direction_10m"] for h in rain_periods) / len(rain_periods)
        avg_wind_speed = sum(h["wind_speed_10m"] for h in rain_periods) / len(rain_periods)
    else:
        avg_wind_dir = sum(h["wind_direction_10m"] for h in forecast_hours) / max(1, len(forecast_hours))
        avg_wind_speed = sum(h["wind_speed_10m"] for h in forecast_hours) / max(1, len(forecast_hours))

    # Datos diarios para humedad del suelo
    from .weather_service import compute_consecutive_rainy_days, estimate_soil_humidity

    # Reconstruir daily data del hourly (futuro/presente)
    daily_from_hourly = _aggregate_daily(forecast_hours)
    # Preferir los dias pasados reales (Open-Meteo past_days) para la racha y
    # la humedad del suelo; si no hay pasado, cae al forecast.
    daily_base = past_daily or daily_from_hourly

    # Humedad del suelo REAL de Open-Meteo (fraccion 0-1) si esta disponible;
    # si no, cae a la heuristica estimada por dias lluviosos consecutivos reales.
    hum_suelo = estimate_soil_humidity(daily_from_hourly)
    for h in forecast_hours:
        capa_0 = h.get("soil_moisture_0_1cm")
        capa_1 = h.get("soil_moisture_1_3cm")
        capa = (capa_0 or 0.0) if capa_0 not in (None, 0.0) else capa_1
        if capa in (None, 0.0):
            continue
        hum_suelo = float(capa)
        break

    return {
        "storm_peak_hour": float(peak_idx),
        "storm_intensity": round(max_precip, 2),
        "rain_duration_h": round(rain_duration, 1),
        "mean_sea_level": nivel_marea_cm,
        "wind_direction_deg": round(avg_wind_dir, 1),
        "wind_speed_kmh": round(avg_wind_speed, 1),
        "soil_humidity": round(hum_suelo, 3),
        "consecutive_rainy_days": compute_consecutive_rainy_days(daily_base),
    }


def _aggregate_daily(hourly_data: List[Dict]) -> List[Dict]:
    """Agrega datos horarios en diarios simples."""
    daily = {}
    for h in hourly_data:
        date = h["time"][:10]  # "2024-01-01T00:00" -> "2024-01-01"
        if date not in daily:
            daily[date] = {
                "date": date,
                "rain_sum": 0.0,
                "precipitation_sum": 0.0,
                "precipitation_hours": 0.0,
            }
        daily[date]["rain_sum"] += h.get("rain", 0)
        daily[date]["precipitation_sum"] += h.get("precipitation", 0)
        if h.get("precipitation", 0) > 0.1:
            daily[date]["precipitation_hours"] += 1

    return list(daily.values())


def get_weather_summary(hourly_data: List[Dict], horas: int = 72) -> Dict[str, Any]:
    """
    Genera un resumen meteorologico para las proximas N horas.
    """
    if not hourly_data:
        return {
            "lluvia_total_mm": 0,
            "temp_max_c": 30.0,
            "temp_min_c": 24.0,
            "humedad_promedio": 80.0,
            "viento_max_kmh": 0.0,
            "dias_lluviosos": 0,
            "horas_con_lluvia": 0,
        }

    forecast = hourly_data[:horas]
    temps = [h["temperature_2m"] for h in forecast]
    humidity = [h["relative_humidity_2m"] for h in forecast]
    wind = [h["wind_speed_10m"] for h in forecast]
    precip = [h["precipitation"] for h in forecast]

    daily_data = _aggregate_daily(forecast)

    return {
        "lluvia_total_mm": round(sum(precip), 2),
        "temp_max_c": round(max(temps), 1) if temps else 30.0,
        "temp_min_c": round(min(temps), 1) if temps else 24.0,
        "humedad_promedio": round(sum(humidity) / len(humidity), 1) if humidity else 80.0,
        "viento_max_kmh": round(max(wind), 1) if wind else 0.0,
        "dias_lluviosos": compute_consecutive_rainy_days(daily_data),
        "horas_con_lluvia": sum(1 for p in precip if p > 0.1),
    }


# Periodo semidiurno de marea (~12.42 h) para estimar pleamar
TIDE_PERIOD_H = 12.42


def _proxima_pleamar(reference: Optional[datetime] = None) -> str:
    """Devuelve la hora ISO de la proxima pleamar estimada.

    Modelo simplificado: hay 2 pleamares por dia (periodo semidiurno).
    Sin datos reales de marea, asumimos un ciclo con un offset fijo que
    aproxima la pleamar de la marea semidiurna del Caribe.
    """
    now = reference or datetime.now()
    # Desplazamiento de fase arbitrario (radianes): asumimos primera pleamar del dia ~06:xx
    # Periodo P = 12.42 h -> frecuencia angular w = 2*pi/P
    w = 2 * 3.141592653589793 / TIDE_PERIOD_H
    # Estimar cuantas horas hasta el proximo maximo de la senoide
    # sen(w*(t - 0.25*P)) tiene maximos cuando w*(t - 0.25P) = pi/2 + k*2pi
    def time_to_peak(t_hours: float, phase_hours: float = 5.0) -> float:
        phase = w * (t_hours - phase_hours)
        # proximo multiplo de 2pi que lleve a pi/2
        target = (0.5 + 2 * 3.141592653589793 - phase) % (2 * 3.141592653589793)
        return target / w

    # Buscar la pleamar mas cercana en las proximas 13 horas
    t0 = now.hour + now.minute / 60.0
    best_hours = None
    best_delta = None
    for k in range(0, 3):
        peak = time_to_peak(t0, phase_hours=5.0) + k * TIDE_PERIOD_H
        future = t0 + peak
        # aceptamos solo si esta en las proximas 24h
        if future <= 24.0:
            delta = peak
            if best_delta is None or delta < best_delta:
                best_delta = delta
                best_hours = future
    if best_hours is None:
        best_hours = t0 + 6.21

    total_minutes = int(round(best_hours * 60)) % (24 * 60)
    hh = total_minutes // 60
    mm = total_minutes % 60
    approx = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return approx.isoformat()


def _estimar_marea_cm(reference: Optional[datetime] = None) -> float:
    """Estima el nivel de marea (cm) para el instante dado.

    Marea semidiurna: nivel = media + amplitud * sin(w*(t - fase)).
    La pleamar coincide con el maximo de la senoide. Amplitud tipica del
    Caribe ~ 25 cm sobre la media (mean_sea_level = 8 cm).
    """
    now = reference or datetime.now()
    w = 2 * 3.141592653589793 / TIDE_PERIOD_H
    phase_hours = 5.0  # desfase: primera pleamar del dia ~06:xx
    t_hours = now.hour + now.minute / 60.0
    mean = 8.0
    amplitude = 25.0
    # sen(w*(t - fase)); offset 0.5 para centrar entre 0 y amplitud
    elev = mean + amplitude * 0.5 * (1.0 + math.sin(w * (t_hours - phase_hours)))
    return round(elev, 1)


def _closest_hour_record(
    hourly: List[Dict], reference: Optional[datetime] = None
) -> Dict[str, Any]:
    """Selecciona el registro horario mas cercano al instante actual.

    Open-Meteo devuelve horas desde el inicio del dia (America/Bogota). En vez
    de tomar arbitrariamente hourly[0], elegimos la fila cuya hora de pronostico
    este mas proxima a "ahora" para dar una lectura de temperatura/humedad
    correcta en tiempo real.
    """
    now = reference or datetime.now()
    best: Optional[Dict[str, Any]] = None
    best_delta: Optional[float] = None
    for rec in hourly:
        t = rec.get("time")
        if not t:
            continue
        try:
            ts = datetime.fromisoformat(str(t).replace("Z", ""))
        except (ValueError, TypeError):
            continue
        delta = abs((ts - now).total_seconds())
        if best_delta is None or delta < best_delta:
            best_delta = delta
            best = rec
    return best or (hourly[0] if hourly else {})


def _actual_promediado(hourly: List[Dict], campo: str, default: float, ventana: int = 3) -> float:
    """Promedia el campo (temp/humedad/etc.) en una pequena ventana centrada
    en el registro mas cercano a ahora para suavizar lecturas puntuales."""
    n = len(hourly)
    if n == 0:
        return default
    actual = _closest_hour_record(hourly)
    base_t = str(actual.get("time", ""))
    try:
        base = datetime.fromisoformat(base_t.replace("Z", ""))
    except (ValueError, TypeError):
        base = None

    valores = []
    if base is None:
        # Sin referencias temporales: promediar los primeros `ventana` registros
        for rec in hourly[:ventana]:
            v = rec.get(campo, default)
            if v is not None:
                valores.append(float(v))
    else:
        for rec in hourly:
            t = str(rec.get("time", ""))
            try:
                ts = datetime.fromisoformat(t.replace("Z", ""))
            except (ValueError, TypeError):
                continue
            gap = abs((ts - base).total_seconds()) / 3600.0
            if gap <= ventana:
                v = rec.get(campo, default)
                if v is not None:
                    valores.append(float(v))

    if not valores:
        v = actual.get(campo, default)
        return float(v) if v is not None else default
    return sum(valores) / len(valores)


class WeatherService:
    """
    Servicio meteorologico robusto con cache local de 30 min y fallback
    a datos simulados si la API de Open-Meteo no responde.

    Reutiliza las funciones modulares de este modulo (fetch_weather_forecast,
    get_weather_summary, extract_simulation_params) -> capa de resiliencia
    sin duplicar logica.
    """

    # Cache de 30 minutos (1800 s) para reducir llamadas a Open-Meteo
    CACHE_TTL_SECONDS = 1800
    CACHE_FILE = (
        "/tmp/stormprint_weather_cache.json"
        if os.getenv("VERCEL")
        else "weather_cache.json"
    )

    def __init__(self):
        self.default_cm = 8.0  # nivel medio del mar para marea (cm)

    async def get_weather(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Obtiene un resumen meteorologico enriquecido para Manga, Cartagena.

        Estrategia (resiliente a dias soleados y a fallos de la API):
          1. Cache local (si es reciente y no se fuerza refresh)
          2. Open-Meteo (principal)  -> fuente=open-meteo, confianza=0.95
          3. Datos historicos del mes -> fuente=historico, confianza=0.70
          4. Datos promedio (ultimo recurso) -> fuente=simulado, confianza=0.40

        Se diferencia explicitamente "sin lluvia" (estado soleado) vs
        "sin datos" (estado sin_datos).
        """
        if not force_refresh:
            cached = self._load_cache()
            if cached is not None:
                logger.info("WeatherService: usando cache local")
                return cached

        data = await self._fetch_from_openmeteo()
        if data is None:
            logger.warning("WeatherService: Open-Meteo no disponible, usando historico")
            data = self._generate_historical_data()
        else:
            self._store_cache(data)
            return data

        # Si el historico tampoco refleja datos reales (mes sin lluvia o invalido),
        # caemos al promedio. El historico ya incluye estado y confianza.
        if data.get("estado") == ESTADO_SIN_DATOS:
            logger.warning("WeatherService: historico invalido, usando promedio")
            data = self._generate_promedio_data()

        self._store_cache(data)
        return data

    async def _fetch_from_openmeteo(self) -> Optional[Dict[str, Any]]:
        """Consulta Open-Meteo y enriquece con resumen y parametros."""
        try:
            forecast = await fetch_weather_forecast(forecast_days=3)
        except Exception as exc:
            logger.error("WeatherService: Open-Meteo fallo: %s", exc)
            return None

        if not forecast or not forecast.get("hourly"):
            return None

        hourly = forecast["hourly"]
        summary = get_weather_summary(hourly, horas=72)
        parametros = extract_simulation_params(
            hourly_data=hourly,
            horas_pronostico=72,
            nivel_marea_cm=self.default_cm,
            past_daily=forecast.get("past_daily"),
        )

        daily = forecast.get("daily", [])
        current = forecast.get("current") or {}
        today = daily[0] if daily else {}
        now = datetime.now()

        # Lectura "ahora" EXACTA: bloque current de Open-Meteo (momento real).
        # Si el bloque current no viene, se cae a la hora mas cercana del hourly.
        actual = current if current else _closest_hour_record(hourly)
        dias_lluviosos = summary.get("dias_lluviosos", 0)

        humedad_suelo_real = (
            float(actual.get("soil_moisture_0_1cm") or 0.0)
            or float(actual.get("soil_moisture_1_3cm") or 0.0)
            or 0.0
        )
        if humedad_suelo_real <= 0.0:
            humedad_suelo_real = round(parametros.get("soil_humidity", 0.3) * 100, 1)
        else:
            humedad_suelo_real = round(min(1.0, humedad_suelo_real) * 100, 1)

        precip_actual = round(actual.get("rain", 0.0) or 0.0, 2)
        nubosidad = actual.get("cloud_cover", 0.0) or 0.0
        weather_code = actual.get("weather_code")
        estado = determinar_estado(
            precipitacion_actual_mmh=precip_actual,
            nubosidad_pct=nubosidad,
            weather_code=weather_code,
        )

        # Con el bloque current ya no hace falta promediar la ventana: el dato
        # "ahora" es el del instante exacto. Se conserva como respaldo por si el
        # bloque current estuviera vacio.
        temp_actual = float(actual.get("temperature_2m") or 0.0) or (
            _actual_promediado(hourly, "temperature_2m", 28.0, ventana=3)
        )
        hum_actual = float(actual.get("relative_humidity_2m") or 0.0) or (
            _actual_promediado(hourly, "relative_humidity_2m", 80.0, ventana=3)
        )
        viento_actual = float(actual.get("wind_speed_10m") or 0.0) or (
            _actual_promediado(hourly, "wind_speed_10m", 0.0, ventana=2)
        )

        return {
            "source": "open-meteo",
            "fuente": "open-meteo",
            "confianza": 0.95,
            "timestamp": now.isoformat(),
            "lat": MANGA_LAT,
            "lon": MANGA_LON,
            "temperatura": round(temp_actual, 1),
            "humedad": round(hum_actual, 1),
            "nubosidad_pct": round(float(nubosidad), 1),
            "estado": estado,
            "estado_label": ESTADO_LABEL.get(estado, estado),
            "weather_code": int(weather_code) if weather_code is not None else None,
            "precipitacion_actual_mm_h": precip_actual,
            "velocidad_viento_kmh": round(viento_actual, 1),
            "direccion_viento_deg": round(float(actual.get("wind_direction_10m") or 0.0), 1),
            "rafagas_kmh": round(float(actual.get("wind_gusts_10m") or 0.0), 1),
            "presion_msl_hpa": round(float(actual.get("pressure_msl") or 0.0), 1),
            "punto_rocio_c": round(float(actual.get("dew_point_2m") or 0.0), 1),
            "sensacion_termica_c": round(float(actual.get("apparent_temperature") or temp_actual), 1),
            "dias_lluviosos_consecutivos": dias_lluviosos,
            "humedad_suelo_pct": humedad_suelo_real,
            "lluvia_total_mm": summary.get("lluvia_total_mm", 0.0),
            "temp_max_c": summary.get("temp_max_c", 30.0),
            "temp_min_c": summary.get("temp_min_c", 24.0),
            "viento_max_kmh": summary.get("viento_max_kmh", 0.0),
            "lluvia_manana_mm": daily[1].get("rain_sum", 0.0) if len(daily) > 1 else 0.0,
            "marea_actual_cm": _estimar_marea_cm(now),
            "proxima_pleamar": _proxima_pleamar(now),
            "parametros_simulacion": parametros,
            "pronostico": [
                {
                    "dia": d.get("date"),
                    "lluvia_mm": d.get("rain_sum", 0.0),
                    "temp_max_c": d.get("temperature_2m_max", 30.0),
                    "prob_lluvia_pct": round(float(d.get("precipitation_probability_max") or 0.0), 0),
                    "estado": (ESTADO_LLUVIOSO
                               if (d.get("rain_sum", 0.0) or 0.0) > 2.0
                               else (ESTADO_NUBLADO if (d.get("cloud_cover_mean", 0.0) or 0.0) > 70 else ESTADO_SOLEADO)),
                }
                for d in daily[:3]
            ],
        }

    def _generate_historical_data(self) -> Dict[str, Any]:
        """Datos basados en el historico promedio del mes (fallback Open-Meteo).

        Confianza media (0.70). Estado derivado de la lluvia media del mes.
        Si el historico no existe para el mes (no deberia), devuelve
        estado=sin_datos para que get_weather caiga al promedio.
        """
        now = datetime.now()
        hora = now.hour
        mes = now.month
        hist = DATOS_HISTORICOS_POR_MES.get(mes)

        if hist is None:
            return self._base_weather(
                fuente="historico",
                confianza=0.70,
                estado=ESTADO_SIN_DATOS,
                temperatura=28.0,
                humedad=75.0,
                nubosidad=40.0,
                precipitacion_actual=0.0,
                viento=8.0,
                viento_dir=180.0,
                dias_lluviosos=0,
                humedad_suelo=30.0,
                lluvia_total=0.0,
                temp_max=30.0,
                temp_min=24.0,
                viento_max=15.0,
                lluvia_manana=0.0,
                lluvia_diaria_estimada=6.0,
                parametros=None,
            )

        # lluvia media diaria a partir del acumulado mensual (aprox.)
        lluvia_diaria = round(hist["lluvia_mm_mes"] / 30.0, 2)
        # Historial del mes: si el mes es seco, estado soleado
        if lluvia_diaria <= LLUVIA_LIGERA_MMH:
            estado = ESTADO_SOLEADO
        else:
            estado = determinar_estado(lluvia_diaria, None)
        nubosidad = 55.0 if estado != ESTADO_SOLEADO else 25.0

        return self._base_weather(
            fuente="historico",
            confianza=0.70,
            estado=estado,
            temperatura=hist["temp_c"],
            humedad=hist["humedad_pct"],
            nubosidad=nubosidad,
            precipitacion_actual=0.0,
            viento=8.0,
            viento_dir=180.0,
            dias_lluviosos=1 if estado in (ESTADO_LLUVIOSO, ESTADO_TORMENTA) else 0,
            humedad_suelo=65.0 if estado in (ESTADO_LLUVIOSO, ESTADO_TORMENTA) else 40.0,
            lluvia_total=round(lluvia_diaria * 24, 2),
            temp_max=hist["temp_c"] + 2,
            temp_min=hist["temp_c"] - 2,
            viento_max=20.0,
            lluvia_manana=lluvia_diaria,
            lluvia_diaria_estimada=lluvia_diaria,
            parametros=None,
        )

    def _generate_promedio_data(self) -> Dict[str, Any]:
        """Ultimo recurso: datos promedio anuales (confianza baja 0.40)."""
        now = datetime.now()
        ahora = now.hour

        return self._base_weather(
            fuente="simulado",
            confianza=0.40,
            estado=ESTADO_SIN_DATOS,
            temperatura=DATOS_PROMEDIO["temp_c"] + (ahora - 6) / 24 * 2,
            humedad=DATOS_PROMEDIO["humedad_pct"],
            nubosidad=50.0,
            precipitacion_actual=0.0,
            viento=DATOS_PROMEDIO["viento_kmh"],
            viento_dir=180.0,
            dias_lluviosos=0,
            humedad_suelo=50.0,
            lluvia_total=0.0,
            temp_max=DATOS_PROMEDIO["temp_c"] + 2,
            temp_min=DATOS_PROMEDIO["temp_c"] - 3,
            viento_max=18.0,
            lluvia_manana=DATOS_PROMEDIO["lluvia_diaria_mm"],
            lluvia_diaria_estimada=DATOS_PROMEDIO["lluvia_diaria_mm"],
            parametros=None,
        )

    def _base_weather(
        self,
        fuente: str,
        confianza: float,
        estado: str,
        temperatura: float,
        humedad: float,
        nubosidad: float,
        precipitacion_actual: float,
        viento: float,
        viento_dir: float,
        dias_lluviosos: int,
        humedad_suelo: float,
        lluvia_total: float,
        temp_max: float,
        temp_min: float,
        viento_max: float,
        lluvia_manana: float,
        lluvia_diaria_estimada: float,
        parametros: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Construye el payload comun de weather a partir de valores escalares."""
        now = datetime.now()
        if parametros is None:
            parametros = {
                "storm_peak_hour": 12.0,
                "storm_intensity": max(0.0, lluvia_diaria_estimada),
                "rain_duration_h": 2.0 if estado == ESTADO_SOLEADO else 4.0,
                "mean_sea_level": self.default_cm,
                "wind_direction_deg": viento_dir,
                "wind_speed_kmh": viento,
                "soil_humidity": round(humedad_suelo / 100.0, 3),
                "consecutive_rainy_days": dias_lluviosos,
            }

        pronostico = []
        for i in range(3):
            dia = (now + timedelta(days=i)).date().isoformat()
            if i == 0:
                lluvia = lluvia_manana
            else:
                lluvia = lluvia_manana  # historico plano
            pronostico.append({
                "dia": dia,
                "lluvia_mm": round(lluvia, 2),
                "temp_max_c": round(temp_max, 1),
                "prob_lluvia_pct": round(100.0 if lluvia > 2.0 else 0.0, 0),
                "estado": ESTADO_LLUVIOSO if lluvia > 2.0 else (ESTADO_NUBLADO if nubosidad > 70 else ESTADO_SOLEADO),
            })

        return {
            "source": fuente,
            "fuente": fuente,
            "confianza": confianza,
            "timestamp": now.isoformat(),
            "lat": MANGA_LAT,
            "lon": MANGA_LON,
            "temperatura": round(float(temperatura), 1),
            "humedad": round(float(humedad), 1),
            "nubosidad_pct": round(float(nubosidad), 1),
            "estado": estado,
            "estado_label": ESTADO_LABEL.get(estado, estado),
            "weather_code": None,
            "precipitacion_actual_mm_h": round(float(precipitacion_actual), 2),
            "velocidad_viento_kmh": round(float(viento), 1),
            "direccion_viento_deg": round(float(viento_dir), 1),
            "rafagas_kmh": round(float(viento_max), 1),
            "presion_msl_hpa": 1013.0,
            "punto_rocio_c": round(float(temp_min), 1),
            "sensacion_termica_c": round(float(temperatura), 1),
            "dias_lluviosos_consecutivos": dias_lluviosos,
            "humedad_suelo_pct": round(float(humedad_suelo), 1),
            "lluvia_total_mm": round(float(lluvia_total), 2),
            "temp_max_c": round(float(temp_max), 1),
            "temp_min_c": round(float(temp_min), 1),
            "viento_max_kmh": round(float(viento_max), 1),
            "lluvia_manana_mm": round(float(lluvia_manana), 2),
            "marea_actual_cm": _estimar_marea_cm(now),
            "proxima_pleamar": _proxima_pleamar(now),
            "parametros_simulacion": parametros,
            "pronostico": pronostico,
        }

    def _load_cache(self) -> Optional[Dict[str, Any]]:
        """Lee y valida el cache local (devuelve None si es viejo/invalido)."""
        try:
            if not os.path.exists(self.CACHE_FILE):
                return None
            with open(self.CACHE_FILE, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            ts = datetime.fromisoformat(data.get("timestamp", "2000-01-01"))
            if (datetime.now() - ts).total_seconds() > self.CACHE_TTL_SECONDS:
                return None
            return data
        except Exception as exc:
            logger.debug("WeatherService: cache invalido: %s", exc)
            return None

    def _store_cache(self, data: Dict[str, Any]) -> None:
        """Persiste el cache local (no bloquear el flujo si falla)."""
        try:
            with open(self.CACHE_FILE, "w", encoding="utf-8") as fh:
                json.dump(data, fh)
        except Exception as exc:
            logger.debug("WeatherService: no se pudo guardar cache: %s", exc)


# Instancia singleton reutilizable por toda la app
weather_service = WeatherService()
