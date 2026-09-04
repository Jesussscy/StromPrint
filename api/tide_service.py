"""
StormPrint :: tide_service.py
Servicio de marea real para Barrio Manga, Cartagena de Indias.

NOAA CO-OPS solo cubre estaciones de EE. UU. y NO existe para Colombia. Para
Cartagena la marea real se obtiene del modelo marino global de Open-Meteo
(endpoint /v1/marine, variable sea_level_height_msl, que incluye mareas y
nivel del mar sobre el nivel medio global).

Fuente: MeteoFrance SMOC Tides, 0.08° (~8 km), escala global, gratuito y sin
API key (uso no comercial). Attribution: Open-Meteo / MeteoFrance.

Coordenadas: lat = 10.4000, lon = -75.5167 (Barrio Manga).
"""

import json
import logging
import math
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

from .storage import atomic_write_json

logger = logging.getLogger("stormprint.tide")

MANGA_LAT = 10.4000
MANGA_LON = -75.5167

OPEN_METEO_MARINE = "https://marine-api.open-meteo.com/v1/marine"

# Periodo semidiurno (~12.42 h) usado solo como fallback y para extender la serie.
TIDE_PERIOD_H = 12.42

# Cache de 30 minutos, igual que el weather_service.
CACHE_TTL_SECONDS = 1800


def _closest_index(times: List[str], reference: datetime, at_or_after: bool = True) -> Optional[int]:
    """Devuelve el indice de la hora mas cercana (>=) al instante dado."""
    best_idx: Optional[int] = None
    best_delta: Optional[float] = None
    for i, t in enumerate(times):
        try:
            ts = datetime.fromisoformat(str(t).replace("Z", ""))
        except (ValueError, TypeError):
            continue
        delta = (ts - reference).total_seconds()
        if at_or_after and delta < 0:
            continue
        if best_idx is None or abs(delta) < best_delta:
            best_delta = abs(delta)
            best_idx = i
    return best_idx


def _proxima_pleamar_de_serie(times: List[str], heights_m: List[float], reference: datetime) -> str:
    """Primer maximo local de la serie de marea estrictamente despues de 'now'."""
    now_ts = reference.timestamp()
    best_iso: Optional[str] = None
    for i in range(1, len(heights_m) - 1):
        tt = times[i]
        try:
            ts = datetime.fromisoformat(str(tt).replace("Z", "")).timestamp()
        except (ValueError, TypeError):
            continue
        if ts <= now_ts:
            continue
        if heights_m[i] >= heights_m[i - 1] and heights_m[i] >= heights_m[i + 1]:
            best_iso = tt
            break
    return best_iso or ""


def _marea_actual_de_serie(sea_level_cm: List[float], now_index: Optional[int]) -> float:
    if now_index is None or now_index < 0 or now_index >= len(sea_level_cm):
        return 8.0
    return round(float(sea_level_cm[now_index]), 1)


