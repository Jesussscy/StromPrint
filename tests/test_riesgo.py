"""Umbrales de clasificacion de riesgo (fuente de verdad 30/60/100)."""

from api.physics_engine import classify_risk_spanish, classify_risk_english


def test_limites_exactos():
    # 30 -> Alerta, 60 -> Emergencia, 100 -> Critico (inclusive)
    assert classify_risk_spanish(29.9) == "Normal"
    assert classify_risk_spanish(30.0) == "Alerta"
    assert classify_risk_spanish(59.9) == "Alerta"
    assert classify_risk_spanish(60.0) == "Emergencia"
    assert classify_risk_spanish(99.9) == "Emergencia"
    assert classify_risk_spanish(100.0) == "Critico"
    assert classify_risk_spanish(175.0) == "Critico"


def test_limites_exactos_ingles():
    assert classify_risk_english(29.9) == "low"
    assert classify_risk_english(30.0) == "moderate"
    assert classify_risk_english(60.0) == "high"
    assert classify_risk_english(100.0) == "critical"


def test_negativos_tratados_como_normal():
    assert classify_risk_spanish(-5.0) == "Normal"
    assert classify_risk_english(-5.0) == "low"


def test_umbrales_coinciden(constants):
    # Los umbrales usados por el servicio de notificaciones provienen de la
    # misma fuente que la clasificacion (import en notification_service.py).
    assert constants["RISK_THRESHOLD_NORMAL"] == 30.0
    assert constants["RISK_THRESHOLD_ALERTA"] == 60.0
    assert constants["RISK_THRESHOLD_EMERGENCIA"] == 100.0