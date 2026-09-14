"""
StormPrint :: zonas.py
Parametros fisicos INDIVIDUALES de las 20 zonas criticas de Manga.

Cada zona rompe la simulacion global en un experimento propio: el motor
resuelve H(t) 20 veces, una por zona, escalando las mismas fuerzas
meteorologicas segun la exposicion local y ajustando drenaje y rigidez
del terreno.

6 parametros por zona (pedido/aceptacion):
  altura_base_m        : elevacion del terreno (0.5 - 1.4 m). Cuanto mas
                         baja la zona, mas profundo llega el mismo nivel de
                         agua: nivel_agua = max(0, H(t) - (altura_base - 0.5)*100).
  drenaje              : bajo | medio | alto  -> amortiguamiento c(t).
                         Mal drenaje = poca evacuacion = el agua se acumula.
  rigidez_suelo        : blando | medio | duro -> rigidez k(t).
                         Blando absorbe mas agua del suelo y deja menos en
                         superficie; el duro (pavimento) la retiene.
  exposicion_marea_pct : 0-100 escala el forzamiento de marea (tide_gain).
  exposicion_lluvia_pct: 0-100 escala el forzamiento de lluvia (rain_gain).
  exposicion_viento_pct: 0-100 escala el forzamiento de viento (wind_gain).
"""

from dataclasses import dataclass
from typing import Literal

DrenajeNivel = Literal["bajo", "medio", "alto"]
RigidezSuelo = Literal["blando", "medio", "duro"]


@dataclass(frozen=True)
class ParametrosZona:
    id: int
    nombre: str
    altura_base_m: float
    drenaje: DrenajeNivel
    rigidez_suelo: RigidezSuelo
    exposicion_marea_pct: float
    exposicion_lluvia_pct: float
    exposicion_viento_pct: float


# Curva de referencia para la bajura: 0.5 m = la cota mas baja de Manga.
ALTURA_BASE_MIN_M = 0.5


def bajura_cm(altura_base_m: float) -> float:
    """Desnivel (cm) entre la zona y la cota de referencia minima.

    Una zona a 0.5 m ve el agua a plena columna (bajura 0); una zona a 1.4 m
    esta 90 cm por encima y el agua le llega 90 cm menos profunda.
    """
    return max(0.0, (altura_base_m - ALTURA_BASE_MIN_M) * 100.0)


PARAMETROS_ZONAS: dict[int, ParametrosZona] = {}


def _registrar(*zonas: ParametrosZona) -> None:
    for z in zonas:
        PARAMETROS_ZONAS[z.id] = z


# ── Borde de la Bahia (Marea Alta) ───────────────────────────────────────────
# Zonas a cota muy baja frente al mar: drenaje pobre (malecón pavimentado),
# rigidez dura (pavimento, poca absorcion) y exposicion maxima a marea/viento.
_registrar(
    ParametrosZona(
        id=1, nombre="Av. Miramar × Calle 24",
        altura_base_m=0.60, drenaje="bajo", rigidez_suelo="duro",
        exposicion_marea_pct=90, exposicion_lluvia_pct=70, exposicion_viento_pct=60,
    ),
    ParametrosZona(
        id=2, nombre="Av. Miramar (C25-26)",
        altura_base_m=0.66, drenaje="bajo", rigidez_suelo="duro",
        exposicion_marea_pct=90, exposicion_lluvia_pct=75, exposicion_viento_pct=80,
    ),
    ParametrosZona(
        id=3, nombre="Av. Miramar × Calle 27",
        altura_base_m=0.90, drenaje="medio", rigidez_suelo="duro",
        exposicion_marea_pct=78, exposicion_lluvia_pct=48, exposicion_viento_pct=55,
    ),
    ParametrosZona(
        id=4, nombre="Carrera 23 × Calle 28",
        altura_base_m=0.96, drenaje="medio", rigidez_suelo="medio",
        exposicion_marea_pct=80, exposicion_lluvia_pct=65, exposicion_viento_pct=60,
    ),
    ParametrosZona(
        id=5, nombre="C24 × C25 (Pte. Román)",
        altura_base_m=0.72, drenaje="bajo", rigidez_suelo="duro",
        exposicion_marea_pct=85, exposicion_lluvia_pct=78, exposicion_viento_pct=60,
    ),
)

