"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Nivel = "CRITICO" | "EMERGENCIA" | "ALERTA" | "INFO";

const NIVEL_STYLE: Record<
  Nivel,
  { color: string; label: string; icon: string; glow: string }
> = {
  CRITICO: { color: "#FF0055", label: "CRÍTICO", icon: "", glow: "rgba(255,0,85,0.35)" },
  EMERGENCIA: { color: "#FF0055", label: "EMERGENCIA", icon: "", glow: "rgba(255,0,85,0.32)" },
  ALERTA: { color: "#FFD600", label: "ALERTA", icon: "", glow: "rgba(255,214,0,0.26)" },
  INFO: { color: "#00E5FF", label: "INFO", icon: "", glow: "rgba(0,229,255,0.22)" },
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

interface AlertDrawerProps {
  nivelAguaCm?: number;
  nivelMaximo?: number;
  tendenciaCmH?: number;
  onVerEnMapa?: () => void;
}

// Normaliza el nivel/riesgo que llega del backend (puede venir en mayúsculas,
// minúsculas o con los aliases legacy en inglés). Cualquier forma desconocida
// cae a INFO sin perder severidad de tornas.
const NIVEL_ALIAS: Record<string, Nivel> = {
  CRITICO: "CRITICO",
  CRÍTICO: "CRITICO",
  CRITICAL: "CRITICO",
  EMERGENCIA: "EMERGENCIA",
  HIGH: "EMERGENCIA",
  ALERTA: "ALERTA",
  MODERATE: "ALERTA",
  NORMAL: "INFO",
  LOW: "INFO",
};

const toNivel = (r?: string): Nivel => {
  if (!r) return "INFO";
  const up = String(r).toUpperCase().replace("Í", "I").trim();
  return NIVEL_ALIAS[up] ?? "INFO";
};

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
    .filter((a) => a.titulo)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));

