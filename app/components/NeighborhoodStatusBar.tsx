"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import type { PrediccionResponse, PuntoPrediccion } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";

interface NeighborhoodStatusBarProps {
  prediccion: PrediccionResponse | null;
  punto: PuntoPrediccion | null;
}

interface StatItemProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}

function StatItem({ label, value, sub, color, icon }: StatItemProps) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}12`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[8px] uppercase tracking-widest text-slate-600 truncate">{label}</p>
        <p className="font-display text-base font-bold font-tabular leading-tight" style={{ color }}>
          {value}
        </p>
        {sub && <p className="font-mono text-[9px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function NeighborhoodStatusBarInner({ prediccion, punto }: NeighborhoodStatusBarProps) {
  const stats = useMemo(() => {
    if (!prediccion || prediccion.puntos.length === 0) {
      return null;
    }

    const puntos = prediccion.puntos;
    const horasCritico = puntos.filter((p) => p.estado === "Critico").length;
    const horasEmergencia = puntos.filter((p) => p.estado === "Emergencia").length;
    const horasAlerta = puntos.filter((p) => p.estado === "Alerta").length;
    const horasNormal = puntos.filter((p) => p.estado === "Normal").length;

    const totalLluvia = puntos.reduce((s, p) => s + p.lluvia_mm_h, 0);

    const tendencia = prediccion.tendencia;
    const tendenciaLabel = tendencia === "creciente" ? "Creciente" : tendencia === "decreciente" ? "Decreciente" : "Estable";
    const tendenciaColor = tendencia === "creciente" ? "#E63946" : tendencia === "decreciente" ? "#2A9D8F" : "#64748B";

    // Estimate affected homes (based on zones with level > 60cm)
    const zonasConNivelCritico = new Set<number>();
    const zonasConNivelEmergencia = new Set<number>();
    puntos.forEach((p) => {
      if (p.nivel_agua_cm >= 100) zonasConNivelCritico.add(p.tiempo_hora);
      if (p.nivel_agua_cm >= 60) zonasConNivelEmergencia.add(p.tiempo_hora);
    });

    const horasConRiesgo = horasCritico + horasEmergencia;
    const horasEnAlerta = horasAlerta + horasEmergencia + horasCritico;

    return {
      horasCritico,
      horasEmergencia,
      horasAlerta,
      horasNormal,
      horasEnAlerta,
      horasConRiesgo,
      totalLluvia,
      tendenciaLabel,
      tendenciaColor,
      horaPico: prediccion.hora_pico,
      maxCm: prediccion.nivel_maximo_cm,
    };
  }, [prediccion]);

  if (!stats) return null;

  return (
    <div className="glass-strong rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan">
            Estado del Barrio
          </p>
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          Pronóstico {prediccion?.horas_pronostico ?? 48}h
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatItem
          label="Estado"
          value={prediccion?.puntos.at(-1)?.estado ?? "Normal"}
          color={riskColor(prediccion?.puntos.at(-1)?.estado ?? "Normal")}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>}
        />
        <StatItem
          label="Tendencia"
          value={stats.tendenciaLabel}
          color={stats.tendenciaColor}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
        />
        <StatItem
          label="Tiempo al pico"
          value={`${stats.horaPico.toFixed(0)}h`}
          sub={`Pico: ${stats.maxCm.toFixed(0)} cm`}
          color="#FF0055"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
        />
        <StatItem
          label="Horas en alerta"
          value={`${stats.horasEnAlerta}h`}
          sub={`de ${prediccion?.horas_pronostico ?? 48}h`}
          color="#FFD600"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
        />
        <StatItem
          label="Horas críticas"
          value={`${stats.horasCritico}h`}
          sub={stats.horasEmergencia > 0 ? `+ ${stats.horasEmergencia}h emerg.` : undefined}
          color="#B000FF"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
        />
        <StatItem
          label="Lluvia total"
          value={`${stats.totalLluvia.toFixed(0)} mm`}
          sub="acumulada"
          color="#00B4D8"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>}
        />
      </div>

      {/* Risk distribution bar */}
      <div className="mt-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full">
          <motion.div
            className="h-full"
            style={{ backgroundColor: "#00E5FF" }}
            animate={{ width: `${(stats.horasNormal / (prediccion?.horas_pronostico ?? 48)) * 100}%` }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            className="h-full"
            style={{ backgroundColor: "#FFD600" }}
            animate={{ width: `${(stats.horasAlerta / (prediccion?.horas_pronostico ?? 48)) * 100}%` }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            className="h-full"
            style={{ backgroundColor: "#FF0055" }}
            animate={{ width: `${(stats.horasEmergencia / (prediccion?.horas_pronostico ?? 48)) * 100}%` }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            className="h-full"
            style={{ backgroundColor: "#B000FF" }}
            animate={{ width: `${(stats.horasCritico / (prediccion?.horas_pronostico ?? 48)) * 100}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[7px] text-slate-600">
          <span>{stats.horasNormal}h normal</span>
          <span>{stats.horasAlerta}h alerta</span>
          <span>{stats.horasEmergencia}h emerg.</span>
          <span>{stats.horasCritico}h crítico</span>
        </div>
      </div>
    </div>
  );
}

export default memo(NeighborhoodStatusBarInner);
