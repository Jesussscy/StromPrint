"""
StormPrint :: physics_engine.py
Motor de ecuaciones diferenciales de segundo orden para el modelo territorial
de acumulacion de agua en Manga, Cartagena de Indias.

 ========================================================================
 ECUACION DIFERENCIAL DE SEGUNDO ORDEN (EDO):
 ========================================================================

   m * H''(t) + c(t) * H'(t) + k(t) * H(t) = F_rain(t) + F_tide(t) + F_wind(t)

 Donde:
   H(t)       -> nivel acumulado de agua en el territorio (cm)
   H'(t)      -> velocidad de cambio del nivel (cm/h)
   H''(t)     -> aceleracion del nivel (cm/h^2)
   m          -> inercia de la masa hidrica (resistencia al cambio)
   c(t)       -> coeficiente de amortiguamiento temporal (capacidad de drenaje)
   k(t)       -> rigidez temporal del terreno (absorcion natural)
   F_rain(t)  -> termino de forzamiento por lluvia (pulso gaussiano)
   F_tide(t)  -> termino de forzamiento por marea (semidiurno + envolvente)
   F_wind(t)  -> termino de forzamiento por viento (empuje de marea)

 ========================================================================
 FORMA INTEGRAL EQUIVALENTE (Ecuacion de Volterra de 2da especie):
 ========================================================================

 Integrando dos veces la EDO desde 0 hasta t:

   H(t) = (1/m) * integral_0^t integral_0^s {
       F_rain(tau) + F_tide(tau) + F_wind(tau)
       - c(s) * H'(s) - k(s) * H(s)
   } dtau ds

 Esta forma integral es equivalente y demuestra que H(t) depende de toda
 la historia del sistema (memoria integral), no solo del estado actual.

 ========================================================================
 TRANSFORMACION A SISTEMA DE PRIMER ORDEN (para solve_ivp):
 ========================================================================

 Sea y = [H, H']:
   dy/dt = [y[1], (F_total(t) - c(t)*y[1] - k(t)*y[0]) / m]

 Condiciones iniciales: H(0) = nivel de equilibrio de la marea real (si hay
   serie; si no, 0) y H'(0) = 0. La siembra evita el transitorio artificial
   de arrancar desde seco cuando la marea ya esta alta "ahora".

 Se resuelve numericamente con scipy.integrate.solve_ivp (Runge-Kutta 45).

 ========================================================================
 VARIABLES AMBIENTALES QUE MODULAN c(t) y k(t):
 ========================================================================

   c(t) = c_0 * max(0.2, 1 - d_consecutivos * 0.1)
     -> Dias lluviosos consecutivos satures el alcantarillado

   k(t) = k_0 * (1 + h_suelo * 0.5)
     -> Suelo humedo reduce la capacidad de absorcion

   F_wind(t) = wind_gain * viento_vel * push_factor * sin(2*pi*t / T_tide)
     -> Vientos del sur/oeste empujan marea hacia la bahia (mar de levante)
"""

import math
from dataclasses import dataclass, field
from typing import List

import numpy as np
from scipy.integrate import solve_ivp

from .zonas import ParametrosZona, bajura_cm

# ---------------------------------------------------------------------------
# Umbrales de clasificacion de riesgo (en espanol)
# ---------------------------------------------------------------------------
RISK_THRESHOLD_NORMAL = 30.0      # cm — Normal (cota de calle Manga ~1.2 msnm)
RISK_THRESHOLD_ALERTA = 60.0      # cm — Alerta (calles inundadas)
RISK_THRESHOLD_EMERGENCIA = 100.0 # cm — Emergencia (entrada a viviendas)

# Calibracion de la serie de marea REAL (Open-Meteo Marine, en cm sobre el
# nivel medio del mar). La serie incluye el ciclo spring/neap real: en marea
# viva la desviacion pico puede llegar a ~±26 cm, y un dia seco debe quedar
# SIEMPRE en riesgo "Normal" (< 30 cm), igual que con la senoide analitica
# (que calibra ~max 20 cm con MSL=8). Sin este factor la serie real empujaba
# los dias secos a "Emergencia" en marea viva (~59 cm medido en experimentos).
# El factor es el cociente entre la respuesta analitica objetivo (~20 cm) y
# la respuesta sin calibrar de una marea viva tipica (~44 cm).
TIDE_SERIES_SCALE = 0.45


