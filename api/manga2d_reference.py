# -*- coding: utf-8 -*-
"""
Modelo 2D incorporado desde el archivo proporcionado por el usuario
``stormprint-modelo-2d.zip`` (referencia/modelo_manga_2d.py).

Implementación de referencia (solo numpy) del modelo 2D de inundación con
memoria fraccionaria de Caputo para el barrio Manga (Cartagena), resuelto por diferencias finitas
con el esquema de dos relojes.

El adaptador validado y la entrada de línea de comandos viven en
``api/manga2d_runner.py`` y ``scripts/manga/run_fractional_2d.py``.

Estructura del módulo
  1. Operador de memoria: coef_actual, pesos_memoria, mittag_leffler (esta última solo para pruebas)
  2. Malla: cotas del DEM, celdas de mar, rugosidad, sumideros, celdas permeables
  3. Forzamientos: lluvia, marea, viento (desde CSV o sintéticos)
  4. Parametros: todo lo que se calibra o se decide
  5. Simulador: el esquema de dos relojes, el balance de masa y los snapshots
"""
from __future__ import annotations

import csv
import json
import math
import time
from dataclasses import asdict, dataclass, field
from typing import Optional

import numpy as np

G_ACC = 9.81  # m/s^2


# =========================================================================================
# 1. Operador de memoria
# =========================================================================================
def coef_actual(alpha: float, dt: float, tau: float) -> float:
    """c = tau^(1-a) * dt^a / Gamma(1+a)  [s].

    Coeficiente del paso actual en la cuadratura producto-rectángulo de la integral fraccionaria
    de orden a. Con a = 1 vale exactamente dt (esquema clásico)."""
    return tau ** (1.0 - alpha) * dt ** alpha / math.gamma(1.0 + alpha)


def pesos_memoria(alpha: float, K: int) -> np.ndarray:
    """Pesos w_0 = 1 ; w_k = (k+1)^a - 2 k^a + (k-1)^a  para k = 1..K.

    w_k es el incremento, entre dos pasos consecutivos, del peso que la integral fraccionaria
    asigna a lo ocurrido k pasos atrás. Para 0 < a < 1 todos los w_k (k >= 1) son negativos y
    suman -1 en el límite: la memoria «devuelve» poco a poco parte de cada transferencia.
    Con a = 1 todos valen 0 (no hay memoria)."""
    w = np.empty(K + 1)
    w[0] = 1.0
    k = np.arange(1, K + 1, dtype=float)
    w[1:] = (k + 1.0) ** alpha - 2.0 * k ** alpha + (k - 1.0) ** alpha
    return w


def mittag_leffler(alpha: float, z: float) -> float:
    """E_a(z) para z <= 0. Solo para las pruebas de aceptación (solución exacta de D^a u = -lambda u).

    Serie de potencias si |z| <= 5 (con mpmath si está instalado, si no en doble precisión) y
    expansión asintótica de 7 términos si |z| > 5."""
    if z < -5.0:
        x = -z
        return sum((-1) ** (k + 1) * x ** (-k) / math.gamma(1.0 - alpha * k) for k in range(1, 8))
    try:
        import mpmath as mp
        mp.mp.dps = 50
        zz, a, s = mp.mpf(z), mp.mpf(alpha), mp.mpf(0)
        for k in range(600):
            s += zz ** k / mp.gamma(a * k + 1)
        return float(s)
    except ImportError:
        s = 0.0
        for k in range(400):
            term = z ** k / math.gamma(alpha * k + 1.0)
            s += term
            if k > 10 and abs(term) < 1e-17:
                break
        return s


