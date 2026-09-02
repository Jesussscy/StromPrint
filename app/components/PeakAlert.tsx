"use client";

import { motion } from "framer-motion";
import type { PrediccionResponse } from "@/app/lib/api";
import { clasificarNivel, COLOR_POR_NIVEL } from "@/app/lib/riesgo";

/**
 * PeakAlert — aviso proactivo del pico previsto por el modelo.
 * Solo se muestra si la proyección supera el umbral de alerta (30 cm).
 */
export default function PeakAlert({ prediccion }: { prediccion: PrediccionResponse | null }) {
  if (!prediccion || !prediccion.puntos.length) return null;
  const max = prediccion.nivel_maximo_cm;
  if (max < 30) return null;

  const nivel = clasificarNivel(max);
  const color = COLOR_POR_NIVEL[nivel];
  const alcanzaAlerta = prediccion.puntos.filter((p) => p.nivel_agua_cm >= 30).length;
  const alcanzaEmergencia = prediccion.puntos.filter((p) => p.nivel_agua_cm >= 60).length;

  return (
    <motion.aside
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: `${color}44`, backgroundColor: `${color}0d` }}
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: `${color}66`, boxShadow: `0 0 16px ${color}40` }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold" style={{ color }}>
          Pico previsto: {max.toFixed(0)} cm a la hora {prediccion.hora_pico.toFixed(0)}h · Nivel {nivel}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {alcanzaEmergencia > 0 ? `${alcanzaEmergencia} h bajo nivel de emergencia` : `${alcanzaAlerta} h bajo nivel de alerta`} dentro de las {prediccion.horas_pronostico} h del pronóstico
        </p>
      </div>
      <span className="font-mono text-[10px] text-slate-500 hidden sm:block">
        {nivel === "Critico" ? "Coordinar evacuación" : nivel === "Emergencia" ? "Monitorear viviendas bajas" : nivel === "Alerta" ? "Preparar calles y sumideros" : "Nivel normal"}
      </span>
    </motion.aside>
  );
}