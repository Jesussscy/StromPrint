"""Offline entry point for the validated experimental 2-D solver."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from api.manga2d_runner import RunInputs, run_model


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dem", type=Path, required=True)
    parser.add_argument("--mascara-mar", type=Path, help="Binary .npy grid aligned with the DEM; required for real terrain")
    parser.add_argument("--forzamientos", type=Path, required=True)
    parser.add_argument("--puntos", type=Path)
    parser.add_argument("--sumideros", type=Path)
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path)
    parser.add_argument("--datum-dem", required=True)
    parser.add_argument("--datum-marea", required=True)
    parser.add_argument("--datum-verificado", action="store_true")
    parser.add_argument("--nivel-mar", type=float, default=0.0)
    parser.add_argument("--alpha", type=float, default=0.8)
    parser.add_argument("--dt-M", type=float, default=300.0)
    parser.add_argument("--ventana-dias", type=float, default=7.0)
    parser.add_argument("--avance-horas", type=float, default=0.0)
    parser.add_argument("--pronostico-horas", type=float, default=12.0)
    args = parser.parse_args()
    result = run_model(RunInputs(
        dem=args.dem, sea_mask=args.mascara_mar, forcing=args.forzamientos, points=args.puntos, drains=args.sumideros,
        output=args.salida, snapshot=args.snapshot, dem_datum=args.datum_dem,
        tide_datum=args.datum_marea, verified_datum=args.datum_verificado,
        sea_cutoff_m=args.nivel_mar, alpha=args.alpha, macro_step_s=args.dt_M,
        memory_days=args.ventana_dias, advance_hours=args.avance_horas,
        forecast_hours=args.pronostico_horas,
    ))
    print(json.dumps({k: result[k] for k in ("status", "observed_time_h", "forecast_end_h", "snapshot")}, indent=2))


if __name__ == "__main__":
    main()