@dataclass
class PhysicalParameters:
    """Parametros fisicos del modelo territorial de Manga."""

    mass: float = 1.0              # m  — inercia de la masa hidrica
    damping: float = 0.45          # c_0 — coeficiente base de amortiguamiento
    stiffness: float = 0.65        # k_0 — rigidez base del terreno
    rain_gain: float = 3.2         # escala lluvia -> unidades de fuerza
    tide_gain: float = 1.1         # escala marea -> unidades de fuerza
    tide_period_h: float = 12.42   # periodo semidiurno de marea (horas)
    wind_gain: float = 0.8         # escala viento -> forzamiento de marea
    soil_humidity: float = 0.3     # h_suelo — humedad del suelo estimada (0-1)
    consecutive_rainy_days: int = 0  # d — dias lluviosos consecutivos
    rain_duration_h: float = 6.0   # duracion de la tormenta (h, sigma de la gaussiana)
    wind_direction_deg: float = 0.0  # direccion del viento (grados)
    wind_speed_kmh: float = 0.0    # velocidad del viento (km/h)
    mean_sea_level: float = 8.0    # nivel medio del mar para marea (cm)
    storm_peak_hour: float = 12.0  # hora del pico de lluvia (h) — se llena por el motor
    storm_intensity: float = 25.0  # intensidad pico de lluvia (mm/h) — se llena por el motor
    tide_series_cm: List[float] = field(default_factory=list)  # marea real horaria (cm)


# ---------------------------------------------------------------------------
# Funciones de amortiguamiento y rigidez dependientes del tiempo
# ---------------------------------------------------------------------------
def effective_damping(t: float, params: PhysicalParameters) -> float:
    """
    c(t) = c_0 * (1 - saturacion) * max(0.2, 1 - d * 0.1)

    Dias consecutivos de lluvia saturan el sistema de alcantarillado,
    reduciendo la capacidad de evacuacion. Ademas, la lluvia del evento en
    curso satura el drenaje cerca del pico de la tormenta, por lo que el
    amortiguamiento efectivo baja conforme el pulso de lluvia gana intensidad.
    """
    d = params.consecutive_rainy_days
    factor = max(0.2, 1.0 - d * 0.1)
    c0 = params.damping * factor

    # Saturacion por el evento actual: gaussiana centrada en el pico de lluvia.
    sigma = max(1.0, params.rain_duration_h)
    rain = params.storm_intensity * math.exp(-((t - params.storm_peak_hour) ** 2) / (2 * sigma ** 2))
    sat = min(0.55, rain * 0.004)
    return c0 * (1.0 - sat)


def effective_stiffness(t: float, params: PhysicalParameters) -> float:
    """
    k(t) = k_0 * (1 + h_suelo * 0.5) * (1 + saturacion)

    Si el suelo esta humedo, absorbe menos agua y la rigidez efectiva
    del terreno aumenta (el agua se queda en superficie); el agua de lluvia
    del evento actual incrementa esa saturacion cerca del pico.
    """
    k0 = params.stiffness * (1.0 + params.soil_humidity * 0.5)

    sigma = max(1.0, params.rain_duration_h)
    rain = params.storm_intensity * math.exp(-((t - params.storm_peak_hour) ** 2) / (2 * sigma ** 2))
    sat = min(0.6, rain * 0.005)
    return k0 * (1.0 + sat)


# ---------------------------------------------------------------------------
# Terminos de forzamiento
# ---------------------------------------------------------------------------
def rain_forcing(
    t: float,
    storm_peak_hour: float,
    storm_intensity: float,
    params: PhysicalParameters,
) -> float:
    """
    Forzamiento de lluvia modelado como pulso gaussiano centrado en
    storm_peak_hour, representando un evento convectivo tropical tipico
    de la temporada de lluvias de Cartagena (Ago-Nov).

    F_rain(t) = I_pico * exp(-(t - t_pico)^2 / (2 * sigma^2))

    Donde sigma = rain_duration_h determina la duracion de la tormenta.
    """
    sigma = params.rain_duration_h
    if sigma <= 0:
        sigma = 6.0
    gaussian = math.exp(-((t - storm_peak_hour) ** 2) / (2 * sigma ** 2))
    return storm_intensity * gaussian


def tide_forcing(t: float, params: PhysicalParameters) -> float:
    """
    Forzamiento de marea como senoide semidiurna acoplada con una
    envolvente lenta de mareas de spring/neap, reflejando el regimen
    de mareas de la Bahia de Cartagena que actua sobre la costa baja
    de Manga.

    F_tide(t) = tide_gain * MSL * sin(2*pi*t / T) * (1 + 0.25*sin(2*pi*t / T_spring))
    """
    # Si hay marea real (Open-Meteo Marine) se usa la serie horaria; el
    # indice 0 de la serie corresponde a la hora actual de la simulacion.
    # La serie se entrega como nivel absoluto; se resta su media para que el
    # forzamiento OS C I L E alrededor de cero, igual que la senoide analitica
    # (un nivel absoluto constante inflaria los dias secos).
    if params.tide_series_cm:
        serie = params.tide_series_cm
        idx = int(round(t))
        if 0 <= idx < len(serie):
            nivel = float(serie[idx])
        elif len(serie) >= 2:
            period = max(1, int(round(params.tide_period_h)))
            cycle = list(serie[-period:])
            nivel = float(cycle[idx % len(cycle)]) if cycle else params.mean_sea_level
        else:
            nivel = params.mean_sea_level
        media = sum(serie) / len(serie)
        # Oscilacion en torno al nivel medio del mar, escalada por el gain y
        # CALIBRADA (TIDE_SERIES_SCALE) para que la marea real tenga el mismo
        # regimen que la senoide analitica en dias secos (ver constante).
        return params.tide_gain * (nivel - media) * TIDE_SERIES_SCALE

    semi_diurnal = math.sin(2 * math.pi * t / params.tide_period_h)
    # Envolvente spring/neap (ciclo de ~14.77 dias)
    envelope = 1.0 + 0.25 * math.sin(2 * math.pi * t / (24 * 14.77))
    return params.tide_gain * params.mean_sea_level * semi_diurnal * envelope


def wind_tide_forcing(t: float, params: PhysicalParameters) -> float:
    """
    Forzamiento del viento sobre la marea (mar de levante).

    Vientos del sur (180) y oeste (270) empujan agua de la bahia
    hacia la costa de Manga. El factor de empuje es maximo cuando
    la direccion del viento esta entre 135 y 270 grados.
    """
    if params.wind_speed_kmh <= 0:
        return 0.0

    # Calcular factor de empuje segun direccion
    d = params.wind_direction_deg
    if 135 <= d <= 270:
        # Sur/Oeste: empuje maximo hacia Manga
        push_factor = 1.0
    elif 90 <= d < 135:
        # Sureste: empuje parcial
        push_factor = (d - 90) / 45.0 * 0.6
    elif 270 < d <= 315:
        # Noroeste: empuje parcial
        push_factor = (315 - d) / 45.0 * 0.6
    else:
        # Norte/Noreste: sin empuje o efecto minimo
        push_factor = 0.0

    # Oscilacion sincronizada con la marea
    tide_oscillation = math.sin(2 * math.pi * t / params.tide_period_h)
    return params.wind_gain * params.wind_speed_kmh * push_factor * tide_oscillation


def total_forcing(t: float, storm_peak: float, storm_intensity: float, params: PhysicalParameters) -> float:
    """Suma de todos los terminos de forzamiento."""
    f_rain = rain_forcing(t, storm_peak, storm_intensity, params) * params.rain_gain
    f_tide = tide_forcing(t, params)
    f_wind = wind_tide_forcing(t, params)
    return f_rain + f_tide + f_wind


# ---------------------------------------------------------------------------
# Clasificacion de riesgo en espanol
# ---------------------------------------------------------------------------
def classify_risk_spanish(water_level_cm: float) -> str:
    """Clasifica el nivel de riesgo en categorias en espanol."""
    if water_level_cm >= RISK_THRESHOLD_EMERGENCIA:
        return "Critico"
    if water_level_cm >= RISK_THRESHOLD_ALERTA:
        return "Emergencia"
    if water_level_cm >= RISK_THRESHOLD_NORMAL:
        return "Alerta"
    return "Normal"


