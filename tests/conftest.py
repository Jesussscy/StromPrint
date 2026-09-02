"""Conftest compartido: constantes de umbral del motor fisico."""

import pytest


@pytest.fixture()
def constants():
    from api.physics_engine import (
        RISK_THRESHOLD_NORMAL,
        RISK_THRESHOLD_ALERTA,
        RISK_THRESHOLD_EMERGENCIA,
    )

    return {
        "RISK_THRESHOLD_NORMAL": RISK_THRESHOLD_NORMAL,
        "RISK_THRESHOLD_ALERTA": RISK_THRESHOLD_ALERTA,
        "RISK_THRESHOLD_EMERGENCIA": RISK_THRESHOLD_EMERGENCIA,
    }