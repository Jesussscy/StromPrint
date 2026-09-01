"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import type { PrediccionGuardada } from "@/app/lib/api";
import { fetchPredicciones } from "@/app/lib/api";
import { riscoColorEstilo } from "@/app/lib/riesgo";

function riskColor(estado: string): string {
  return riscoColorEstilo(estado);
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
    const header = ["Fecha", "Nivel max (cm)", "Hora pico (h)", "Riesgo", "Pronostico (h)", "Origen de datos"];
    const rows = predicciones.map((p) => [
      new Date(p.timestamp).toLocaleString("es-CO"),
      p.max_water_level_cm.toFixed(1),
      p.peak_hour.toFixed(0),
      p.risk_level,
      p.horas_pronostico,
      p.data_source === "real" ? "Meteorologicos reales" : p.data_source === "simulado" ? "Datos ficticios (simulacion)" : "Desconocido",
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Exportar CSV
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
                  <th className="pb-2 pr-4">Origen</th>
                  <th className="pb-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {predicciones.map((p) => {
                  const c = riskColor(p.risk_level);
                  const accion =
                    p.max_water_level_cm >= 100 ? <><svg className="inline-block mr-1 -mt-0.5 text-risk-emergency" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>Evacuar</>
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
                      <td className="py-2 pr-4">
                        {p.data_source === "real" ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                            Meteo real
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                            Simulado
                          </span>
                        )}
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
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500 inline-flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>Tendencia registrada</p>
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
