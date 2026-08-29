"use client";

import { motion } from "framer-motion";

const STEPS = [
  { label: "Sensores DAVIS", sub: "f_lluvia(t)", icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01m2.99-3H8m-4.99 3L8 9l3 3 3-6 2 4h2.01" /></svg>, color: "#00F3FF" },
  { label: "NOAA / Open-Meteo", sub: "f_marea(t)", icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4c0 1.1-.45 2.1-1.17 2.83A4 4 0 0 1 16 12a4 4 0 0 1-4 4 4 4 0 0 1-4-4c0-1.1.45-2.1 1.17-2.83A4 4 0 0 1 8 6a4 4 0 0 1 4-4z" /><line x1="12" y1="18" x2="12" y2="22" /><circle cx="12" cy="6" r="1.5" /></svg>, color: "#00F3FF" },
  { label: "Servidor Cloud", sub: "Analítica · Duhamel", icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>, color: "#FFD600" },
  { label: "Tu Pantalla", sub: "H(t)", icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>, color: "#00E5FF" },
];

export default function DataFlowDiagram() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2">
      {STEPS.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2 md:gap-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="glass rounded-xl p-4 text-center min-w-[140px]"
          >
            <div className="text-2xl mb-2 flex items-center justify-center" style={{ color: step.color }}>{step.icon}</div>
            <p className="font-display text-xs font-bold text-white">{step.label}</p>
            <p className="font-mono text-[10px] mt-1" style={{ color: step.color }}>{step.sub}</p>
          </motion.div>

          {i < STEPS.length - 1 && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 + 0.1, duration: 0.4 }}
              className="hidden md:flex items-center"
            >
              <div className="w-12 h-px bg-gradient-to-r from-cyan/40 to-cyan/10 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-transparent border-l-cyan/40" />
              </div>
            </motion.div>
          )}
          {i < STEPS.length - 1 && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 + 0.1 }}
              className="md:hidden w-px h-8 bg-gradient-to-b from-cyan/40 to-cyan/10"
            />
          )}
        </div>
      ))}
    </div>
  );
}
