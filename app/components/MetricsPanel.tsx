"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { PuntoPrediccion, PrediccionResponse } from "@/app/lib/api";
import { riskColor, riskLabel, formatHourShort } from "@/app/lib/api";

interface MetricsPanelProps {
  punto: PuntoPrediccion | null;
  prediccion: PrediccionResponse | null;
  isLoading: boolean;
  error: string | null;
}

const ALERT_THRESHOLD = 15;
const CRITICAL_THRESHOLD = 30;

function MetricTile({
  label,
  value,
  unit,
  accent,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass-panel px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="font-mono text-[9px] uppercase tracking-widest text-mist">{label}</p>
      </div>
      <p className="font-display text-xl font-tabular" style={{ color: accent }}>
        {value}
        <span className="ml-1 text-xs text-mist">{unit}</span>
      </p>
    </div>
  );
}

function RainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="2">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

function TideIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C8BA1" strokeWidth="2">
      <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
    </svg>
  );
}

function SoilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a3744e" strokeWidth="2">
      <path d="M2 22h20" />
      <path d="M7 22V12c0-2 1-4 5-4s5 2 5 4v10" />
    </svg>
  );
}

function DrainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
    </svg>
  );
}

function VelocityIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function HumidityIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

function DaysIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function MetricsPanel({ punto, prediccion, isLoading, error }: MetricsPanelProps) {
  const accent = punto ? riskColor(punto.estado) : "#00F3FF";
  const isElevated = (punto?.nivel_agua_cm ?? 0) > CRITICAL_THRESHOLD;

  const chartData = prediccion
    ? prediccion.puntos.map((p) => ({
        hora: p.tiempo_hora,
        nivel: p.nivel_agua_cm,
        lluvia: p.lluvia_mm_h,
        marea: p.marea_cm,
      }))
    : [];

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Estado de riesgo */}
      <AnimatePresence mode="wait">
        {punto && (
          <motion.div
            key={punto.estado}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`glass-panel p-4 ${
              punto.estado === "Inundacion Critica"
                ? "glass-panel-critical shadow-glow-critical"
                : punto.estado === "Alerta"
                ? "glass-panel-warn shadow-glow-warn"
                : "shadow-glow-cyan"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-mist">
                  Estado del riesgo
                </p>
                <p className="font-display text-2xl font-bold" style={{ color: accent }}>
                  {riskLabel(punto.estado)}
                </p>
              </div>
              <motion.div
                animate={isElevated ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ repeat: isElevated ? Infinity : 0, duration: 1.6 }}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2"
                style={{ borderColor: accent, boxShadow: `0 0 24px ${accent}55` }}
              >
                <span className="font-display text-lg font-tabular" style={{ color: accent }}>
                  {punto.nivel_agua_cm.toFixed(0)}
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8 metricas */}
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          label="Lluvia"
          value={punto ? punto.lluvia_mm_h.toFixed(1) : "\u2014"}
          unit="mm/h"
          accent="#00F3FF"
          icon={<RainIcon />}
        />
        <MetricTile
          label="Marea"
          value={punto ? punto.marea_cm.toFixed(1) : "\u2014"}
          unit="cm"
          accent="#7C8BA1"
          icon={<TideIcon />}
        />
        <MetricTile
          label="Viento"
          value={punto ? punto.viento_efecto_cm.toFixed(1) : "\u2014"}
          unit="cm"
          accent="#a78bfa"
          icon={<WindIcon />}
        />
        <MetricTile
          label="Suelo"
          value={punto ? (punto.saturacion_suelo * 100).toFixed(0) : "\u2014"}
          unit="%"
          accent="#a3744e"
          icon={<SoilIcon />}
        />
        <MetricTile
          label="Drenaje"
          value={punto ? (punto.eficiencia_drenaje * 100).toFixed(0) : "\u2014"}
          unit="%"
          accent="#22d3ee"
          icon={<DrainIcon />}
        />
        <MetricTile
          label="Cambio"
          value={punto ? punto.velocidad_cambio.toFixed(2) : "\u2014"}
          unit="cm/h"
          accent="#f5c518"
          icon={<VelocityIcon />}
        />
        <MetricTile
          label="Humedad"
          value={prediccion ? prediccion.meteorologia_resumen.humedad_promedio.toFixed(0) : "\u2014"}
          unit="%"
          accent="#60a5fa"
          icon={<HumidityIcon />}
        />
        <MetricTile
          label="Dias Lluvia"
          value={prediccion ? String(prediccion.meteorologia_resumen.dias_lluviosos) : "\u2014"}
          unit="dias"
          accent="#fb923c"
          icon={<DaysIcon />}
        />
      </div>

      {/* Grafico H(t) con lluvia y marea */}
      <div className="glass-panel flex-1 p-3">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-mist">
          H(t) \u2014 Nivel de agua, lluvia y marea
        </p>
        <div className="h-44 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientWater" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F3FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00F3FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,243,255,0.06)" />
                <XAxis
                  dataKey="hora"
                  stroke="#7C8BA1"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  tickFormatter={(h: number) => formatHourShort(h)}
                />
                <YAxis stroke="#7C8BA1" tick={{ fontSize: 9 }} tickLine={false} />
                <ReferenceLine
                  y={ALERT_THRESHOLD}
                  stroke="#FF7700"
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
                <ReferenceLine
                  y={CRITICAL_THRESHOLD}
                  stroke="#FF0055"
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0D1420",
                    border: "1px solid rgba(0,243,255,0.25)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelFormatter={(h) => `Hora ${h}`}
                  formatter={(value: number, name: string) => {
                    if (name === "nivel") return [`${value.toFixed(1)} cm`, "H(t)"];
                    if (name === "lluvia") return [`${value.toFixed(1)} mm/h`, "Lluvia"];
                    if (name === "marea") return [`${value.toFixed(1)} cm`, "Marea"];
                    return [value, name];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="nivel"
                  stroke="#00F3FF"
                  strokeWidth={2}
                  fill="url(#gradientWater)"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="marea"
                  stroke="#7C8BA1"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="4 2"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-xs text-mist">
              {isLoading ? "Calculando ecuacion integral..." : "Sin datos"}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="glass-panel-critical glass-panel px-4 py-3 text-sm text-critical">{error}</div>
      )}
    </div>
  );
}