# ── Borde Cienaga de Las Quintas (Marea + Drenaje) ───────────────────────────
# La ciénaga regresa hacia las viviendas: zona mas baja del barrio en el
# Callejón Dandy. Suelo duro (patios pavimentados) que retiene el agua.
_registrar(
    ParametrosZona(
        id=6, nombre="Callejón Dandy (C29A)",
        altura_base_m=0.52, drenaje="bajo", rigidez_suelo="duro",
        exposicion_marea_pct=86, exposicion_lluvia_pct=75, exposicion_viento_pct=60,
    ),
    ParametrosZona(
        id=7, nombre="Carrera 23A × Calle 29B",
        altura_base_m=0.80, drenaje="bajo", rigidez_suelo="medio",
        exposicion_marea_pct=78, exposicion_lluvia_pct=72, exposicion_viento_pct=50,
    ),
    ParametrosZona(
        id=8, nombre="Calle 29 × Carrera 22",
        altura_base_m=0.98, drenaje="bajo", rigidez_suelo="medio",
        exposicion_marea_pct=55, exposicion_lluvia_pct=75, exposicion_viento_pct=40,
    ),
    ParametrosZona(
        id=9, nombre="Calle 29A × Carrera 21",
        altura_base_m=1.12, drenaje="medio", rigidez_suelo="blando",
        exposicion_marea_pct=45, exposicion_lluvia_pct=60, exposicion_viento_pct=30,
    ),
    ParametrosZona(
        id=10, nombre="Pte. Las Palmas → C29",
        altura_base_m=0.95, drenaje="medio", rigidez_suelo="duro",
        exposicion_marea_pct=70, exposicion_lluvia_pct=70, exposicion_viento_pct=45,
    ),
)

# ── Ejes Viales Internos (Acumulacion Pluvial) ───────────────────────────────
# Zonas algo mas elevadas: dominadas por lluvia, con poca marea/viento.
_registrar(
    ParametrosZona(
        id=11, nombre="Av. Brujo (C26×C24)",
        altura_base_m=1.10, drenaje="medio", rigidez_suelo="medio",
        exposicion_marea_pct=22, exposicion_lluvia_pct=30, exposicion_viento_pct=25,
    ),
    ParametrosZona(
        id=12, nombre="Av. Brujo (C26×C22)",
        altura_base_m=1.15, drenaje="medio", rigidez_suelo="blando",
        exposicion_marea_pct=18, exposicion_lluvia_pct=58, exposicion_viento_pct=20,
    ),
    ParametrosZona(
        id=13, nombre="C. Trébol (C28×C22)",
        altura_base_m=1.10, drenaje="medio", rigidez_suelo="medio",
        exposicion_marea_pct=25, exposicion_lluvia_pct=60, exposicion_viento_pct=30,
    ),
    ParametrosZona(
        id=14, nombre="C. Trébol (C28×C25)",
        altura_base_m=1.08, drenaje="medio", rigidez_suelo="medio",
        exposicion_marea_pct=30, exposicion_lluvia_pct=62, exposicion_viento_pct=28,
    ),
    ParametrosZona(
        id=15, nombre="C25 Jiménez × C21",
        altura_base_m=1.33, drenaje="alto", rigidez_suelo="blando",
        exposicion_marea_pct=15, exposicion_lluvia_pct=35, exposicion_viento_pct=15,
    ),
)

# ── Intersecciones Residenciales Bajas (Drenaje) ─────────────────────────────
# Sector mas elevado y con buen drenaje: riesgo minimo incluso en tormenta.
_registrar(
    ParametrosZona(
        id=16, nombre="Carrera 26 × Calle 27",
        altura_base_m=1.35, drenaje="alto", rigidez_suelo="medio",
        exposicion_marea_pct=8, exposicion_lluvia_pct=20, exposicion_viento_pct=10,
    ),
    ParametrosZona(
        id=17, nombre="Carrera 27 × Calle 26",
        altura_base_m=1.38, drenaje="alto", rigidez_suelo="medio",
        exposicion_marea_pct=10, exposicion_lluvia_pct=30, exposicion_viento_pct=10,
    ),
    ParametrosZona(
        id=18, nombre="Carrera 25 × Calle 29",
        altura_base_m=1.40, drenaje="alto", rigidez_suelo="blando",
        exposicion_marea_pct=12, exposicion_lluvia_pct=28, exposicion_viento_pct=8,
    ),
    ParametrosZona(
        id=19, nombre="Carrera 21 × Calle 26",
        altura_base_m=1.30, drenaje="alto", rigidez_suelo="blando",
        exposicion_marea_pct=15, exposicion_lluvia_pct=40, exposicion_viento_pct=12,
    ),
    ParametrosZona(
        id=20, nombre="Av. Jiménez × Carrera 27",
        altura_base_m=1.36, drenaje="alto", rigidez_suelo="medio",
        exposicion_marea_pct=12, exposicion_lluvia_pct=30, exposicion_viento_pct=10,
    ),
)