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

export default function TimelineSlider({
  puntos,
  currentHour,
  onScrub,
  isPlaying,
  onTogglePlay,
}: TimelineSliderProps) {
  const maxHour = puntos.length > 0 ? puntos[puntos.length - 1].tiempo_hora : 72;
  const progressPct = Math.min(100, (currentHour / (maxHour || 72)) * 100);

  const activePunto = useMemo(() => {
    if (puntos.length === 0) return null;
    return puntos.reduce((closest, p) =>
      Math.abs(p.tiempo_hora - currentHour) < Math.abs(closest.tiempo_hora - currentHour) ? p : closest
    );
  }, [puntos, currentHour]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onScrub(parseFloat(e.target.value));
    },
    [onScrub]
  );

  const dayMarkers = useMemo(() => {
    const days = Math.floor((maxHour || 72) / 24);
    return Array.from({ length: days + 1 }, (_, i) => i * 24);
  }, [maxHour]);

  const trackColor = activePunto ? riskColor(activePunto.estado) : "#00F3FF";

  // Mini heatmap of risk levels along the timeline
  const riskHeatmap = useMemo(() => {
    if (puntos.length === 0) return [];
    const step = Math.max(1, Math.floor(puntos.length / 100));
    return puntos.filter((_, i) => i % step === 0).map((p) => ({
      hour: p.tiempo_hora,
      color: riskColor(p.estado),
    }));
  }, [puntos]);

  return (
    <div className="glass-panel p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pausar prediccion" : "Reproducir prediccion"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan/30 bg-abyss-3/60 text-cyan transition hover:border-cyan hover:shadow-glow-cyan"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="1" width="4" height="12" />
                <rect x="8" y="1" width="4" height="12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <polygon points="2,1 13,7 2,13" />
              </svg>
            )}
          </button>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-mist">Linea temporal</p>
            <p className="font-display text-lg text-fog font-tabular">
              {formatHour(currentHour)}
              <span className="text-mist text-sm"> / {formatHourShort(maxHour)}</span>
            </p>
          </div>
        </div>

        {activePunto && (
          <motion.div
            key={activePunto.estado}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              color: trackColor,
              border: `1px solid ${trackColor}55`,
              backgroundColor: `${trackColor}14`,
            }}
          >
            {activePunto.nivel_agua_cm.toFixed(1)} cm \u00b7 {activePunto.estado}
          </motion.div>
        )}
      </div>

      {/* Risk heatmap */}
      {riskHeatmap.length > 0 && (
        <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full">
          {riskHeatmap.map((point, i) => (
            <div
              key={i}
              className="h-full flex-1"
              style={{ backgroundColor: point.color, opacity: 0.6 }}
            />
          ))}
        </div>
      )}

      <div className="relative pt-1">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-abyss-3">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: trackColor }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "tween", duration: 0.15 }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-40 blur-md"
            style={{ width: `${progressPct}%`, backgroundColor: trackColor }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={maxHour || 72}
          step={1}
          value={currentHour}
          onChange={handleChange}
          className="absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cyan [&::-webkit-slider-thumb]:bg-abyss [&::-webkit-slider-thumb]:shadow-glow-cyan"
          aria-label="Deslizador de linea temporal"
        />

        <div className="mt-2 flex justify-between font-mono text-[9px] text-mist">
          {dayMarkers.map((h) => (
            <span key={h}>{h === 0 ? "Hoy" : `Dia ${h / 24}`}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
