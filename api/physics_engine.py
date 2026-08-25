"""
StormPrint :: physics_engine.py
Numerical solver for the territorial water-accumulation model in Manga,
Cartagena de Indias.

    m * H''(t) + c * H'(t) + k * H(t) = F_rain(t) + F_tide(t)

Where:
    H(t)  -> accumulated water height on the territory (cm)
    m     -> inertial mass of the hydric mass (system resistance to change)
    c     -> drainage damping coefficient (storm-drain evacuation capacity)
    k     -> terrain "restoring stiffness" (natural absorption / elevation)
    F_rain(t)  -> forcing term from rainfall intensity
    F_tide(t)  -> forcing term from Caribbean Sea tidal coupling (Manga is
                  a peninsula bounded by the Cartagena Bay)

Solved as a first-order system with scipy.integrate.solve_ivp (RK45).
"""

import math
from dataclasses import dataclass
from typing import Callable, List

import numpy as np
from scipy.integrate import solve_ivp

RISK_THRESHOLD_MODERATE = 15.0
RISK_THRESHOLD_HIGH = 30.0
RISK_THRESHOLD_CRITICAL = 45.0


@dataclass
class PhysicalParameters:
    mass: float = 1.0          # m — inertia of the hydric mass
    damping: float = 0.45      # c — storm-drain / gravity drainage coefficient
    stiffness: float = 0.65    # k — terrain absorption & elevation stiffness
    rain_gain: float = 3.2     # scales rainfall intensity into forcing units
    tide_gain: float = 1.1     # scales tidal oscillation into forcing units
    tide_period_h: float = 12.42  # semi-diurnal tidal period (hours)


def rain_forcing(t: float, storm_peak_hour: float, storm_intensity: float, storm_width: float) -> float:
    """
    Rainfall forcing modeled as a Gaussian storm pulse centered at
    `storm_peak_hour`, representing a tropical convective event typical
    of Cartagena's rainy season (Aug–Nov).
    """
    gaussian = math.exp(-((t - storm_peak_hour) ** 2) / (2 * storm_width ** 2))
    return storm_intensity * gaussian


def tide_forcing(t: float, params: PhysicalParameters, mean_sea_level: float) -> float:
    """
    Tidal forcing as a semi-diurnal sinusoid coupled with a slow spring/neap
    envelope, reflecting the Cartagena Bay's tidal regime acting on Manga's
    low-lying shoreline.
    """
    semi_diurnal = math.sin(2 * math.pi * t / params.tide_period_h)
    envelope = 1.0 + 0.25 * math.sin(2 * math.pi * t / (24 * 14.77))
    return params.tide_gain * mean_sea_level * semi_diurnal * envelope


def classify_risk(water_level_cm: float) -> str:
    if water_level_cm >= RISK_THRESHOLD_CRITICAL:
        return "critical"
    if water_level_cm >= RISK_THRESHOLD_HIGH:
        return "high"
    if water_level_cm >= RISK_THRESHOLD_MODERATE:
        return "moderate"
    return "low"


def run_simulation(
    duration_hours: float = 168.0,
    resolution_hours: float = 1.0,
    storm_peak_hour: float = 36.0,
    storm_intensity: float = 42.0,
    storm_width: float = 6.0,
    mean_sea_level: float = 8.0,
    params: PhysicalParameters | None = None,
) -> List[dict]:
    """
    Solves H(t) over [0, duration_hours] and returns a per-hour timeseries
    of water level, rainfall forcing, tidal level and risk classification,
    ready for persistence and frontend consumption.
    """
    p = params or PhysicalParameters()

    def forcing(t: float) -> float:
        return rain_forcing(t, storm_peak_hour, storm_intensity, storm_width) * p.rain_gain + tide_forcing(
            t, p, mean_sea_level
        )

    def system(t: float, y: np.ndarray) -> List[float]:
        H, dH = y
        d2H = (forcing(t) - p.damping * dH - p.stiffness * H) / p.mass
        return [dH, d2H]

    t_eval = np.arange(0, duration_hours + resolution_hours, resolution_hours)

    solution = solve_ivp(
        fun=system,
        t_span=(0, duration_hours),
        y0=[0.0, 0.0],
        method="RK45",
        t_eval=t_eval,
        rtol=1e-6,
        atol=1e-8,
    )

    if not solution.success:
        raise RuntimeError(f"ODE integration failed: {solution.message}")

    records: List[dict] = []
    for idx, t in enumerate(solution.t):
        H = max(0.0, float(solution.y[0][idx]))
        rain_val = rain_forcing(t, storm_peak_hour, storm_intensity, storm_width)
        tide_val = tide_forcing(t, p, mean_sea_level)
        records.append(
            {
                "hour": float(t),
                "water_level_cm": H,
                "rain_intensity": max(0.0, rain_val),
                "tide_level": tide_val,
                "risk_level": classify_risk(H),
            }
        )
    return records
