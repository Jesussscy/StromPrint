"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { PuntoPrediccion } from "@/app/lib/api";
import { clasificarNivel, colorDeNivelCm, UMBRAL_CRITICO, UMBRAL_EMERGENCIA, UMBRAL_ALERTA } from "@/app/lib/riesgo";

/* Niveles de referencia de la "escala" vertical (cm) */
const LEVELS = [150, 120, 90, 60, 30, 0];

function clasificar(nivelCm: number): string {
  return clasificarNivel(nivelCm);
}

function colorNivel(nivelCm: number): string {
  return colorDeNivelCm(nivelCm);
}

function colorBar(nivel: number): string {
  if (nivel >= UMBRAL_CRITICO) return "#B000FF";
  if (nivel >= UMBRAL_EMERGENCIA) return "#FF0055";
  if (nivel >= UMBRAL_ALERTA) return "#FFD600";
  return "#00E5FF";
}

interface WaterLevelBarsProps {
  nivelAguaCm: number;
  punto: PuntoPrediccion | null;
  zonasCriticas?: number;
}

function WaterLevelBars({ nivelAguaCm, punto, zonasCriticas = 0 }: WaterLevelBarsProps) {
  const maxMark = 150;
  const pct = Math.min(1, Math.max(0, nivelAguaCm / maxMark));

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
            Nivel de Agua en Tiempo Real
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className="font-display text-4xl font-bold font-tabular"
              style={{ color: colorNivel(nivelAguaCm), textShadow: `0 0 16px ${colorNivel(nivelAguaCm)}55` }}
            >
              {nivelAguaCm.toFixed(0)}
            </span>
            <span className="text-xs text-slate-400">cm</span>
          </p>
        </div>
        {/* Badge de riesgo */}
        <span
          className="rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider"
          style={{
            color: colorNivel(nivelAguaCm),
            backgroundColor: `${colorNivel(nivelAguaCm)}18`,
            border: `1px solid ${colorNivel(nivelAguaCm)}55`,
          }}
        >
          {clasificar(nivelAguaCm)}
        </span>
      </div>

      {/* Barras horizontales por nivel */}
      <div className="space-y-1.5">
        {LEVELS.map((nivel) => {
          const alcanzado = nivelAguaCm >= nivel;
          const fillPct = alcanzado ? 100 : Math.max(0, (nivelAguaCm / maxMark) * 100);
          const barColor = colorBar(nivel);
          return (
            <div key={nivel} className="flex items-center gap-2">
              <span className="w-9 text-right font-mono text-[10px] sm:text-[11px] text-slate-500 font-tabular">{nivel}</span>
              <span
                className="text-right font-mono text-[10px] text-slate-600"
                style={{ width: 22 }}
              >
                cm
              </span>
              <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-white/[0.03]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{
                    backgroundColor: barColor,
                    boxShadow: alcanzado ? `0 0 12px ${barColor}` : "none",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Línea de marcador actual */}
      <div className="relative mt-3 h-px bg-white/10">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 w-1 -translate-x-1/2 rounded-full"
          style={{
            left: `${pct * 100}%`,
            backgroundColor: colorNivel(nivelAguaCm),
            boxShadow: `0 0 12px ${colorNivel(nivelAguaCm)}`,
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Pico máximo</span>
            <span className="font-display text-sm font-bold font-tabular" style={{ color: colorNivel(punto?.nivel_agua_cm ?? nivelAguaCm) }}>
              {punto ? punto.nivel_agua_cm.toFixed(0) : nivelAguaCm.toFixed(0)} cm
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Zonas críticas</span>
            <span className="font-display text-sm font-bold font-tabular" style={{ color: zonasCriticas > 0 ? "#FF0055" : "#00E5FF" }}>
              {zonasCriticas > 0 ? `🔴 ${zonasCriticas}` : "0"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(WaterLevelBars);