# =========================================================================================
# 2. Malla (DEM + máscaras)
# =========================================================================================
@dataclass
class Malla:
    """Malla regular de celdas cuadradas. Fila 0 = sur (y crece hacia el norte), columna 0 = oeste."""
    z: np.ndarray                 # cota del terreno [m] sobre el datum de la marea, (ny, nx)
    dx: float                     # tamaño de celda [m]
    sea: np.ndarray               # True en celdas de mar/bahía (frontera con nivel impuesto)
    nman: np.ndarray              # n de Manning por celda [s/m^(1/3)]
    drain: np.ndarray             # True en celdas con sumidero
    permeable: np.ndarray         # True en celdas permeables (infiltración)
    x0: float = 0.0               # x del borde oeste (xllcorner del .asc)
    y0: float = 0.0               # y del borde sur (yllcorner del .asc)
    nombre: str = "malla"

    # ---- propiedades básicas
    @property
    def ny(self) -> int:
        return self.z.shape[0]

    @property
    def nx(self) -> int:
        return self.z.shape[1]

    @property
    def land(self) -> np.ndarray:
        return ~self.sea

    @property
    def A(self) -> float:
        return self.dx * self.dx

    def celda(self, x: float, y: float) -> tuple[int, int]:
        """(fila j, columna i) de la celda que contiene el punto (x, y) en las coordenadas del DEM."""
        i = int(math.floor((x - self.x0) / self.dx))
        j = int(math.floor((y - self.y0) / self.dx))
        if not (0 <= i < self.nx and 0 <= j < self.ny):
            raise ValueError(f"punto ({x}, {y}) fuera de la malla")
        return j, i

    def volumen_bajo_nivel(self, nivel: float) -> float:
        """Volumen geométrico [m^3] que ocuparía el agua en tierra si la superficie libre fuera plana en `nivel`."""
        return float(np.maximum(nivel - self.z[self.land], 0.0).sum() * self.A)

    # ---- constructores
    @classmethod
    def sintetica(cls, nx: int = 50, ny: int = 40, dx: float = 20.0, seed: int = 3,
                  n_sumideros: int = 12, n_calle: float = 0.02, n_techo: float = 0.05) -> "Malla":
        """DEM sintético para pruebas: plano inclinado hacia el mar (sur), una depresión (calle baja),
        manzanas elevadas 4 m (los techos drenan a la calle) y una fila de mar al sur."""
        rng = np.random.default_rng(seed)
        x = (np.arange(nx) + 0.5) * dx
        y = (np.arange(ny) + 0.5) * dx
        X, Y = np.meshgrid(x, y)
        z = 0.3 + 2.0 * Y / (ny * dx)
        z -= 0.7 * np.exp(-((X - 500.0) ** 2 + (Y - 330.0) ** 2) / (2 * 120.0 ** 2))
        calle = np.ones((ny, nx), bool)
        for bi in range(2, nx - 2, 8):
            for bj in range(3, ny - 2, 8):
                z[bj:bj + 5, bi:bi + 5] += 4.0
                calle[bj:bj + 5, bi:bi + 5] = False
        sea = np.zeros((ny, nx), bool)
        sea[0, :] = True
        z[0, :] = -2.0
        nman = np.where(calle, n_calle, n_techo)
        cand = np.argwhere(calle & ~sea)
        drain = np.zeros((ny, nx), bool)
        for j, i in cand[rng.choice(len(cand), n_sumideros, replace=False)]:
            drain[j, i] = True
        permeable = np.zeros((ny, nx), bool)
        return cls(z=z, dx=dx, sea=sea, nman=nman, drain=drain, permeable=permeable, nombre="sintetica")

    @classmethod
    def desde_asc(cls, ruta: str, nivel_mar_datum: float = 0.0, n_calle: float = 0.02,
                  sumideros_xy: Optional[list] = None, permeables_xy: Optional[list] = None,
                  mascara_mar: Optional[np.ndarray] = None) -> "Malla":
        """Lee un DEM en formato ESRI ASCII Grid (.asc, exportable desde QGIS).

        Celdas de mar: NODATA o cota <= nivel_mar_datum (o la máscara dada). Las cotas deben estar
        referidas al MISMO datum vertical que la serie de marea (nivel medio del mar local)."""
        with open(ruta, "r", encoding="utf-8") as fh:
            lineas = fh.read().splitlines()
        cab = {}
        k = 0
        while k < len(lineas) and lineas[k].split()[0].lower() in (
                "ncols", "nrows", "xllcorner", "yllcorner", "xllcenter", "yllcenter", "cellsize", "nodata_value"):
            nombre, valor = lineas[k].split()[:2]
            cab[nombre.lower()] = float(valor)
            k += 1
        ncols, nrows = int(cab["ncols"]), int(cab["nrows"])
        dx = float(cab["cellsize"])
        nodata = cab.get("nodata_value", -9999.0)
        datos = np.array(" ".join(lineas[k:]).split(), dtype=float).reshape(nrows, ncols)
        z = datos[::-1, :].copy()                      # el .asc va de norte a sur; aquí fila 0 = sur
        x0 = cab.get("xllcorner", cab.get("xllcenter", 0.0) - dx / 2)
        y0 = cab.get("yllcorner", cab.get("yllcenter", 0.0) - dx / 2)
        if mascara_mar is not None:
            if mascara_mar.shape != z.shape:
                raise ValueError("la mascara de mar no coincide con la forma del DEM")
            if np.any((z == nodata) & ~mascara_mar):
                raise ValueError("hay celdas NODATA marcadas como tierra")
            sea = mascara_mar.astype(bool)
        else:
            sea = (z == nodata) | (z <= nivel_mar_datum)
        z = np.where(z == nodata, nivel_mar_datum - 2.0, z)
        malla = cls(z=z, dx=dx, sea=sea, nman=np.full(z.shape, n_calle), drain=np.zeros(z.shape, bool),
                    permeable=np.zeros(z.shape, bool), x0=x0, y0=y0, nombre=ruta)
        for (x, y) in (sumideros_xy or []):
            j, i = malla.celda(x, y)
            malla.drain[j, i] = True
        for (x, y) in (permeables_xy or []):
            j, i = malla.celda(x, y)
            malla.permeable[j, i] = True
        return malla

    def guardar_asc(self, ruta: str, nodata: float = -9999.0) -> None:
        """Escribe el DEM como ESRI ASCII Grid (las celdas de mar salen con su cota, no como NODATA)."""
        with open(ruta, "w", encoding="utf-8") as fh:
            fh.write(f"ncols {self.nx}\nnrows {self.ny}\nxllcorner {self.x0}\nyllcorner {self.y0}\n")
            fh.write(f"cellsize {self.dx}\nNODATA_value {nodata}\n")
            for fila in self.z[::-1, :]:
                fh.write(" ".join(f"{v:.3f}" for v in fila) + "\n")


