"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
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
import { compararMetodos } from "@/app/lib/api";

export default function ValidationChart() {
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof compararMetodos>> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setCargando(true);
    setError(null);
    compararMetodos({ duration_hours: 96, storm_peak_hour: 24, storm_intensity: 60, subtramos: 6 })
      .then(setResultado)
      .catch((e: Error) => setError(e.message || "No se pudo cargar la comparación."))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    let activo = true;
    compararMetodos({ duration_hours: 96, storm_peak_hour: 24, storm_intensity: 60, subtramos: 6 })
      .then((res) => { if (activo) setResultado(res); })
      .catch((e: Error) => { if (activo) setError(e.message || "No se pudo cargar la comparación."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const chartData = useMemo(() => {
    if (!resultado) return [];
    return resultado.horas.map((h, i) => ({
      hora: h,
      analitico: resultado.analitico_cm[i],
      numerico: resultado.numerico_cm[i],
    }));
  }, [resultado]);

  // Progreso de "dibujado" de la gráfica (0 a 1) cuando entra en pantalla
  const chartRef = useRef<HTMLDivElement>(null);
  const enVista = useInView(chartRef, { once: true, margin: "-60px" });
  const [dibujo, setDibujo] = useState(0);

  useEffect(() => {
    if (!enVista) return;
    let raf: number;
    const inicio = performance.now();
    const dur = 1800;
    const step = (now: number) => {
      const t = Math.min(1, (now - inicio) / dur);
      setDibujo(t);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [enVista]);

  const datosTrazados = useMemo(
    () => chartData.slice(0, Math.max(1, Math.round(dibujo * chartData.length))),
    [chartData, dibujo]
  );

  const rmse = resultado?.error_rmse_cm ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_200px]">
      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass rounded-2xl p-4"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-3">
          Congruencia: solución analítica por tramos vs solución numérica (solve_ivp)
        </p>
        <div ref={chartRef} className="h-[280px]">
          {cargando || !resultado ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {cargando ? "Comparando soluciones…" : "Sin datos"}
            </div>
          ) : error && !resultado ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-risk-emergency">
              <span>{error}</span>
              <button
                onClick={load}
                className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition min-h-[44px]"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={datosTrazados} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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
                    if (name === "analitico") return [`${value.toFixed(2)} cm`, "Analítica"];
                    if (name === "numerico") return [`${value.toFixed(2)} cm`, "Numérica"];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} iconType="line" />
                <ReferenceLine y={30} stroke="#FFD600" strokeDasharray="6 4" strokeWidth={1} opacity={0.4} />
                <ReferenceLine y={60} stroke="#FF0055" strokeDasharray="6 4" strokeWidth={1} opacity={0.4} />
                <Line type="monotone" dataKey="numerico" stroke="#94A3B8" strokeWidth={2} dot={false} strokeDasharray="6 4" name="Numérica (solve_ivp)" isAnimationActive={false} />
                <Line type="monotone" dataKey="analitico" stroke="#00E5FF" strokeWidth={2.5} dot={false} name="Analítica por tramos" isAnimationActive={dibujo > 0.4} animationDuration={1200} animationEasing="ease-out" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Gauge + Stats */}
      <div className="flex flex-col gap-4">
        {/* Congruence gauge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-5 flex flex-col items-center"
        >
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0,210,255,0.1)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="#00E5FF"
              strokeWidth="6"
              strokeDasharray={`${Math.min(100, Math.max(0, 100 - rmse)) / 100 * 327} 327`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              className="drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]"
            />
            <text x="60" y="55" textAnchor="middle" fill="#00E5FF" fontSize="22" fontFamily="'Exo 2'" fontWeight="700">
              {(100 - Math.min(100, rmse)).toFixed(1)}%
            </text>
            <text x="60" y="72" textAnchor="middle" fill="#64748B" fontSize="8" fontFamily="monospace">
              CONGRUENCIA
            </text>
          </svg>
        </motion.div>

        {/* Stats */}
        <div className="glass rounded-2xl p-4 space-y-3">
          {[
            { label: "Error promedio", value: `${(resultado?.error_promedio_cm ?? 0).toFixed(3)} cm`, color: "#00E5FF" },
            { label: "Error máximo", value: `${(resultado?.error_maximo_cm ?? 0).toFixed(3)} cm`, color: "#FFD600" },
            { label: "Error RMSE", value: `${rmse.toFixed(3)} cm`, color: "#B000FF" },
            { label: "Muestras", value: `${chartData.length} horas`, color: "#64748B" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500">{stat.label}</span>
              <span className="font-mono text-xs font-tabular" style={{ color: stat.color }}>{stat.value}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-600 leading-relaxed text-center">
          Congruencia = 100 − RMSE (cm). Mide qué tan próximas están la solución analítica de StormPrint y la
          referencia numérica por pasos en el mismo escenario de tormenta.
        </p>
      </div>
    </div>
  );
}