async def fetch_tide_hourly(
    forecast_days: int = 8,
    past_days: int = 1,
    lat: float = MANGA_LAT,
    lon: float = MANGA_LON,
) -> Optional[Dict[str, Any]]:
    """Consulta el nivel del mar (incluye mareas) de Open-Meteo Marine.

    Devuelve un dict con 'time' (lista ISO) y 'sea_level_cm' (lista en cm) o
    None si falla la API.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "sea_level_height_msl",
        "forecast_days": min(forecast_days, 8),
        "past_days": min(past_days, 2),
        "timezone": "America/Bogota",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(OPEN_METEO_MARINE, params=params)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("tide_service: Open-Meteo Marine fallo: %s", exc)
        return None

    times = data.get("hourly", {}).get("time", [])
    heights = data.get("hourly", {}).get("sea_level_height_msl", [])
    if not times or not heights:
        return None

    sea_cm = [round(float(h) * 100.0, 2) for h in heights]
    return {"time": times, "sea_level_cm": sea_cm}


def serie_marea_desde_ahora(
    time: List[str],
    sea_level_cm: List[float],
    duration_hours: int,
    reference: Optional[datetime] = None,
) -> List[float]:
    """Recorta la serie de marea a partir de la hora actual y tantas horas
    como dure la simulacion. Si faltan valores, extiende periodicamente con el
    ultimo ciclo semidiurno disponible (fallback).
    """
    now = reference or datetime.now()
    duration_hours = max(1, int(duration_hours))
    idx = _closest_index(time, now, at_or_after=True)
    if idx is None:
        return []
    base = sea_level_cm[idx:idx + duration_hours]
    if len(base) >= duration_hours:
        return base
    # Extender con la periodicidad de la marea semidiurna
    period = max(1, int(round(TIDE_PERIOD_H)))
    cycle = sea_level_cm[max(0, idx - period):idx] or sea_level_cm[-period:]
    out = list(base)
    i = 0
    while len(out) < duration_hours and cycle:
        out.append(float(cycle[i % len(cycle)]))
        i += 1
    return out[:duration_hours]


class TideService:
    """Servicio de marea real con cache local de 30 min y fallback analitico."""

    def __init__(self):
        self.default_cm = 8.0

    def _calibrar_serie(self, serie_cm: List[float], default_msl: float = 8.0) -> List[float]:
        """Recorta la serie de marea real al rango estable del modelo.

        El motor usa la serie como oscilacion (resta su media), por lo que aqui
        solo nos aseguramos de devolver la serie cruda saneada. La media de la
        serie es 0 en el forzamiento; se conserva intacto el PAUTA real
        (momento en que sube/baja la marea en Cartagena).
        """
        if not serie_cm:
            return []
        return [round(float(x), 2) for x in serie_cm]

    async def get_tide(
        self,
        duration_hours: int = 168,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        duration_hours = max(1, int(duration_hours))
        if not force_refresh:
            cached = self._load_cache()
            if cached is not None:
                return cached

        raw = await fetch_tide_hourly()
        now = datetime.now()
        if raw is None or not raw.get("time"):
            # Fallback analitico (misma estimacion actual del weather_service)
            data = {
                "marea_actual_cm": 8.0,
                "proxima_pleamar": "",
                "serie_cm": [],
                "origen": "analitico",
            }
        else:
            serie_cm = serie_marea_desde_ahora(
                raw["time"], raw["sea_level_cm"], duration_hours, now
            )
            serie_calibrada = self._calibrar_serie(serie_cm)
            data = {
                "marea_actual_cm": serie_calibrada[0] if serie_calibrada else 8.0,
                "proxima_pleamar": _proxima_pleamar_de_serie(
                    raw["time"], raw["sea_level_cm"], now
                ),
                "serie_cm": serie_calibrada,
                "origen": "open-meteo-marine",
            }
        self._store_cache(data)
        return data

    CACHE_FILE = (
        "/tmp/stormprint_tide_cache.json"
        if os.getenv("VERCEL")
        else "tide_cache.json"
    )

    def _load_cache(self) -> Optional[Dict[str, Any]]:
        try:
            if not os.path.exists(self.CACHE_FILE):
                return None
            with open(self.CACHE_FILE, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            ts = datetime.fromisoformat(data.get("timestamp", "2000-01-01"))
            if (datetime.now() - ts).total_seconds() > CACHE_TTL_SECONDS:
                return None
            return data
        except Exception as exc:
            logger.debug("tide_service: cache invalido: %s", exc)
            return None

    def _store_cache(self, data: Dict[str, Any]) -> None:
        try:
            data = dict(data)
            data["timestamp"] = datetime.utcnow().isoformat()
            atomic_write_json(self.CACHE_FILE, data)
        except Exception as exc:
            logger.debug("tide_service: no se pudo guardar cache: %s", exc)


tide_service = TideService()