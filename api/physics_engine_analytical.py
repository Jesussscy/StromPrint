"""
StormPrint :: physics_engine_analytical.py
Version analitica (por tramos) del motor de acumulacion de agua en Manga.
Proposito academico/educativo: obtener una solucion cerrada "por tramos" de la EDO

    m * H''(t) + c(t) * H'(t) + k(t) * H(t) = F_lluvia(t) + F_marea(t) + F_viento(t)

en lugar de la integracion numerica con scipy.integrate.solve_ivp.

================================================================================
POR QUE "POR TRAMOS" Y NO UNA FORMULA CERRADA GLOBAL
================================================================================
- c(t) y k(t) dependen de variables ambientales (dias lluviosos consecutivos y
  humedad del suelo). En el modelo real de physics_engine.py ambas son CONSTANTES
  por corrida, pero se generaliza aqui a tramos donde se aproximan como constantes.
- F_lluvia(t) es un pulso gaussiano, cuya particular no tiene expresion cerrada
  elemental. Se resuelve con la integral de Duhamel (convolucion con la respuesta
  al impulso) evaluada numericamente — es la UNICA parte "numerica" restante.
- Por tanto la solucion es analitica en estructura, con un termino de convolucion.

================================================================================
SOLUCION EN UN TRAMO DE COEFICIENTES CONSTANTES  (m, c, k fijos)
================================================================================
Ecuacion caracteristica:  m*r^2 + c*r + k = 0,  disc = c^2 - 4*m*k

  Caso 1 (sobreamortiguado,  disc > 0):
      r1, r2 = (-c ± sqrt(disc)) / (2m)
      H_h(t)          = C1*e^(r1 t) + C2*e^(r2 t)
      respuesta_impulso g(t) = (e^(r1 t) - e^(r2 t)) / (m (r1 - r2))

  Caso 2 (amortiguamiento critico,  disc = 0):
      r = -c / (2m)
      H_h(t)          = (C1 + C2 t) * e^(r t)
      g(t)            = t * e^(r t) / m

  Caso 3 (subamortiguado,  disc < 0):
      alpha = -c/(2m),  omega = sqrt(4mk - c^2)/(2m)
      H_h(t)          = e^(alpha t) [C1 cos(omega t) + C2 sin(omega t)]
      g(t)            = e^(alpha t) sin(omega t) / (m omega)

Solucion particular por Duhamel (integral de convolucion):
    H_p(t) = integral_0^t F(tau) * g(t - tau) dtau

Solucion completa:  H(t) = H_h(t) + H_p(t)
Las constantes C1, C2 se eligen para que en t = t0 se cumplan las condiciones
iniciales del tramo, REStandole a cada condicion inicial la aportacion de la
particular en t0:
    H_h(t0) = H0 - H_p(t0)
    H'_h(t0) = V0 - H'_p(t0)
"""

import math
from typing import List, Optional

import numpy as np
from scipy.integrate import quad

from .physics_engine import (
    PhysicalParameters,
    effective_damping,
    effective_stiffness,
    rain_forcing,
    tide_forcing,
    wind_tide_forcing,
)


class TramoAnalitico:
    """Descripcion de un tramo de solucion con coeficientes constantes."""

    __slots__ = ("t_inicio", "t_fin", "H0", "V0", "c", "k", "m")

    def __init__(
        self,
        t_inicio: float,
        t_fin: float,
        H0: float,
        V0: float,
        c: float,
        k: float,
        m: float,
    ):
        self.t_inicio = t_inicio
        self.t_fin = t_fin
        self.H0 = H0
        self.V0 = V0
        self.c = c
        self.k = k
        self.m = m


