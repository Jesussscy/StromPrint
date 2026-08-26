"use client";

import { motion } from "framer-motion";
import type { DaySummary } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";

interface ForecastDayCardProps {
  summary: DaySummary;
  index: number;
}

function WeatherIcon({ nivel }: { nivel: number }) {
  if (nivel >= 100) return <span className="text-lg">🚨</span>;
  if (nivel >= 60) return <span className="text-lg">⚠️</span>;
  if (nivel >= 30) return <span className="text-lg">🌧️</span>;
  if (nivel > 0) return <span className="text-lg">⛅</span>;
  return <span className="text-lg">☀️</span>;
}

export default function ForecastDayCard({ summary, index }: ForecastDayCardProps) {
  const accent = riskColor(summary.estadoDominante);
  const rainPct = summary.horasTotales > 0
    ? Math.round((summary.horasConLluvia / summary.horasTotales) * 100)
    : 0;

  const estadoText = summary.nivelMaximo >= 100
    ? "Evacuación"
    : summary.nivelMaximo >= 60
    ? "Emergencia"
    : summary.nivelMaximo >= 30
    ? "Alerta"
    : "Sin riesgo";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 * index }}
      className="rounded-xl bg-navy-light/50 border border-navy-lighter p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{summary.dayLabel}</p>
          <p className="font-display text-lg text-white font-bold">Día {summary.dayIndex + 1}</p>
        </div>
        <div className="flex items-center gap-2">
          <WeatherIcon nivel={summary.nivelMaximo} />
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border-2"
            style={{ borderColor: accent, boxShadow: `0 0 16px ${accent}33` }}
          >
            <span className="font-display text-sm font-tabular" style={{ color: accent }}>
              {summary.nivelMaximo.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-400">💧 Lluvia acumulada</span>
          <span className="font-mono text-[11px] text-slate-300 font-tabular">{summary.lluviaTotal.toFixed(1)} mm</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-400">📍 Altura máx</span>
          <span className="font-mono text-[11px] font-tabular" style={{ color: accent }}>{summary.nivelMaximo.toFixed(1)} cm</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-400">Estado</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color: accent, border: `1px solid ${accent}40`, backgroundColor: `${accent}15` }}>
            {estadoText}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[9px] text-slate-500">Horas con lluvia</span>
          <span className="font-mono text-[9px] text-slate-500">{summary.horasConLluvia}/{summary.horasTotales}h</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-navy-lighter">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${rainPct}%` }}
            transition={{ duration: 0.8, delay: 0.2 * index }}
          />
        </div>
      </div>
    </motion.div>
  );
}
