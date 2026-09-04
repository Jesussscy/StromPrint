"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Home,
  LayoutDashboard,
  Brain,
  Siren,
  Phone,
  Globe,
  Twitter,
  Camera,
  Linkedin,
  MapPin,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { fetchHealth, type HealthResponse } from "@/app/lib/api";

function tiempoDesde(iso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

const NAV_LINKS = [
  { label: "Inicio", href: "/", icon: <Home size={15} /> },
  { label: "Panel en Vivo", href: "/#panel-vivo", icon: <LayoutDashboard size={15} /> },
  { label: "Ciencia", href: "/ciencia", icon: <Brain size={15} /> },
  { label: "Alertas", href: "/alertas", icon: <Siren size={15} /> },
];

const REDES = [
  { label: "Web", href: "#", icon: <Globe size={17} /> },
  { label: "Twitter", href: "#", icon: <Twitter size={17} /> },
  { label: "Instagram", href: "#", icon: <Camera size={17} /> },
  { label: "LinkedIn", href: "#", icon: <Linkedin size={17} /> },
];

export default function Footer() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  // El anyo se fija en el montaje (no en render) para evitar diferencias de
  // hidratacion en el cambio de anyo (31 dic -> 1 ene).
  const [year, setYear] = useState<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    setYear(new Date().getFullYear());
    const poll = () => {
      fetchHealth()
        .then((h) => {
          if (mounted.current) setHealth(h);
        })
        .catch(() => {
          // Backend caido: marcar como degradado en lugar de dejar "Verificando…"
          // para siempre, senalando que hay un problema.
          if (mounted.current) setHealth((prev) => prev ?? { status: "degraded", timestamp: "", uptime_seconds: 0, database: "error", fuentes: {}, suscripciones: 0 });
        });
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

  return (
    <footer className="group relative bg-[#080C14] border-t border-cyan/10 animate-fade-in-up">
      {/* Separador decorativo superior — se ilumina al hacer hover */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent transition-all duration-300 group-hover:via-cyan/70 group-hover:shadow-[0_0_12px_rgba(0,210,255,0.4)]" />

      <div className="mx-auto max-w-6xl px-6 pt-14 pb-24 sm:pb-10">
        {/* Grid de 3 columnas */}
        <div className="grid gap-10 md:grid-cols-3">

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
              Monitoreo y predicción de riesgo de inundación en tiempo real para el Barrio Manga, Cartagena.
            </p>
            <div className="space-y-2 text-sm text-slate-500">
              <p className="flex items-center gap-2.5">
                <MapPin size={15} className="shrink-0 text-cyan/60" />
                <span>Barrio Manga, Cartagena de Indias</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Mail size={15} className="shrink-0 text-cyan/60" />
                <a href="mailto:contacto@stormprint.co" className="hover:text-cyan transition-colors duration-200">
                  contacto@stormprint.co
                </a>
              </p>
            </div>
            {/* Redes sociales */}
            <div className="flex gap-2.5 pt-1">
              {REDES.map((r) => (
                <a
                  key={r.label}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={r.label}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:border-cyan/40 hover:text-cyan active:scale-95 hover:-translate-y-0.5 transition-all duration-200 touch-manipulation"
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
                  <Link
                    href={link.href}
                    className="group flex items-center gap-2.5 text-sm text-slate-400 hover:text-cyan transition-colors duration-200"
                  >
                    <span className="text-cyan/60 transition-colors duration-200 group-hover:text-cyan">
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Columna 3: Estado del Sistema ── */}
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-white mb-5">
              Estado del Sistema
            </h4>
            <div className="space-y-5">
              {/* Status */}
              <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    isOperational
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse"
                      : health
                        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse"
                        : "bg-slate-600"
                  }`}
                />
                <div>
                  <div className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
                    {isOperational ? "Sistema Activo" : health ? "Degradado" : "Verificando..."}
                  </div>
                  {health && (
                    <div className="text-[10px] font-mono text-slate-500">
                      {uptimeH}h {uptimeM}m de uptime · actualización hace {tiempoDesde(health.timestamp)}
                    </div>
                  )}
                </div>
              </div>

              <Link
                href="/#panel-vivo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan/30 px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 transition-all duration-200"
              >
                <LayoutDashboard size={14} /> Ver dashboard en vivo
              </Link>

              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <CheckCircle2 size={13} className="text-emerald-400/80" />
                Predicciones actualizadas cada 30 segundos
              </p>
            </div>
          </div>
        </div>

        {/* ── Barra inferior ── */}
        <div className="mt-12 pt-6 border-t border-white/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <p className="flex items-center gap-2">
              <Phone size={12} className="text-cyan/60" />
              <a href="tel:+573001234567" className="hover:text-cyan transition-colors duration-200">+57 300 123 4567</a>
              <span className="text-slate-700">·</span>
              <a href="mailto:contacto@stormprint.co" className="hover:text-cyan transition-colors duration-200">contacto@stormprint.co</a>
            </p>
            <p>© {year ?? ""} StormPrint · Cartagena, Colombia</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
