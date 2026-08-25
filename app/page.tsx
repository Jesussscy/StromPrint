"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Canvas3D from "@/app/components/Canvas3D";
import TimelineSlider from "@/app/components/TimelineSlider";
import MetricsPanel from "@/app/components/MetricsPanel";
import { runPrediction, type FloodRecord } from "@/app/lib/api";

const PLAYBACK_SPEED_MS = 220; // ms per simulated hour while auto-playing

export default function DashboardPage() {
  const [records, setRecords] = useState<FloodRecord[]>([]);
  const [currentHour, setCurrentHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPersisted, setTotalPersisted] = useState<number | null>(null);

  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSimulation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await runPrediction({
        duration_hours: 168,
        resolution_hours: 1,
        storm_peak_hour: 36,
        storm_intensity: 42,
        mean_sea_level: 8,
      });
      setRecords(result.records);
      setTotalPersisted(result.total_points);
      setCurrentHour(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al ejecutar la simulación.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSimulation();
  }, [loadSimulation]);

  useEffect(() => {
    if (isPlaying && records.length > 0) {
      playbackRef.current = setInterval(() => {
        setCurrentHour((prev) => {
          const maxHour = records[records.length - 1].hour;
          if (prev >= maxHour) {
            setIsPlaying(false);
            return maxHour;
          }
          return prev + 1;
        });
      }, PLAYBACK_SPEED_MS);
    }
    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current);
    };
  }, [isPlaying, records]);

  const activeRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records.reduce((closest, r) =>
      Math.abs(r.hour - currentHour) < Math.abs(closest.hour - currentHour) ? r : closest
    );
  }, [records, currentHour]);

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-10">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto mb-8 flex max-w-7xl flex-col gap-1"
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-glow-cyan animate-pulse-slow" />
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan/80">
            StormPrint · Manga, Cartagena de Indias
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold text-fog text-glow-cyan md:text-4xl">
          La huella que deja cada tormenta en el territorio
        </h1>
        <p className="max-w-2xl text-sm text-mist">
          Simulación física del nivel de acumulación de agua H(t) en el barrio Manga,
          integrando intensidad de lluvia, acoplamiento de marea y capacidad de drenaje
          territorial, resuelta mediante Runge-Kutta 45.
        </p>
        <div className="hairline mt-4" />
      </motion.header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-panel h-[420px] p-1 md:h-[560px]"
        >
          <Canvas3D record={activeRecord} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <MetricsPanel
            record={activeRecord}
            records={records}
            isLoading={isLoading}
            error={error}
            totalPersisted={totalPersisted}
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mx-auto mt-4 max-w-7xl"
      >
        <TimelineSlider
          records={records}
          currentHour={currentHour}
          onScrub={setCurrentHour}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
        />
      </motion.div>

      <footer className="mx-auto mt-8 max-w-7xl font-mono text-[10px] uppercase tracking-widest text-mist/60">
        m·H'' + c·H' + k·H = F_lluvia(t) + F_marea(t) — Modelo territorial, barrio Manga
      </footer>
    </main>
  );
}
