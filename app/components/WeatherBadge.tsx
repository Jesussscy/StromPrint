"use client";

import { motion } from "framer-motion";
import type { MeteorologiaResumen } from "@/app/lib/api";

interface WeatherBadgeProps {
  meteorologia: MeteorologiaResumen | null;
  isLoading: boolean;
}

function WeatherIcon({ lluvia }: { lluvia: number }) {
  if (lluvia > 5) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="2">
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
        <line x1="8" y1="16" x2="8.01" y2="21" /><line x1="12" y1="18" x2="12.01" y2="23" /><line x1="16" y1="16" x2="16.01" y2="21" />
      </svg>
    );
  }
  if (lluvia > 0.5) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    </svg>
  );
}

export default function WeatherBadge({ meteorologia, isLoading }: WeatherBadgeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 glass-subtle rounded-lg px-3 py-1.5">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Cargando...</span>
      </div>
    );
  }

  if (!meteorologia) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-wrap items-center gap-3 glass-subtle rounded-lg px-3 py-1.5"
    >
      <div className="flex items-center gap-1.5">
        <WeatherIcon lluvia={meteorologia.horas_con_lluvia} />
        <span className="font-mono text-[10px] text-slate-300 font-tabular">{meteorologia.temp_max_c.toFixed(0)}°C</span>
      </div>
      <div className="h-4 w-px bg-cyan/10" />
      <div className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
        <span className="font-mono text-[10px] text-slate-300 font-tabular">{meteorologia.lluvia_total_mm.toFixed(1)} mm</span>
      </div>
      <div className="h-4 w-px bg-cyan/10" />
      <div className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2" /></svg>
        <span className="font-mono text-[10px] text-slate-300 font-tabular">{meteorologia.viento_max_kmh.toFixed(0)} km/h</span>
      </div>
    </motion.div>
  );
}
