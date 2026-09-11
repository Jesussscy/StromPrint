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
    assert body["version"] == "3.11.0"
    assert body["status"] in {"operational", "degraded"}
    assert "timestamp" in body
    assert "uptime_seconds" in body
    assert "fuentes" in body
    assert "suscripciones" in body


def test_health_es_publica(client):
    assert client.get("/api/v1/health").status_code == 200


def test_weather_requiere_api_key(client):
    assert client.get("/api/v1/weather").status_code == 401


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
    # Modo manual: sin datos meteorologicos reales => la fuente es "manual".
    assert body["fuente_meteo"] == "manual"
    # El eje temporal arranca en "ahora": hora_inicio_h indica la hora de
    # reloj (0-23) en America/Bogota que corresponde a t=0.
    assert 0 <= body["hora_inicio_h"] <= 23


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


def _meteo_fija():
    """Payload de weather_service.get_weather determinista (sin red).

    Escenario: tormenta en curso (estado TORMENTA) con lluvia, viento del
    noreste y parametros de simulacion acordes (misma forma que la real).
    """
    return {
        "source": "open-meteo",
        "fuente": "open-meteo",
        "confianza": 0.95,
        "timestamp": "2026-09-10T14:00:00",
        "estado": "tormenta",
        "estado_label": "Tormenta",
        "precipitacion_actual_mm_h": 8.5,
        "velocidad_viento_kmh": 24.0,
        "direccion_viento_deg": 45.0,
        "lluvia_total_mm": 40.0,
        "parametros_simulacion": {
            "storm_peak_hour": 6.0,
            "storm_intensity": 35.0,
            "rain_duration_h": 6.0,
            "mean_sea_level": 8.0,
            "wind_direction_deg": 45.0,
            "wind_speed_kmh": 24.0,
            "soil_humidity": 0.7,
            "consecutive_rainy_days": 2,
        },
    }


def _marea_fija():
    """Serie de marea semidiurna realista (media 12 cm, amplitud 10 cm, sin red).

    El modelo fuerza la oscilacion de la marea alrededor de la media: si la
    serie fuera constante el nivel quedaria sembrado en 0 (forzamiento nulo).
    """
    import math

    serie = [round(12.0 + 10.0 * math.sin(2 * math.pi * (h + 3) / 12.4), 3) for h in range(72)]
    return {
        "serie_cm": serie,
        "marea_actual_cm": serie[0],
        "nivel_actual_cm": serie[0],
        "origen": "prueba",
        "proxima_pleamar": "16:00",
    }


async def _async_meteo_fija(force_refresh: bool = False):
    return _meteo_fija()


async def _async_marea_fija(force_refresh: bool = False, duration_hours: float = 72.0):
    return _marea_fija()


def test_water_state_publico_devuelve_202_sin_key_o_con_key(client):
    """El snapshot es el mismo con o sin API key (endpoint publico de polling)."""
    assert client.get("/api/v1/water-state").status_code == 200
    assert client.get("/api/v1/water-state", headers=KEY_HEADER).status_code == 200


def test_water_state_estructura(client, monkeypatch):
    """Estructura del snapshot: nivel actual, tendencia, serie de 72 h y hora de ancla."""
    index._response_cache.clear()
    monkeypatch.setattr(index.weather_service, "get_weather", _async_meteo_fija)
    monkeypatch.setattr(index.tide_service, "get_tide", _async_marea_fija)
    monkeypatch.setattr(index, "hora_inicio_bogota", lambda: 9)

    r = client.get("/api/v1/water-state")
    assert r.status_code == 200
    body = r.json()
    assert body["territorio"] == "Manga, Cartagena de Indias"
    assert body["nivel_agua_cm"] > 0.0
    assert body["tendencia"] in {"creciente", "decreciente", "estable"}
    assert body["riesgo"] in {"Normal", "Alerta", "Emergencia", "Critico"}
    assert body["estado_meteorologico"] == "tormenta"
    assert body["estado_label"] == "Tormenta"
    assert body["lluvia_mm_h"] == 8.5
    assert body["viento_kmh"] == 24.0
    assert body["direccion_viento_deg"] == 45.0
    assert body["pico_maximo_cm"] >= body["nivel_agua_cm"]
    assert body["hora_pico"] >= 0.0
    assert body["hora_inicio_h"] == 9
    assert body["serie_horas"] == 72
    assert len(body["serie"]) == 72
    first = body["serie"][0]
    assert set(first.keys()) == {"tiempo_hora", "nivel_agua_cm", "velocidad_cambio"}
    assert first["tiempo_hora"] == 0
    assert abs(first["nivel_agua_cm"] - body["nivel_agua_cm"]) < 0.05


def test_water_state_dia_seco_quita_lluvia(client, monkeypatch):
    """Regresion: dia seco (sin lluvia en el resumen) => storm_intensity se anula
    y el nivel queda gobernado por la marea, nunca explota."""
    index._response_cache.clear()
    seco = dict(_meteo_fija())
    seco["estado"] = "soleado"
    seco["estado_label"] = "Soleado"
    seco["precipitacion_actual_mm_h"] = 0.0
    seco["lluvia_total_mm"] = 0.0
    seco["parametros_simulacion"] = {
        **_meteo_fija()["parametros_simulacion"],
        "storm_intensity": 35.0,  # el weather la habia estimado, pero no llueve
    }

    async def _get_weather(force_refresh: bool = False):
        return seco

    monkeypatch.setattr(index.weather_service, "get_weather", _get_weather)
    monkeypatch.setattr(index.tide_service, "get_tide", _async_marea_fija)

    r = client.get("/api/v1/water-state")
    assert r.status_code == 200
    body = r.json()
    # Dia soleado sin lluvia: el nivel sigue la marea, no crece a valores de tormenta.
    assert body["nivel_agua_cm"] < 40.0
    assert body["lluvia_mm_h"] == 0.0