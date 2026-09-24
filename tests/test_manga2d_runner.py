"""Integration checks for observed checkpoints and disposable 2-D forecasts."""

import csv
from dataclasses import replace

import numpy as np
import pytest

from api.manga2d_reference import Forzamientos, Malla, Simulador
from api.manga2d_runner import RunInputs, run_model


def _fixture(tmp_path):
    grid = Malla.sintetica(nx=12, ny=10, dx=20, n_sumideros=2)
    dem = tmp_path / "dem.asc"
    grid.guardar_asc(str(dem))
    forcing = tmp_path / "forcing.csv"
    Forzamientos.sintetico(horas=2, lluvia_mm_h=30, ini_h=0.25, fin_h=0.75).guardar_csv(str(forcing))
    points = tmp_path / "points.csv"
    with points.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["nombre", "x", "y"])
        writer.writerow(["punto", 50, 50])
    return RunInputs(
        dem=dem, sea_mask=None, forcing=forcing, points=points, drains=None,
        output=tmp_path / "first", dem_datum="synthetic", tide_datum="synthetic",
        verified_datum=True, advance_hours=0.5, forecast_hours=0.5,
        memory_days=0.025,
    )


def test_resume_matches_continuous_and_forecast_does_not_commit(tmp_path):
    config = _fixture(tmp_path)
    first = run_model(config)
    checkpoint = config.output / "snapshot.npz"
    assert first["observed_time_h"] == 0.5
    assert Simulador.cargar_snapshot(str(checkpoint))["t"] == 1800

    resumed = replace(config, output=tmp_path / "resumed", snapshot=checkpoint)
    second = run_model(resumed)
    direct = replace(config, output=tmp_path / "direct", advance_hours=1, forecast_hours=0.5)
    whole = run_model(direct)
    assert second["observed_time_h"] == whole["observed_time_h"] == 1
    assert Simulador.cargar_snapshot(str(resumed.output / "snapshot.npz"))["t"] == 3600
    np.testing.assert_allclose(
        np.load(resumed.output / "lamina_final.npy"),
        np.load(direct.output / "lamina_final.npy"), atol=1e-10,
    )
    assert second["balance"]["residuo_rel"] < 1e-9


def test_reject_unverified_datum_and_incompatible_snapshot(tmp_path):
    config = _fixture(tmp_path)
    with pytest.raises(ValueError, match="vertical datum"):
        run_model(replace(config, verified_datum=False))
    with pytest.raises(ValueError, match="explicit sea mask"):
        run_model(replace(config, dem_datum="EGM96", tide_datum="EGM96"))
    run_model(config)
    with pytest.raises(ValueError, match="Snapshot does not match"):
        run_model(replace(config, output=tmp_path / "changed", snapshot=config.output / "snapshot.npz", alpha=0.7))
