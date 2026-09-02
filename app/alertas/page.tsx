"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import NotificationBanner from "@/app/components/NotificationBanner";
import MobileBottomNav, {
  type MobileNavItem,
  IconPanel,
  IconBell,
  IconHistory,
  IconScience,
} from "@/app/components/MobileBottomNav";
import { Skeleton } from "@/app/components/Skeleton";
import { formatFechaHoraCartagena } from "@/app/lib/datetime";

const FADE = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const NIVEL_STYLE: Record<string, { color: string; label: string }> = {
  CRITICO: { color: "#B000FF", label: "Crítico" },
  EMERGENCIA: { color: "#FF0055", label: "Emergencia" },
  ALERTA: { color: "#FFD600", label: "Alerta" },
  NORMAL: { color: "#00E5FF", label: "Normal" },
};

interface Notificacion {
  id?: string;
  timestamp: string;
  riesgo?: string;
  nivel?: string;
  nivel_cm?: number;
  nivel_agua?: number;
  mensaje?: string;
  titulo?: string;
  descripcion?: string;
  ubicacion?: string;
  email_enviado?: boolean;
  webhook_enviado?: boolean;
  de_sistema?: boolean;
}

interface Metricas {
  ultima_alerta?: string | null;
  alertas_hoy?: number;
  nivel_maximo?: number | null;
  zonas_afectadas?: number | null;
}

const NAV_ALERTAS: MobileNavItem[] = [
  { href: "/", label: "Panel", action: "route", icon: <IconPanel /> },
  { href: "#suscripcion", label: "Alertas", action: "scroll", icon: <IconBell /> },
  { href: "#historial", label: "Historial", action: "scroll", icon: <IconHistory /> },
  { href: "/ciencia", label: "Ciencia", action: "route", icon: <IconScience /> },
];

