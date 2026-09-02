"""Comparacion analitica vs numerica: robustez y metricas de error."""

import math

from api.physics_engine_analytical import PhysicsEngineAnalytical


def test_comparacion_devuelve_series_finitas():
    engine = PhysicsEngineAnalytical()
    res = engine.comparar_con_numerico(
        duration_hours=24.0,
        storm_peak_hour=10.0,
        storm_intensity=30.0,
        subtramos=1,
    )
    assert res["puntos"] == 24
    assert len(res["horas"]) == 24
    assert len(res["numerico_cm"]) == 24
    assert len(res["analitico_cm"]) == 24
    assert all(math.isfinite(v) for v in res["numerico_cm"])
    assert all(math.isfinite(v) for v in res["analitico_cm"])


def test_comparacion_niveles_no_negativos():
    engine = PhysicsEngineAnalytical()
    res = engine.comparar_con_numerico(
        duration_hours=24.0,
        storm_peak_hour=10.0,
        storm_intensity=50.0,
        subtramos=2,
    )
    assert all(v >= 0.0 for v in res["numerico_cm"])
    assert all(v >= 0.0 for v in res["analitico_cm"])


def test_comparacion_errores_validos():
    engine = PhysicsEngineAnalytical()
    res = engine.comparar_con_numerico(
        duration_hours=24.0,
        storm_peak_hour=10.0,
        storm_intensity=30.0,
        subtramos=1,
    )
    assert res["error_promedio_cm"] >= 0.0
    assert res["error_maximo_cm"] >= 0.0
    assert res["error_rmse_cm"] >= 0.0
    # Coherencia: el maximo >= promedio
    assert res["error_maximo_cm"] >= res["error_promedio_cm"]


def test_comparacion_parametros_documentan_config():
    engine = PhysicsEngineAnalytical()
    res = engine.comparar_con_numerico(duration_hours=24.0, subtramos=1)
    assert res["subtramos"] == 1
    assert res["parametros"]["mass"] > 0.0
    assert "damping" in res["parametros"]