def classify_risk_english(water_level_cm: float) -> str:
    """Clasificacion en ingles (para backwards compatibility)."""
    if water_level_cm >= RISK_THRESHOLD_EMERGENCIA:
        return "critical"
    if water_level_cm >= RISK_THRESHOLD_ALERTA:
        return "high"
    if water_level_cm >= RISK_THRESHOLD_NORMAL:
        return "moderate"
    return "low"


# ---------------------------------------------------------------------------
# Metricas avanzadas
# ---------------------------------------------------------------------------
def compute_advanced_metrics(records: List[dict]) -> dict:
    """Calcula metricas avanzadas a partir de los registros de simulacion."""
    if not records:
        return {}

    water_levels = [r["water_level_cm"] for r in records]
    rain_intensities = [r.get("rain_intensity", 0) for r in records]
    hours = [r["hour"] for r in records]

    max_level = max(water_levels)
    max_level_idx = water_levels.index(max_level)
    peak_hour = hours[max_level_idx]

    # Acumulado total de lluvia (integral numerica trapezoidal)
    total_rain = 0.0
    for i in range(1, len(records)):
        dt = hours[i] - hours[i - 1]
        total_rain += (rain_intensities[i] + rain_intensities[i - 1]) / 2.0 * dt

    # Horas con lluvia significativa (> 0.1 mm/h)
    hours_with_rain = sum(1 for r in rain_intensities if r > 0.1)

    # Eficiencia promedio de drenaje
    drainage_values = [r.get("drainage_efficiency", 1.0) for r in records]
    avg_drainage = sum(drainage_values) / len(drainage_values) if drainage_values else 1.0

    # Nivel promedio
    avg_level = sum(water_levels) / len(water_levels)

    # Estado dominante
    risk_counts = {}
    for r in records:
        risk = r.get("risk_level", "Normal")
        risk_counts[risk] = risk_counts.get(risk, 0) + 1
    dominant_risk = max(risk_counts, key=risk_counts.get) if risk_counts else "Normal"

    return {
        "max_water_level_cm": round(max_level, 3),
        "peak_hour": round(peak_hour, 1),
        "total_rain_mm": round(total_rain, 2),
        "hours_with_rain": hours_with_rain,
        "avg_drainage_efficiency": round(avg_drainage, 3),
        "avg_water_level_cm": round(avg_level, 3),
        "dominant_risk": dominant_risk,
        "total_points": len(records),
    }


# ---------------------------------------------------------------------------
# Condicion inicial coherente con la marea real
# ---------------------------------------------------------------------------
def initial_level(params: PhysicalParameters) -> float:
    """Nivel inicial H(0) coherente con el forzamiento actual.

    Antes se arrancaba siempre en H(0)=0 (territorio seco), lo que generaba un
    transitorio artificial y hacia que records[0] fuese 0 aunque la marea
    estuviera alta EN ESTE MOMENTO. Con una marea real se siembra el nivel en
    el equilibrio estatico F_tide(0)/k(0) (la asintota de la solucion), por lo
    que records[0] es directamente el nivel de agua ACTUAL y se elimina el
    pico artificial de arranque. Sin serie activa, devuelve 0 (test: dia seco
    -> 0)."""
    if not params.tide_series_cm:
        return 0.0
    serie = params.tide_series_cm
    if not any(v != 0.0 for v in serie):
        return 0.0  # serie toda ceros (fallback): no hay nivel por siembra
    f0 = tide_forcing(0.0, params)  # ya incluye TIDE_SERIES_SCALE
    k0 = effective_stiffness(0.0, params)
    if k0 <= 0:
        return 0.0
    eq = f0 / k0
    # El nivel no arranca en negativo (el agua no se "hunde").
    return max(0.0, eq)


