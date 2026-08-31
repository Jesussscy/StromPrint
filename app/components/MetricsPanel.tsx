"use client";

import { AnimatePresence, motion } from "framer-motion";
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
import type { PuntoPrediccion, PrediccionResponse } from "@/app/lib/api";
import { riskColor, riskLabel, formatHourShort } from "@/app/lib/api";

interface MetricsPanelProps {
  punto: PuntoPrediccion | null;
  prediccion: PrediccionResponse | null;
  isLoading: boolean;
  error: string | null;
}

function RiskSemaphore({ estado }: { estado: string }) {
  const config: Record<string, { color: string; bg: string; border: string; label: string; desc: string }> = {
    Normal:    { color: "#00E5FF", bg: "rgba(0,229,255,0.1)",  border: "rgba(0,229,255,0.3)",  label: "NORMAL",    desc: "Sin riesgo de inundación" },
    Alerta:    { color: "#FFD600", bg: "rgba(255,214,0,0.1)", border: "rgba(255,214,0,0.3)", label: "ALERTA",    desc: "Calles con acumulación de agua" },
    Emergencia:{ color: "#FF0055", bg: "rgba(255,0,85,0.1)",   border: "rgba(255,0,85,0.3)",   label: "EMERGENCIA",desc: "Agua entrando a viviendas" },
    Critico:   { color: "#B000FF", bg: "rgba(176,0,255,0.1)",  border: "rgba(176,0,255,0.3)",  label: "CRITICO",   desc: "Evacuación requerida" },
  };
  const c = config[estado] || config.Normal;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl p-4"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">
            Estado del Barrio Manga
          </p>
          <p className="font-display text-2xl font-bold" style={{ color: c.color }}>
            {c.label}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
        </div>
        <div
          className="h-14 w-14 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: c.color, boxShadow: `0 0 20px ${c.color}40` }}
        >
          <span className="font-display text-lg font-bold font-tabular" style={{ color: c.color }}>
            {estado === "Normal" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : estado === "Alerta" ? "!" : estado === "Emergencia" ? "!!" : "!!!"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function KPI({ label, value, unit, trend, color, icon }: {
  label: string; value: string; unit: string;
  trend?: "up" | "down" | "stable"; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-xl font-tabular" style={{ color }}>{value}</p>
        <span className="text-xs text-slate-500">{unit}</span>
        {trend && (
          <span className="text-xs" style={{ color: trend === "up" ? "#E63946" : trend === "down" ? "#2A9D8F" : "#64748B" }}>
            {trend === "up" ? <svg className="inline-block -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg> : trend === "down" ? <svg className="inline-block -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg> : <svg className="inline-block -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          </span>
        )}
      </div>
    </div>
  );
}

function Narrative({ narrativa, recomendacion }: { narrativa: string; recomendacion: string }) {
  if (!narrativa) return null;
  return (
    <div className="glass rounded-2xl p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">
        Análisis del Modelo
      </p>
      <p className="text-sm text-slate-300 leading-relaxed">{narrativa}</p>
      <div className="mt-3 pt-3 border-t border-white/5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">Recomendación</p>
        <p className="text-sm font-medium text-accent">{recomendacion}</p>
      </div>
    </div>
  );
}

const IconDroplet = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00B4D8" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>;
const IconTide = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></svg>;
const IconDrain = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2A9D8F" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18M12 3v18" /></svg>;
const IconSoil = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M2 22h20M7 22V12c0-2 1-4 5-4s5 2 5 4v10" /></svg>;
const IconVelocity = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E9C46A" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;

const HISTORICAL_MAX: number[] = [
  10, 12, 14, 16, 19, 22, 26, 30, 34, 38,
  42, 46, 50, 54, 58, 61, 64, 67, 69, 71,
  72, 73, 74, 75, 75, 74, 73, 71, 69, 67,
  64, 61, 58, 54, 50, 46, 42, 38, 34, 30,
  26, 22, 19, 16, 14, 12, 11, 10,
];

function GlowingDot(props: Record<string, unknown>) {
  const cx = props.cx as number | undefined;
  const cy = props.cy as number | undefined;
  const index = props.index as number | undefined;
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  if (index !== 0) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="rgba(0,210,255,0.15)" />
      <circle cx={cx} cy={cy} r={6} fill="rgba(0,210,255,0.3)" />
      <circle cx={cx} cy={cy} r={3} fill="#00E5FF" stroke="#00E5FF" strokeWidth={1.5} />
    </g>
  );
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

function DrainageIndicator({ eficiencia_drenaje, saturacion_suelo }: { eficiencia_drenaje: number; saturacion_suelo: number }) {
  const pct = eficiencia_drenaje * 100;
  const satPct = saturacion_suelo * 100;
  const color = pct < 60 ? "#00E5FF" : pct <= 85 ? "#FFD600" : "#FF0055";
  const radius = 36;
  const stroke = 5;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="glass rounded-2xl p-3 flex flex-col items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="block">
        <circle
          stroke="rgba(255,255,255,0.08)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset, transition: "stroke-dashoffset 0.6s ease", transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <text x={radius} y={radius - 2} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="16" fontWeight="bold" fontFamily="var(--font-display)">
          {pct.toFixed(0)}%
        </text>
        <text x={radius} y={radius + 14} textAnchor="middle" dominantBaseline="middle" fill="#94A3B8" fontSize="8" fontFamily="var(--font-mono)">
          {satPct.toFixed(0)}% sat.
        </text>
      </svg>
      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mt-1">Resiliencia del Drenaje</p>
    </div>
  );
}

export default function MetricsPanel({ punto, prediccion, isLoading, error }: MetricsPanelProps) {
  const accent = punto ? riskColor(punto.estado) : "#00E5FF";

  const chartData = prediccion
    ? prediccion.puntos.map((p, i) => ({
        hora: p.tiempo_hora,
        nivel: p.nivel_agua_cm,
        f_lluvia: p.f_lluvia,
        f_marea: Math.abs(p.f_marea),
        historical: HISTORICAL_MAX[i] ?? 0,
      }))
    : [];

  return (
    <div className="flex h-full flex-col gap-3">
      <AnimatePresence mode="wait">
        {punto && <RiskSemaphore key={punto.estado} estado={punto.estado} />}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-2">
        <KPI label="Nivel Actual" value={punto ? punto.nivel_agua_cm.toFixed(1) : "—"} unit="cm"
          trend={prediccion?.tendencia === "creciente" ? "up" : prediccion?.tendencia === "decreciente" ? "down" : "stable"}
          color={accent} icon={<IconTide />} />
        <KPI label="Pico Máximo" value={prediccion ? prediccion.nivel_maximo_cm.toFixed(0) : "—"}
          unit={prediccion ? `cm @ ${prediccion.hora_pico.toFixed(0)}h` : ""} color="#E63946" icon={<IconDroplet />} />
        <KPI label="Lluvia" value={punto ? punto.lluvia_mm_h.toFixed(1) : "—"} unit="mm/h" color="#00B4D8" icon={<IconDroplet />} />
        <DrainageIndicator
          eficiencia_drenaje={punto ? punto.eficiencia_drenaje : 0}
          saturacion_suelo={punto ? punto.saturacion_suelo : 0}
        />
      </div>

      {/* KPIs secondary - mobile friendly */}
      <div className="grid grid-cols-3 gap-2">
        <KPI label="Marea" value={punto ? punto.marea_cm.toFixed(1) : "—"} unit="cm" color="#6366F1" icon={<IconTide />} />
        <KPI label="Suelo" value={punto ? (punto.saturacion_suelo * 100).toFixed(0) : "—"} unit="%" color="#D97706" icon={<IconSoil />} />
        <KPI label="Cambio" value={punto ? punto.velocidad_cambio.toFixed(2) : "—"} unit="cm/h" color="#E9C46A" icon={<IconVelocity />} />
      </div>

      {/* Chart */}
      <div className="glass rounded-2xl p-3 flex-1">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          Proyección H(t) — 48 Horas
        </p>
        <div className="h-48 sm:h-52 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradWater" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00E5FF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,210,255,0.05)" />
                <XAxis dataKey="hora" stroke="#475569" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} tickFormatter={(h: number) => formatHourShort(h)} />
                <YAxis stroke="#475569" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} label={{ value: "cm", position: "insideTopLeft", offset: 10, style: { fontSize: 9, fill: "#94A3B8" } }} />
                <Tooltip
                  contentStyle={{ background: "rgba(5,10,15,0.95)", border: "1px solid rgba(0,210,255,0.15)", borderRadius: 8, fontSize: 11, color: "#E2E8F0", backdropFilter: "blur(12px)" }}
                  labelFormatter={(h) => `Hora ${h}`}
                  formatter={(value: number, name: string) => {
                    if (name === "nivel") return [`${value.toFixed(1)} cm`, "Nivel H(t)"];
                    if (name === "f_lluvia") return [`${value.toFixed(1)} mm/h`, "Lluvia"];
                    if (name === "f_marea") return [`${value.toFixed(1)} cm`, "Marea"];
                    if (name === "historical") return [`${value.toFixed(0)} cm`, "Máx histórico"];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} iconType="line" />
                <ReferenceLine y={30} stroke="#FFD600" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Alerta", position: "right", style: { fontSize: 8, fill: "#FFD600" } }} />
                <ReferenceLine y={60} stroke="#FF0055" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Emergencia", position: "right", style: { fontSize: 8, fill: "#FF0055" } }} />
                <ReferenceLine y={100} stroke="#B000FF" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Crítico", position: "right", style: { fontSize: 8, fill: "#B000FF" } }} />
                <Area type="monotone" dataKey="nivel" stroke="#00E5FF" strokeWidth={2.5} fill="url(#gradWater)" dot={<PeakDot />} activeDot={{ r: 5, fill: "#00E5FF", stroke: "#00E5FF", strokeWidth: 2 }} name="Nivel H(t)" isAnimationActive={false} />
                <Bar dataKey="f_lluvia" fill="#00F3FF" opacity={0.2} name="Lluvia (mm/h)" isAnimationActive={false} />
                <Line type="monotone" dataKey="f_marea" stroke="#94A3B8" strokeWidth={1.5} dot={false} strokeDasharray="3 3" name="Marea (cm)" isAnimationActive={false} />
                <Line type="monotone" dataKey="historical" stroke="#FF0055" strokeWidth={1.5} dot={false} strokeDasharray="4 4" strokeOpacity={0.4} name="Máx histórico" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
              {isLoading ? "Calculando proyección..." : "Sin datos"}
            </div>
          )}
        </div>
      </div>

      {prediccion && <Narrative narrativa={prediccion.narrativa} recomendacion={prediccion.recomendacion} />}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}
    </div>
  );
}
