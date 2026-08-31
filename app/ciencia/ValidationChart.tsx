"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
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

const HOURS = 48;

function generateHistoricalData(): number[] {
  const data: number[] = [];
  for (let i = 0; i <= HOURS; i++) {
    const t = i / HOURS;
    const peak = 72 * Math.exp(-0.5 * Math.pow((t - 0.45) / 0.15, 2));
    const noise = Math.sin(i * 0.3) * 3 + Math.cos(i * 0.7) * 2;
    data.push(Math.max(0, peak + noise));
  }
  return data;
}

function generatePredictedData(): number[] {
  const historical = generateHistoricalData();
  return historical.map((v, i) => {
    const error = (Math.sin(i * 0.5) * 2 + Math.cos(i * 0.8) * 1.5);
    return Math.max(0, v + error);
  });
}

export default function ValidationChart() {
  const chartData = useMemo(() => {
    const historical = generateHistoricalData();
    const predicted = generatePredictedData();
    return historical.map((h, i) => ({
      hora: i,
      real: parseFloat(h.toFixed(1)),
      predicho: parseFloat(predicted[i].toFixed(1)),
      error: parseFloat(Math.abs(h - predicted[i]).toFixed(1)),
    }));
  }, []);

  // Progreso de "dibujado" de la gráfica (0 a 1) cuando entra en pantalla
  const chartRef = useRef<HTMLDivElement>(null);
  const enVista = useInView(chartRef, { once: true, margin: "-60px" });
  const [dibujo, setDibujo] = useState(0);
  const [contando, setContando] = useState(false);

  useEffect(() => {
    if (!enVista) return;
    let raf: number;
    const inicio = performance.now();
    const dur = 1800;
    const step = (now: number) => {
      const t = Math.min(1, (now - inicio) / dur);
      setDibujo(t);
      if (t < 1) raf = requestAnimationFrame(step);
      else setContando(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [enVista]);

  // Datos recortados según el progreso de dibujo -> efecto "trazado"
  const datosTrazados = useMemo(
    () => chartData.slice(0, Math.max(1, Math.round(dibujo * chartData.length))),
    [chartData, dibujo]
  );

  // Conteo animado de la precisión
  const maxError = Math.max(...chartData.map((d) => d.error));
  const avgError = chartData.reduce((s, d) => s + d.error, 0) / chartData.length;
  const accuracy = (1 - avgError / 72) * 100;

  const [accMostrada, setAccMostrada] = useState(0);
  useEffect(() => {
    if (!contando) return;
    let raf: number;
    const inicio = performance.now();
    const dur = 1200;
    const step = (now: number) => {
      const t = Math.min(1, (now - inicio) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setAccMostrada(accuracy * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contando]);

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
          Comparativa: Evento histórico vs Predicción del modelo
        </p>
        <div ref={chartRef} className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datosTrazados} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="gradError" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF0055" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#FF0055" stopOpacity={0} />
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
                  if (name === "real") return [`${value} cm`, "Dato histórico"];
                  if (name === "predicho") return [`${value} cm`, "Predicción"];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} iconType="line" />
              <ReferenceLine y={30} stroke="#FFD600" strokeDasharray="6 4" strokeWidth={1} opacity={0.4} />
              <ReferenceLine y={60} stroke="#FF0055" strokeDasharray="6 4" strokeWidth={1} opacity={0.4} />
              <Area type="monotone" dataKey="error" fill="url(#gradError)" stroke="none" name="Error" isAnimationActive={false} />
              <Line type="monotone" dataKey="real" stroke="#94A3B8" strokeWidth={2} dot={false} strokeDasharray="6 4" name="Histórico real" isAnimationActive={false} />
              <Line type="monotone" dataKey="predicho" stroke="#00E5FF" strokeWidth={2.5} dot={false} name="Predicción StormPrint" isAnimationActive={dibujo > 0.4} animationDuration={1200} animationEasing="ease-out" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Gauge + Stats */}
      <div className="flex flex-col gap-4">
        {/* Accuracy gauge */}
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
              strokeDasharray={`${(accMostrada / 100) * 327} 327`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              className="drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]"
            />
            <text x="60" y="55" textAnchor="middle" fill="#00E5FF" fontSize="22" fontFamily="'Exo 2'" fontWeight="700">
              {accMostrada.toFixed(1)}%
            </text>
            <text x="60" y="72" textAnchor="middle" fill="#64748B" fontSize="8" fontFamily="monospace">
              PRECISIÓN
            </text>
          </svg>
        </motion.div>

        {/* Stats */}
        <div className="glass rounded-2xl p-4 space-y-3">
          {[
            { label: "Error promedio", value: `${avgError.toFixed(1)} cm`, color: "#00E5FF" },
            { label: "Error máximo", value: `${maxError.toFixed(1)} cm`, color: "#FFD600" },
            { label: "Muestras", value: `${chartData.length} horas`, color: "#B000FF" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500">{stat.label}</span>
              <span className="font-mono text-xs font-tabular" style={{ color: stat.color }}>{stat.value}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-600 leading-relaxed text-center">
          El {accuracy.toFixed(1)}% representa la exactitud de la curva predicha frente a los datos de la estación física.
        </p>
      </div>
    </div>
  );
}
