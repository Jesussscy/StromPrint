"""Validated, resumable runs of the experimental Manga 2-D fractional solver.

The committed model is deliberately offline until a surveyed DEM, sea mask,
drain locations and a tide series on the same vertical datum are available.
Forecast integration never replaces the checkpoint at the observed present.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from .manga2d_reference import Forzamientos, Malla, Parametros, Simulador


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_xy(path: Path | None, named: bool) -> dict | list:
    if path is None:
        return {} if named else []
    with path.open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    result = {} if named else []
    for row in rows:
        x, y = float(row["x"]), float(row["y"])
        if not math.isfinite(x) or not math.isfinite(y):
            raise ValueError(f"Non-finite coordinate in {path}")
        if named:
            name = row["nombre"].strip()
            if not name or name in result:
                raise ValueError(f"Empty or duplicate point name in {path}")
            result[name] = (x, y)
        else:
            result.append((x, y))
    return result


@dataclass(frozen=True)
class RunInputs:
    dem: Path
    sea_mask: Path | None
    forcing: Path
    points: Path | None
    drains: Path | None
    output: Path
    dem_datum: str
    tide_datum: str
    verified_datum: bool
    advance_hours: float
    forecast_hours: float
    snapshot: Path | None = None
    sea_cutoff_m: float = 0.0
    alpha: float = 0.8
    macro_step_s: float = 300.0
    memory_days: float = 7.0


def _validate_config(config: RunInputs) -> None:
    if not config.verified_datum or not config.dem_datum.strip() or config.dem_datum != config.tide_datum:
        raise ValueError("DEM and tide must have an explicitly verified common vertical datum")
    if config.sea_mask is None and config.dem_datum.lower() != "synthetic":
        raise ValueError("A surveyed run needs an explicit sea mask; low land cannot be inferred from elevation")
    if not 0 < config.alpha <= 1:
        raise ValueError("alpha must be in (0, 1]")
    if not 0 < config.macro_step_s <= 900 or not 0 < config.memory_days <= 30:
        raise ValueError("Invalid macro step or memory window")
    if config.advance_hours < 0 or config.forecast_hours <= 0:
        raise ValueError("Advance must be nonnegative and forecast must be positive")
    for hours in (config.advance_hours, config.forecast_hours):
        steps = hours * 3600 / config.macro_step_s
        if not math.isfinite(steps) or abs(steps - round(steps)) > 1e-8:
            raise ValueError("Run lengths must be exact multiples of the macro step")


def run_model(config: RunInputs) -> dict:
    """Advance observed time, save its state, then compute a disposable forecast."""
    _validate_config(config)
    points = _read_xy(config.points, named=True)
    drains = _read_xy(config.drains, named=False)
    mask = None
    if config.sea_mask is not None:
        mask = np.load(config.sea_mask, allow_pickle=False)
        if mask.ndim != 2 or not np.isin(mask, [0, 1]).all():
            raise ValueError("Sea mask must be a two-dimensional binary .npy array")
        mask = mask.astype(bool)
    grid = Malla.desde_asc(str(config.dem), nivel_mar_datum=config.sea_cutoff_m,
                          sumideros_xy=drains, mascara_mar=mask)
    if not np.isfinite(grid.z).all() or grid.dx <= 0 or not grid.land.any() or not grid.sea.any():
        raise ValueError("DEM needs finite land elevations, sea cells and positive cell size")
    if np.any(grid.drain & grid.sea):
        raise ValueError("A drain falls in a sea cell")
    for x, y in points.values():
        j, i = grid.celda(x, y)
        if grid.sea[j, i]:
            raise ValueError("A reading point falls in a sea cell")
    forcing = Forzamientos.desde_csv(str(config.forcing))
    if len(forcing.t) < 2 or not all(np.isfinite(a).all() for a in (forcing.t, forcing.p, forcing.m, forcing.w, forcing.dir_w)):
        raise ValueError("Forcing needs at least two finite rows")
    if np.any(np.diff(forcing.t) <= 0) or np.max(np.diff(forcing.t)) > 3600.0001 or np.any(forcing.p < 0) or np.any(forcing.w < 0):
        raise ValueError("Forcing times must increase with no gap greater than one hour, and rain/wind must be nonnegative")
    params = Parametros(alpha=config.alpha, dt_M=config.macro_step_s, ventana_s=config.memory_days * 86400)
    identity = {
        "dem_sha256": _sha256(config.dem),
        "sea_mask_sha256": _sha256(config.sea_mask) if config.sea_mask else None,
        "datum": config.dem_datum,
        "sea_cutoff_m": config.sea_cutoff_m,
        "grid_shape": list(grid.z.shape),
        "params": asdict(params),
    }
    if config.snapshot is None:
        sim = Simulador(grid, forcing, params)
    else:
        metadata_path = config.snapshot.with_suffix(".json")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if metadata.get("identity") != identity or metadata.get("snapshot_sha256") != _sha256(config.snapshot):
            raise ValueError("Snapshot does not match the DEM, datum or solver parameters")
        snap = Simulador.cargar_snapshot(str(config.snapshot))
        sim = Simulador.desde_snapshot(snap, grid, forcing, params)
    start_s = sim.t
    observed_end_s = start_s + config.advance_hours * 3600
    forecast_end_s = observed_end_s + config.forecast_hours * 3600
    if forcing.t[0] > start_s or forcing.t[-1] < forecast_end_s:
        raise ValueError("Forcing does not cover the observed advance and complete forecast")

    if config.advance_hours:
        sim.correr(observed_end_s)
    observed_snapshot = sim.snapshot()
    forecast = Simulador.desde_snapshot(observed_snapshot, grid, forcing, params).correr(forecast_end_s, points)
    if forecast.balance["residuo_rel"] > 1e-9 or forecast.diag["courant_max"] > params.cfl + 1e-9:
        raise RuntimeError("Numerical balance or Courant acceptance criterion failed")
    config.output.mkdir(parents=True, exist_ok=True)
    snapshot_path = config.output / "snapshot.npz"
    sim.guardar_snapshot(str(snapshot_path))
    snapshot_meta = {
        "schema_version": 1,
        "identity": identity,
        "observed_time_s": sim.t,
        "snapshot_sha256": _sha256(snapshot_path),
        "committed_forcing_sha256": _sha256(config.forcing),
    }
    (config.output / "snapshot.json").write_text(json.dumps(snapshot_meta, indent=2), encoding="utf-8")
    np.save(config.output / "lamina_final.npy", forecast.h_final)
    with (config.output / "serie_global.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["tiempo_h", "volumen_tierra_m3", "lamina_max_cm", "marea_cm", "lluvia_mm_h"])
        for i, t in enumerate(forecast.t):
            writer.writerow([t / 3600, forecast.V[i], 100 * forecast.hmax[i], 100 * forecast.marea[i], 3.6e6 * forecast.lluvia[i]])
    with (config.output / "serie_puntos.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["tiempo_h", *[f"{name}_cm" for name in points]])
        for i, t in enumerate(forecast.t):
            writer.writerow([t / 3600, *[100 * forecast.h_puntos[name][i] for name in points]])
    summary = {
        "status": "experimental_uncalibrated",
        "observed_time_h": observed_end_s / 3600,
        "forecast_end_h": forecast_end_s / 3600,
        "datum": config.dem_datum,
        "alpha": config.alpha,
        "balance": forecast.balance,
        "diagnostics": forecast.diag,
        "point_names": list(points),
        "forcing_sha256": _sha256(config.forcing),
        "points_sha256": _sha256(config.points) if config.points else None,
        "drains_sha256": _sha256(config.drains) if config.drains else None,
        "snapshot": str(snapshot_path),
    }
    (config.output / "resumen.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary
