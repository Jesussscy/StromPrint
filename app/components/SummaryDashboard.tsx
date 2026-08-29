"use client";

import { motion } from "framer-motion";
import type { PuntoPrediccion, DaySummary } from "@/app/lib/api";
import { riskColor, riskLabel } from "@/app/lib/api";

interface SummaryDashboardProps {
  puntos: PuntoPrediccion[];
  daySummaries: DaySummary[];
}

function Stat({ label, value, unit, color, icon }: {
  label: string; value: string; unit: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="font-display text-2xl font-bold font-tabular" style={{ color }}>{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mt-1">{unit}</p>
      <p className="text-[10px] text-slate-600 mt-1">{label}</p>
    </div>
  );
}

function RiskBar({ count, total, label, color }: { count: number; total: number; label: string; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] text-slate-400 w-20 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.1 }}
        />
      </div>
      <span className="font-mono text-[10px] font-tabular" style={{ color }}>{count}h</span>
    </div>
  );
}

export default function SummaryDashboard({ puntos, daySummaries }: SummaryDashboardProps) {
  if (puntos.length === 0) return null;

  const maxNivel = Math.max(...puntos.map((p) => p.nivel_agua_cm));
  const minNivel = Math.min(...puntos.map((p) => p.nivel_agua_cm));
  const avgNivel = puntos.reduce((s, p) => s + p.nivel_agua_cm, 0) / puntos.length;
  const peakPunto = puntos.reduce((max, p) => p.nivel_agua_cm > max.nivel_agua_cm ? p : max);
  const totalLluvia = puntos.reduce((s, p) => s + p.lluvia_mm_h, 0);
  const horasConLluvia = puntos.filter((p) => p.lluvia_mm_h > 0.1).length;

  const horasNormal = puntos.filter((p) => p.estado === "Normal").length;
  const horasAlerta = puntos.filter((p) => p.estado === "Alerta").length;
  const horasEmergencia = puntos.filter((p) => p.estado === "Emergencia").length;
  const horasCritico = puntos.filter((p) => p.estado === "Critico").length;

  const maxPico = daySummaries.reduce((max, s) => s.nivelMaximo > max.nivelMaximo ? s : max);

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
        </svg>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan">
          Resumen 7 Días
        </p>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat
          label="Pico máximo"
          value={maxNivel.toFixed(1)}
          unit="cm"
          color={riskColor(peakPunto.estado)}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={riskColor(peakPunto.estado)} strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
        />
        <Stat
          label="Promedio"
          value={avgNivel.toFixed(1)}
          unit="cm"
          color="#00D2FF"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
        />
        <Stat
          label="Lluvia total"
          value={totalLluvia.toFixed(0)}
          unit="mm"
          color="#00B4D8"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00B4D8" strokeWidth="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>}
        />
        <Stat
          label="Día más crítico"
          value={maxPico.dayLabel}
          unit={`Pico: ${maxPico.nivelMaximo.toFixed(0)} cm`}
          color={riskColor(maxPico.estadoDominante)}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={riskColor(maxPico.estadoDominante)} strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
        />
      </div>

      {/* Risk distribution */}
      <div className="glass rounded-xl p-4 mb-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          Distribución de Riesgo — {puntos.length} horas
        </p>
        <div className="space-y-2">
          <RiskBar count={horasNormal} total={puntos.length} label="Normal" color="#00E5FF" />
          <RiskBar count={horasAlerta} total={puntos.length} label="Alerta" color="#FFD600" />
          <RiskBar count={horasEmergencia} total={puntos.length} label="Emergencia" color="#FF0055" />
          <RiskBar count={horasCritico} total={puntos.length} label="Crítico" color="#B000FF" />
        </div>
      </div>

      {/* Day-by-day summary table */}
      <div className="glass rounded-xl p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          Detalle por Día
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left font-mono text-[9px] uppercase tracking-widest text-slate-500 py-2 pr-3">Día</th>
                <th className="text-right font-mono text-[9px] uppercase tracking-widest text-slate-500 py-2 px-3">Máx</th>
                <th className="text-right font-mono text-[9px] uppercase tracking-widest text-slate-500 py-2 px-3">Lluvia</th>
                <th className="text-right font-mono text-[9px] uppercase tracking-widest text-slate-500 py-2 px-3">Horas lluvia</th>
                <th className="text-right font-mono text-[9px] uppercase tracking-widest text-slate-500 py-2 pl-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {daySummaries.map((s) => (
                <tr key={s.dayIndex} className="border-b border-white/[0.02]">
                  <td className="py-2 pr-3">
                    <span className="font-mono text-slate-300">{s.dayLabel}</span>
                    <span className="text-slate-600 ml-1">Día {s.dayIndex + 1}</span>
                  </td>
                  <td className="text-right py-2 px-3 font-tabular font-bold" style={{ color: riskColor(s.estadoDominante) }}>
                    {s.nivelMaximo.toFixed(1)} cm
                  </td>
                  <td className="text-right py-2 px-3 font-tabular text-slate-400">
                    {s.lluviaTotal.toFixed(1)} mm
                  </td>
                  <td className="text-right py-2 px-3 font-tabular text-slate-500">
                    {s.horasConLluvia}h
                  </td>
                  <td className="text-right py-2 pl-3">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase"
                      style={{
                        backgroundColor: `${riskColor(s.estadoDominante)}15`,
                        color: riskColor(s.estadoDominante),
                        border: `1px solid ${riskColor(s.estadoDominante)}30`,
                      }}
                    >
                      {riskLabel(s.estadoDominante)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