# =========================================================================================
# 3. Forzamientos
# =========================================================================================
@dataclass
class Forzamientos:
    """Series de entrada. La lluvia es una intensidad media por intervalo (constante a trozos);
    marea, viento y dirección se interpolan linealmente."""
    t: np.ndarray        # s desde el inicio de la simulación, creciente
    p: np.ndarray        # lluvia [m/s] en [t_i, t_{i+1})
    m: np.ndarray        # nivel del mar [m] sobre el datum del DEM
    w: np.ndarray        # velocidad del viento [m/s]
    dir_w: np.ndarray    # dirección de donde viene el viento [grados desde el norte]

    def en(self, t: float) -> tuple[float, float, float, float]:
        i = int(np.searchsorted(self.t, t, side="right")) - 1
        i = min(max(i, 0), len(self.t) - 1)
        return (float(self.p[i]), float(np.interp(t, self.t, self.m)),
                float(np.interp(t, self.t, self.w)), float(np.interp(t, self.t, self.dir_w)))

    @classmethod
    def sintetico(cls, horas: float = 12.0, lluvia_mm_h: float = 40.0, ini_h: float = 1.0, fin_h: float = 3.0,
                  marea_media_m: float = 0.15, amplitud_m: float = 0.25, fase: float = -0.45,
                  viento_kmh: float = 0.0, dir_viento: float = 180.0, paso_min: float = 15.0) -> "Forzamientos":
        t = np.arange(0.0, horas * 3600.0 + 1.0, paso_min * 60.0)
        p = np.where((t >= ini_h * 3600) & (t < fin_h * 3600), lluvia_mm_h / 1000.0 / 3600.0, 0.0)
        m = marea_media_m + amplitud_m * np.sin(2 * np.pi * t / (12.42 * 3600) + fase)
        w = np.full_like(t, viento_kmh / 3.6)
        d = np.full_like(t, dir_viento)
        return cls(t=t, p=p, m=m, w=w, dir_w=d)

    @classmethod
    def desde_csv(cls, ruta: str) -> "Forzamientos":
        """CSV con encabezados: tiempo_h, lluvia_mm_h, marea_cm, viento_kmh, dir_viento_deg
        (se localizan por nombre de columna, no por posición)."""
        with open(ruta, "r", encoding="utf-8", newline="") as fh:
            filas = list(csv.DictReader(fh))
        col = lambda nombre: np.array([float(f[nombre]) for f in filas])
        return cls(t=col("tiempo_h") * 3600.0, p=col("lluvia_mm_h") / 1000.0 / 3600.0,
                   m=col("marea_cm") / 100.0, w=col("viento_kmh") / 3.6, dir_w=col("dir_viento_deg"))

    def guardar_csv(self, ruta: str) -> None:
        with open(ruta, "w", encoding="utf-8", newline="") as fh:
            wr = csv.writer(fh)
            wr.writerow(["tiempo_h", "lluvia_mm_h", "marea_cm", "viento_kmh", "dir_viento_deg"])
            for k in range(len(self.t)):
                wr.writerow([f"{self.t[k] / 3600:.4f}", f"{self.p[k] * 3.6e6:.3f}", f"{self.m[k] * 100:.2f}",
                             f"{self.w[k] * 3.6:.2f}", f"{self.dir_w[k]:.1f}"])


