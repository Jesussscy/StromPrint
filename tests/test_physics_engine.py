"""Motor fisico: corridas saneadas, sin NaN y metricas consistentes."""

import math

from api.physics_engine import (
    PhysicalParameters,
    compute_advanced_metrics,
    run_simulation,
)


def _ids(run: list) -> list:
    return [round(r["water_level_cm"], 6) for r in run]


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