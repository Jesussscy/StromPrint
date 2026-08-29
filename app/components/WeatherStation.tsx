"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface PronosticoIter {
  dia: string;
  lluvia_mm: number;
  temp_max_c: number;
}

interface WeatherData {
  source: string;
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5"><path d="M17 18a5 5 0 0 0-10 0" /><path d="M12 9V2m0 0l-3 3m3-3l3 3" /><line x1="4.22" y1="12.22" x2="5.64" y2="13.64" /><line x1="18.36" y1="13.64" x2="19.78" y2="12.22" /></svg>
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white">Estación Meteorológica — Manga</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
              {weather ? (weather.source === "open-meteo" ? "📡 Open-Meteo" : "⚠ Simulado") : "Cargando..."}
              {weather && ` · ${new Date(weather.timestamp).toLocaleString("es-CO", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchWeather(true)}
          disabled={refreshing}
          className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition disabled:opacity-50"
        >
          {refreshing ? "Actualizando..." : "↻ Actualizar"}
        </button>
      </div>

      {loading && !weather ? (
        <div className="h-40 flex items-center justify-center font-mono text-xs text-slate-500">Cargando datos meteorológicos...</div>
      ) : error && !weather ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : weather ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <StatPill label="Temperatura" value={weather.temperatura.toFixed(1)} unit="°C" color="#FFD600" icon={<span>🌡️</span>} />
            <StatPill label="Humedad" value={weather.humedad.toFixed(0)} unit="%" color="#00E5FF" icon={<span>💧</span>} />
            <StatPill label="Lluvia" value={weather.precipitacion_actual_mm_h.toFixed(1)} unit="mm/h" color="#00D2FF" icon={<span>🌧️</span>} />
            <StatPill label="Viento" value={weather.velocidad_viento_kmh.toFixed(1)} unit="km/h" color="#94A3B8" icon={<span>💨</span>} />
            <StatPill label="Suelo" value={weather.humedad_suelo_pct.toFixed(0)} unit="% sat." color="#D97706" icon={<span>🪨</span>} />
            <StatPill label="Marea" value={(weather.parametros_simulacion?.mean_sea_level ?? 8).toFixed(0)} unit="cm" color="#6366F1" icon={<span>🌊</span>} />
          </div>

          {/* Pronóstico 3 días */}
          <div className="mt-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">📆 Pronóstico 3 días</p>
            <div className="grid grid-cols-3 gap-2">
              {(weather.pronostico.length > 0 ? weather.pronostico : [
                { dia: "hoy", lluvia_mm: weather.lluvia_manana_mm, temp_max_c: weather.temp_max_c },
                { dia: "manana", lluvia_mm: weather.lluvia_manana_mm, temp_max_c: weather.temp_max_c },
                { dia: "pasado", lluvia_mm: 0, temp_max_c: weather.temp_max_c },
              ].slice(0, 3)).map((p, i) => (
                <motion.div
                  key={p.dia}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="glass rounded-xl p-3 text-center"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-2">{dias[i]}</p>
                  <p className="font-display text-2xl font-bold neon-text">{Math.round(p.temp_max_c)}°C</p>
                  <div className="my-2 h-1 rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.lluvia_mm * 8)}%`, backgroundColor: "#00D2FF" }} />
                  </div>
                  <p className="font-mono text-[10px] text-slate-500">🌧️ {p.lluvia_mm.toFixed(1)} mm</p>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