# ---------------------------------------------------------------------------
# Solucion numerica de la EDO
# ---------------------------------------------------------------------------
def run_simulation(
    duration_hours: float = 72.0,
    resolution_hours: float = 1.0,
    storm_peak_hour: float = 12.0,
    storm_intensity: float = 25.0,
    mean_sea_level: float = 8.0,
    params: PhysicalParameters | None = None,
) -> List[dict]:
    """
    Resuelve la EDO de segundo orden:

        m * H''(t) + c(t) * H'(t) + k(t) * H(t) = F_total(t)

    sobre el intervalo [0, duration_hours] y retorna un series temporales
    por hora con nivel de agua, forzamientos, y clasificacion de riesgo.

    Implementa la forma integral de Volterra resuelta como sistema de
    primer orden con scipy.integrate.solve_ivp (Runge-Kutta 45).
    """
    p = params or PhysicalParameters()
    p.storm_peak_hour = float(storm_peak_hour)
    p.storm_intensity = float(storm_intensity)
    p.mean_sea_level = float(mean_sea_level)

    def system(t: float, y: np.ndarray) -> List[float]:
        """
        Sistema de primer orden equivalente:
            y[0] = H(t)      -> nivel de agua
            y[1] = H'(t)     -> velocidad de cambio
            y[1]' = H''(t)   -> aceleracion
        """
        H, dH = y
        c_t = effective_damping(t, p)
        k_t = effective_stiffness(t, p)
        F = total_forcing(t, storm_peak_hour, storm_intensity, p)

        d2H = (F - c_t * dH - k_t * H) / p.mass
        return [dH, d2H]

    t_eval = np.arange(0, duration_hours, resolution_hours)

    # H(0) se siembra al equilibrio estatico de la marea real (si hay serie):
    # records[0] = nivel actual y se elimina el transitorio artificial.
    h0 = initial_level(p)
    solution = solve_ivp(
        fun=system,
        t_span=(0, duration_hours),
        y0=[h0, 0.0],
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
        dH = float(solution.y[1][idx])

        c_t = effective_damping(t, p)
        k_t = effective_stiffness(t, p)
        rain_val = rain_forcing(t, storm_peak_hour, storm_intensity, p)
        tide_val = tide_forcing(t, p)
        wind_val = wind_tide_forcing(t, p)
        soil_sat = min(1.0, p.soil_humidity + rain_val * 0.01)
        drain_eff = max(0.2, 1.0 - p.consecutive_rainy_days * 0.1)

        records.append(
            {
                "hour": float(t),
                "water_level_cm": round(H, 4),
                "rain_intensity": round(max(0.0, rain_val), 4),
                "tide_level": round(tide_val, 4),
                "wind_effect": round(wind_val, 4),
                "f_lluvia": round(max(0.0, rain_val * p.rain_gain), 4),
                "f_marea": round(tide_val, 4),
                "f_viento": round(wind_val, 4),
                "soil_saturation": round(soil_sat, 3),
                "drainage_efficiency": round(drain_eff, 3),
                "risk_level": classify_risk_spanish(H),
                "dH_dt": round(dH, 4),
                "accumulation_rate": round(dH, 4),
            }
        )

    return records


# ---------------------------------------------------------------------------
# Parametros individuales por zona critica
# ---------------------------------------------------------------------------
def _mapa_drenaje(drenaje: str) -> float:
    """Drenaje -> amortiguamiento c_0.

    Mal drenaje (bajo) evacua lento: el agua se acumula (c pequeno).
    Buen drenaje (alto) evacua rapido: el agua no sube (c grande).
    """
    return {"bajo": 0.14, "medio": 0.45, "alto": 0.80}.get(drenaje, 0.45)


def _mapa_rigidez(rigidez: str) -> float:
    """Rigidez del suelo -> constante de rigidez k_0.

    Blando absorbe mas agua (la saca de la superficie): k grande deprime el
    nivel. Duro (pavimento) retiene la lamina en la calle: k pequeno deja
    subir el nivel. (Estado estacionario H = F/k.)
    """
    return {"blando": 0.85, "medio": 0.65, "duro": 0.42}.get(rigidez, 0.65)


def _exposicion_gain(exposicion_pct: float, min_gain: float, max_gain: float) -> float:
    """Mapeo lineal 0-100% de exposicion a la escala del forzamiento."""
    pct = max(0.0, min(100.0, float(exposicion_pct)))
    return min_gain + (max_gain - min_gain) * pct / 100.0


def parametros_por_zona(base: PhysicalParameters, zona: ParametrosZona) -> PhysicalParameters:
    """Deriva los parametros fisicos de una zona a partir de los globales.

    Cada zona ajusta los tres factores de escala (lluvia/marea/viento) segun
    su exposicion local y su drenaje/rigidez. El resto del escenario
    meteorologico se hereda del experimento global.
    """
    return PhysicalParameters(
        mass=base.mass,
        damping=_mapa_drenaje(zona.drenaje),
        stiffness=_mapa_rigidez(zona.rigidez_suelo),
        rain_gain=_exposicion_gain(zona.exposicion_lluvia_pct, 0.8, 5.5),
        tide_gain=_exposicion_gain(zona.exposicion_marea_pct, 0.3, 1.5),
        wind_gain=_exposicion_gain(zona.exposicion_viento_pct, 0.2, 1.3),
        tide_period_h=base.tide_period_h,
        soil_humidity=base.soil_humidity,
        consecutive_rainy_days=base.consecutive_rainy_days,
        rain_duration_h=base.rain_duration_h,
        wind_direction_deg=base.wind_direction_deg,
        wind_speed_kmh=base.wind_speed_kmh,
        mean_sea_level=base.mean_sea_level,
        storm_peak_hour=base.storm_peak_hour,
        storm_intensity=base.storm_intensity,
        tide_series_cm=base.tide_series_cm,
    )


def _punto_zona(record: dict, bajura: float) -> dict:
    """Un punto de la serie de una zona: nivel neto (columna real sobre el
    terreno, bajura descontada), riesgo reclasificado y forzamientos."""
    neto = max(0.0, record["water_level_cm"] - bajura)
    return {
        "tiempo_hora": int(record["hour"]),
        "nivel_agua_cm": round(neto, 2),
        "estado": classify_risk_spanish(neto),
        "velocidad_cambio": round(record.get("dH_dt", 0.0), 3),
        "f_lluvia": round(record.get("f_lluvia", 0.0), 2),
        "f_marea": round(record.get("f_marea", 0.0), 2),
        "f_viento": round(record.get("f_viento", 0.0), 2),
        "rain_intensity": round(record.get("rain_intensity", 0.0), 2),
        "tide_level": round(record.get("tide_level", 0.0), 2),
        "drainage_efficiency": round(record.get("drainage_efficiency", 1.0), 3),
    }


def run_zones_simulation(
    duration_hours: float = 72.0,
    storm_peak_hour: float = 12.0,
    storm_intensity: float = 25.0,
    mean_sea_level: float = 8.0,
    base_params: PhysicalParameters | None = None,
    zonas: "list[ParametrosZona] | None" = None,
) -> List[dict]:
    """Simula la EDO UNA VEZ POR ZONA, con sus 6 parametros propios.

    Cada zona resuelve su propio H(t) (misma tormenta, distinta exposicion,
    drenaje, rigidez y cota de terreno). Devuelve, por zona, la serie neta,
    el nivel actual/maximo, su propia hora de pico y el riesgo pico/actual.
    """
    if zonas is None:
        from .zonas import PARAMETROS_ZONAS

        zonas = list(PARAMETROS_ZONAS.values())
    base = base_params or PhysicalParameters()

    resultados: List[dict] = []
    for z in zonas:
        pz = parametros_por_zona(base, z)
        records = run_simulation(
            duration_hours=duration_hours,
            resolution_hours=1.0,
            storm_peak_hour=storm_peak_hour,
            storm_intensity=storm_intensity,
            mean_sea_level=mean_sea_level,
            params=pz,
        )
        bajura = bajura_cm(z.altura_base_m)
        puntos = [_punto_zona(r, bajura) for r in records]

        max_point = max(puntos, key=lambda p: p["nivel_agua_cm"])
        actual = puntos[0]
        resultados.append(
            {
                "id": z.id,
                "nombre": z.nombre,
                "altura_base_m": z.altura_base_m,
                "drenaje": z.drenaje,
                "rigidez_suelo": z.rigidez_suelo,
                "exposicion_marea_pct": z.exposicion_marea_pct,
                "exposicion_lluvia_pct": z.exposicion_lluvia_pct,
                "exposicion_viento_pct": z.exposicion_viento_pct,
                "nivel_actual_cm": round(actual["nivel_agua_cm"], 2),
                "nivel_maximo_cm": round(max_point["nivel_agua_cm"], 2),
                "hora_pico": float(max_point["tiempo_hora"]),
                "riesgo_actual": actual["estado"],
                "riesgo_pico": max_point["estado"],
                "puntos": puntos,
            }
        )
    return resultados
