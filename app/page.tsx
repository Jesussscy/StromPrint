"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Canvas3D from "@/app/components/Canvas3D";
import TimelineSlider from "@/app/components/TimelineSlider";
import MetricsPanel from "@/app/components/MetricsPanel";
import WeatherBadge from "@/app/components/WeatherBadge";
import EquationDisplay from "@/app/components/EquationDisplay";
import ForecastDayCard from "@/app/components/ForecastDayCard";
import {
  predecir,
  computeDaySummaries,
  type PuntoPrediccion,
  type PrediccionResponse,
} from "@/app/lib/api";

const PLAYBACK_SPEED_MS = 200;

export default function DashboardPage() {
  const [prediccion, setPrediccion] = useState<PrediccionResponse | null>(null);
  const [currentHour, setCurrentHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPrediction = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await predecir({
        horas_pronostico: 72,
        nivel_marea_cm: 8,
        usar_datos_meteo: true,
      });
      setPrediccion(result);
      setCurrentHour(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al cargar prediccion.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrediction();
  }, [loadPrediction]);

  useEffect(() => {
    if (isPlaying && prediccion && prediccion.puntos.length > 0) {
      playbackRef.current = setInterval(() => {
        setCurrentHour((prev) => {
          const maxHour = prediccion.puntos[prediccion.puntos.length - 1].tiempo_hora;
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
  }, [isPlaying, prediccion]);

  const activePunto = useMemo(() => {
    if (!prediccion || prediccion.puntos.length === 0) return null;
    return prediccion.puntos.reduce((closest, p) =>
      Math.abs(p.tiempo_hora - currentHour) < Math.abs(closest.tiempo_hora - currentHour) ? p : closest
    );
  }, [prediccion, currentHour]);

  const daySummaries = useMemo(() => {
    if (!prediccion) return [];
    return computeDaySummaries(prediccion.puntos);
  }, [prediccion]);

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-10">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto mb-4 max-w-7xl flex flex-col gap-2"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-glow-cyan animate-pulse-slow" />
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan/80">
              StormPrint \u00b7 Manga, Cartagena de Indias
            </p>
          </div>
          <WeatherBadge
            meteorologia={prediccion?.meteorologia_resumen ?? null}
            isLoading={isLoading}
          />
        </div>
        <h1 className="font-display text-3xl font-bold text-fog text-glow-cyan md:text-4xl">
          La huella que deja cada tormenta en el territorio
        </h1>
        <p className="max-w-3xl text-sm text-mist">
          Simulacion fisica del nivel de acumulacion de agua H(t) en el barrio Manga,
          integrando intensidad de lluvia, acoplamiento de marea, efecto del viento y
          capacidad de drenaje territorial. Resuelta como EDO de segundo orden mediante
          Runge-Kutta 45.
        </p>
        <div className="hairline mt-2" />
      </motion.header>

      {/* Ecuacion */}
      <div className="mx-auto mb-4 max-w-7xl">
        <EquationDisplay
          ecuacion={prediccion?.ecuacion}
          parametros={
            activePunto
              ? {
                  humedadSuelo: activePunto.saturacion_suelo,
                  diasLluviosos: prediccion?.meteorologia_resumen.dias_lluviosos ?? 0,
                }
              : undefined
          }
        />
      </div>

      {/* Grid principal: 3D + Metricas */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-panel h-[400px] p-1 md:h-[520px]"
        >
          <Canvas3D punto={activePunto} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <MetricsPanel
            punto={activePunto}
            prediccion={prediccion}
            isLoading={isLoading}
            error={error}
          />
        </motion.div>
      </div>

      {/* Forecast 3 dias */}
      {daySummaries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mx-auto mt-4 max-w-7xl"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-mist">
            Pronostico 3 Dias \u2014 Barrio Manga
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {daySummaries.slice(0, 3).map((summary, idx) => (
              <ForecastDayCard key={summary.dayIndex} summary={summary} index={idx} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mx-auto mt-4 max-w-7xl"
      >
        <TimelineSlider
          puntos={prediccion?.puntos ?? []}
          currentHour={currentHour}
          onScrub={setCurrentHour}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
        />
      </motion.div>

      {/* Footer */}
      <footer className="mx-auto mt-8 max-w-7xl flex flex-col gap-1">
        <div className="hairline" />
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mist/60">
            {"m\u00b7H\u2032\u2032(t) + c(t)\u00b7H\u2032(t) + k(t)\u00b7H(t) = F_lluvia(t) + F_marea(t) + F_viento(t)"}
          </p>
          <p className="font-mono text-[9px] text-mist/40">
            Datos meteorologicos: Open-Meteo \u00b7 CC BY 4.0 \u00b7 Manga, Cartagena
          </p>
        </div>
      </footer>
    </main>
  );
}
