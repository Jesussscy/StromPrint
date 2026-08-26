"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo } from "react";
import type { PuntoPrediccion } from "@/app/lib/api";
import { riskColor, formatHour, formatHourShort } from "@/app/lib/api";

interface TimelineSliderProps {
  puntos: PuntoPrediccion[];
  currentHour: number;
  onScrub: (hour: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export default function TimelineSlider({ puntos, currentHour, onScrub, isPlaying, onTogglePlay }: TimelineSliderProps) {
  const maxHour = puntos.length > 0 ? puntos[puntos.length - 1].tiempo_hora : 48;
  const progressPct = Math.min(100, (currentHour / (maxHour || 48)) * 100);

  const activePunto = useMemo(() => {
    if (puntos.length === 0) return null;
    return puntos.reduce((c, p) => Math.abs(p.tiempo_hora - currentHour) < Math.abs(c.tiempo_hora - currentHour) ? p : c);
  }, [puntos, currentHour]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { onScrub(parseFloat(e.target.value)); }, [onScrub]);

  const dayMarkers = useMemo(() => {
    const days = Math.floor((maxHour || 48) / 24);
    return Array.from({ length: days + 1 }, (_, i) => i * 24);
  }, [maxHour]);

  const trackColor = activePunto ? riskColor(activePunto.estado) : "#2A9D8F";

  const riskHeatmap = useMemo(() => {
    if (puntos.length === 0) return [];
    const step = Math.max(1, Math.floor(puntos.length / 120));
    return puntos.filter((_, i) => i % step === 0).map((p) => ({ color: riskColor(p.estado) }));
  }, [puntos]);

  return (
    <div className="card-dark p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pausar" : "Reproducir"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-navy-light text-accent transition hover:border-accent hover:shadow-glow"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="4" height="12" /><rect x="8" y="1" width="4" height="12" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="2,1 13,7 2,13" /></svg>
            )}
          </button>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">Línea temporal</p>
            <p className="font-display text-lg text-white font-tabular">
              {formatHour(currentHour)}
              <span className="text-slate-500 text-sm"> / {formatHourShort(maxHour)}</span>
            </p>
          </div>
        </div>

        {activePunto && (
          <motion.div key={activePunto.estado} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: trackColor, border: `1px solid ${trackColor}55`, backgroundColor: `${trackColor}15` }}
          >
            {activePunto.nivel_agua_cm.toFixed(1)} cm · {activePunto.estado}
          </motion.div>
        )}
      </div>

      {riskHeatmap.length > 0 && (
        <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full">
          {riskHeatmap.map((point, i) => (
            <div key={i} className="h-full flex-1" style={{ backgroundColor: point.color, opacity: 0.6 }} />
          ))}
        </div>
      )}

      <div className="relative pt-1">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-navy-lighter">
          <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ backgroundColor: trackColor }}
            animate={{ width: `${progressPct}%` }} transition={{ type: "tween", duration: 0.15 }} />
        </div>

        <input type="range" min={0} max={maxHour || 48} step={1} value={currentHour} onChange={handleChange}
          className="absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent"
          aria-label="Deslizador de línea temporal" />

        <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-500">
          {dayMarkers.map((h) => (
            <span key={h}>{h === 0 ? "Hoy" : `Día ${h / 24}`}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
