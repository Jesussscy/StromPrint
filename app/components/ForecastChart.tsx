"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { PuntoPrediccion } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";

interface ForecastChartProps {
  puntos: PuntoPrediccion[];
}

export default function ForecastChart({ puntos }: ForecastChartProps) {
  const chartData = useMemo(() => {
    if (puntos.length === 0) return null;

    const maxH = puntos[puntos.length - 1].tiempo_hora;
    const width = 800;
    const height = 200;
    const padL = 45;
    const padR = 10;
    const padT = 20;
    const padB = 30;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const maxVal = Math.max(120, ...puntos.map((p) => p.nivel_agua_cm));
    const xScale = (h: number) => padL + (h / maxH) * plotW;
    const yScale = (v: number) => padT + plotH - (v / maxVal) * plotH;

    const waterPath = puntos
      .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.tiempo_hora).toFixed(1)},${yScale(p.nivel_agua_cm).toFixed(1)}`)
      .join(" ");

    const mareaPath = puntos
      .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.tiempo_hora).toFixed(1)},${yScale(p.marea_cm).toFixed(1)}`)
      .join(" ");

    const lluviaBars = puntos.filter((_, i) => i % 2 === 0).map((p) => ({
      x: xScale(p.tiempo_hora),
      h: Math.max(0, (p.lluvia_mm_h / 50) * plotH * 0.3),
      y: padT + plotH,
    }));

    const alertLine = yScale(30);
    const emergenciaLine = yScale(60);
    const criticoLine = yScale(100);

    const hourLabels = [];
    for (let h = 0; h <= maxH; h += 6) {
      hourLabels.push({ x: xScale(h), label: `${h}h` });
    }
    const dayLabels = [];
    for (let d = 0; d <= Math.ceil(maxH / 24); d++) {
      dayLabels.push({ x: xScale(d * 24), label: `Día ${d + 1}` });
    }

    return { width, height, padL, padR, padT, padB, plotW, plotH, waterPath, mareaPath, lluviaBars, alertLine, emergenciaLine, criticoLine, hourLabels, dayLabels };
  }, [puntos]);

  if (!chartData) return null;

  const { width, height, padL, padR, padT, padB, waterPath, mareaPath, lluviaBars, alertLine, emergenciaLine, criticoLine, hourLabels, dayLabels } = chartData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Pronóstico 48 horas</p>
          <p className="font-display text-sm text-white">Nivel del agua en el punto crítico</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-accent rounded" />
            <span className="font-mono text-[9px] text-slate-400">Nivel H(t)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-slate-500 rounded" style={{ borderBottom: "1px dashed #94A3B8" }} />
            <span className="font-mono text-[9px] text-slate-400">Marea</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 bg-accent/30 rounded" />
            <span className="font-mono text-[9px] text-slate-400">Lluvia</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Rain bars */}
        {lluviaBars.map((bar, i) => (
          <rect key={i} x={bar.x - 3} y={bar.y - bar.h} width="6" height={bar.h} fill="#00D2FF" opacity="0.2" rx="1" />
        ))}

        {/* Risk threshold lines */}
        <line x1={padL} y1={alertLine} x2={width - padR} y2={alertLine} stroke="#FFD600" strokeWidth="1" strokeDasharray="6 4" opacity="0.6" />
        <text x={padL - 4} y={alertLine + 3} textAnchor="end" fill="#FFD600" fontSize="8" fontFamily="monospace">30 cm</text>

        <line x1={padL} y1={emergenciaLine} x2={width - padR} y2={emergenciaLine} stroke="#FF0055" strokeWidth="1" strokeDasharray="6 4" opacity="0.6" />
        <text x={padL - 4} y={emergenciaLine + 3} textAnchor="end" fill="#FF0055" fontSize="8" fontFamily="monospace">60 cm</text>

        <line x1={padL} y1={criticoLine} x2={width - padR} y2={criticoLine} stroke="#B000FF" strokeWidth="1" strokeDasharray="6 4" opacity="0.6" />
        <text x={padL - 4} y={criticoLine + 3} textAnchor="end" fill="#B000FF" fontSize="8" fontFamily="monospace">100 cm</text>

        {/* Tide line */}
        <path d={mareaPath} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />

        {/* Water level line */}
        <path d={waterPath} fill="none" stroke="#00D2FF" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Hour labels */}
        {hourLabels.map((l, i) => (
          <g key={i}>
            <line x1={l.x} y1={padT} x2={l.x} y2={padT + 5} stroke="#475569" strokeWidth="1" />
            <text x={l.x} y={height - 5} textAnchor="middle" fill="#64748B" fontSize="8" fontFamily="monospace">{l.label}</text>
          </g>
        ))}

        {/* Day labels */}
        {dayLabels.map((l, i) => (
          <text key={i} x={l.x} y={height - 16} textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="sans-serif" fontWeight="600">{l.label}</text>
        ))}

        {/* Y axis label */}
        <text x={12} y={padT + (chartData?.plotH ?? 170) / 2} textAnchor="middle" fill="#64748B" fontSize="8" fontFamily="monospace" transform={`rotate(-90, 12, ${padT + (chartData?.plotH ?? 170) / 2})`}>Altura (cm)</text>

        {/* Zero line */}
        <line x1={padL} y1={padT + chartData.plotH} x2={width - padR} y2={padT + chartData.plotH} stroke="#1E293B" strokeWidth="1" />
      </svg>
    </motion.div>
  );
}
