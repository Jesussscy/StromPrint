"""Herramientas de pronostico: timezone America/Bogota, ventana desde
"ahora", dias lluviosos (conteo real) y hora de inicio del eje temporal."""

import datetime as _dt

import pytest

from api import weather_service as ws


def _hourly(dias: int, inicio: _dt.datetime, lluvias: dict = None) -> list:
    """Genera registros horarios Open-Meteo (time naive Bogota) opcionales."""
    lluvias = lluvias or {}
    records = []
    idx = 0
    for d in range(dias):
        for h in range(24):
            t = inicio + _dt.timedelta(days=d, hours=h)
            records.append({
                "time": t.strftime("%Y-%m-%dT%H:%M"),
                "precipitation": float(lluvias.get(idx, 0.0)),
                "rain": float(lluvias.get(idx, 0.0)),
                "temperature_2m": 28.0 + h / 24.0,
                "relative_humidity_2m": 78.0,
                "wind_speed_10m": 5.0,
                "wind_direction_10m": 180.0,
                "soil_moisture_0_1cm": 0.25,
            })
            idx += 1
    return records


@pytest.fixture(autouse=True)
def _fijar_ahora(monkeypatch):
    """Fija el reloj del modulo: 'ahora' = 12:00 del dia 0 (America/Bogota)."""
    ahora = _dt.datetime(2026, 9, 6, 12, 0)
    monkeypatch.setattr(ws, "_ahora_bogota", lambda: ahora)
    return ahora


def test_hora_actual_index_en_hora_exacta():
    hourly = _hourly(2, _dt.datetime(2026, 9, 6, 0, 0))
    assert ws._hora_actual_index(hourly) == 12
    assert hourly[ws._hora_actual_index(hourly)]["time"] == "2026-09-06T12:00"


def test_ventana_desde_ahora_no_arranca_en_medianoche():
    hourly = _hourly(4, _dt.datetime(2026, 9, 6, 0, 0))
    ventana = ws._ventana_desde_ahora(hourly, 72)
    assert len(ventana) == 72
    assert ventana[0]["time"] == "2026-09-06T12:00"


def test_dias_lluviosos_cuenta_dias_reales_no_racha():
    """dias_lluviosos debe ser el conteo de dias con lluvia en la ventana,
    no una racha consecutiva desde el final (que ignora dias intermedios)."""
    # Secuencia: dia0 seco, dia1 con lluvia, dia2 seco, dia3 con lluvia.
    # La racha consecutiva daba 1; el conteo real de la ventana debe dar 2.
    lluvias = {24: 5.0, 30: 8.0, 80: 12.0}  # indice 24 = dia1 h0; 30 = dia1 h6; 80 = dia3 h8
    hourly = _hourly(4, _dt.datetime(2026, 9, 6, 0, 0), lluvias)
    s = ws.get_weather_summary(hourly, horas=72)  # dia0 12h -> dia3 hasta h12
    assert s["dias_lluviosos"] == 2
    assert s["horas_con_lluvia"] == 3


def test_resumen_ventana_desde_ahora():
    lluvias = {10: 4.0}  # 10:00 (antes de ahora las 12:00) -> fuera de ventana
    hourly = _hourly(2, _dt.datetime(2026, 9, 6, 0, 0), lluvias)
    s = ws.get_weather_summary(hourly, horas=24)  # ventana desde 12:00
    assert s["lluvia_total_mm"] == 0.0
    assert s["horas_con_lluvia"] == 0


def test_tiene_lluvia_en_horizonte_desde_ahora():
    lluvias = {13: 6.0}  # 13:00 (despues de ahora)
    hourly = _hourly(2, _dt.datetime(2026, 9, 6, 0, 0), lluvias)
    assert ws.tiene_lluvia_en_horizonte(hourly, 24) is True
    lluvias_pasada = {11: 6.0}  # 11:00 (antes de ahora) -> fuera de ventana
    hourly2 = _hourly(2, _dt.datetime(2026, 9, 6, 0, 0), lluvias_pasada)
    assert ws.tiene_lluvia_en_horizonte(hourly2, 24) is False


def test_closest_hour_record_en_bogota():
    """Un record en la hora actual de Bogota es el seleccionado aunque el
    servidor corra en otra zona (la logica no usa datetime.now() de la maquina)."""
    hourly = _hourly(2, _dt.datetime(2026, 9, 6, 0, 0))
    rec = ws._closest_hour_record(hourly, reference=_dt.datetime(2026, 9, 6, 12, 0))
    assert rec["time"] == "2026-09-06T12:00"
    desfasado = ws._closest_hour_record(hourly, reference=_dt.datetime(2026, 9, 6, 20, 30))
    assert desfasado["time"] == "2026-09-06T20:00"


def test_hora_inicio_bogota_publica():
    assert 0 <= ws.hora_inicio_bogota() <= 23