# =========================================================================================
# 4. Parámetros
# =========================================================================================
@dataclass
class Parametros:
    # --- operador de memoria
    alpha: float = 0.8            # orden fraccionario (1 = clásico)
    tau_s: float = 3600.0         # tiempo de referencia del operador [s]; se FIJA, no se calibra
    dt_M: float = 300.0           # macro-paso del reloj de memoria [s]
    ventana_s: float = 7 * 86400  # ventana de memoria [s]
    forma: str = "transporte"     # "transporte" (recomendada) | "literal"
    memoria_en_costa: bool = True   # el intercambio con el mar también lleva memoria (False crea agua por recorte:
                                    # la memoria interior devuelve agua que la celda costera ya entregó al mar)
    # --- enrutamiento
    motor: str = "inercial"       # "inercial" | "difusivo" | "lineal" (solo pruebas)
    cfl: float = 0.7              # número de Courant de diseño
    h_max_cfl: float = 1.5        # profundidad de diseño para fijar el paso fino [m]
    dt_fino_eff: Optional[float] = None  # si se da, fija el paso físico fino y omite la CFL
    h_min: float = 1e-3           # profundidad mínima de cara para que haya flujo [m]
    K_lin: float = 0.02           # conductancia del motor lineal [m^2/s] (solo pruebas)
    # --- fuentes y sumideros
    f_c: float = 0.0              # capacidad de infiltración en celdas permeables [m/s]
    Qcap: float = 0.06            # capacidad de cada sumidero [m^3/s]
    z_out: float = 0.10           # cota de la boca de descarga de los sumideros [m]
    Hb: float = 0.30              # rango de marea en que el sumidero pasa de abierto a cerrado [m]
    # --- viento
    C_w: float = 2.0e-4           # sobreelevación por viento s_w = C_w w^2 cos+  [s^2/m]
    theta_n: float = 180.0        # dirección hacia donde mira la costa (normal exterior) [grados]

    def a_json(self) -> str:
        return json.dumps(asdict(self), indent=2)


# =========================================================================================
# 5. Simulador (dos relojes)
# =========================================================================================
@dataclass
class Resultados:
    t: np.ndarray                       # s, al cierre de cada macro-paso
    V: np.ndarray                       # volumen de agua en tierra [m^3]
    hmax: np.ndarray                    # lámina máxima en tierra [m]
    marea: np.ndarray                   # nivel del mar usado [m]
    lluvia: np.ndarray                  # intensidad usada [m/s]
    h_puntos: dict                      # nombre -> lámina [m] en ese punto
    h_final: np.ndarray                 # lámina final (ny, nx) [m]
    balance: dict                       # contabilidad de masa
    diag: dict                          # Courant máximo, tiempos, pasos
    parametros: dict


