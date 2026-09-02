"""API HTTP: health, autenticacion por API key, endpoints publicos y suscripcion."""

import os

os.environ.setdefault("STORMPRINT_API_KEY", "sp_live_test_key_123")
os.environ.setdefault("ENV", "development")
os.environ.setdefault("VERCEL_ENV", "development")

import pytest
from fastapi.testclient import TestClient

from api import index
from api.notification_service import NotificationService

TEST_KEY = "sp_live_test_key_123"
KEY_HEADER = {"X-StormPrint-Key": TEST_KEY}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    svc = index.notification_service
    subs_file = str(tmp_path / "subs.json")
    hist_file = str(tmp_path / "hist.json")
    monkeypatch.setattr(svc, "SUBSCRIPTIONS_FILE", subs_file)
    monkeypatch.setattr(svc, "HISTORY_FILE", hist_file)
    monkeypatch.setattr(NotificationService, "SUBSCRIPTIONS_FILE", subs_file)
    monkeypatch.setattr(NotificationService, "HISTORY_FILE", hist_file)
    svc.subscriptions = svc._load_subscriptions()
    with TestClient(index.app) as c:
        yield c


def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "stormprint-api"
    assert body["version"] == "3.0.0"
    assert body["status"] in {"operational", "degraded"}
    assert "timestamp" in body
    assert "uptime_seconds" in body
    assert "fuentes" in body
    assert "suscripciones" in body


def test_health_es_publica(client):
    assert client.get("/api/v1/health").status_code == 200


def test_weather_requiere_api_key(client):
    assert client.get("/api/v1/weather").status_code == 401


def test_comparacion_requiere_api_key(client):
    r = client.post(
        "/api/v1/comparacion",
        json={"duration_hours": 24, "storm_peak_hour": 10, "storm_intensity": 30},
    )
    assert r.status_code == 401


def test_predict_requiere_api_key(client):
    r = client.post("/api/v1/predict", json={"duration_hours": 24, "storm_intensity": 30})
    assert r.status_code == 401


def test_predict_con_key_ok(client):
    r = client.post(
        "/api/v1/predict",
        headers=KEY_HEADER,
        json={"duration_hours": 24, "storm_intensity": 40, "storm_peak_hour": 12},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["territory"] == "Manga, Cartagena de Indias"
    assert body["total_points"] == 24
    assert body["max_water_level_cm"] >= 0.0


def test_predecir_manual_offline(client):
    r = client.post(
        "/api/v1/predecir",
        json={
            "horas_pronostico": 24,
            "intensidad_lluvia_mm_h": 10,
            "usar_datos_meteo": False,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["puntos"]) == 24
    assert body["nivel_maximo_cm"] >= 0.0
    assert body["fuente_meteo"] == "open-meteo"


def test_predecir_manual_sin_lluvia_no_rompe(client):
    r = client.post(
        "/api/v1/predecir",
        json={"horas_pronostico": 24, "usar_datos_meteo": False},
    )
    assert r.status_code == 200
    assert len(r.json()["puntos"]) == 24


def test_serie_marea_acepta_duracion_float():
    """Regresion: predecir envia horas_pronostico como float (pydantic) y
    serie_marea_desde_ahora usaba el float como indice de slice -> TypeError.
    El slice debe funcionar con float (se coerce a int)."""
    import datetime as _dt

    from api.tide_service import serie_marea_desde_ahora

    tiempos = [
        "2026-09-02T00:00",
        "2026-09-02T01:00",
        "2026-09-02T02:00",
        "2026-09-02T03:00",
    ]
    niveles = [10.0, 20.0, 30.0, 40.0]
    ref = _dt.datetime(2026, 9, 2, 1, 0)
    out = serie_marea_desde_ahora(tiempos, niveles, 72.0, ref)  # 72.0 float
    assert isinstance(out, list)
    assert out
    assert len(out) == 72


def test_subscribe_rechaza_email_invalido(client):
    r = client.post("/api/v1/notify/subscribe", json={"email": "no-es-un-email"})
    assert r.status_code == 422


def test_subscribe_unsubscribe_ok(client):
    r = client.post("/api/v1/notify/subscribe", json={"email": "test@example.com"})
    assert r.status_code == 200
    body = r.json()
    assert body["subscribed"] is True
    assert body["total_suscripciones"] >= 1
    r2 = client.post("/api/v1/notify/unsubscribe", json={"email": "test@example.com"})
    assert r2.status_code == 200
    assert r2.json()["subscribed"] is False


def test_notify_status_estructura(client):
    r = client.get("/api/v1/notify/status")
    assert r.status_code == 200
    body = r.json()
    assert "smtp_configurado" in body
    assert "webhook_configurado" in body
    assert "total_suscripciones" in body


def test_notifications_estructura(client):
    r = client.get("/api/v1/notifications?limit=5")
    assert r.status_code == 200
    body = r.json()
    assert "notifications" in body
    assert "metrics" in body
    assert body["total"] <= 5