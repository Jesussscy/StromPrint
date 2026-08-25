"""
StormPrint :: weather_service.py
Servicio de datos meteorologicos via Open-Meteo (gratuito, sin API key).

Coordenadas fijas: Barrio Manga, Cartagena de Indias
  lat = 10.4000, lon = -75.5167

Open-Meteo es una API publica, open-source, sin registro requerido.
No comercial: hasta 10,000 llamadas/dia. Attribution: CC BY 4.0.
"""

import logging
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
    "wind_speed_10m",
    "wind_direction_10m",
]

# Variables diarias
DAILY_VARS = [
    "precipitation_sum",
    "rain_sum",
    "precipitation_hours",
    "temperature_2m_max",
    "temperature_2m_min",
]


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
        "hourly": ",".join(HOURLY_VARS),
        "daily": ",".join(DAILY_VARS),
        "timezone": "America/Bogota",
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
            "wind_speed_10m": hourly.get("wind_speed_10m", [0.0])[i] or 0.0,
            "wind_direction_10m": hourly.get("wind_direction_10m", [0.0])[i] or 0.0,
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
            "temperature_2m_max": daily.get("temperature_2m_max", [30.0])[i] or 30.0,
            "temperature_2m_min": daily.get("temperature_2m_min", [24.0])[i] or 24.0,
        })

    return {
        "hourly": hourly_records,
        "daily": daily_records,
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

    # Reconstruir daily data del hourly
    daily_from_hourly = _aggregate_daily(forecast_hours)

    return {
        "storm_peak_hour": float(peak_idx),
        "storm_intensity": round(max_precip, 2),
        "rain_duration_h": round(rain_duration, 1),
        "mean_sea_level": nivel_marea_cm,
        "wind_direction_deg": round(avg_wind_dir, 1),
        "wind_speed_kmh": round(avg_wind_speed, 1),
        "soil_humidity": round(estimate_soil_humidity(daily_from_hourly), 3),
        "consecutive_rainy_days": compute_consecutive_rainy_days(daily_from_hourly),
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
