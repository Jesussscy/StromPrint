"use client";

import { memo, useMemo } from "react";
import {
  Area,
  Bar,
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
import type { PuntoPrediccion } from "@/app/lib/api";
import { formatHourShort } from "@/app/lib/api";

interface ProjectionChartProps {
  puntos: PuntoPrediccion[];
  currentHour?: number;
}

function PeakDot(props: Record<string, unknown>) {
  const cx = props.cx as number | undefined;
  const cy = props.cy as number | undefined;
  const payload = props.payload as { nivel?: number } | undefined;
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  if (!payload || (payload.nivel ?? 0) < 55) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="rgba(255,0,85,0.2)" />
      <circle cx={cx} cy={cy} r={4} fill="#FF0055" />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#FF0055" fontSize={8} fontFamily="var(--font-mono)">
        {(payload.nivel ?? 0).toFixed(0)}cm
      </text>
    </g>
  );
}

function ProjectionChartInner({ puntos, currentHour }: ProjectionChartProps) {
  const chartData = useMemo(
    () =>
      puntos.map((p) => ({
        hora: p.tiempo_hora,
        nivel: p.nivel_agua_cm,
        f_lluvia: p.f_lluvia,
        f_marea: Math.abs(p.f_marea),
      })),
    [puntos]
  );

  if (chartData.length === 0) {
    return (
      <div className="glass-strong rounded-2xl p-5 flex items-center justify-center h-64">
        <p className="font-mono text-xs text-slate-500">Sin datos de proyección disponibles</p>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan">
            Proyección H(t)
          </p>
          <p className="font-display text-sm font-bold text-white mt-0.5">
            Evolución del nivel — {puntos[puntos.length - 1]?.tiempo_hora ?? 48} horas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FFD600]" />
            <span className="font-mono text-[8px] text-slate-500">Alerta 30cm</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FF0055]" />
            <span className="font-mono text-[8px] text-slate-500">Emerg. 60cm</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#B000FF]" />
            <span className="font-mono text-[8px] text-slate-500">Crítico 100cm</span>
          </span>
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradWaterProj" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00E5FF" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,210,255,0.05)" />
            <XAxis
              dataKey="hora"
              stroke="#475569"
              tick={{ fontSize: 9, fill: "#94A3B8" }}
              tickLine={false}
              tickFormatter={(h: number) => formatHourShort(h)}
            />
            <YAxis
              stroke="#475569"
              tick={{ fontSize: 9, fill: "#94A3B8" }}
              tickLine={false}
              label={{ value: "cm", position: "insideTopLeft", offset: 10, style: { fontSize: 9, fill: "#94A3B8" } }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(5,10,15,0.95)",
                border: "1px solid rgba(0,210,255,0.15)",
                borderRadius: 8,
                fontSize: 11,
                color: "#E2E8F0",
                backdropFilter: "blur(12px)",
              }}
              labelFormatter={(h) => `Hora ${h}`}
              formatter={(value: number, name: string) => {
                if (name === "nivel") return [`${value.toFixed(1)} cm`, "Nivel H(t)"];
                if (name === "f_lluvia") return [`${value.toFixed(1)} mm/h`, "Lluvia"];
                if (name === "f_marea") return [`${value.toFixed(1)} cm`, "Marea"];
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} iconType="line" />
            <ReferenceLine y={30} stroke="#FFD600" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Alerta", position: "right", style: { fontSize: 8, fill: "#FFD600" } }} />
            <ReferenceLine y={60} stroke="#FF0055" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Emergencia", position: "right", style: { fontSize: 8, fill: "#FF0055" } }} />
            <ReferenceLine y={100} stroke="#B000FF" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Crítico", position: "right", style: { fontSize: 8, fill: "#B000FF" } }} />
            {currentHour != null && (
              <ReferenceLine x={Math.floor(currentHour)} stroke="#00E5FF" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Ahora", position: "top", style: { fontSize: 8, fill: "#00E5FF" } }} />
            )}
            <Area type="monotone" dataKey="nivel" stroke="#00E5FF" strokeWidth={2.5} fill="url(#gradWaterProj)" dot={<PeakDot />} activeDot={{ r: 5, fill: "#00E5FF", stroke: "#00E5FF", strokeWidth: 2 }} name="Nivel H(t)" isAnimationActive={false} />
            <Bar dataKey="f_lluvia" fill="#00F3FF" opacity={0.15} name="Lluvia (mm/h)" isAnimationActive={false} />
            <Line type="monotone" dataKey="f_marea" stroke="#94A3B8" strokeWidth={1.5} dot={false} strokeDasharray="3 3" name="Marea (cm)" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(ProjectionChartInner);