class Simulador:
    """Avanza el modelo en macro-pasos de dt_M. Dentro de cada macro-paso corre nsub pasos finos de
    enrutamiento clásico con reloj acelerado s = c_M/dt_M; al cerrar el macro-paso guarda el promedio
    de la divergencia y actualiza la fuente de memoria M para el macro-paso siguiente."""

    def __init__(self, malla: Malla, forz: Forzamientos, par: Parametros,
                 h0: Optional[np.ndarray] = None, t0: float = 0.0):
        self.malla, self.forz, self.par = malla, forz, par
        ny, nx = malla.ny, malla.nx
        a = par.alpha
        self.cM = coef_actual(a, par.dt_M, par.tau_s)
        self.s = self.cM / par.dt_M                                   # aceleración del reloj fino
        dt_eff = par.dt_fino_eff if par.dt_fino_eff else par.cfl * malla.dx / math.sqrt(G_ACC * par.h_max_cfl)
        self.nsub = max(1, int(math.ceil(par.dt_M / (dt_eff / self.s))))
        self.dt_r = par.dt_M / self.nsub                              # paso fino de pared [s]
        self.dt_eff = self.s * self.dt_r                              # paso físico del enrutamiento [s]
        self.K = max(1, int(round(par.ventana_s / par.dt_M)))
        self.w = pesos_memoria(a, self.K)
        self.hist = np.zeros((2 * self.K, ny * nx))                  # doble buffer circular
        self.N = 0                                                    # macro-pasos completados
        self.t = float(t0)
        self.t_base = float(t0)                                       # t = t_base + N * dt_M (sin deriva flotante)
        self.h = np.zeros((ny, nx)) if h0 is None else np.array(h0, dtype=float)
        self.qx = np.zeros((ny, nx - 1))
        self.qy = np.zeros((ny - 1, nx))
        self.M = np.zeros((ny, nx))                                   # fuente de memoria vigente [m/s * s]
        self.Facc = np.zeros((ny, nx))
        # clasificación de caras
        sea = malla.sea
        offx = sea[:, :-1] & sea[:, 1:]
        offy = sea[:-1, :] & sea[1:, :]
        costax = sea[:, :-1] ^ sea[:, 1:]
        costay = sea[:-1, :] ^ sea[1:, :]
        memx = ~offx & (np.ones_like(costax) if par.memoria_en_costa else ~costax)
        memy = ~offy & (np.ones_like(costay) if par.memoria_en_costa else ~costay)
        self.fx_off, self.fy_off = offx, offy
        self.mx_mem, self.my_mem = memx.astype(float), memy.astype(float)
        self.mx_cl, self.my_cl = (~offx & ~memx).astype(float), (~offy & ~memy).astype(float)
        self.dtx = np.where(offx, 0.0, np.where(memx, self.dt_eff, self.dt_r))
        self.dty = np.where(offy, 0.0, np.where(memy, self.dt_eff, self.dt_r))
        self.nfx = 0.5 * (malla.nman[:, :-1] + malla.nman[:, 1:])
        self.nfy = 0.5 * (malla.nman[:-1, :] + malla.nman[1:, :])
        self.bal = {k: 0.0 for k in ("lluvia", "lluvia_fisica", "sumideros", "infiltracion", "mar_clasico",
                                     "transporte_mem", "memoria", "recorte")}
        self.V0 = float(self.h[malla.land].sum() * malla.A)
        self.courant_max = 0.0
        self.seg_cpu = 0.0

    # ---------------------------------------------------------------- flujos en caras
    def _flujos(self, h: np.ndarray):
        ml, par = self.malla, self.par
        z, dx = ml.z, ml.dx
        eta = z + h
        hfx = np.maximum(np.maximum(eta[:, :-1], eta[:, 1:]) - np.maximum(z[:, :-1], z[:, 1:]), 0.0)
        hfy = np.maximum(np.maximum(eta[:-1, :], eta[1:, :]) - np.maximum(z[:-1, :], z[1:, :]), 0.0)
        Sx = (eta[:, 1:] - eta[:, :-1]) / dx
        Sy = (eta[1:, :] - eta[:-1, :]) / dx
        if par.motor == "inercial":
            with np.errstate(divide="ignore", invalid="ignore"):
                qx = (self.qx - G_ACC * hfx * self.dtx * Sx) / (
                    1.0 + G_ACC * self.dtx * self.nfx ** 2 * np.abs(self.qx) / hfx ** (7.0 / 3.0))
                qy = (self.qy - G_ACC * hfy * self.dty * Sy) / (
                    1.0 + G_ACC * self.dty * self.nfy ** 2 * np.abs(self.qy) / hfy ** (7.0 / 3.0))
            actx, acty = hfx > par.h_min, hfy > par.h_min
            qx = np.where(actx, qx, 0.0)
            qy = np.where(acty, qy, 0.0)
            cx = (self.dtx * np.sqrt(G_ACC * hfx) / dx)[actx & ~self.fx_off]
            cy = (self.dty * np.sqrt(G_ACC * hfy) / dx)[acty & ~self.fy_off]
            c = max(cx.max() if cx.size else 0.0, cy.max() if cy.size else 0.0)
            self.courant_max = max(self.courant_max, float(c))
        elif par.motor == "difusivo":
            qx = -(hfx ** (5.0 / 3.0) / self.nfx) * Sx / np.sqrt(np.abs(Sx) + 1e-6)
            qy = -(hfy ** (5.0 / 3.0) / self.nfy) * Sy / np.sqrt(np.abs(Sy) + 1e-6)
            vmx = dx * np.abs(eta[:, 1:] - eta[:, :-1]) / 4.0
            vmy = dx * np.abs(eta[1:, :] - eta[:-1, :]) / 4.0
            with np.errstate(divide="ignore", invalid="ignore"):
                qx = np.where(self.dtx > 0, np.sign(qx) * np.minimum(np.abs(qx) * self.dtx, vmx) / self.dtx, 0.0)
                qy = np.where(self.dty > 0, np.sign(qy) * np.minimum(np.abs(qy) * self.dty, vmy) / self.dty, 0.0)
        elif par.motor == "lineal":
            qx = -par.K_lin * Sx
            qy = -par.K_lin * Sy
        else:
            raise ValueError(f"motor desconocido: {par.motor}")
        qx = np.where(self.fx_off, 0.0, qx)
        qy = np.where(self.fy_off, 0.0, qy)
        return qx, qy

    def _limitar(self, h, qx, qy):
        """Ninguna celda entrega en un paso más lámina de la que tiene (escala sus caras salientes)."""
        dx = self.malla.dx
        out = np.zeros_like(h)
        out[:, :-1] += np.maximum(qx, 0.0) * self.dtx / dx
        out[:, 1:] += np.maximum(-qx, 0.0) * self.dtx / dx
        out[:-1, :] += np.maximum(qy, 0.0) * self.dty / dx
        out[1:, :] += np.maximum(-qy, 0.0) * self.dty / dx
        f = np.ones_like(h)
        m = out > h
        f[m] = h[m] / out[m]
        fx = np.where(qx > 0, f[:, :-1], f[:, 1:])
        fy = np.where(qy > 0, f[:-1, :], f[1:, :])
        return qx * fx, qy * fy

    def _div_negativa(self, qx, qy):
        """G = -div q [m/s]: lo que entra a la celda menos lo que sale, por unidad de área."""
        dx = self.malla.dx
        G = np.zeros(self.h.shape)
        G[:, :-1] -= qx / dx
        G[:, 1:] += qx / dx
        G[:-1, :] -= qy / dx
        G[1:, :] += qy / dx
        return G

    # ---------------------------------------------------------------- un paso fino
    def _paso_fino(self):
        ml, par = self.malla, self.par
        p, m, w, dw = self.forz.en(self.t)
        s_w = par.C_w * w * w * max(0.0, math.cos(math.radians(dw - par.theta_n)))
        h = self.h
        h[ml.sea] = np.maximum(m + s_w - ml.z[ml.sea], 0.0)          # frontera marina: nivel impuesto
        qx, qy = self._flujos(h)
        qx, qy = self._limitar(h, qx, qy)
        self.qx, self.qy = qx, qy
        Gm = self._div_negativa(qx * self.mx_mem, qy * self.my_mem)   # transporte con memoria
        Gc = self._div_negativa(qx * self.mx_cl, qy * self.my_cl)     # intercambio clásico (costa)
        Phi = min(max((par.z_out - m) / par.Hb, 0.0), 1.0)           # compuerta de marea
        dt_sink = self.dt_eff if par.forma == "literal" else self.dt_r
        d = np.where(ml.drain, np.minimum(par.Qcap / ml.A * Phi, h / dt_sink), 0.0)
        inf = np.where(ml.permeable & (h > 0.0), np.minimum(par.f_c, h / dt_sink), 0.0)
        S = np.where(ml.land, p, 0.0) - d - inf
        if par.forma == "literal":
            dh = self.dt_eff * (Gm + S) + self.dt_r * Gc + self.dt_r * self.M / par.dt_M
            self.Facc += (Gm + S) * (self.dt_r / par.dt_M)
            fac = self.dt_eff
        else:
            dh = self.dt_eff * Gm + self.dt_r * (Gc + S) + self.dt_r * self.M / par.dt_M
            self.Facc += Gm * (self.dt_r / par.dt_M)
            fac = self.dt_r
        land, A, b = ml.land, ml.A, self.bal
        nland = land.sum()
        b["lluvia"] += p * nland * A * fac
        b["lluvia_fisica"] += p * nland * A * self.dt_r
        b["sumideros"] += d[land].sum() * A * fac
        b["infiltracion"] += inf[land].sum() * A * fac
        b["mar_clasico"] += self.dt_r * Gc[land].sum() * A
        b["transporte_mem"] += self.dt_eff * Gm[land].sum() * A
        b["memoria"] += self.dt_r * self.M[land].sum() * A / par.dt_M
        h_new = h + dh
        b["recorte"] += -np.minimum(h_new, 0.0)[land].sum() * A
        self.h = np.maximum(h_new, 0.0)
        self.t += self.dt_r

    # ---------------------------------------------------------------- un macro-paso
    def paso_macro(self):
        t0 = time.time()
        self.Facc = np.zeros(self.h.shape)
        for _ in range(self.nsub):
            self._paso_fino()
        K = self.K
        idx = self.N % K
        F = self.Facc.ravel()
        self.hist[idx] = F
        self.hist[idx + K] = F
        self.N += 1
        self.t = self.t_base + self.N * self.par.dt_M                 # reloj de pared exacto
        kk = min(self.N, K)
        ventana = self.hist[idx + 1: idx + K + 1][::-1][:kk]          # [G_N, G_{N-1}, ..., G_{N-kk+1}]
        self.M = (self.cM * (self.w[1:kk + 1] @ ventana)).reshape(self.h.shape)
        self.seg_cpu += time.time() - t0

    # ---------------------------------------------------------------- correr
    def correr(self, T_s: float, puntos: Optional[dict] = None) -> Resultados:
        """Avanza hasta t >= T_s registrando series al cierre de cada macro-paso.
        puntos: {nombre: (x, y)} en coordenadas del DEM."""
        ml = self.malla
        celdas = {nom: ml.celda(x, y) for nom, (x, y) in (puntos or {}).items()}
        ts, Vs, hm, ms, ps = [], [], [], [], []
        hp = {nom: [] for nom in celdas}
        while self.t < T_s - 0.5 * self.par.dt_M:
            self.paso_macro()
            p, m, _, _ = self.forz.en(self.t)
            ts.append(self.t)
            Vs.append(self.h[ml.land].sum() * ml.A)
            hm.append(self.h[ml.land].max())
            ms.append(m)
            ps.append(p)
            for nom, (j, i) in celdas.items():
                hp[nom].append(self.h[j, i])
        return Resultados(t=np.array(ts), V=np.array(Vs), hmax=np.array(hm), marea=np.array(ms),
                          lluvia=np.array(ps), h_puntos={k: np.array(v) for k, v in hp.items()},
                          h_final=self.h.copy(), balance=self.balance(), diag=self.diagnostico(),
                          parametros=asdict(self.par))

    # ---------------------------------------------------------------- contabilidad
    def balance(self) -> dict:
        ml, b = self.malla, dict(self.bal)
        V = float(self.h[ml.land].sum() * ml.A)
        entradas = b["lluvia"] - b["sumideros"] - b["infiltracion"] + b["mar_clasico"] + b["transporte_mem"] + b["memoria"] + b["recorte"]
        b["V_inicial"], b["V_final"] = self.V0, V
        b["residuo"] = V - self.V0 - entradas
        b["residuo_rel"] = abs(b["residuo"]) / max(b["lluvia_fisica"], V, 1.0)
        b["recorte_rel"] = b["recorte"] / max(b["lluvia_fisica"], 1.0)
        return b

    def diagnostico(self) -> dict:
        return dict(nsub=self.nsub, dt_r=self.dt_r, dt_eff=self.dt_eff, s=self.s, cM=self.cM, K=self.K,
                    N=self.N, courant_max=self.courant_max, seg_cpu=self.seg_cpu,
                    seg_por_hora_simulada=self.seg_cpu / max(self.t / 3600.0, 1e-9))

    # ---------------------------------------------------------------- snapshots
    def snapshot(self) -> dict:
        """Estado completo para reanudar: lámina, caudales, memoria y la ventana de promedios."""
        K = self.K
        kk = min(self.N, K)
        idx = (self.N - 1) % K if self.N > 0 else 0
        ventana = self.hist[idx + 1: idx + K + 1][K - kk:] if self.N > 0 else np.zeros((0, self.h.size))
        return dict(t=self.t, N=self.N, h=self.h.copy(), qx=self.qx.copy(), qy=self.qy.copy(),
                    M=self.M.copy(), ventana=np.array(ventana), bal=dict(self.bal), V0=self.V0,
                    courant_max=self.courant_max, parametros=asdict(self.par))

    def guardar_snapshot(self, ruta: str) -> None:
        s = self.snapshot()
        np.savez_compressed(ruta, t=s["t"], N=s["N"], h=s["h"], qx=s["qx"], qy=s["qy"], M=s["M"],
                            ventana=s["ventana"], V0=s["V0"], courant_max=s["courant_max"],
                            bal=json.dumps(s["bal"]), parametros=json.dumps(s["parametros"]))

    @classmethod
    def desde_snapshot(cls, snap: dict, malla: Malla, forz: Forzamientos, par: Parametros) -> "Simulador":
        sim = cls(malla, forz, par, h0=snap["h"], t0=float(snap["t"]))
        sim.qx, sim.qy, sim.M = np.array(snap["qx"]), np.array(snap["qy"]), np.array(snap["M"])
        sim.N = int(snap["N"])
        sim.t_base = float(snap["t"]) - sim.N * par.dt_M
        vent = np.array(snap["ventana"])
        K = sim.K
        for r, fila in enumerate(vent):                                # reconstruir el doble buffer
            n_abs = sim.N - len(vent) + r
            idx = n_abs % K
            sim.hist[idx] = fila
            sim.hist[idx + K] = fila
        sim.bal = dict(snap["bal"])
        sim.V0 = float(snap["V0"])
        sim.courant_max = float(snap["courant_max"])
        return sim

    @staticmethod
    def cargar_snapshot(ruta: str) -> dict:
        d = np.load(ruta, allow_pickle=False)
        return dict(t=float(d["t"]), N=int(d["N"]), h=d["h"], qx=d["qx"], qy=d["qy"], M=d["M"],
                    ventana=d["ventana"], V0=float(d["V0"]), courant_max=float(d["courant_max"]),
                    bal=json.loads(str(d["bal"])), parametros=json.loads(str(d["parametros"])))
