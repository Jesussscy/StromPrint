"use client";

import { useEffect, useState } from "react";
import { compararMetodos, ComparacionResponse } from "../lib/api";

interface Parametros {
  mass: number;
  damping: number;
  stiffness: number;
  mean_sea_level: number;
  soil_humidity: number;
  consecutive_rainy_days: number;
}

export default function ParametrosVariables() {
  const [res, setRes] = useState<ComparacionResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    compararMetodos({ duration_hours: 96, storm_peak_hour: 24, storm_intensity: 60, subtramos: 6 })
      .then((r) => {
        if (activo) setRes(r);
      })
      .catch((e: Error) => {
        if (activo) setError(e.message || "No se pudo cargar los parámetros.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  if (cargando)
    return (
      <div className="glass rounded-2xl p-6 animate-pulse h-[220px]" />
    );

  if (error || !res)
    return (
      <div className="glass rounded-2xl p-6 text-sm text-risk-emergency">
        {error ?? "Sin datos"}
      </div>
    );

  const p: Parametros = {
    mass: res.parametros.mass ?? 1,
    damping: res.parametros.damping ?? 0.45,
    stiffness: res.parametros.stiffness ?? 0.65,
    mean_sea_level: res.parametros.mean_sea_level ?? 8,
    soil_humidity: res.parametros.soil_humidity ?? 0.3,
    consecutive_rainy_days: res.parametros.consecutive_rainy_days ?? 0,
  };

  // Parámetros derivados del sistema masa-resorte-amortiguador
  const omegaN = Math.sqrt(p.stiffness / p.mass); // frecuencia natural (rad/h)
  const zeta = p.damping / (2 * Math.sqrt(p.mass * p.stiffness)); // razón de amortiguamiento

  return (
    <div className="glass rounded-2xl p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">
        Parámetros dinámicos c(t) · k(t)
      </p>
      <h3 className="font-display text-lg font-bold text-white mb-2">
        Amortiguamiento y Rigidez del Barrio
      </h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-5">
        En cada tramo del tiempo estos coeficientes son <strong className="text-white">constantes</strong>.
        Representan cómo el territorio disipa (drenaje <code className="font-mono text-cyan">c</code>)
        y resiste (rigidez <code className="font-mono text-cyan">k</code>) el empuje del agua.
        Al dividir el pronóstico en tramos, cada uno puede re-usar estos valores según la humedad del suelo y
        los días lluviosos recientes.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[#050A0F] p-3">
          <p className="font-mono text-[10px] text-slate-500">Masa · m</p>
          <p className="font-display text-lg font-bold text-white">{p.mass} kg</p>
        </div>
        <div className="rounded-xl bg-[#050A0F] p-3">
          <p className="font-mono text-[10px] text-slate-500">c(t) · drenaje</p>
          <p className="font-display text-lg font-bold text-cyan">{p.damping} N·s/m</p>
        </div>
        <div className="rounded-xl bg-[#050A0F] p-3">
          <p className="font-mono text-[10px] text-slate-500">k(t) · rigidez</p>
          <p className="font-display text-lg font-bold text-[#FF7700]">{p.stiffness} N/m</p>
        </div>
        <div className="rounded-xl bg-[#050A0F] p-3">
          <p className="font-mono text-[10px] text-slate-500">ωₙ · frecuencia natural</p>
          <p className="font-display text-lg font-bold text-[#B000FF]">{omegaN.toFixed(3)} rad/h</p>
        </div>
        <div className="rounded-xl bg-[#050A0F] p-3">
          <p className="font-mono text-[10px] text-slate-500">ζ · amortiguamiento</p>
          <p className="font-display text-lg font-bold text-[#00FF87]">{zeta.toFixed(3)}</p>
        </div>
        <div className="rounded-xl bg-[#050A0F] p-3">
          <p className="font-mono text-[10px] text-slate-500">Humedad del suelo</p>
          <p className="font-display text-lg font-bold text-sky-300">
            {Math.round(p.soil_humidity * 100)}% · {p.consecutive_rainy_days}d
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#0A1628] p-3 border border-cyan/10">
        <p className="font-mono text-[11px] text-cyan">
          m·r² + c·r + k = 0 &nbsp;→&nbsp; ζ = {zeta.toFixed(3)}{" "}
          {zeta < 1 ? "(subamortiguado ⇒ oscila y drena)" : zeta === 1 ? "(crítico)" : "(sobreamortiguado)"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Los tramos con más días lluviosos concentrados elevan la humedad del suelo y cambian
          efectivamente c y k entre tramo y tramo.
        </p>
      </div>
    </div>
  );
}
