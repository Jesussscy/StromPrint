"use client";

import { motion } from "framer-motion";
import type { DaySummary } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";

interface ForecastDayCardProps {
  summary: DaySummary;
  index: number;
}

export default function ForecastDayCard({ summary, index }: ForecastDayCardProps) {
  const accent = riskColor(summary.estadoDominante);
  const rainPct = summary.horasTotales > 0
    ? Math.round((summary.horasConLluvia / summary.horasTotales) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 * index }}
      className="glass-panel flex flex-col gap-3 p-4"
      style={{ borderColor: `${accent}25` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-mist">
            {summary.dayLabel}
          </p>
          <p className="font-display text-lg text-fog font-bold">
            Dia {summary.dayIndex + 1}
          </p>
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border-2"
          style={{ borderColor: accent, boxShadow: `0 0 16px ${accent}33` }}
        >
          <span className="font-display text-sm font-tabular" style={{ color: accent }}>
            {summary.nivelMaximo.toFixed(0)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
            <span className="font-mono text-[10px] text-mist">Lluvia</span>
          </div>
          <span className="font-mono text-[11px] text-fog font-tabular">
            {summary.lluviaTotal.toFixed(1)} mm
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF7700" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="font-mono text-[10px] text-mist">Nivel max</span>
          </div>
          <span className="font-mono text-[11px] font-tabular" style={{ color: accent }}>
            {summary.nivelMaximo.toFixed(1)} cm
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-mist">Estado</span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
            style={{
              color: accent,
              border: `1px solid ${accent}40`,
              backgroundColor: `${accent}12`,
            }}
          >
            {summary.estadoDominante}
          </span>
        </div>
      </div>

      {/* Barra de horas con lluvia */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[9px] text-mist">Horas con lluvia</span>
          <span className="font-mono text-[9px] text-mist">
            {summary.horasConLluvia}/{summary.horasTotales}h
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-abyss-3">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-cyan"
            initial={{ width: 0 }}
            animate={{ width: `${rainPct}%` }}
            transition={{ duration: 0.8, delay: 0.2 * index }}
          />
        </div>
      </div>
    </motion.div>
  );
}
