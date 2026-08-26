"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Alert {
  id: string;
  level: "normal" | "alerta" | "emergencia" | "critico";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_ALERTS: Alert[] = [
  { id: "1", level: "alerta", title: "Alerta Temprana", message: "Se esperan 35 cm de agua en Calle 24 en 45 minutos.", time: "Hace 5 min", read: false },
  { id: "2", level: "emergencia", title: "Emergencia", message: "Nivel de agua subiendo rápido en Av. Pedro de Heredia. 62 cm actuales.", time: "Hace 2 min", read: false },
  { id: "3", level: "normal", title: "Sistema Operativo", message: "Todos los sensores funcionando correctamente. Sin anomalías detectadas.", time: "Hace 15 min", read: true },
];

const LEVEL_CONFIG = {
  normal: { color: "#00E5FF", bg: "rgba(0,229,255,0.08)", border: "rgba(0,229,255,0.2)", icon: "✓" },
  alerta: { color: "#FFD600", bg: "rgba(255,214,0,0.08)", border: "rgba(255,214,0,0.2)", icon: "⚠" },
  emergencia: { color: "#FF0055", bg: "rgba(255,0,85,0.08)", border: "rgba(255,0,85,0.2)", icon: "!!" },
  critico: { color: "#B000FF", bg: "rgba(176,0,255,0.08)", border: "rgba(176,0,255,0.2)", icon: "!!!" },
};

export default function AlertDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts] = useState<Alert[]>(MOCK_ALERTS);
  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <>
      {/* Toggle button */}
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
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-risk-emergency text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </motion.button>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[380px] glass-strong border-l border-cyan/10 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">Centro de Alertas</h2>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{unreadCount} sin leer</p>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  {alerts.map((alert) => {
                    const cfg = LEVEL_CONFIG[alert.level];
                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-xl p-4 border"
                        style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                          >
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold text-white">{alert.title}</p>
                              <span className="font-mono text-[9px] text-slate-500">{alert.time}</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{alert.message}</p>
                          </div>
                        </div>
                        {!alert.read && (
                          <div className="mt-2 flex justify-end">
                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                          </div>
                        )}
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
