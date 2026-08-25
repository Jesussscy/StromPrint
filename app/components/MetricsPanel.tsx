"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { FloodRecord } from "@/app/lib/api";
import { riskColor, riskLabel } from "@/app/lib/api";

interface MetricsPanelProps {
  record: FloodRecord | null;
  records: FloodRecord[];
  isLoading: boolean;
  error: string | null;
  totalPersisted: number | null;
}

const CRITICAL_THRESHOLD = 30;

function MetricTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div className="glass-panel px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-mist">{label}</p>
      <p className="font-display text-2xl font-tabular" style={{ color: accent }}>
        {value}
        <span className="ml-1 text-sm text-mist">{unit}</span>
      </p>
    </div>
  );
}

export default function MetricsPanel({ record, records, isLoading, error, totalPersisted }: MetricsPanelProps) {
  const isElevated = (record?.water_level_cm ?? 0) > CRITICAL_THRESHOLD;
  const accent = record ? riskColor(record.risk_level) : "#00F3FF";

  const chartData = records.map((r) => ({ hour: r.hour, level: r.water_level_cm }));

  return (
    <div className="flex h-full flex-col gap-4">
      <AnimatePresence mode="wait">
        {record && (
          <motion.div
            key={record.risk_level}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`glass-panel p-5 ${
              record.risk_level === "critical"
                ? "glass-panel-critical shadow-glow-critical"
                : record.risk_level === "high"
                ? "glass-panel-warn shadow-glow-warn"
                : "shadow-glow-cyan"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-mist">Estado del riesgo</p>
                <p className="font-display text-3xl font-bold" style={{ color: accent }}>
                  {riskLabel(record.risk_level)}
                </p>
              </div>
              <motion.div
                animate={isElevated ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ repeat: isElevated ? Infinity : 0, duration: 1.6 }}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2"
                style={{ borderColor: accent, boxShadow: `0 0 24px ${accent}55` }}
              >
                <span className="font-display text-lg font-tabular" style={{ color: accent }}>
                  {record.water_level_cm.toFixed(0)}
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Lluvia"
          value={record ? record.rain_intensity.toFixed(1) : "—"}
          unit="mm/h"
          accent="#00F3FF"
        />
        <MetricTile
          label="Marea"
          value={record ? record.tide_level.toFixed(1) : "—"}
          unit="cm"
          accent="#7C8BA1"
        />
        <MetricTile
          label="Nivel de agua"
          value={record ? record.water_level_cm.toFixed(1) : "—"}
          unit="cm"
          accent={accent}
        />
        <MetricTile
          label="Registros BD"
          value={totalPersisted !== null ? String(totalPersisted) : "—"}
          unit="filas"
          accent="#FF7700"
        />
      </div>

      <div className="glass-panel flex-1 p-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-mist">
          H(t) — 168 horas simuladas
        </p>
        <div className="h-40 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <XAxis dataKey="hour" stroke="#7C8BA1" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis stroke="#7C8BA1" tick={{ fontSize: 10 }} tickLine={false} />
                <ReferenceLine y={CRITICAL_THRESHOLD} stroke="#FF0055" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Tooltip
                  contentStyle={{
                    background: "#0D1420",
                    border: "1px solid rgba(0,243,255,0.25)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(h) => `Hora ${h}`}
                  formatter={(value: number) => [`${value.toFixed(1)} cm`, "H(t)"]}
                />
                <Line
                  type="monotone"
                  dataKey="level"
                  stroke="#00F3FF"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-xs text-mist">
              {isLoading ? "Calculando simulación…" : "Sin datos aún"}
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
