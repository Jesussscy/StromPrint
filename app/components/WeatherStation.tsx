"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import FreshnessBadge from "@/app/components/FreshnessBadge";
import { SkeletonStat, Skeleton } from "@/app/components/Skeleton";
import {
  ESTADO_METEO_COLOR,
  ESTADO_METEO_LABEL,
  ES_DIA_LLUVIOSO,
  fuenteLabel,
  formatConfianza,
  type EstadoMeteo,
} from "@/app/lib/api";

interface PronosticoIter {
  dia: string;
  lluvia_mm: number;
  temp_max_c: number;
  estado?: EstadoMeteo;
}

interface WeatherData {
  source: string;
  fuente: string;
  confianza: number;
  estado: EstadoMeteo;
  estado_label: string;
  nubosidad_pct: number;
  timestamp: string;
  temperatura: number;
  humedad: number;
  precipitacion_actual_mm_h: number;
  velocidad_viento_kmh: number;
  direccion_viento_deg: number;
  dias_lluviosos_consecutivos: number;
  humedad_suelo_pct: number;
  lluvia_total_mm: number;
  temp_max_c: number;
  temp_min_c: number;
  viento_max_kmh: number;
  lluvia_manana_mm: number;
  marea_actual_cm: number;
  proxima_pleamar: string;
  parametros_simulacion?: { mean_sea_level?: number; [k: string]: unknown };
  pronostico: PronosticoIter[];
}

function StatPill({ label, value, unit, icon, color }: {
  label: string; value: string; unit: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color }}>{icon}</span>
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
      </div>
      <p className="font-display text-2xl font-bold font-tabular" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-500">{unit}</p>
    </div>
  );
}

