"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import type { PrediccionGuardada } from "@/app/lib/api";
import { fetchPredicciones } from "@/app/lib/api";

const RISK_COLOR: Record<string, string> = {
  Critico: "#B000FF",
  critical: "#B000FF",
  Emergencia: "#FF0055",
  high: "#FF0055",
  Alerta: "#FFD600",
  moderate: "#FFD600",
  Normal: "#00E5FF",
  low: "#00E5FF",
};

function riskColor(estado: string): string {
  return RISK_COLOR[estado] ?? "#00E5FF";
}

export default function HistoryPanel() {
  const [predicciones, setPredicciones] = useState<PrediccionGuardada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPredicciones(10)
      .then((data) => {
        if (alive) setPredicciones(data.predicciones ?? []);
      })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const trend = useMemo(() => {
    return predicciones.slice().reverse().map((p) => ({
      dia: new Date(p.timestamp).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }),
      nivel: p.max_water_level_cm,
    }));
  }, [predicciones]);

  const exportCSV = () => {
    const header = ["Fecha", "Nivel max (cm)", "Hora pico (h)", "Riesgo", "Pronostico (h)"];
    const rows = predicciones.map((p) => [
      new Date(p.timestamp).toLocaleString("es-CO"),
      p.max_water_level_cm.toFixed(1),
      p.peak_hour.toFixed(0),
      p.risk_level,
      p.horas_pronostico,
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stormprint-historial.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg glass-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white">Historial de Predicciones</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
              {predicciones.length} corridas registradas
            </p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          disabled={predicciones.length === 0}
          className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition disabled:opacity-40"
        >
          📥 Exportar CSV
        </button>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center font-mono text-xs text-slate-500">Cargando historial...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : predicciones.length === 0 ? (
        <p className="py-8 text-center font-mono text-xs text-slate-500">Aún no hay predicciones guardadas. Ejecutá una simulación para ver el historial.</p>
      ) : (
        <>
          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-cyan/10 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="pb-2 pr-4">Fecha</th>
                  <th className="pb-2 pr-4">Nivel máx</th>
                  <th className="pb-2 pr-4">Riesgo</th>
                  <th className="pb-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {predicciones.map((p) => {
                  const c = riskColor(p.risk_level);
                  const accion =
                    p.max_water_level_cm >= 100 ? "Evacuar ⚠️"
                    : p.max_water_level_cm >= 60 ? "Monitorear"
                    : p.max_water_level_cm >= 30 ? "Preparar"
                    : "Normal";
                  return (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-400">
                        {new Date(p.timestamp).toLocaleString("es-CO")}
                      </td>
                      <td className="py-2 pr-4 font-display font-bold font-tabular text-slate-200">
                        {p.max_water_level_cm.toFixed(0)} cm
                      </td>
                      <td className="py-2 pr-4">
                        <span className="rounded px-2 py-0.5 font-mono text-[10px] uppercase" style={{ color: c, backgroundColor: `${c}18`, border: `1px solid ${c}40` }}>
                          {p.risk_level}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs text-slate-300">{accion}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tendencia */}
          {trend.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">📈 Tendencia registrada</p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,210,255,0.05)" />
                    <XAxis dataKey="dia" stroke="#475569" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} />
                    <YAxis stroke="#475569" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "rgba(5,10,15,0.95)", border: "1px solid rgba(0,210,255,0.15)", borderRadius: 8, fontSize: 11, color: "#E2E8F0" }}
                      formatter={(value: number | string) => [`${Number(value).toFixed(1)} cm`, "Nivel máx"]}
                    />
                    <Bar dataKey="nivel" fill="#00E5FF" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
