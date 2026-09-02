"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { predecir, type PrediccionResponse } from "@/app/lib/api";
import { clasificarNivel, COLOR_POR_NIVEL } from "@/app/lib/riesgo";
import { Skeleton } from "@/app/components/Skeleton";

interface Escenario {
  id: string;
  label: string;
  color: string;
  desc: string;
  params: {
    horas_pronostico: number;
    intensidad_lluvia_mm_h: number;
    nivel_marea_cm: number;
    eficiencia_drenaje: number;
    usar_datos_meteo: boolean;
  };
  resultado?: PrediccionResponse;
}

const ESCENARIOS: Escenario[] = [
  {
    id: "moderado",
    label: "Moderado",
    color: "#FFD600",
    desc: "Lluvia 25 mm/h · Drenaje 70% · Marea 10 cm",
    params: { horas_pronostico: 48, intensidad_lluvia_mm_h: 25, nivel_marea_cm: 10, eficiencia_drenaje: 0.7, usar_datos_meteo: false },
  },
  {
    id: "intenso",
    label: "Intenso",
    color: "#FF0055",
    desc: "Lluvia 45 mm/h · Drenaje 45% · Marea 20 cm",
    params: { horas_pronostico: 48, intensidad_lluvia_mm_h: 45, nivel_marea_cm: 20, eficiencia_drenaje: 0.45, usar_datos_meteo: false },
  },
  {
    id: "extremo",
    label: "Extremo",
    color: "#B000FF",
    desc: "Lluvia 70 mm/h · Drenaje 25% · Marea 30 cm",
    params: { horas_pronostico: 48, intensidad_lluvia_mm_h: 70, nivel_marea_cm: 30, eficiencia_drenaje: 0.25, usar_datos_meteo: false },
  },
];

function resumen(e: Escenario) {
  if (!e.resultado) return null;
  const puntos = e.resultado.puntos;
  const enAlerta = puntos.filter((p) => p.nivel_agua_cm >= 30).length;
  const enEmergencia = puntos.filter((p) => p.nivel_agua_cm >= 60).length;
  const enCritico = puntos.filter((p) => p.nivel_agua_cm >= 100).length;
  return {
    max: e.resultado.nivel_maximo_cm,
    pico: e.resultado.hora_pico,
    enAlerta,
    enEmergencia,
    enCritico,
    nivel: clasificarNivel(e.resultado.nivel_maximo_cm),
  };
}

export default function ScenarioComparator() {
  const [resultados, setResultados] = useState<Record<string, PrediccionResponse> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all(
      ESCENARIOS.map(async (e) => {
        const r = await predecir(e.params);
        return [e.id, r] as const;
      })
    )
      .then((pares) => setResultados(Object.fromEntries(pares)))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron calcular los escenarios."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const conResultado = ESCENARIOS.map((e) => ({
    esc: e,
    res: resumen({ ...e, resultado: resultados?.[e.id] }),
  }));

  const maxAbs = Math.max(1, ...conResultado.map((c) => c.res?.max ?? 0));

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg glass-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white">Comparador de Escenarios</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
              Tres corridas hipotéticas en vivo — no reemplazan el pronóstico real
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={cargando}
          className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition disabled:opacity-40 min-h-[44px]"
        >
          {cargando ? "Calculando…" : "Recalcular"}
        </button>
      </div>

      {error && !resultados && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-sm text-red-400">
          <p>{error}</p>
          <button
            onClick={load}
            className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition min-h-[44px]"
          >
            Reintentar
          </button>
        </div>
      )}

      {!error && cargando && !resultados && (
        <div className="grid gap-3 md:grid-cols-3" aria-busy="true" aria-label="Calculando escenarios">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10" />
              <Skeleton className="h-3" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {resultados && (
        <div className="grid gap-3 md:grid-cols-3">
          {conResultado.map(({ esc, res }, i) => {
            const pct = res ? (res.max / maxAbs) * 100 : 0;
            return (
              <motion.div
                key={esc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i }}
                className="glass rounded-2xl p-4 flex flex-col"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: esc.color }}>
                  Escenario {esc.label}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{esc.desc}</p>

                <div className="mt-4 flex items-end gap-2">
                  <p className="font-display text-3xl font-bold font-tabular" style={{ color: esc.color }}>
                    {res ? `${res.max.toFixed(0)}` : "—"}
                  </p>
                  <p className="mb-1 font-mono text-[10px] text-slate-500">cm pico</p>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: esc.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                </div>

                {res ? (
                  <div className="mt-4 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Hora del pico</span>
                      <span className="font-mono text-slate-300 font-tabular">{res.pico.toFixed(0)}h</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Nivel máx. alcanzado</span>
                      <span className="font-mono font-tabular" style={{ color: COLOR_POR_NIVEL[res.nivel] }}>{res.nivel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Horas ≥ Alerta (30cm)</span>
                      <span className="font-mono text-slate-300 font-tabular">{res.enAlerta} h</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Horas ≥ Emergencia (60cm)</span>
                      <span className="font-mono text-slate-300 font-tabular">{res.enEmergencia} h</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Horas ≥ Crítico (100cm)</span>
                      <span className="font-mono text-slate-300 font-tabular">{res.enCritico} h</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 font-mono text-xs text-slate-600">Sin datos</p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}