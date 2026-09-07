"""Motor fisico: corridas saneadas, sin NaN y metricas consistentes."""

import math

from api.physics_engine import (
    RISK_THRESHOLD_NORMAL,
    PhysicalParameters,
    compute_advanced_metrics,
    initial_level,
    run_simulation,
)


def _ids(run: list) -> list:
    return [round(r["water_level_cm"], 6) for r in run]


def _tide_serie(amplitude: float = 26.0, n: int = 336, phase0: float = 0.0) -> list:
    """Serie horaria tipo Open-Meteo Marine (senoide semidiurna 12.42 h)."""
    return [
        round(amplitude * math.sin(2 * math.pi * t / 12.42 + phase0), 2)
        for t in range(n)
    ]


def test_dia_seco_nivel_minimo():
    # Sin lluvia y sin marea (MSL=0) la solucion debe quedar ~0 y finita.
    run = run_simulation(
        duration_hours=24.0,
        storm_peak_hour=10.0,
        storm_intensity=0.0,
        mean_sea_level=0.0,
    )
    assert len(run) == 24
    assert all(math.isfinite(r["water_level_cm"]) for r in run)
    # Tolerancia numerica: sin fuerzas externas no deberia generar inundacion.
    assert max(_ids(run)) < 1.0
    assert min(r["risk_level"] for r in run) == "Normal"


def test_tormenta_genera_nivel_mayor_que_dia_seco():
    base = PhysicalParameters(mean_sea_level=0.0)
    seco = run_simulation(
        duration_hours=48.0,
        storm_peak_hour=24.0,
        storm_intensity=0.0,
        mean_sea_level=0.0,
        params=base,
    )
    tormenta = run_simulation(
        duration_hours=48.0,
        storm_peak_hour=24.0,
        storm_intensity=120.0,
        mean_sea_level=0.0,
        params=PhysicalParameters(mean_sea_level=0.0),
    )
    assert max(_ids(tormenta)) > max(_ids(seco))
    assert all(math.isfinite(r["water_level_cm"]) for r in tormenta)


def test_pico_ocurre_cerca_del_pico_de_lluvia():
    run = run_simulation(
        duration_hours=48.0,
        storm_peak_hour=24.0,
        storm_intensity=80.0,
        mean_sea_level=5.0,
    )
    peak = max(run, key=lambda r: r["water_level_cm"])
    # El maximo deberia darse en la segunda mitad (despues del pico de lluvia).
    assert peak["hour"] >= 24.0


def test_water_level_nunca_negativo():
    run = run_simulation(
        duration_hours=48.0,
        storm_peak_hour=20.0,
        storm_intensity=60.0,
        mean_sea_level=10.0,
    )
    assert all(r["water_level_cm"] >= 0.0 for r in run)


def test_metricas_avanzadas():
    run = run_simulation(duration_hours=24.0, storm_intensity=40.0)
    m = compute_advanced_metrics(run)
    assert m["total_points"] == 24
    assert m["max_water_level_cm"] >= 0.0
    assert m["hours_with_rain"] > 0
    assert m["avg_drainage_efficiency"] > 0.0
    assert m["peak_hour"] >= 0.0


def test_metricas_vacias():
    assert compute_advanced_metrics([]) == {}


def test_run_simulation_respeta_mean_sea_level():
    # El experimento debe reflejar el argumento mean_sea_level (antes se ignoraba).
    alto = run_simulation(duration_hours=24.0, storm_intensity=0.0, mean_sea_level=12.0)
    bajo = run_simulation(duration_hours=24.0, storm_intensity=0.0, mean_sea_level=0.0)
    assert max(_ids(alto)) > max(_ids(bajo))
    assert max(_ids(bajo)) < 1.0


def test_dia_seco_con_marea_viva_queda_en_normal():
    """Calibracion TIDE_SERIES_SCALE: un dia seco con marea real de marea viva
    (+/- 26 cm) debe quedar en riesgo 'Normal' (< 30 cm), no dispararse a
    Emergencia como antes del factor de calibracion (~59 cm medido)."""
    serie = _tide_serie(amplitude=26.0)
    run = run_simulation(
        duration_hours=72.0,
        storm_peak_hour=30.0,
        storm_intensity=0.0,
        mean_sea_level=8.0,
        params=PhysicalParameters(mean_sea_level=8.0, tide_series_cm=serie),
    )
    assert max(_ids(run)) < RISK_THRESHOLD_NORMAL
    assert all(r["risk_level"] == "Normal" for r in run)


def test_initial_level_sembrado_con_marea_alta():
    """Si la marea esta alta AHORA, H(0) arranca en el equilibrio estatico
    (>0): records[0] es el nivel actual, no el transitorio artificial de 0."""
    serie = _tide_serie(amplitude=26.0, phase0=math.pi / 2)  # arranca en maximo
    p = PhysicalParameters(mean_sea_level=8.0, tide_series_cm=serie)
    assert initial_level(p) > 5.0
    run = run_simulation(
        duration_hours=72.0,
        storm_peak_hour=30.0,
        storm_intensity=0.0,
        mean_sea_level=8.0,
        params=p,
    )
    assert run[0]["water_level_cm"] > 5.0


def test_initial_level_cero_sin_serie():
    """Sin serie de marea (marea analitica o modo manual) H(0)=0, como antes."""
    p = PhysicalParameters(mean_sea_level=0.0)
    assert initial_level(p) == 0.0
    run = run_simulation(duration_hours=24.0, storm_intensity=0.0, mean_sea_level=0.0)
    assert run[0]["water_level_cm"] == 0.0