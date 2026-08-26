"use client";

import { motion } from "framer-motion";

const STEPS = [
  { label: "Sensores DAVIS", sub: "f_lluvia(t)", icon: "📡", color: "#00D2FF" },
  { label: "NOAA / Open-Meteo", sub: "f_marea(t)", icon: "🛰", color: "#00D2FF" },
  { label: "Servidor Cloud", sub: "RK4 Solver", icon: "⚙", color: "#FFD600" },
  { label: "Tu Pantalla", sub: "H(t)", icon: "📊", color: "#00E5FF" },
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
            <div className="text-2xl mb-2">{step.icon}</div>
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
