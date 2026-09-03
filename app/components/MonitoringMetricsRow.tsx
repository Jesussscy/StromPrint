"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { PuntoPrediccion, PrediccionResponse } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";
import { clasificarNivel, COLOR_POR_NIVEL } from "@/app/lib/riesgo";

interface MonitoringMetricsRowProps {
  punto: PuntoPrediccion | null;
  prediccion: PrediccionResponse | null;
  isLoading: boolean;
}

function MetricCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function TrendArrow({ trend }: { trend?: "up" | "down" | "stable" }) {
  if (!trend) return null;
  const color = trend === "up" ? "#E63946" : trend === "down" ? "#2A9D8F" : "#64748B";
  return (
    <span style={{ color }} className="inline-flex items-center">
      {trend === "up" ? (
        <svg className="inline-block -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
      ) : trend === "down" ? (
        <svg className="inline-block -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>
      ) : (
        <svg className="inline-block -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
      )}
    </span>
  );
}

export default function MonitoringMetricsRow({ punto, prediccion, isLoading }: MonitoringMetricsRowProps) {
  const nivel = punto?.nivel_agua_cm ?? 0;
  const nivelColor = nivel > 0 ? riskColor(clasificarNivel(nivel)) : "#00E5FF";
  const tendencia = prediccion?.tendencia === "creciente" ? "up" as const : prediccion?.tendencia === "decreciente" ? "down" as const : "stable" as const;
  const horaPico = prediccion?.hora_pico ?? 0;
  const maxCm = prediccion?.nivel_maximo_cm ?? 0;
  const velocidad = punto?.velocidad_cambio ?? 0;
  const estado = clasificarNivel(nivel);

  const riskConfig: Record<string, { color: string; bg: string; border: string; label: string; action: string; icon: React.ReactNode }> = {
    Normal: {
      color: "#00E5FF",
      bg: "rgba(0,229,255,0.08)",
      border: "rgba(0,229,255,0.25)",
      label: "NORMAL",
      action: "Sin riesgo de inundación",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
    },
    Alerta: {
      color: "#FFD600",
      bg: "rgba(255,214,0,0.08)",
      border: "rgba(255,214,0,0.25)",
      label: "ALERTA",
      action: "Preparar calles y sumideros",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    },
    Emergencia: {
      color: "#FF0055",
      bg: "rgba(255,0,85,0.08)",
      border: "rgba(255,0,85,0.25)",
      label: "EMERGENCIA",
      action: "Monitorear viviendas bajas",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF0055" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    },
    Critico: {
      color: "#B000FF",
      bg: "rgba(176,0,255,0.08)",
      border: "rgba(176,0,255,0.25)",
      label: "CRITICO",
      action: "Coordinar evacuación",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B000FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    },
  };

  const rc = riskConfig[estado] ?? riskConfig.Normal;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* ── COL 1: NIVEL ACTUAL ── */}
      <MetricCard>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-1">
              Nivel Actual
            </p>
            <div className="flex items-baseline gap-2">
              <AnimatePresence mode="wait">
                <motion.span
                  key={nivel.toFixed(1)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="font-display text-4xl md:text-5xl font-bold font-tabular leading-none"
                  style={{ color: nivelColor, textShadow: `0 0 20px ${nivelColor}33` }}
                >
                  {nivel.toFixed(1)}
                </motion.span>
              </AnimatePresence>
              <span className="text-sm text-slate-400 font-medium">cm</span>
            </div>
          </div>
          <div className="text-right">
            <TrendArrow trend={tendencia} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Velocidad</span>
            <span className="font-mono text-xs font-tabular" style={{ color: velocidad > 0 ? "#E63946" : "#2A9D8F" }}>
              {velocidad > 0 ? "+" : ""}{velocidad.toFixed(1)} cm/h
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Pico</span>
            <span className="font-mono text-xs font-tabular text-slate-300">
              {horaPico.toFixed(0)}h · {maxCm.toFixed(0)} cm
            </span>
          </div>
        </div>

        {/* Micro gauge */}
        <div className="mt-3">
          <div className="relative h-1.5 rounded-full bg-black/40 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: "linear-gradient(to right, #00E5FF, #FFD600, #FF0055, #B000FF)",
              }}
              animate={{ width: `${Math.min(100, (nivel / Math.max(maxCm, 120)) * 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="mt-0.5 flex justify-between font-mono text-[7px] text-slate-600">
            <span>0</span>
            <span>30</span>
            <span>60</span>
            <span>100</span>
          </div>
        </div>
      </MetricCard>

      {/* ── COL 2: METEOROLOGÍA ── */}
      <MetricCard>
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-3">
          Meteorología
        </p>
        <div className="grid grid-cols-2 gap-3">
          <MeteoStat
            label="Temperatura"
            value={punto ? (prediccion?.meteorologia_resumen?.temp_max_c ?? 28).toFixed(1) : "—"}
            unit="°C"
            color="#FFD600"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /></svg>}
          />
          <MeteoStat
            label="Humedad"
            value={punto ? (prediccion?.meteorologia_resumen?.humedad_promedio ?? 75).toFixed(0) : "—"}
            unit="%"
            color="#00E5FF"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>}
          />
          <MeteoStat
            label="Lluvia"
            value={punto ? punto.lluvia_mm_h.toFixed(1) : "—"}
            unit="mm/h"
            color="#00F3FF"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="20" y1="16.58" x2="20" y2="16.58" /><line x1="12" y1="16.58" x2="12" y2="16.58" /><line x1="4" y1="16.58" x2="4" y2="16.58" /><path d="M17 7h-1.78A2.5 2.5 0 0 0 13 5.5A2.5 2.5 0 0 0 10.5 8H9a4 4 0 0 0-4 4v6h16v-6a4 4 0 0 0-4-4z" /></svg>}
          />
          <MeteoStat
            label="Viento"
            value={punto ? (prediccion?.meteorologia_resumen?.viento_max_kmh ?? 0).toFixed(0) : "—"}
            unit="km/h"
            color="#94A3B8"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2" /><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2" /><path d="M12.59 19.41A2 2 0 1 0 14 16H2" /></svg>}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[8px] uppercase tracking-widest text-slate-600">Marea</span>
          <span className="font-mono text-[10px] font-tabular text-slate-400">
            {punto ? punto.marea_cm.toFixed(1) : "—"} cm
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] uppercase tracking-widest text-slate-600">Suelo</span>
          <span className="font-mono text-[10px] font-tabular text-slate-400">
            {punto ? (punto.saturacion_suelo * 100).toFixed(0) : "—"}% sat.
          </span>
        </div>
      </MetricCard>

      {/* ── COL 3: RIESGO ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl p-4"
        style={{ backgroundColor: rc.bg, borderColor: rc.border, borderWidth: 1 }}
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-2">
          Estado de Riesgo
        </p>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${rc.color}15`,
              border: `1.5px solid ${rc.color}40`,
              boxShadow: `0 0 20px ${rc.color}20`,
            }}
          >
            {rc.icon}
          </div>
          <div>
            <AnimatePresence mode="wait">
              <motion.p
                key={estado}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="font-display text-xl font-bold leading-tight"
                style={{ color: rc.color }}
              >
                {rc.label}
              </motion.p>
            </AnimatePresence>
            <p className="text-[10px] text-slate-400 mt-0.5">{rc.action}</p>
          </div>
        </div>

        {/* Risk level indicator */}
        <div className="flex gap-1 mb-3">
          {["Normal", "Alerta", "Emergencia", "Critico"].map((nivel) => {
            const colors = ["#00E5FF", "#FFD600", "#FF0055", "#B000FF"];
            const labels = ["N", "A", "E", "C"];
            const idx = ["Normal", "Alerta", "Emergencia", "Critico"].indexOf(estado);
            const nivelIdx = ["Normal", "Alerta", "Emergencia", "Critico"].indexOf(nivel);
            const isActive = nivelIdx <= idx;
            return (
              <div key={nivel} className="flex-1 text-center">
                <div
                  className="h-2 rounded-full mb-1 transition-all duration-300"
                  style={{
                    backgroundColor: isActive ? colors[nivelIdx] : "rgba(255,255,255,0.05)",
                    boxShadow: isActive ? `0 0 8px ${colors[nivelIdx]}40` : "none",
                  }}
                />
                <span className="font-mono text-[7px] uppercase tracking-wider" style={{ color: isActive ? colors[nivelIdx] : "#475569" }}>
                  {labels[nivelIdx]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Peak alert inline */}
        {maxCm >= 30 && (
          <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={rc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <span className="font-mono text-[10px] text-slate-300">
              Pico: <span className="font-bold" style={{ color: rc.color }}>{maxCm.toFixed(0)} cm</span> a la hora {horaPico.toFixed(0)}h
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function MeteoStat({ label, value, unit, color, icon }: {
  label: string; value: string; unit: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}12`, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[7px] uppercase tracking-widest text-slate-600">{label}</p>
        <p className="font-display text-sm font-bold font-tabular leading-tight" style={{ color }}>{value} <span className="text-[10px] font-normal text-slate-500">{unit}</span></p>
      </div>
    </div>
  );
}
