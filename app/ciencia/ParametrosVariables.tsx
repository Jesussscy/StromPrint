"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
        {[
          { label: "Masa · m", valor: `${p.mass} kg`, color: "text-white" },
          { label: "c(t) · drenaje", valor: `${p.damping} N·s/m`, color: "text-cyan" },
          { label: "k(t) · rigidez", valor: `${p.stiffness} N/m`, color: "text-[#FF7700]" },
          { label: "ωₙ · frecuencia natural", valor: `${omegaN.toFixed(3)} rad/h`, color: "text-[#B000FF]" },
          { label: "ζ · amortiguamiento", valor: `${zeta.toFixed(3)}`, color: "text-[#00FF87]" },
          { label: "Humedad del suelo", valor: `${Math.round(p.soil_humidity * 100)}% · ${p.consecutive_rainy_days}d`, color: "text-sky-300" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            whileHover={{ y: -3, boxShadow: "0 8px 22px rgba(0,229,255,0.12)" }}
            className="rounded-xl bg-ocean p-3 border border-white/5"
          >
            <p className="font-mono text-[10px] text-slate-500">{item.label}</p>
            <p className={`font-display text-lg font-bold font-tabular ${item.color}`}>{item.valor}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-ocean-mid p-3 border border-cyan/10">
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
