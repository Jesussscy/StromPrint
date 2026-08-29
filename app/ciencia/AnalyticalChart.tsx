"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
                <Area type="monotone" dataKey="nivel" stroke="#00E5FF" strokeWidth={2.5} fill="url(#gradAnalit)" dot={false} name="Nivel H(t)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Control de subtramos */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
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
        <div className="glass rounded-xl p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">Pico máximo</p>
          <p className="font-display text-2xl font-bold font-tabular" style={{ color: "#00E5FF" }}>
            {pico ? `${pico.nivel.toFixed(1)} cm` : "—"}
          </p>
          <p className="font-mono text-[10px] text-slate-500">
            {pico ? `hora ${pico.hora}h` : ""}
          </p>
        </div>

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
