"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Alert {
  id: string;
  level: "normal" | "alerta" | "emergencia" | "critico";
  title: string;
  message: string;
  time: string;
  action?: string;
}

const MOCK_ALERTS: Alert[] = [
  { id: "1", level: "alerta", title: "Alerta Temprana", message: "Se esperan 35 cm de agua en Calle 24 en 45 minutos.", time: "Hace 5 min", action: "Ver mapa" },
  { id: "2", level: "emergencia", title: "¡Alerta Crítica!", message: "Nivel supera los 60 cm en Av. Pedro de Heredia.", time: "Hace 2 min", action: "Ver ruta de evacuación" },
  { id: "3", level: "normal", title: "Sistema Operativo", message: "Todos los sensores funcionando. Sin anomalías.", time: "Hace 15 min" },
];

const LEVEL_CONFIG = {
  normal: {
    color: "#00E5FF",
    bg: "rgba(0, 229, 255, 0.06)",
    border: "rgba(0, 229, 255, 0.3)",
    glow: "rgba(0, 229, 255, 0.15)",
    label: "SISTEMA ESTABLE",
    iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  alerta: {
    color: "#FFD600",
    bg: "rgba(255, 214, 0, 0.06)",
    border: "rgba(255, 214, 0, 0.3)",
    glow: "rgba(255, 214, 0, 0.15)",
    label: "ALERTA",
    iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  emergencia: {
    color: "#FF0055",
    bg: "rgba(255, 0, 85, 0.06)",
    border: "rgba(255, 0, 85, 0.3)",
    glow: "rgba(255, 0, 85, 0.2)",
    label: "EMERGENCIA",
    iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  critico: {
    color: "#B000FF",
    bg: "rgba(176, 0, 255, 0.06)",
    border: "rgba(176, 0, 255, 0.3)",
    glow: "rgba(176, 0, 255, 0.2)",
    label: "CRITICO",
    iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
};

function AlertIcon({ path, color }: { path: string; color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function AlertDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const alerts = MOCK_ALERTS.filter((a) => !dismissed.has(a.id));
  const unreadCount = alerts.length;

  return (
    <>
      {/* Toggle button - HUD style */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-20 right-6 z-50 glass-glow rounded-xl p-3 cursor-pointer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-risk-emergency text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </motion.button>

      {/* Floating HUD notifications - always visible */}
      <div className="fixed top-36 right-6 z-50 flex flex-col gap-2 w-[340px] pointer-events-none">
        <AnimatePresence>
          {isOpen && alerts.map((alert, i) => {
            const cfg = LEVEL_CONFIG[alert.level];
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                className="pointer-events-auto rounded-xl p-3.5 backdrop-blur-xl border-l-4 flex gap-3 items-start"
                style={{
                  backgroundColor: "rgba(5, 10, 15, 0.85)",
                  borderColor: cfg.color,
                  border: `1px solid ${cfg.border}`,
                  borderLeftWidth: 4,
                  borderLeftColor: cfg.color,
                  boxShadow: `0 0 25px ${cfg.glow}, 0 8px 32px rgba(0,0,0,0.5)`,
                }}
              >
                {/* Icon */}
                <div
                  className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${cfg.color}15` }}
                >
                  <AlertIcon path={cfg.iconPath} color={cfg.color} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="font-mono text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
                      style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
                    >
                      {cfg.label}
                    </span>
                    <span className="font-mono text-[9px] text-slate-600">{alert.time}</span>
                  </div>
                  <p className="text-xs font-semibold text-white mb-0.5">{alert.title}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{alert.message}</p>
                  {alert.action && (
                    <button
                      className="mt-2 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded transition-all hover:brightness-125"
                      style={{ color: cfg.color, backgroundColor: `${cfg.color}12`, border: `1px solid ${cfg.color}30` }}
                    >
                      {alert.action} →
                    </button>
                  )}
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => setDismissed((s) => new Set(s).add(alert.id))}
                  className="shrink-0 text-slate-600 hover:text-white transition text-xs"
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Full drawer panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-[60] w-[380px] backdrop-blur-xl overflow-y-auto"
              style={{
                backgroundColor: "rgba(5, 10, 15, 0.92)",
                borderLeft: "1px solid rgba(0, 229, 255, 0.1)",
              }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">Centro de Alertas</h2>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                      {unreadCount} notificaciones activas
                    </p>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  {MOCK_ALERTS.map((alert) => {
                    const cfg = LEVEL_CONFIG[alert.level];
                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-xl p-4 backdrop-blur-xl border-l-4"
                        style={{
                          backgroundColor: cfg.bg,
                          borderColor: cfg.color,
                          borderLeftWidth: 4,
                          borderLeftColor: cfg.color,
                          boxShadow: `0 0 20px ${cfg.glow}`,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${cfg.color}15` }}
                          >
                            <AlertIcon path={cfg.iconPath} color={cfg.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="font-mono text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
                                style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
                              >
                                {cfg.label}
                              </span>
                              <span className="font-mono text-[9px] text-slate-500">{alert.time}</span>
                            </div>
                            <p className="text-sm font-semibold text-white mb-0.5">{alert.title}</p>
                            <p className="text-xs text-slate-400 leading-relaxed">{alert.message}</p>
                            {alert.action && (
                              <button
                                className="mt-2 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded transition-all hover:brightness-125"
                                style={{ color: cfg.color, backgroundColor: `${cfg.color}12`, border: `1px solid ${cfg.color}30` }}
                              >
                                {alert.action} →
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
