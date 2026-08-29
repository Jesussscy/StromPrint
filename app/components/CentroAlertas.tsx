"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Nivel = "CRITICO" | "EMERGENCIA" | "ALERTA" | "INFO";

const NIVEL_ORDER: Nivel[] = ["CRITICO", "EMERGENCIA", "ALERTA", "INFO"];

const NIVEL_STYLE: Record<
  Nivel,
  { color: string; label: string; icon: string; glow: string }
> = {
  CRITICO: { color: "#FF0055", label: "CRÍTICO", icon: "🚨", glow: "rgba(255,0,85,0.35)" },
  EMERGENCIA: { color: "#FF7700", label: "EMERGENCIA", icon: "🌊", glow: "rgba(255,119,0,0.32)" },
  ALERTA: { color: "#F3F300", label: "ALERTA", icon: "⚠️", glow: "rgba(243,243,0,0.26)" },
  INFO: { color: "#00F3FF", label: "INFO", icon: "🔵", glow: "rgba(0,243,255,0.22)" },
};

interface AlertItem {
  id: string;
  nivel: Nivel;
  icono: string;
  titulo: string | null;
  descripcion: string;
  ubicacion: string;
  zona: string;
  nivel_cm?: number;
  tendencia?: string | null;
  timestamp: string;
}

interface Metrics {
  ultima_alerta?: string | null;
  alertas_hoy?: number;
  nivel_maximo?: number | null;
  zonas_afectadas?: number | null;
}

interface CentroAlertasProps {
  nivelAguaCm?: number;
  nivelMaximo?: number;
  tendenciaCmH?: number;
  onVerEnMapa?: () => void;
}

const toNivel = (r?: string): Nivel =>
  r === "CRITICO" || r === "EMERGENCIA" || r === "ALERTA" ? (r as Nivel) : "INFO";

const getTimeAgo = (ts: string, now: number): string => {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, now - t);
  const s = Math.floor(diff / 1000);
  if (s < 10) return "ahora mismo";
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
};

const mapItem = (n: any): AlertItem => {
  const nivel = toNivel(n.nivel ?? n.riesgo);
  const s = NIVEL_STYLE[nivel];
  return {
    id: n.id ?? `${n.timestamp}-${n.riesgo ?? "x"}`,
    nivel,
    icono: n.icono ?? s.icon,
    titulo: n.titulo ?? (n.mensaje ? null : s.label),
    descripcion: n.descripcion ?? n.mensaje ?? "Evento de StormPrint",
    ubicacion: n.ubicacion ?? "Barrio Manga, Cartagena",
    zona: n.zona ?? "Manga",
    nivel_cm: typeof n.nivel_cm === "number" ? n.nivel_cm : typeof n.nivel_agua === "number" ? n.nivel_agua : undefined,
    tendencia: n.tendencia ?? null,
    timestamp: n.timestamp ?? new Date().toISOString(),
  } as AlertItem;
};

const sortItems = (items: AlertItem[]): AlertItem[] =>
  items
    .filter((a) => a.titulo) // descartar eventos sin encabezado coherente
    .sort((a, b) => {
      const pa = NIVEL_ORDER.indexOf(a.nivel);
      const pb = NIVEL_ORDER.indexOf(b.nivel);
      if (pa !== pb) return pa - pb;
      return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0;
    });