class PhysicsEngineAnalytical:
    """Motor fisico con solucion analitica por tramos de la EDO territorial."""

    def __init__(self, params: Optional[PhysicalParameters] = None):
        self.params = params or PhysicalParameters()

    # ------------------------------------------------------------------
    # Parametros del tramo (constantes en el tramo)
    # ------------------------------------------------------------------
    def coefficientes_tramo(self, t_mid: float, c_extern: Optional[float], k_extern: Optional[float]):
        """Coeficientes c y k constantes dentro de un tramo centrado en t_mid.

        Si no se proveen valores externos, se usa el modelo real de
        physics_engine.py evaluado en t_mid (robusto ante c(t), k(t) variables).
        """
        c = c_extern if c_extern is not None else effective_damping(t_mid, self.params)
        k = k_extern if k_extern is not None else effective_stiffness(t_mid, self.params)
        return float(c), float(k)

    # ------------------------------------------------------------------
    # Forzamiento total (reusa las funciones reales)
    # ------------------------------------------------------------------
    def total_forcing(
        self,
        t: float,
        storm_peak_hour: float,
        storm_intensity: float,
    ) -> float:
        p = self.params
        f_rain = rain_forcing(t, storm_peak_hour, storm_intensity, p) * p.rain_gain
        f_tide = tide_forcing(t, p)
        f_wind = wind_tide_forcing(t, p)
        return f_rain + f_tide + f_wind

    # ------------------------------------------------------------------
    # Raices caracteristicas y respuesta al impulso
    # ------------------------------------------------------------------
    def _raices(self, c: float, k: float):
        m = self.params.mass
        disc = c * c - 4.0 * m * k
        if disc > 1e-12:
            return "over", list(((-c + math.sqrt(disc)) / (2.0 * m), (-c - math.sqrt(disc)) / (2.0 * m)))
        if disc < -1e-12:
            return "under", (-c / (2.0 * m), math.sqrt(4.0 * m * k - c * c) / (2.0 * m))
        return "crit", (-c / (2.0 * m),)

    def respuesta_impulso(self, tau: float, c: float, k: float) -> float:
        """Respuesta al impulso g(tau) del sistema de coeficientes constantes."""
        m = self.params.mass
        if tau < 0:
            return 0.0
        caso, roots = self._raices(c, k)
        if caso == "over":
            r1, r2 = roots
            return (math.exp(r1 * tau) - math.exp(r2 * tau)) / (m * (r1 - r2))
        if caso == "under":
            alpha, omega = roots
            return math.exp(alpha * tau) * math.sin(omega * tau) / (m * omega)
        r = roots[0]
        return tau * math.exp(r * tau) / m

    # ------------------------------------------------------------------
    # Parte homogenea (formas analiticas cerradas) + sus derivadas
    # ------------------------------------------------------------------
    def _homogenea(
        self,
        t: np.ndarray,
        C1: float,
        C2: float,
        c: float,
        k: float,
    ) -> np.ndarray:
        """Devuelve H_h y H'_h evaluadas en t (array)."""
        m = self.params.mass
        caso, roots = self._raices(c, k)
        if caso == "over":
            r1, r2 = roots
            e1 = np.exp(r1 * t)
            e2 = np.exp(r2 * t)
            H = C1 * e1 + C2 * e2
            V = C1 * r1 * e1 + C2 * r2 * e2
        elif caso == "crit":
            r = roots[0]
            e = np.exp(r * t)
            H = (C1 + C2 * t) * e
            V = (C2 + (C1 + C2 * t) * r) * e
        else:
            alpha, omega = roots
            e = np.exp(alpha * t)
            cos = np.cos(omega * t)
            sin = np.sin(omega * t)
            H = e * (C1 * cos + C2 * sin)
            V = e * ((alpha * C1 + omega * C2) * cos + (alpha * C2 - omega * C1) * sin)
        return H, V

    def _constantes_homogenea(
        self,
        H0: float,
        V0: float,
        c: float,
        k: float,
    ) -> tuple:
        """Resuelve C1, C2 de modo que la homogenea en el ORIGEN local (t=0)
        del tramo valga (H0, V0). Trabaja en tiempo local del intervalo, lo que
        mantiene consistencia con la particular de Duhamel."""
        m = self.params.mass
        caso, roots = self._raices(c, k)
        if caso == "over":
            r1, r2 = roots
            A = np.array([[1.0, 1.0], [r1, r2]], dtype=float)
            return tuple(np.linalg.solve(A, np.array([H0, V0], dtype=float)))
        if caso == "crit":
            r = roots[0]
            return (float(H0), float(V0 - r * H0))
        alpha, omega = roots
        return (float(H0), float((V0 - alpha * H0) / omega))

    # ------------------------------------------------------------------
    # Particular por Duhamel (unica parte numerica: cuadratura)
    # ------------------------------------------------------------------
    def _particular_duhamel(
        self,
        t_local: float,
        c: float,
        k: float,
        t_inicio: float,
        storm_peak_hour: float,
        storm_intensity: float,
    ) -> tuple:
        """Devuelve H_p(t_local), H'_p(t_local) en el tramo que comienza en
        t_inicio (absoluto), via la integral de Duhamel:

            H_p = integral_0^{t_local} F(t_inicio + s) * g(t_local - s) ds

        donde la fuerza se evalua en TIEMPO ABSOLUTO (t_inicio + s) y la
        respuesta al impulso en tiempo local.
        Para la derivada: integral_0^{t_local} F(t_inicio+s) * g'(t_local-s) ds.
        """
        def integrando_H(s: float) -> float:
            return self.total_forcing(t_inicio + s, storm_peak_hour, storm_intensity) * self.respuesta_impulso(t_local - s, c, k)

        def integrando_V(s: float) -> float:
            return self.total_forcing(t_inicio + s, storm_peak_hour, storm_intensity) * self._respuesta_impulso_deriv(t_local - s, c, k)

        if t_local <= 0:
            return 0.0, 0.0

        Hp, _ = quad(integrando_H, 0.0, t_local, limit=200)
        Vp, _ = quad(integrando_V, 0.0, t_local, limit=200)
        return Hp, Vp

    def _respuesta_impulso_deriv(self, tau: float, c: float, k: float) -> float:
        """Derivada analitica g'(tau) de la respuesta al impulso."""
        m = self.params.mass
        caso, roots = self._raices(c, k)
        if caso == "over":
            r1, r2 = roots
            return (r1 * math.exp(r1 * tau) - r2 * math.exp(r2 * tau)) / (m * (r1 - r2))
        if caso == "under":
            alpha, omega = roots
            return math.exp(alpha * tau) * (alpha * math.sin(omega * tau) + omega * math.cos(omega * tau)) / (m * omega)
        r = roots[0]
        return math.exp(r * tau) * (1.0 + r * tau) / m

    # ------------------------------------------------------------------
    # Solucion completa
    # ------------------------------------------------------------------
    def resolver_tramo(
        self,
        tramo: TramoAnalitico,
        t_local: np.ndarray,
        storm_peak_hour: float,
        storm_intensity: float,
    ) -> tuple:
        """Resuelve un tramo [t_inicio, t_fin] y devuelve (H, V) en t_local.

        t_local debe ser [0, dt] desplazado al inicio del tramo.
        """
        c = tramo.c
        k = tramo.k

        # Trabajar en TIEMPO LOCAL del intervalo: la particular de Duhamel y la
        # homogenea comparten el mismo origen (t=0 = t_inicio del tramo), de modo
        # que la composicion respeta las condiciones iniciales exactamente.
        t_comp = np.concatenate([[0.0], t_local])
        Hp_arr = np.empty_like(t_comp)
        Vp_arr = np.empty_like(t_comp)
        for i, tt in enumerate(t_comp):
            Hp_arr[i], Vp_arr[i] = self._particular_duhamel(
                tt, c, k, tramo.t_inicio, storm_peak_hour, storm_intensity
            )

        # Compensar condiciones iniciales (en el origen local t=0) con la parte
        # de la particular que ya aporta ahí.
        Hp0 = Hp_arr[0]
        Vp0 = Vp_arr[0]
        C1, C2 = self._constantes_homogenea(
            tramo.H0 - Hp0,
            tramo.V0 - Vp0,
            c,
            k,
        )

        # Solucion completa en tiempo local (devolver sin el origen duplicado)
        H_h, V_h = self._homogenea(t_comp, C1, C2, c, k)
        H = H_h + Hp_arr
        V = V_h + Vp_arr
        return H[1:], V[1:]

    # ------------------------------------------------------------------
    # Director orquestador por tramos
    # ------------------------------------------------------------------
    def resolver_analitico(
        self,
        duration_hours: float = 72.0,
        resolution_hours: float = 1.0,
        storm_peak_hour: float = 12.0,
        storm_intensity: float = 25.0,
        c_extern: Optional[float] = None,
        k_extern: Optional[float] = None,
        subtramos: int = 1,
        return_derivative: bool = False,
    ) -> List[dict]:
        """Resuelve la EDO de forma analitica por tramos.

        Params:
          subtramos: cuantos tramos de coeficientes constantes usar. Como en el
                     modelo real c(t) y k(t) son constantes por corrida, lo
                     habitual es 1 (solucion analitica "global"). Se deja
                     parametrizable para proposito academico.
          return_derivative: incluir 'dH_dt' en cada registro.
        """
        t_eval = np.arange(0.0, duration_hours, resolution_hours)

        H0, V0 = 0.0, 0.0
        records: List[dict] = []
        n = len(t_eval)

        # Registrar la condicion inicial (t=0) una sola vez
        records.append(
            {
                "hour": round(float(t_eval[0]), 6),
                "water_level_cm": round(H0, 4),
                "dH_dt": round(V0, 4),
            }
        )

        # Particionar en subtramos contiguos
        bounds = []
        step = max(1, int(round(max(1.0, n - 1) / max(1, subtramos))))
        idx = 0
        while idx < n - 1:
            end = min(idx + step, n - 1)
            bounds.append((idx, end))
            idx = end

        for li, ri in bounds:
            t_i = float(t_eval[li])
            t_f = float(t_eval[ri])
            t_mid = (t_i + t_f) / 2.0
            c, k = self.coefficientes_tramo(t_mid, c_extern, k_extern)

            dt = t_f - t_i
            n_local = ri - li + 1
            if n_local <= 1:
                continue
            t_local = np.linspace(0.0, dt, n_local)
            t_local_full = t_local + t_i

            H_loc, V_loc = self.resolver_tramo(
                TramoAnalitico(t_i, t_f, H0, V0, c, k, self.params.mass),
                t_local[1:],
                storm_peak_hour,
                storm_intensity,
            )

            # Registrar SOLO los puntos interiores del tramo (t_local[1:]) para
            # no duplicar la hora inicial (t_i) que ya quedo al cierre del tramo
            # anterior. La hora 0 se registra una sola vez antes del bucle.
            for j in range(1, n_local):
                hour = t_local_full[j]
                Hc = max(0.0, float(H_loc[j - 1]))
                records.append(
                    {
                        "hour": round(hour, 6),
                        "water_level_cm": round(Hc, 4),
                        "dH_dt": round(float(V_loc[j - 1]), 4),
                    }
                )

            H0 = float(H_loc[-1])
            V0 = float(V_loc[-1])

        if not return_derivative:
            for r in records:
                r.pop("dH_dt", None)
        return records

    # ------------------------------------------------------------------
    # Comparacion con el metodo numerico (solve_ivp)
    # ------------------------------------------------------------------
    def comparar_con_numerico(
        self,
        duration_hours: float = 72.0,
        resolution_hours: float = 1.0,
        storm_peak_hour: float = 12.0,
        storm_intensity: float = 25.0,
        subtramos: int = 1,
        c_extern: Optional[float] = None,
        k_extern: Optional[float] = None,
    ) -> dict:
        """Ejecuta el motor numerico (physics_engine) y el analitico y los compara."""
        from .physics_engine import run_simulation

        numerico = run_simulation(
            duration_hours=duration_hours,
            resolution_hours=resolution_hours,
            storm_peak_hour=storm_peak_hour,
            storm_intensity=storm_intensity,
            mean_sea_level=self.params.mean_sea_level,
            params=self.params,
        )

        analitico = self.resolver_analitico(
            duration_hours=duration_hours,
            resolution_hours=resolution_hours,
            storm_peak_hour=storm_peak_hour,
            storm_intensity=storm_intensity,
            c_extern=c_extern,
            k_extern=k_extern,
            subtramos=subtramos,
            return_derivative=True,
        )

        n_max = min(len(numerico), len(analitico))
        horas = [r["hour"] for r in numerico[:n_max]]
        num_lvl = [r["water_level_cm"] for r in numerico[:n_max]]
        ana_lvl = [r["water_level_cm"] for r in analitico[:n_max]]
        diffs = [abs(a - b) for a, b in zip(num_lvl, ana_lvl)]

        mean_err = sum(diffs) / n_max if n_max else 0.0
        max_err = max(diffs) if diffs else 0.0
        rmse = math.sqrt(sum(d**2 for d in diffs) / n_max) if n_max else 0.0

        return {
            "horas": horas,
            "numerico_cm": num_lvl,
            "analitico_cm": ana_lvl,
            "error_promedio_cm": round(mean_err, 5),
            "error_maximo_cm": round(max_err, 5),
            "error_rmse_cm": round(rmse, 5),
            "puntos": n_max,
            "subtramos": subtramos,
            "parametros": {
                "mass": self.params.mass,
                "damping": self.params.damping,
                "stiffness": self.params.stiffness,
                "mean_sea_level": self.params.mean_sea_level,
                "soil_humidity": self.params.soil_humidity,
                "consecutive_rainy_days": self.params.consecutive_rainy_days,
            },
        }


# ---------------------------------------------------------------------------
# Utilidad CLI para verificar la implementacion
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    engine = PhysicsEngineAnalytical()
    res = engine.comparar_con_numerico(
        duration_hours=72.0,
        storm_peak_hour=12.0,
        storm_intensity=42.0,
        subtramos=1,
    )
    print("Comparacion numerica (solve_ivp) vs analitica:")
    print(f"  error promedio: {res['error_promedio_cm']} cm")
    print(f"  error maximo : {res['error_maximo_cm']} cm")
    print(f"  error RMSE   : {res['error_rmse_cm']} cm")
    print(f"  parametros   : {res['parametros']}")