function NivelIcon({ nivel, color }: { nivel: Nivel; color: string }) {
  const common = {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  if (nivel === "CRITICO") {
    return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
  }
  if (nivel === "EMERGENCIA") {
    return <svg {...common}><path d="M2 12a6 6 0 0 1 6 0 6 6 0 0 0 6 0 6 6 0 0 1 6 0" /><path d="M2 17a6 6 0 0 1 6 0 6 6 0 0 0 6 0 6 6 0 0 1 6 0" /></svg>;
  }
  if (nivel === "ALERTA") {
    return <svg {...common}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
}

export default function AlertDrawer({ nivelAguaCm, nivelMaximo, tendenciaCmH, onVerEnMapa }: AlertDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<AlertItem[]>([]);
  const [metrics, setMetrics] = useState<{ alertas_hoy?: number; ultima_alerta?: string | null }>({});
  const [silenced, setSilenced] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

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
    const poll = setInterval(load, 30000);
    const tick = setInterval(() => setNow(Date.now()), 10000);
    const onOpen = () => setIsOpen(true);
    window.addEventListener("stormprint:open-alerts", onOpen);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener("stormprint:open-alerts", onOpen);
    };
  }, [load]);

  const visible = useMemo(() => {
    const base = items.filter((a) => a.nivel !== "INFO"); // en el icono priorizamos alertas reales
    return base.filter((a) => !silenced.has(a.id));
  }, [items, silenced]);

  const unread = visible.length;
  const nivelActual: Nivel = useMemo(() => {
    const peak = items.find((a) => a.nivel === "CRITICO");
    if (peak) return "CRITICO";
    const em = items.find((a) => a.nivel === "EMERGENCIA");
    if (em) return "EMERGENCIA";
    const al = items.find((a) => a.nivel === "ALERTA");
    if (al) return "ALERTA";
    return "INFO";
  }, [items]);

  const silenciar = (id: string) => setSilenced((prev) => new Set(prev).add(id));
  const silenciarTodas = () => {
    setSilenced((prev) => {
      const next = new Set(prev);
      items.forEach((a) => next.add(a.id));
      return next;
    });
  };

  // Accesibilidad del panel: es un diálogo modal. Al abrir se enfoca el
  // botón de cierre; ESC cierra; Tab queda atrapado dentro del panel.
  const drawerRef = useRef<HTMLElement>(null);
  const cerrar = useCallback(() => setIsOpen(false), []);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const node = drawerRef.current;
    const focusables = node
      ? Array.from(
          node.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true")
      : [];
    const target = focusables[0] as HTMLElement | undefined;
    target?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
      if (e.key === "Tab" && node && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !node.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  return (
    <>
      {/* Icono de campana - HUD */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Centro de alertas"
        className="fixed bottom-20 left-4 z-[55] md:bottom-6 md:left-6 md:z-[90] glass-glow rounded-xl p-3 cursor-pointer active:scale-95 transition-transform duration-150 min-w-[44px] min-h-[44px] flex items-center justify-center"
        style={{ borderColor: `${NIVEL_STYLE[nivelActual].color}55`, boxShadow: `0 0 14px ${NIVEL_STYLE[nivelActual].glow}` }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={NIVEL_STYLE[nivelActual].color} strokeWidth="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-3.5 w-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold text-white"
            style={{ background: NIVEL_STYLE[nivelActual].color, boxShadow: `0 0 6px ${NIVEL_STYLE[nivelActual].color}` }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[95] bg-black/50"
              onClick={() => setIsOpen(false)}
            />
            <motion.aside
              ref={drawerRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label="Centro de Alertas"
              className="fixed right-0 top-0 bottom-0 z-[100] w-[380px] max-w-[94vw] overflow-y-auto backdrop-blur-xl"
              style={{
                background: "rgba(8, 12, 20, 0.96)",
                borderLeft: "1px solid rgba(0, 243, 255, 0.2)",
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                (e.currentTarget as any)._swipeStart = { x: touch.clientX, y: touch.clientY };
              }}
              onTouchMove={(e) => {
                const start = (e.currentTarget as any)._swipeStart;
                if (!start) return;
                const dx = e.touches[0].clientX - start.x;
                const dy = Math.abs(e.touches[0].clientY - start.y);
                if (dx < -50 && dy < 100) {
                  cerrar();
                  (e.currentTarget as any)._swipeStart = null;
                }
              }}
            >
              <div className="p-5">
                {/* Cabecera */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">Centro de Alertas</h2>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                      {unread} alertas activas · en vivo
                    </p>
                  </div>
                  <button onClick={cerrar} aria-label="Cerrar centro de alertas" className="text-slate-500 hover:text-white transition flex items-center justify-center min-w-[44px] min-h-[44px]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Métricas */}
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <MiniMetric label="Alertas hoy" valor={String(metrics.alertas_hoy ?? 0)} color="#FFD600" />
                  <MiniMetric
                    label="Última alerta"
                    valor={metrics.ultima_alerta ? getTimeAgo(metrics.ultima_alerta, now) : "—"}
                    color="#FF0055"
                  />
                </div>

                {/* Acciones */}
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={silenciarTodas}
                    className="glass-glow rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-300 hover:text-white transition"
                  >
                    <svg className="inline-block mr-1.5 -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.8 3.27A16 16 0 0 0 4 7l-1.27-.63A2 2 0 0 0 0 8.12V20a2 2 0 0 0 3.27 1.51l1.27-1.27A16 16 0 0 0 16.8 24h1.5a2.5 2.5 0 0 0 2.5-2.5v-2.76A16 16 0 0 0 22 19.75L20 21a2 2 0 0 1-3.27-1.51V8.12a2 2 0 0 1 1.51-2z" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                    Silenciar todas
                  </button>
                </div>

                {/* Lista */}
                <div className="space-y-2.5">
                  {visible.length === 0 ? (
                    <p className="rounded-xl border border-white/5 bg-ocean py-10 text-center font-mono text-xs text-slate-500">
                      Sin alertas activas. Todo en orden.
                    </p>
                  ) : (
                    visible.map((a) => {
                      const s = NIVEL_STYLE[a.nivel];
                      const titulo = a.titulo ?? s.label;
                      return (
                        <motion.div
                          key={a.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="rounded-xl border-l-4 p-3.5 backdrop-blur"
                          style={{
                            backgroundColor: "rgba(8, 12, 20, 0.92)",
                            borderColor: s.color,
                            borderLeftWidth: 4,
                            borderLeftColor: s.color,
                            boxShadow: `0 0 20px ${s.glow}`,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${s.color}18` }}>
                              <NivelIcon nivel={a.nivel} color={s.color} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider" style={{ color: s.color, background: `${s.color}18` }}>
                                  {s.label}
                                </span>
                                <span className="font-mono text-[9px] text-slate-500">{getTimeAgo(a.timestamp, now)}</span>
                              </div>
                              <p className="text-sm font-semibold text-white" style={{ color: a.nivel === "INFO" ? "#E2E8F0" : undefined }}>
                                {titulo}
                              </p>
                              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{a.descripcion}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-slate-500">
                                <span className="inline-flex items-center gap-1"><svg className="-mt-0.5" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>{a.zona}</span>
                                {typeof a.nivel_cm === "number" && <span className="font-bold" style={{ color: s.color }}>{a.nivel_cm.toFixed(0)} cm</span>}
                                {a.tendencia && <span>Tendencia: {a.tendencia}</span>}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  onClick={onVerEnMapa}
                                  className="rounded px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#050A0F] transition hover:brightness-110"
                                  style={{ background: s.color }}
                                >
                                  Ver en mapa
                                </button>
                                <button
                                  onClick={() => silenciar(a.id)}
                                  className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-400 transition hover:text-white"
                                >
                                  Silenciar
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                <Link
                  href="/alertas"
                  onClick={cerrar}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-cyan/20 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-cyan transition hover:bg-cyan/10"
                >
                  Ver el centro de alertas completo
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MiniMetric({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-ocean p-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-0.5 font-display text-base font-bold font-tabular" style={{ color }}>{valor}</p>
    </div>
  );
}
