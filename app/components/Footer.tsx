"use client";

import { useEffect, useState, useRef } from "react";
import { fetchHealth, type HealthResponse } from "@/app/lib/api";

function tiempoDesde(iso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

const NAV_LINKS = [
  { label: "Inicio", href: "/", icon: "🏠" },
  { label: "Panel en Vivo", href: "/#panel-vivo", icon: "📊" },
  { label: "Ciencia", href: "/ciencia", icon: "🧠" },
  { label: "Alertas", href: "/alertas", icon: "🚨" },
  { label: "Contacto", href: "/#contacto", icon: "📞" },
];

const REDES = [
  { label: "Web", href: "#", icon: "🌐" },
  { label: "Twitter", href: "#", icon: "🐦" },
  { label: "Instagram", href: "#", icon: "📸" },
  { label: "LinkedIn", href: "#", icon: "💼" },
];

const RECURSOS = [
  { label: "Documentación técnica", href: "#" },
  { label: "Política de privacidad", href: "#" },
  { label: "Términos de uso", href: "#" },
  { label: "Mapa del sitio", href: "#" },
  { label: "Preguntas frecuentes", href: "#" },
];

export default function Footer() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const poll = () => {
      fetchHealth()
        .then((h) => {
          if (mounted.current) setHealth(h);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, []);

  const isOperational = health?.status === "operational";
  const uptimeH = health ? Math.floor(health.uptime_seconds / 3600) : 0;
  const uptimeM = health ? Math.floor((health.uptime_seconds % 3600) / 60) : 0;
  const year = new Date().getFullYear();

  return (
    <footer className="group relative bg-[#080C14] border-t border-cyan/10 animate-fade-in-up">
      {/* Separador decorativo superior — se ilumina al hacer hover */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent transition-all duration-300 group-hover:via-cyan/70 group-hover:shadow-[0_0_12px_rgba(0,210,255,0.4)]" />

      <div className="mx-auto max-w-7xl px-6 pt-16 pb-8">
        {/* Grid de 4 columnas */}
        <div className="grid gap-10 lg:grid-cols-4 md:grid-cols-2 max-md:grid-cols-1">

          {/* ── Columna 1: Marca ── */}
          <div className="space-y-5">
            <a href="/" className="inline-flex items-center gap-2 group">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="shrink-0">
                <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" opacity="0.5" className="text-cyan" />
                <path d="M16 8C16 8 10 15 10 19a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill="currentColor" opacity="0.7" className="text-cyan" />
              </svg>
              <span className="font-display text-sm font-bold tracking-wider text-white group-hover:text-cyan transition-colors duration-200">
                STORM<span className="neon-text">{"//"}</span>PRINT
              </span>
            </a>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Ingeniería de datos para la resiliencia climática en el Caribe colombiano.
            </p>
            <div className="space-y-2 text-sm text-slate-500">
              <p className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">📍</span>
                <span>Barrio Manga, Cartagena de Indias</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">📧</span>
                <a href="mailto:contacto@stormprint.co" className="hover:text-cyan transition-colors duration-200">
                  contacto@stormprint.co
                </a>
              </p>
              <p className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">📱</span>
                <a href="tel:+573001234567" className="hover:text-cyan transition-colors duration-200">
                  +57 300 123 4567
                </a>
              </p>
            </div>
            {/* Redes sociales */}
            <div className="flex gap-2 pt-1">
              {REDES.map((r) => (
                <a
                  key={r.label}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={r.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-sm text-slate-400 hover:border-cyan/40 hover:text-cyan hover:scale-110 hover:shadow-[0_0_12px_rgba(0,210,255,0.15)] transition-all duration-200"
                >
                  {r.icon}
                </a>
              ))}
            </div>
          </div>

          {/* ── Columna 2: Navegación ── */}
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-white mb-5">
              Navegación
            </h4>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="group flex items-center gap-2.5 text-sm text-slate-400 hover:text-cyan transition-colors duration-200"
                  >
                    <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                      {link.icon}
                    </span>
                    <span className="group-hover:drop-shadow-[0_0_6px_rgba(0,210,255,0.5)]">
                      {link.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Columna 3: Estado del Sistema ── */}
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-white mb-5">
              Estado del Sistema
            </h4>
            <div className="space-y-4">
              {/* Status LED + label */}
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    isOperational
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse"
                      : health
                        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse"
                        : "bg-slate-600"
                  }`}
                />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
                  {isOperational ? "Sistema Activo" : health ? "Degradado" : "Verificando..."}
                </span>
              </div>

              {/* Última actualización */}
              <p className="text-xs text-slate-500">
                Última actualización:{" "}
                <span className="font-mono text-slate-400">
                  hace {health ? tiempoDesde(health.timestamp) : "—"}
                </span>
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatBlock icon="📊" label="Precisión" value="98.7%" />
                <StatBlock icon="🕒" label="Monitoreo" value="24/7" />
                <StatBlock icon="📅" label="Pronóstico" value="7 días" />
              </div>

              {/* Uptime */}
              {health && (
                <p className="text-[10px] font-mono text-slate-600">
                  Uptime: {uptimeH}h {uptimeM}m
                </p>
              )}

              <a
                href="/#panel-vivo"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan/20 px-4 py-2 text-xs font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 hover:border-cyan/40 hover:shadow-[0_0_12px_rgba(0,210,255,0.15)] transition-all duration-200"
              >
                📊 Ver dashboard
              </a>
            </div>
          </div>

          {/* ── Columna 4: Legal y Recursos ── */}
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-white mb-5">
              Recursos
            </h4>
            <ul className="space-y-3">
              {RECURSOS.map((r) => (
                <li key={r.label}>
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-400 hover:text-cyan hover:drop-shadow-[0_0_6px_rgba(0,210,255,0.5)] transition-all duration-200"
                  >
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Barra inferior ── */}
        <div className="mt-14 pt-6 border-t border-white/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-600">
            <p>
              ⚡ StormPrint © {year} · Todos los derechos reservados
            </p>
            <p>
              Hecho con <span className="text-red-400">❤</span> para Manga, Cartagena
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function StatBlock({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-center">
      <span className="block text-xs mb-1">{icon}</span>
      <span className="block font-mono text-[10px] font-bold text-white leading-tight">{value}</span>
      <span className="block text-[9px] text-slate-600 mt-0.5 uppercase tracking-wider">{label}</span>
    </div>
  );
}
