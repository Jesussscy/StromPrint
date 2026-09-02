"use client";

import { useEffect, useMemo, useState } from "react";

interface FreshnessBadgeProps {
  timestamp?: string;
  fuente?: string;
  dataSource?: string; // "real" | "simulado"
  labelPrefix?: string;
}

function timeAgo(ts: number, now: number): { text: string; stale: boolean } {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return { text: "hace <1 min", stale: false };
  if (min < 60) return { text: `hace ${min} min`, stale: min > 30 };
  const h = Math.floor(min / 60);
  return { text: `hace ${h} h`, stale: true };
}

/**
 * FreshnessBadge — muestra hace cuánto se actualizaron los datos y si esa
 * caché ya está vieja (>30 min), además del origen de datos (real/simulado)
 * para que el usuario no confunda una simulación con observaciones reales.
 */
export default function FreshnessBadge({
  timestamp,
  fuente,
  dataSource,
  labelPrefix = "Datos",
}: FreshnessBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const parsed = useMemo(() => {
    if (!timestamp) return null;
    const t = new Date(timestamp).getTime();
    return Number.isFinite(t) ? t : null;
  }, [timestamp]);

  const isSimulado = dataSource === "simulado" || (!dataSource && fuente === "simulado");

  const color = isSimulado ? "#FFD600" : parsed ? (timeAgo(parsed, now).stale ? "#FF0055" : "#00E5FF") : "#64748B";
  const dotLabel = isSimulado
    ? "simulado"
    : parsed
      ? timeAgo(parsed, now).text
      : "sin datos";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
      style={{ color, borderColor: `${color}44`, backgroundColor: `${color}12` }}
      title={`${labelPrefix}: ${dotLabel}${isSimulado ? " · datos simulados, no mediciones reales" : ""}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      {labelPrefix} · {dotLabel}
    </span>
  );
}