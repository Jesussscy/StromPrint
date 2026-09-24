"""Generate a clearly synthetic input set for the experimental 2-D runner."""

import argparse
import csv
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from api.manga2d_reference import Forzamientos, Malla


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--salida", type=Path, required=True)
    args = parser.parse_args()
    args.salida.mkdir(parents=True, exist_ok=True)
    grid = Malla.sintetica()
    grid.guardar_asc(str(args.salida / "dem_sintetico.asc"))
    np.save(args.salida / "mascara_mar.npy", grid.sea)
    Forzamientos.sintetico(horas=12).guardar_csv(str(args.salida / "forzamientos.csv"))
    with (args.salida / "sumideros.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["x", "y"])
        for j, i in np.argwhere(grid.drain):
            writer.writerow([(i + 0.5) * grid.dx, (j + 0.5) * grid.dx])
    with (args.salida / "puntos.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["nombre", "x", "y"])
        land = np.argwhere(grid.land)
        for k, index in enumerate(np.linspace(0, len(land) - 1, 4, dtype=int), 1):
            j, i = land[index]
            writer.writerow([f"punto_{k}", (i + 0.5) * grid.dx, (j + 0.5) * grid.dx])
    print(args.salida.resolve())


if __name__ == "__main__":
    main()