export default function AlertasPage() {
  const [notas, setNotas] = useState<Notificacion[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [smtpConfigurado, setSmtpConfigurado] = useState<boolean | null>(null);
  const [totalSuscripciones, setTotalSuscripciones] = useState<number | null>(null);

  const [filtro, setFiltro] = useState<string>("TODOS");
  const [busqueda, setBusqueda] = useState("");

  const [email, setEmail] = useState("");
  const [suscripcionMsg, setSuscripcionMsg] = useState<string | null>(null);
  const [suscripcionErr, setSuscripcionErr] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const load = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [res, status] = await Promise.all([
        fetch("/api/v1/notifications?limit=40").then((r) => {
          if (!r.ok) throw new Error(`Error ${r.status}`);
          return r.json();
        }),
        fetch("/api/v1/notify/status").then((r) => (r.ok ? r.json() : null)),
      ]);
      setNotas(res.notifications ?? []);
      setMetricas(res.metrics ?? null);
      setSmtpConfigurado(status?.smtp_configurado ?? null);
      setTotalSuscripciones(status?.total_suscripciones ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el centro de alertas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return notas.filter((n) => {
      const nivel = (n.riesgo ?? n.nivel ?? "NORMAL").toUpperCase();
      if (filtro !== "TODOS" && nivel !== filtro) return false;
      if (q) {
        const hay = `${n.mensaje ?? ""} ${n.titulo ?? ""} ${n.descripcion ?? ""} ${n.ubicacion ?? ""} ${n.nivel_cm ?? n.nivel_agua ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notas, filtro, busqueda]);

  function exportarCSV() {
    const header = "timestamp,nivel,cm,mensaje,email,webhook";
    const rows = notas.map((n) => [
      n.timestamp,
      (n.riesgo ?? n.nivel ?? "").toUpperCase(),
      n.nivel_cm ?? n.nivel_agua ?? "",
      `"${(n.mensaje ?? n.descripcion ?? "").replaceAll('"', '""')}"`,
      n.email_enviado ? "si" : "no",
      n.webhook_enviado ? "si" : "no",
    ]);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stormprint-alertas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function gestionarSuscripcion(accion: "subscribe" | "unsubscribe") {
    const em = email.trim();
    if (!em) {
      setSuscripcionErr("Ingresá tu correo para suscribirte.");
      return;
    }
    setEnviando(true);
    setSuscripcionErr(null);
    setSuscripcionMsg(null);
    try {
      const res = await fetch(`/api/v1/notify/${accion}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
      setTotalSuscripciones(data.total_suscripciones ?? null);
      setSuscripcionMsg(
        accion === "subscribe"
          ? `Tu correo quedó guardado. El sistema te avisará cuando una predicción supere los umbrales de riesgo.`
          : `Tu correo fue dado de baja.`
      );
    } catch (e) {
      setSuscripcionErr(e instanceof Error ? e.message : "No se pudo procesar la suscripción.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-ocean">
      <Navbar />
      <NotificationBanner />

      {/* Hero */}
      <div className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative mx-auto max-w-4xl px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-cyan transition mb-8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Volver al panel principal
          </Link>
          <motion.div {...FADE}>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Monitoreo continuo</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
              Centro de <span className="neon-text">Alertas</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl">
              Historial de alertas del Barrio Manga y suscripción por correo para recibir avisos cuando una predicción supere los umbrales de riesgo.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 md:px-12 py-8 space-y-8">

        {/* Métricas */}
        <section id="suscripcion" className="scroll-mt-24">
          {cargando ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-busy="true" aria-label="Cargando métricas">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : error && !metricas ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-sm text-red-400">
              <p>{error}</p>
              <button
                onClick={load}
                className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition min-h-[44px]"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Alertas últimas 24 h", value: metricas?.alertas_hoy ?? 0, color: "#FFD600" },
                { label: "Nivel máx. registrado", value: metricas?.nivel_maximo != null ? `${metricas.nivel_maximo.toFixed(0)} cm` : "—", color: "#FF0055" },
                { label: "Zonas afectadas", value: metricas?.zonas_afectadas != null ? String(metricas.zonas_afectadas) : "—", color: "#B000FF" },
                {
                  label: "Última alerta",
                  value: metricas?.ultima_alerta ? formatFechaHoraCartagena(metricas.ultima_alerta) : "Sin alertas",
                  color: "#00E5FF",
                },
              ].map((m) => (
                <div key={m.label} className="glass rounded-2xl p-4">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{m.label}</p>
                  <p className="mt-1 font-display text-lg font-bold font-tabular break-words" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Suscripción */}
          <motion.div {...FADE} className="glass-strong rounded-2xl p-5 mt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg glass-glow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </div>
              <div>
                <p className="font-display text-sm font-bold text-white">Suscripción por correo</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                  Recibí un aviso cuando el nivel proyectado supere 30 cm
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                aria-label="Correo para suscripción"
                className="min-w-[220px] flex-1 rounded-lg bg-ocean/60 border border-cyan/15 px-3 py-2.5 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan/40"
              />
              <button
                onClick={() => gestionarSuscripcion("subscribe")}
                disabled={enviando}
                className="glass-glow rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition disabled:opacity-50 min-h-[44px]"
              >
                {enviando ? "Guardando…" : "Suscribirme"}
              </button>
              <button
                onClick={() => gestionarSuscripcion("unsubscribe")}
                disabled={enviando}
                className="glass rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-white transition disabled:opacity-50 min-h-[44px]"
              >
                Darme de baja
              </button>
            </div>

            {suscripcionMsg && (
              <p role="status" className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm text-emerald-300">{suscripcionMsg}</p>
            )}
            {suscripcionErr && (
              <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{suscripcionErr}</p>
            )}

            <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
              {totalSuscripciones != null && `${totalSuscripciones} suscriptor(es) guardados en este servidor. `}
              {smtpConfigurado === false && (
                <>El envío por correo está <strong className="text-amber-300">deshabilitado</strong> en el servidor (SMTP sin configurar): tu suscripción queda guardada y se activará cuando el administrador configure el envío.</>
              )}
              {smtpConfigurado === true && (<>El envío por correo está <strong className="text-emerald-300">activo</strong>: recibirás avisos por email.</>)}
            </p>
          </motion.div>
        </section>

        {/* Historial de alertas */}
        <section id="historial" className="scroll-mt-24">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-display text-xl font-bold text-white">Historial de alertas</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{notas.length} registros</p>
            </div>
            <button
              onClick={exportarCSV}
              disabled={notas.length === 0}
              className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition disabled:opacity-40 min-h-[44px]"
            >
              Exportar CSV
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {["TODOS", "CRITICO", "EMERGENCIA", "ALERTA", "NORMAL"].map((n) => {
              const activo = filtro === n;
              const color = n === "TODOS" ? "#00E5FF" : NIVEL_STYLE[n].color;
              return (
                <button
                  key={n}
                  onClick={() => setFiltro(activo ? "TODOS" : n)}
                  aria-pressed={activo}
                  className={`rounded-md px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition min-h-[32px] ${
                    activo ? "bg-white/5" : "text-slate-400 hover:text-white"
                  }`}
                  style={activo ? { color, boxShadow: `0 0 0 1px ${color}55` } : undefined}
                >
                  {n === "TODOS" ? "Todos" : NIVEL_STYLE[n].label}
                </button>
              );
            })}
          </div>

          {/* Búsqueda */}
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el historial…"
              aria-label="Buscar en el historial"
              className="w-full rounded-lg bg-ocean/60 border border-cyan/15 pl-10 pr-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan/40"
            />
          </div>

          {/* Lista */}
          {cargando && notas.length === 0 ? (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando historial de alertas">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-slate-500 text-sm">
                {notas.length === 0 ? "Aún no hay alertas registradas. Cuando una predicción supere los umbrales, aparecerán aquí." : "Ninguna alerta coincide con el filtro."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtradas.map((n, i) => {
                const nivel = (n.riesgo ?? n.nivel ?? "NORMAL").toUpperCase();
                const c = NIVEL_STYLE[nivel] ?? NIVEL_STYLE.NORMAL;
                const esSistema = Boolean(n.de_sistema);
                const nivelVal: number | undefined = n.nivel_cm ?? n.nivel_agua;
                return (
                  <motion.div
                    key={n.id ?? `${n.timestamp}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * Math.min(i, 6) }}
                    className="glass rounded-xl p-4 flex flex-wrap items-start gap-3"
                  >
                    <span className="mt-1 inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color, boxShadow: `0 0 10px ${c.color}80` }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color: c.color, borderColor: `${c.color}55` }}>
                          {c.label}
                        </span>
                        {esSistema && (
                          <span className="rounded-full border border-cyan/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan">Estado en vivo</span>
                        )}
                        <span className="font-mono text-[10px] text-slate-500">{formatFechaHoraCartagena(n.timestamp)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-300">
                        {(n.mensaje ?? n.titulo ?? n.descripcion ?? "Sin descripción") + (n.titulo && n.descripcion ? ` — ${n.descripcion}` : "")}
                      </p>
                      {nivelVal != null && (
                        <p className="mt-1 font-mono text-[11px] text-slate-400 font-tabular">
                          Nivel: {nivelVal.toFixed(1)} cm
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        title={n.email_enviado ? "Correo enviado" : n.email_enviado === false ? "Correo no enviado" : "—"}
                        className={`rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${n.email_enviado ? "border-emerald-400/40 text-emerald-300" : "border-white/10 text-slate-600"}`}
                      >
                        correo{!!n.email_enviado && " ✓"}
                      </span>
                      <span
                        title={n.webhook_enviado ? "Webhook enviado" : n.webhook_enviado === false ? "Webhook no enviado" : "—"}
                        className={`rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${n.webhook_enviado ? "border-cyan/40 text-cyan" : "border-white/10 text-slate-600"}`}
                      >
                        webhook{!!n.webhook_enviado && " ✓"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        <div className="text-center pt-4 border-t border-cyan/10">
          <Link href="/" className="glass-glow rounded-lg px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition inline-block">
            Volver al panel principal
          </Link>
        </div>
      </div>

      <MobileBottomNav items={NAV_ALERTAS} />
    </main>
  );
}