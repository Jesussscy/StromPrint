"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Line,
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

export default function ComparisonChart() {
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
        if (activo) setError(e.message || "No se pudo cargar la comparación.");
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
    const min = Math.min(resultado.horas.length, resultado.numerico_cm.length, resultado.analitico_cm.length);
    const data: { hora: number; numerico: number; analitico: number }[] = [];
    for (let i = 0; i < min; i++) {
      data.push({
        hora: resultado.horas[i],
        numerico: parseFloat(resultado.numerico_cm[i].toFixed(3)),
        analitico: parseFloat(resultado.analitico_cm[i].toFixed(3)),
      });
    }
    return data;
  }, [resultado]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      {/* Chart */}
      <div className="glass rounded-2xl p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-3">
          Comparativa: solve_ivp (RK45) vs Solución analítica por tramos
        </p>
        <div className="h-[300px]">
          {cargando || !resultado ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {cargando ? "Resolviendo ambos métodos…" : "Sin datos"}
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-risk-emergency">
              {error}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradNumerico" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.12} />
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
                  formatter={(value: number, name: string) => {
                    if (name === "numerico") return [`${value} cm`, "Numérico (RK45)"];
                    if (name === "analitico") return [`${value} cm`, "Analítico (Duhamel)"];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} iconType="line" />
                <Line type="monotone" dataKey="numerico" stroke="#00E5FF" strokeWidth={2.5} dot={false} name="numerico" isAnimationActive={false} />
                <Line type="monotone" dataKey="analitico" stroke="#B000FF" strokeWidth={2} dot={false} strokeDasharray="6 4" name="analitico" isAnimationActive={false} />
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

      {/* Error stats */}
      <div className="flex flex-col gap-3">
        {[
          { label: "Error promedio", value: resultado ? `${resultado.error_promedio_cm.toFixed(4)} cm` : "—", color: "#00E5FF" },
          { label: "Error máximo", value: resultado ? `${resultado.error_maximo_cm.toFixed(4)} cm` : "—", color: "#FFD600" },
          { label: "RMSE", value: resultado ? `${resultado.error_rmse_cm.toFixed(4)} cm` : "—", color: "#B000FF" },
          { label: "Puntos", value: resultado ? `${resultado.puntos}` : "—", color: "#00FF87" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">{stat.label}</p>
            <p className="font-display text-lg font-bold font-tabular" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}

        {/* Derivación clave */}
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
