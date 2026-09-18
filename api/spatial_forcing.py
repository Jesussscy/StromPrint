"""Unmodified hourly precipitation for spatial water, separate from EDO forcing."""
import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pydantic import BaseModel, Field

class SpatialHour(BaseModel):
    hour: int
    timestamp: str
    rain_mm_h: float | None
    wind_kmh: float | None = None
    wind_direction_deg: float | None = None

class SpatialForcing(BaseModel):
    source: str = 'Open-Meteo hourly precipitation'
    kind: str = 'forecast'
    retrieved_at: str
    start_time: str
    step_seconds: int = 3600
    rain_units: str = 'mm/h (hourly precipitation total / 1 h)'
    spatial_support: str = 'single weather model grid point; uniform over Manga'
    hours: list[SpatialHour] = Field(default_factory=list)

def make_spatial_forcing(hourly: list[dict], count: int, now: datetime | None = None) -> SpatialForcing:
    tz=ZoneInfo('America/Bogota')
    now=now or datetime.now(tz)
    if now.tzinfo is None: now=now.replace(tzinfo=tz)
    start=now.astimezone(tz).replace(minute=0,second=0,microsecond=0)
    lookup={}
    for row in hourly:
        try:
            stamp=datetime.fromisoformat(row['time'])
            if stamp.tzinfo is None: stamp=stamp.replace(tzinfo=tz)
            lookup[stamp.astimezone(tz)]=row
        except (KeyError,TypeError,ValueError): continue
    def finite(v):
        return float(v) if isinstance(v,(int,float)) and math.isfinite(v) else None
    hours=[]
    for i in range(count):
        stamp=start+timedelta(hours=i);row=lookup.get(stamp,{})
        rain=None if row.get('precipitation_missing',False) else finite(row.get('precipitation'))
        if rain is not None and rain<0: rain=None
        hours.append(SpatialHour(hour=i,timestamp=stamp.isoformat(),rain_mm_h=rain,wind_kmh=finite(row.get('wind_speed_10m')),wind_direction_deg=finite(row.get('wind_direction_10m'))))
    return SpatialForcing(retrieved_at=now.isoformat(),start_time=start.isoformat(),hours=hours)
