"""Servicio de notificaciones: clasificacion, validacion y suscripciones."""

import pytest

from api.notification_service import NotificationService


@pytest.fixture()
def servicio(tmp_path, monkeypatch):
    monkeypatch.setattr(NotificationService, "SUBSCRIPTIONS_FILE", str(tmp_path / "subs.json"))
    monkeypatch.setattr(NotificationService, "HISTORY_FILE", str(tmp_path / "hist.json"))
    return NotificationService()


def test_clasificar_umbrales(servicio):
    assert servicio._clasificar(29.9)[0] == "NORMAL"
    assert servicio._clasificar(30.0)[0] == "ALERTA"
    assert servicio._clasificar(59.9)[0] == "ALERTA"
    assert servicio._clasificar(60.0)[0] == "EMERGENCIA"
    assert servicio._clasificar(99.9)[0] == "EMERGENCIA"
    assert servicio._clasificar(100.0)[0] == "CRITICO"


def test_clasificar_mensajes_incluyen_nivel(servicio):
    riesgo, mensaje = servicio._clasificar(105.2)
    assert riesgo == "CRITICO"
    assert "105.2" in mensaje


def test_validar_email():
    servicio = NotificationService()
    assert servicio.validar_email("alguien@example.com")
    assert not servicio.validar_email("no-es-correo")
    assert not servicio.validar_email("falta-arroba")
    assert not servicio.validar_email("")


def test_subscribe_normaliza_y_deduplica(servicio):
    assert servicio.subscribe("Ana@Example.COM ") == 1
    assert servicio.subscriptions == ["ana@example.com"]
    assert servicio.subscribe("ana@example.com") == 1
    assert servicio.unsubscribe("ANA@example.com") == 0


def test_subscribe_rechaza_email_invalido(servicio):
    with pytest.raises(ValueError):
        servicio.subscribe("no-valido")
    assert servicio.subscriptions == []


def test_recipient_list_incluye_smtp_to(servicio, monkeypatch):
    servicio.subscribe("suscriptor@example.com")
    monkeypatch.setenv("SMTP_TO", "operaciones@example.com")
    recips = servicio.recipient_list()
    assert "suscriptor@example.com" in recips
    assert "operaciones@example.com" in recips
    assert len(recips) == len(set(recips))


def test_recipient_list_solo_suscriptores(servicio, monkeypatch):
    monkeypatch.setenv("SMTP_TO", "")
    servicio.subscribe("solo@example.com")
    assert servicio.recipient_list() == ["solo@example.com"]


def test_historial_persiste(tmp_path, monkeypatch):
    monkeypatch.setattr(NotificationService, "SUBSCRIPTIONS_FILE", str(tmp_path / "subs.json"))
    monkeypatch.setattr(NotificationService, "HISTORY_FILE", str(tmp_path / "hist.json"))
    svc = NotificationService()
    svc._store_notification(
        {"timestamp": "2026-01-01T00:00:00", "riesgo": "ALERTA", "nivel_cm": 35.0, "mensaje": "x"}
    )
    # Una nueva instancia debe recargar el historial persistido.
    svc2 = NotificationService()
    assert svc.notification_history[-1]["riesgo"] == "ALERTA"
    assert any(n["nivel_cm"] == 35.0 for n in svc2.notification_history)