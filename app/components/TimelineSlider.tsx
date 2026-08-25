"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo } from "react";
import type { FloodRecord } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";

interface TimelineSliderProps {
  records: FloodRecord[];
  currentHour: number;
  onScrub: (hour: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

const MAX_HOURS = 168;

export default function TimelineSlider({
  records,
  currentHour,
  onScrub,
  isPlaying,
  onTogglePlay,
}: TimelineSliderProps) {
  const maxHour = records.length > 0 ? records[records.length - 1].hour : MAX_HOURS;
  const progressPct = Math.min(100, (currentHour / (maxHour || MAX_HOURS)) * 100);

  const activeRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records.reduce((closest, r) =>
      Math.abs(r.hour - currentHour) < Math.abs(closest.hour - currentHour) ? r : closest
    );
  }, [records, currentHour]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onScrub(parseFloat(e.target.value));
    },
    [onScrub]
  );

  const dayMarkers = useMemo(() => {
    const days = Math.floor((maxHour || MAX_HOURS) / 24);
    return Array.from({ length: days + 1 }, (_, i) => i * 24);
  }, [maxHour]);

  const trackColor = activeRecord ? riskColor(activeRecord.risk_level) : "#00F3FF";

  return (
    <div className="glass-panel p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pausar simulación" : "Reproducir simulación"}
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
            <p className="font-mono text-[10px] uppercase tracking-widest text-mist">Línea temporal</p>
            <p className="font-display text-lg text-fog font-tabular">
              Hora {currentHour.toFixed(0)}{" "}
              <span className="text-mist text-sm">/ {Math.round(maxHour || MAX_HOURS)}h</span>
            </p>
          </div>
        </div>

        {activeRecord && (
          <motion.div
            key={activeRecord.risk_level}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{
              color: trackColor,
              border: `1px solid ${trackColor}55`,
              backgroundColor: `${trackColor}14`,
            }}
          >
            {activeRecord.water_level_cm.toFixed(1)} cm
          </motion.div>
        )}
      </div>

      <div className="relative pt-2">
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
          max={maxHour || MAX_HOURS}
          step={1}
          value={currentHour}
          onChange={handleChange}
          className="absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cyan [&::-webkit-slider-thumb]:bg-abyss [&::-webkit-slider-thumb]:shadow-glow-cyan"
          aria-label="Deslizador de línea temporal, 0 a 168 horas"
        />

        <div className="mt-3 flex justify-between font-mono text-[10px] text-mist">
          {dayMarkers.map((h) => (
            <span key={h}>Día {h / 24}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
