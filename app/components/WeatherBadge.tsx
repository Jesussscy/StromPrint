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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="2">
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
        <line x1="8" y1="16" x2="8.01" y2="21" />
        <line x1="12" y1="18" x2="12.01" y2="23" />
        <line x1="16" y1="16" x2="16.01" y2="21" />
      </svg>
    );
  }
  if (lluvia > 0.5) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C8BA1" strokeWidth="2">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export default function WeatherBadge({ meteorologia, isLoading }: WeatherBadgeProps) {
  if (isLoading) {
    return (
      <div className="glass-panel flex items-center gap-3 px-4 py-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan/30 border-t-cyan" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-mist">
          Cargando clima...
        </span>
      </div>
    );
  }

  if (!meteorologia) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel flex flex-wrap items-center gap-4 px-4 py-2.5"
    >
      <div className="flex items-center gap-2">
        <WeatherIcon lluvia={meteorologia.horas_con_lluvia} />
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-mist">Clima Actual</p>
          <p className="font-display text-sm text-fog font-tabular">
            {meteorologia.temp_max_c.toFixed(0)}°C
          </p>
        </div>
      </div>

      <div className="h-6 w-px bg-cyan/15" />

      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="2">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-mist">Lluvia</p>
          <p className="font-display text-sm text-fog font-tabular">
            {meteorologia.lluvia_total_mm.toFixed(1)} mm
          </p>
        </div>
      </div>

      <div className="h-6 w-px bg-cyan/15" />

      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C8BA1" strokeWidth="2">
          <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
        </svg>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-mist">Viento</p>
          <p className="font-display text-sm text-fog font-tabular">
            {meteorologia.viento_max_kmh.toFixed(0)} km/h
          </p>
        </div>
      </div>

      <div className="h-6 w-px bg-cyan/15" />

      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
        </svg>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-mist">Humedad</p>
          <p className="font-display text-sm text-fog font-tabular">
            {meteorologia.humedad_promedio.toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="ml-auto">
        <p className="font-mono text-[8px] uppercase tracking-widest text-mist/50">
          Open-Meteo · CC BY 4.0
        </p>
      </div>
    </motion.div>
  );
}