export default function CentroAlertas({ nivelAguaCm, nivelMaximo, tendenciaCmH, onVerEnMapa }: CentroAlertasProps) {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [filter, setFilter] = useState<Nivel | "TODAS">("TODAS");
  const [silenced, setSilenced] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [rutaAbierta, setRutaAbierta] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (typeof nivelAguaCm === "number" && Number.isFinite(nivelAguaCm)) params.set("nivel_cm", String(nivelAguaCm));
      if (typeof nivelMaximo === "number" && Number.isFinite(nivelMaximo)) params.set("nivel_maximo", String(nivelMaximo));
      if (typeof tendenciaCmH === "number" && Number.isFinite(tendenciaCmH)) params.set("tendencia_cm_h", String(tendenciaCmH));
      const res = await fetch(`/api/v1/notifications?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.notifications)) setItems(sortItems(data.notifications.map(mapItem)));
      if (data.metrics) setMetrics(data.metrics);
    } catch {
      /* API no disponible */
    }
  }, [nivelAguaCm, nivelMaximo, tendenciaCmH]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000); // polling 30s
    const tick = setInterval(() => setNow(Date.now()), 10000); // timestamps en vivo 10s
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const visible = useMemo(() => {
    const base = items.filter((a) => !silenced.has(a.id));
    return filter === "TODAS" ? base : base.filter((a) => a.nivel === filter);
  }, [items, silenced, filter]);

  const silenciar = (id: string) => {
    setSilenced((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const contadores = useMemo(() => {
    const c: Record<Nivel, number> = { CRITICO: 0, EMERGENCIA: 0, ALERTA: 0, INFO: 0 };
    items.forEach((a) => {
      c[a.nivel] = (c[a.nivel] ?? 0) + 1;
    });
    return c;
  }, [items]);

  const nivelActual: Nivel = useMemo(() => {
    const peak = items.find((a) => a.nivel === "CRITICO");
    if (peak) return "CRITICO";
    const em = items.find((a) => a.nivel === "EMERGENCIA");
    if (em) return "EMERGENCIA";
    const al = items.find((a) => a.nivel === "ALERTA");
    if (al) return "ALERTA";
    return "INFO";
  }, [items]);

  const niveles: (Nivel | "TODAS")[] = ["TODAS", ...NIVEL_ORDER];

  return (
    <div className="relative">
      {/* Cabecera */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-bold text-white">CENTRO DE ALERTAS</h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            {items.length} eventos · polling 30s · timestamps en vivo
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-lg border px-4 py-2 backdrop-blur"
          style={{ borderColor: `${NIVEL_STYLE[nivelActual].color}66`, background: "#0A101C" }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: NIVEL_STYLE[nivelActual].color, boxShadow: `0 0 10px ${NIVEL_STYLE[nivelActual].color}` }} />
          <span className="font-mono text-xs font-bold" style={{ color: NIVEL_STYLE[nivelActual].color }}>
            ESTADO: {NIVEL_STYLE[nivelActual].label}
          </span>
        </div>
      </div>

      {/* Métricas reales */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica label="Última alerta" valor={metrics.ultima_alerta ? getTimeAgo(metrics.ultima_alerta, now) : "—"} color="#FF0055" />
        <Metrica label="Alertas hoy" valor={String(metrics.alertas_hoy ?? 0)} color="#FF7700" />
        <Metrica label="Nivel máximo" valor={metrics.nivel_maximo != null ? `${Number(metrics.nivel_maximo).toFixed(0)} cm` : "—"} color="#F3F300" />
        <Metrica label="Zonas afectadas" valor={metrics.zonas_afectadas != null ? String(metrics.zonas_afectadas) : "—"} color="#00F3FF" />
      </div>

      {/* Filtros por nivel */}
      <div className="mb-6 flex flex-wrap gap-2">
        {niveles.map((n) => {
          const active = filter === n;
          const color = n === "TODAS" ? "#FFFFFF" : NIVEL_STYLE[n].color;
          const count = n === "TODAS" ? items.length : contadores[n] ?? 0;
          return (
            <button
              key={n}
              onClick={() => setFilter(n)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${
                active ? "text-[#050A0F]" : "text-slate-300 opacity-60 hover:opacity-100"
              }`}
              style={active ? { background: color, boxShadow: `0 0 12px ${color}66` } : { background: "#0A101C", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {n}
              <span className={`ml-1.5 ${active ? "text-[#050A0F]/70" : "text-slate-500"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de alertas */}
      <div className="space-y-3">
        <AnimatePresence>
          {visible.length === 0 ? (
            <p className="rounded-xl border border-white/5 bg-[#0A101C] py-10 text-center font-mono text-xs text-slate-500">
              Sin alertas para este filtro
            </p>
          ) : (
            visible.map((a) => {
              const s = NIVEL_STYLE[a.nivel];
              const titulo = a.titulo ?? s.label;
              return (
                <motion.article
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden rounded-2xl border backdrop-blur"
                  style={{ background: "#0A101C", borderColor: `${s.color}4D`, boxShadow: `0 0 24px ${s.glow}` }}
                >
                  <div className="flex items-stretch gap-4 p-4 sm:p-5">
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                        style={{ background: `${s.color}1A`, border: `1px solid ${s.color}55`, boxShadow: `0 0 14px ${s.glow}` }}
                      >
                        {a.icono}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold uppercase tracking-wide" style={{ color: s.color }}>
                          {titulo}
                        </span>
                        <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase" style={{ background: `${s.color}1F`, color: s.color }}>
                          {s.label}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-slate-400">{getTimeAgo(a.timestamp, now)}</span>
                      </div>

                      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{a.descripcion}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
                        <span>📍 {a.zona} · {a.ubicacion}</span>
                        {typeof a.nivel_cm === "number" && (
                          <span className="font-bold" style={{ color: s.color }}>{a.nivel_cm.toFixed(0)} cm</span>
                        )}
                        <span>·</span>
                        <span>Tendencia: {a.tendencia ?? "—"}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={onVerEnMapa}
                          className="rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#050A0F] transition hover:brightness-110"
                          style={{ background: s.color, boxShadow: `0 0 10px ${s.glow}` }}
                        >
                          Ver en mapa
                        </button>
                        <button
                          onClick={() => setRutaAbierta(rutaAbierta === a.id ? null : a.id)}
                          className="rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-200 transition hover:bg-white/5"
                          style={{ borderColor: `${s.color}66` }}
                        >
                          Ruta evacuación
                        </button>
                        <button
                          onClick={() => silenciar(a.id)}
                          className="rounded-md border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:text-white"
                        >
                          Silenciar
                        </button>
                      </div>

                      {rutaAbierta === a.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] p-3"
                        >
                          <p className="font-mono text-[11px] leading-relaxed text-slate-300">
                            🚸 Ruta segura {a.zona} → diríjase por calles altas hacia la Av. Pedro de Heredia hasta los
                            puntos de alta en Manga. Siga las señales y al personal de Defensa Civil.
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Metrica({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#0A101C] p-4 backdrop-blur">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold font-tabular" style={{ color }}>
        {valor}
      </p>
    </div>
  );
}
