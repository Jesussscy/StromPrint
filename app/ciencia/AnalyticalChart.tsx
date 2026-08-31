"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Line,
  Area,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { compararMetodos, ComparacionResponse } from "@/app/lib/api";

const KaTeXBlock = dynamic(() => import("./KaTeXBlock"), { ssr: false });

export default function AnalyticalChart() {
  const [resultado, setResultado] = useState<ComparacionResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subtramos, setSubtramos] = useState(1);

  // Sel interpretando la solución en vivo (scrubber)
  const [reproduciendo, setReproduciendo] = useState(false);
  const [idxCursor, setIdxCursor] = useState(0);
  const rafRepro = useRef<number | null>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    compararMetodos({
      duration_hours: 96,
      storm_peak_hour: 24,
      storm_intensity: 60,
      subtramos,
    })
      .then((res) => {
        if (activo) setResultado(res);
      })
      .catch((e: Error) => {
        if (activo) setError(e.message || "No se pudo cargar la solución analítica.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [subtramos]);

  const chartData = useMemo(() => {
    if (!resultado) return [];
    const data: { hora: number; nivel: number }[] = [];
    for (let i = 0; i < resultado.horas.length; i++) {
      data.push({
        hora: resultado.horas[i],
        nivel: parseFloat(resultado.analitico_cm[i].toFixed(3)),
      });
    }
    return data;
  }, [resultado]);

  const pico = useMemo(() => {
    if (!chartData.length) return null;
    return chartData.reduce((max, p) => (p.nivel > max.nivel ? p : max), chartData[0]);
  }, [chartData]);

  const parametros = resultado?.parametros ?? {};

  // Bucle de reproducción: arrastra el cursor a lo largo de la curva
  useEffect(() => {
    if (!reproduciendo || chartData.length === 0) return;
    idxRef.current = idxCursor;
    const step = () => {
      if (!reproduciendo) return;
      idxRef.current = (idxRef.current + 1) % chartData.length;
      setIdxCursor(idxRef.current);
      // Ojete: al llegar al final, seguimos desde el inicio (bucle fluido)
      rafRepro.current = requestAnimationFrame(step);
    };
    rafRepro.current = requestAnimationFrame(step);
    return () => {
      if (rafRepro.current) cancelAnimationFrame(rafRepro.current);
      rafRepro.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendo, chartData.length]);

  // Limpiar loop al desmontar
  useEffect(() => () => {
    if (rafRepro.current) cancelAnimationFrame(rafRepro.current);
  }, []);

  const puntoCursor = chartData[idxCursor] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      {/* Chart */}
      <div className="glass rounded-2xl p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-3">
          Curva de la solución analítica por tramos — H(t)
        </p>
        <div className="h-[300px]">
          {cargando || !resultado ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {cargando ? "Resolviendo la solución analítica…" : "Sin datos"}
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-risk-emergency">
              {error}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAnalit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,210,255,0.05)" />
                <XAxis
                  dataKey="hora"
                  stroke="#334155"
                  tick={{ fontSize: 9, fill: "#64748B" }}
                  tickLine={false}
                  tickFormatter={(h: number) => `${h}h`}
                />
                <YAxis
                  stroke="#334155"
                  tick={{ fontSize: 9, fill: "#64748B" }}
                  tickLine={false}
                  label={{ value: "cm", position: "insideTopLeft", offset: 10, style: { fontSize: 9, fill: "#475569" } }}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(5,10,15,0.95)",
                    border: "1px solid rgba(0,210,255,0.15)",
                    borderRadius: 12,
                    fontSize: 11,
                    color: "#E2E8F0",
                    backdropFilter: "blur(12px)",
                  }}
                  labelFormatter={(h) => `Hora ${h}`}
                  formatter={(value: number | string) => [`${Number(value).toFixed(2)} cm`, "Nivel H(t)"]}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} iconType="line" />
                <ReferenceLine
                  y={60}
                  stroke="#FF0055"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{ value: "Emergencia", position: "right", style: { fontSize: 8, fill: "#FF0055" } }}
                />
                {/* Cursor en vivo (sweeping) */}
                {puntoCursor && !cargando && (
                  <>
                    <ReferenceLine
                      x={puntoCursor.hora}
                      stroke="#00E5FF"
                      strokeOpacity={0.5}
                      strokeWidth={1}
                    />
                    <ReferenceLine
                      x={puntoCursor.hora}
                      stroke="#00E5FF"
                      strokeOpacity={0.05}
                      strokeWidth={34}
                    />
                  </>
                )}
                <Area type="monotone" dataKey="nivel" stroke="#00E5FF" strokeWidth={2.5} fill="url(#gradAnalit)" dot={false} name="Nivel H(t)" animationDuration={700} animationEasing="ease-out" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Controles de reproducción en vivo */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              if (reproduciendo) {
                setReproduciendo(false);
              } else {
                if (idxCursor >= chartData.length - 1) setIdxCursor(0);
                setReproduciendo(true);
              }
            }}
            disabled={chartData.length === 0}
            className="glass-glow rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition disabled:opacity-40 flex items-center gap-1.5"
          >
            {reproduciendo ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                Pausar
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                Reproducir
              </>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={Math.max(0, chartData.length - 1)}
            value={idxCursor}
            onChange={(e) => { setIdxCursor(Number(e.target.value)); }}
            className="flex-1 min-w-[120px] h-1.5 accent-cyan"
            disabled={chartData.length === 0}
            aria-label="Recorrer la solución"
          />

          <span className="font-mono text-[11px] text-cyan w-16 text-right font-tabular">
            {puntoCursor ? `${puntoCursor.hora}h` : "—"}
          </span>
          <motion.span
            key={puntoCursor ? puntoCursor.hora : -1}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="font-mono text-[11px] text-slate-400 font-tabular w-20 text-right"
          >
            {puntoCursor ? `${puntoCursor.nivel.toFixed(1)} cm` : "—"}
          </motion.span>
        </div>

        {/* Control de subtramos */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Tramos de coeficientes constantes:
          </span>
          <div className="flex gap-1 rounded-lg glass p-1">
            {[1, 2, 3, 6, 12].map((s) => (
              <button
                key={s}
                onClick={() => setSubtramos(s)}
                className={`rounded-md px-3 py-1 font-mono text-[11px] transition ${
                  subtramos === s
                    ? "bg-cyan/20 text-cyan shadow-glow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats analíticas */}
      <div className="flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">Pico máximo</p>
          <p className="font-display text-2xl font-bold font-tabular" style={{ color: "#00E5FF" }}>
            {pico ? `${pico.nivel.toFixed(1)} cm` : "—"}
          </p>
          <p className="font-mono text-[10px] text-slate-500">
            {pico ? `hora ${pico.hora}h` : ""}
          </p>
        </motion.div>

        <div className="glass rounded-xl p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">Masa (m)</p>
          <p className="font-display text-lg font-bold font-tabular text-white">
            {parametros.mass != null ? `${parametros.mass} kg` : "—"}
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">Amortiguamiento (c)</p>
          <p className="font-display text-lg font-bold font-tabular text-white">
            {parametros.damping != null ? `${parametros.damping} N·s/m` : "—"}
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">Rigidez (k)</p>
          <p className="font-display text-lg font-bold font-tabular text-white">
            {parametros.stiffness != null ? `${parametros.stiffness} N/m` : "—"}
          </p>
        </div>

        {/* Valor en vivo del cursor */}
        <div className="glass rounded-xl p-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">
            Nivel en el cursor
          </p>
          <motion.div
            key={idxCursor}
            initial={{ scale: 0.92, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <p className="font-display text-3xl font-bold font-tabular text-cyan">
              {puntoCursor ? puntoCursor.nivel.toFixed(1) : "—"}<span className="text-sm text-slate-500"> cm</span>
            </p>
          </motion.div>
          <div className="mt-1 h-1 w-full rounded-full bg-ocean overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cyan/40 to-cyan"
              animate={{ width: `${chartData.length ? ((idxCursor + 1) / chartData.length) * 100 : 0}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        <div className="glass rounded-xl p-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-2">
            Solución particular (Duhamel)
          </p>
          <KaTeXBlock
            math="H_p(t) = \int_0^t F(\tau)\, g(t - \tau)\, d\tau"
            displayMode
          />
        </div>
      </div>
    </div>
  );
}