export default function WeatherStation() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/weather${force ? "?force_refresh=true" : ""}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setWeather(data.weather);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el clima");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  const dias = ["Hoy", "Mañana", "Pasado mañana"];

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg glass-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><path d="M17 18a5 5 0 0 0-10 0" /><path d="M12 9V2m0 0l-3 3m3-3l3 3" /><line x1="4.22" y1="12.22" x2="5.64" y2="13.64" /><line x1="18.36" y1="13.64" x2="19.78" y2="12.22" /></svg>
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white">Estación Meteorológica — Manga</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
              {weather ? (weather.fuente === "open-meteo" ? <><svg className="inline-block mr-1 -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01m2.99-3H8m-4.99 3L8 9l3 3 3-6 2 4h2.01" /></svg>Open-Meteo en vivo</> : weather.fuente === "historico" ? <><svg className="inline-block mr-1 -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFD600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>Histórico mensual</> : <><svg className="inline-block mr-1 -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF8A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>Promedio estimado</>) : "Cargando..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FreshnessBadge timestamp={weather?.timestamp} fuente={weather?.fuente} labelPrefix="Actualizado" />
          <button
            onClick={() => fetchWeather(true)}
            disabled={refreshing}
            className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition disabled:opacity-50 min-h-[44px]"
          >
            {refreshing ? "Actualizando..." : <><svg className="inline-block mr-1 -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>Actualizar</>}
          </button>
        </div>
      </div>

      {loading && !weather ? (
        <div className="space-y-4" aria-busy="true" aria-label="Cargando datos meteorológicos">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonStat key={i} />)}
          </div>
          <Skeleton className="h-24" />
        </div>
      ) : error && !weather ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-sm text-red-400">
          <p>{error}</p>
          <button
            onClick={() => fetchWeather(true)}
            className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition min-h-[44px]"
          >
            Reintentar
          </button>
        </div>
      ) : weather ? (
        <>
          {/* Banner de estado meteorológico + confianza de la fuente */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: `${ESTADO_METEO_COLOR[weather.estado]}44`, backgroundColor: `${ESTADO_METEO_COLOR[weather.estado]}0d` }}
          >
            <span className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: ESTADO_METEO_COLOR[weather.estado], boxShadow: `0 0 12px ${ESTADO_METEO_COLOR[weather.estado]}` }} />
            <div>
              <p className="font-display text-sm font-bold" style={{ color: ESTADO_METEO_COLOR[weather.estado] }}>
                {ESTADO_METEO_LABEL[weather.estado] ?? weather.estado_label}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                {ES_DIA_LLUVIOSO(weather.estado)
                  ? "Jornada con lluvia: riesgo dominado por precipitación"
                  : weather.estado === "sin_datos"
                    ? "Sin datos en vivo: usando estimación de respaldo"
                    : "Día sin lluvia significativa: nivel gobernado por marea"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Confianza</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: ESTADO_METEO_COLOR[weather.estado] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((weather.confianza ?? 0) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <span className="font-mono text-xs text-slate-300 font-tabular">{formatConfianza(weather.confianza)}</span>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Fuente</p>
                <p className="font-mono text-xs text-slate-300">{fuenteLabel(weather.fuente)}</p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <StatPill label="Temperatura" value={weather.temperatura.toFixed(1)} unit="°C" color="#FFD600" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /></svg>} />
            <StatPill label="Humedad" value={weather.humedad.toFixed(0)} unit="%" color="#00E5FF" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>} />
            <StatPill label="Lluvia" value={weather.precipitacion_actual_mm_h.toFixed(1)} unit="mm/h" color="#00F3FF" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="20" y1="16.58" x2="20" y2="16.58" /><line x1="12" y1="16.58" x2="12" y2="16.58" /><line x1="4" y1="16.58" x2="4" y2="16.58" /><path d="M17 7h-1.78A2.5 2.5 0 0 0 13 5.5A2.5 2.5 0 0 0 10.5 8H9a4 4 0 0 0-4 4v6h16v-6a4 4 0 0 0-4-4z" /></svg>} />
            <StatPill label="Viento" value={weather.velocidad_viento_kmh.toFixed(1)} unit="km/h" color="#94A3B8" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2" /><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2" /><path d="M12.59 19.41A2 2 0 1 0 14 16H2" /></svg>} />
            <StatPill label="Suelo" value={weather.humedad_suelo_pct.toFixed(0)} unit="% sat." color="#D97706" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5c0-3 3-4 4-4 2 0 2 1 4 1s2-2 5-2 4 2 4 5" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M3 15h18" /><line x1="3" y1="18" x2="21" y2="18" /></svg>} />
            <StatPill label="Marea" value={(weather.marea_actual_cm ?? weather.parametros_simulacion?.mean_sea_level ?? 8).toFixed(0)} unit="cm · pleamar " color="#6366F1" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12a6 6 0 0 1 6 0 6 6 0 0 0 6 0 6 6 0 0 1 6 0" /><path d="M2 17a6 6 0 0 1 6 0 6 6 0 0 0 6 0 6 6 0 0 1 6 0" /></svg>} />
          </div>

          {/* Pronóstico 3 días */}
          <div className="mt-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500 inline-flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>Pronóstico 3 días</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(weather.pronostico.length > 0 ? weather.pronostico : [
                { dia: "hoy", lluvia_mm: weather.lluvia_manana_mm, temp_max_c: weather.temp_max_c, estado: weather.estado },
                { dia: "manana", lluvia_mm: weather.lluvia_manana_mm, temp_max_c: weather.temp_max_c, estado: weather.estado },
                { dia: "pasado", lluvia_mm: 0, temp_max_c: weather.temp_max_c, estado: weather.estado },
              ].slice(0, 3)).map((p, i) => (
                <motion.div
                  key={p.dia}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="glass rounded-xl p-4 sm:p-3 text-center"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1">{dias[i]}</p>
                  {p.estado && (
                    <p className="mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider"
                      style={{ borderColor: `${ESTADO_METEO_COLOR[p.estado]}55`, color: ESTADO_METEO_COLOR[p.estado] }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ESTADO_METEO_COLOR[p.estado] }} />
                      {ESTADO_METEO_LABEL[p.estado]}
                    </p>
                  )}
                  <p className="font-display text-2xl font-bold neon-text">{Math.round(p.temp_max_c)}°C</p>
                  <div className="my-2 h-1 rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.lluvia_mm * 8)}%`, backgroundColor: "#00F3FF" }} />
                  </div>
                  <p className="font-mono text-[10px] text-slate-500 inline-flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="20" y1="16.58" x2="20" y2="16.58" /><line x1="12" y1="16.58" x2="12" y2="16.58" /><line x1="4" y1="16.58" x2="4" y2="16.58" /><path d="M17 7h-1.78A2.5 2.5 0 0 0 13 5.5A2.5 2.5 0 0 0 10.5 8H9a4 4 0 0 0-4 4v6h16v-6a4 4 0 0 0-4-4z" /></svg>{p.lluvia_mm.toFixed(1)} mm</p>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
