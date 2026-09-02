"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { DaySummary } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";

interface ForecastDayCardProps {
  summary: DaySummary;
  index: number;
}

function WeatherIcon({ nivel }: { nivel: number }) {
  if (nivel >= 100) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B000FF" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  );
  if (nivel >= 60) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF0055" strokeWidth="2"><path d="M12 2L2 22h20L12 2z" /><line x1="12" y1="9" x2="12" y2="15" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  );
  if (nivel >= 30) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD600" strokeWidth="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" /><line x1="8" y1="16" x2="8.01" y2="21" /><line x1="12" y1="18" x2="12.01" y2="23" /><line x1="16" y1="16" x2="16.01" y2="21" /></svg>
  );
  if (nivel > 0) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>
  );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
  );
}

function ProgressRing({ nivel, color }: { nivel: number; color: string }) {
  const r = 38;
  const stroke = 4;
  const nr = r - stroke / 2;
  const circ = nr * 2 * Math.PI;
  const pct = Math.min(nivel / 100, 1);
  const offset = circ - pct * circ;

  return (
    <svg width={r * 2} height={r * 2} className="block">
      <circle
        stroke="rgba(255,255,255,0.06)"
        fill="none"
        strokeWidth={stroke}
        r={nr}
        cx={r}
        cy={r}
      />
      <circle
        stroke={color}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`}
        style={{
          strokeDashoffset: offset,
          transition: "stroke-dashoffset 1s ease",
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
        r={nr}
        cx={r}
        cy={r}
      />
      <text
        x={r}
        y={r - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize="18"
        fontWeight="bold"
        fontFamily="var(--font-display)"
      >
        {nivel.toFixed(0)}
      </text>
      <text
        x={r}
        y={r + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#94A3B8"
        fontSize="9"
        fontFamily="var(--font-mono)"
      >
        cm
      </text>
    </svg>
  );
}

function MiniBarChart({ lluviaMax }: { lluviaMax: number }) {
  const bars = [
    Math.max(0.1, lluviaMax * 0.3),
    Math.max(0.1, lluviaMax * 0.7),
    Math.max(0.1, lluviaMax),
    Math.max(0.1, lluviaMax * 0.5),
  ];
  const maxBar = Math.max(...bars, 1);

  return (
    <div className="flex items-end gap-1 h-8">
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-t" style={{ backgroundColor: "rgba(0,210,255,0.3)", height: `${(h / maxBar) * 100}%` }} />
      ))}
    </div>
  );
}

function ForecastDayCard({ summary, index }: ForecastDayCardProps) {
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
      className="glass rounded-2xl p-4 flex flex-col items-center"
    >
      <div className="flex items-center justify-between w-full mb-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{summary.dayLabel}</p>
          <p className="font-display text-lg text-white font-bold">Día {summary.dayIndex + 1}</p>
        </div>
        <WeatherIcon nivel={summary.nivelMaximo} />
      </div>

      <ProgressRing nivel={summary.nivelMaximo} color={accent} />

      <p className="font-mono text-[9px] uppercase tracking-wider mt-2" style={{ color: accent }}>
        {estadoText}
      </p>

      <div className="w-full mt-3">
        <MiniBarChart lluviaMax={summary.lluviaTotal} />
      </div>

      <div className="flex flex-col gap-1.5 mt-3 w-full">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-400">Lluvia</span>
          <span className="font-mono text-[11px] text-slate-500 font-tabular">{summary.lluviaTotal.toFixed(1)} mm</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-400">Horas lluvia</span>
          <span className="font-mono text-[11px] text-slate-500 font-tabular">{summary.horasConLluvia}h / {summary.horasTotales}h</span>
        </div>
      </div>

      <div className="w-full mt-3">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
            initial={{ width: 0 }}
            animate={{ width: `${rainPct}%` }}
            transition={{ duration: 0.8, delay: 0.2 * index }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default memo(ForecastDayCard);
