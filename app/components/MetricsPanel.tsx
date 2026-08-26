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
    Normal:    { color: "#2A9D8F", bg: "rgba(42,157,143,0.1)",  border: "rgba(42,157,143,0.3)",  label: "NORMAL",    desc: "Sin riesgo de inundación" },
    Alerta:    { color: "#E9C46A", bg: "rgba(233,196,106,0.1)", border: "rgba(233,196,106,0.3)", label: "ALERTA",    desc: "Calles con acumulación de agua" },
    Emergencia:{ color: "#E63946", bg: "rgba(230,57,70,0.1)",   border: "rgba(230,57,70,0.3)",   label: "EMERGENCIA",desc: "Agua entrando a viviendas" },
    Critico:   { color: "#7B2CBF", bg: "rgba(123,44,191,0.1)",  border: "rgba(123,44,191,0.3)",  label: "CRITICO",   desc: "Evacuación requerida" },
  };
  const c = config[estado] || config.Normal;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl p-4 border"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-1">
            Estado del Barrio Manga
          </p>
          <p className="font-display text-2xl font-bold" style={{ color: c.color }}>
            {c.label}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{c.desc}</p>
        </div>
        <div
          className="h-14 w-14 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: c.color, boxShadow: `0 0 20px ${c.color}40` }}
        >
          <span className="font-display text-lg font-bold font-tabular" style={{ color: c.color }}>
            {estado === "Normal" ? "✓" : estado === "Alerta" ? "!" : estado === "Emergencia" ? "!!" : "!!!"}
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
    <div className="rounded-xl bg-navy-light/50 border border-navy-lighter p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-xl font-tabular" style={{ color }}>{value}</p>
        <span className="text-xs text-slate-500">{unit}</span>
        {trend && (
          <span className="text-xs" style={{ color: trend === "up" ? "#E63946" : trend === "down" ? "#2A9D8F" : "#64748B" }}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
        )}
      </div>
    </div>
  );
}

function Narrative({ narrativa, recomendacion }: { narrativa: string; recomendacion: string }) {
  if (!narrativa) return null;
  return (
    <div className="rounded-xl bg-navy-light/50 border border-navy-lighter p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">
        Análisis del Modelo
      </p>
      <p className="text-sm text-slate-300 leading-relaxed">{narrativa}</p>
      <div className="mt-3 pt-3 border-t border-navy-lighter">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-1">Recomendación</p>
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

export default function MetricsPanel({ punto, prediccion, isLoading, error }: MetricsPanelProps) {
  const accent = punto ? riskColor(punto.estado) : "#2A9D8F";

  const chartData = prediccion
    ? prediccion.puntos.map((p) => ({
        hora: p.tiempo_hora,
        nivel: p.nivel_agua_cm,
        f_lluvia: p.f_lluvia,
        f_marea: Math.abs(p.f_marea),
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
        <KPI label="Drenaje" value={punto ? (punto.eficiencia_drenaje * 100).toFixed(0) : "—"} unit="%" color="#2A9D8F" icon={<IconDrain />} />
      </div>

      {/* Chart */}
      <div className="rounded-xl bg-navy-light/50 border border-navy-lighter p-3 flex-1">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Proyección H(t) — 48 Horas
        </p>
        <div className="h-52 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradWater" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00B4D8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00B4D8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="hora" stroke="#475569" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} tickFormatter={(h: number) => formatHourShort(h)} />
                <YAxis stroke="#475569" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} label={{ value: "cm", position: "insideTopLeft", offset: 10, style: { fontSize: 9, fill: "#64748B" } }} />
                <Tooltip
                  contentStyle={{ background: "#1C2B4A", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8, fontSize: 11, color: "#E2E8F0" }}
                  labelFormatter={(h) => `Hora ${h}`}
                  formatter={(value: number, name: string) => {
                    if (name === "nivel") return [`${value.toFixed(1)} cm`, "Nivel H(t)"];
                    if (name === "f_lluvia") return [`${value.toFixed(1)} mm/h`, "Lluvia"];
                    if (name === "f_marea") return [`${value.toFixed(1)} cm`, "Marea"];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} iconType="line" />
                <ReferenceLine y={30} stroke="#E9C46A" strokeDasharray="6 4" strokeWidth={1} label={{ value: "Alerta", position: "right", style: { fontSize: 8, fill: "#E9C46A" } }} />
                <ReferenceLine y={60} stroke="#E63946" strokeDasharray="6 4" strokeWidth={1} label={{ value: "Emergencia", position: "right", style: { fontSize: 8, fill: "#E63946" } }} />
                <ReferenceLine y={100} stroke="#7B2CBF" strokeDasharray="6 4" strokeWidth={1} label={{ value: "Crítico", position: "right", style: { fontSize: 8, fill: "#7B2CBF" } }} />
                <Area type="monotone" dataKey="nivel" stroke="#00B4D8" strokeWidth={2.5} fill="url(#gradWater)" dot={false} name="Nivel H(t)" isAnimationActive={false} />
                <Bar dataKey="f_lluvia" fill="#00B4D8" opacity={0.3} name="Lluvia (mm/h)" isAnimationActive={false} />
                <Line type="monotone" dataKey="f_marea" stroke="#94A3B8" strokeWidth={1.5} dot={false} strokeDasharray="3 3" name="Marea (cm)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
              {isLoading ? "Calculando proyección..." : "Sin datos"}
            </div>
          )}
        </div>
      </div>

      {/* Secondary */}
      <div className="grid grid-cols-3 gap-2">
        <KPI label="Marea" value={punto ? punto.marea_cm.toFixed(1) : "—"} unit="cm" color="#6366F1" icon={<IconTide />} />
        <KPI label="Suelo" value={punto ? (punto.saturacion_suelo * 100).toFixed(0) : "—"} unit="%" color="#D97706" icon={<IconSoil />} />
        <KPI label="Cambio" value={punto ? punto.velocidad_cambio.toFixed(2) : "—"} unit="cm/h" color="#E9C46A" icon={<IconVelocity />} />
      </div>

      {prediccion && <Narrative narrativa={prediccion.narrativa} recomendacion={prediccion.recomendacion} />}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}
    </div>
  );
}
