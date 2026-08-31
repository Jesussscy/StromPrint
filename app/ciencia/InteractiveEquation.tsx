"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

const KaTeXBlock = dynamic(() => import("./KaTeXBlock"), { ssr: false });

interface Variable {
  id: string;
  symbol: string;
  label: string;
  color: string;
  description: string;
}

const VARIABLES: Variable[] = [
  { id: "h", symbol: "H''(t)", label: "Aceleración", color: "#00E5FF", description: "Segunda derivada de la altura del agua respecto al tiempo." },
  { id: "c", symbol: "c(t)", label: "Fricción", color: "#FFD600", description: "Coeficiente de fricción propio del terreno de Manga." },
  { id: "k", symbol: "k(t)", label: "Amortiguamiento", color: "#FF0055", description: "Coeficiente de amortiguamiento del sistema hídrico." },
  { id: "f_lluvia", symbol: "f_{lluvia}(t)", label: "Lluvia", color: "#00FF87", description: "Caudal de agua que entra por precipitación (sensores locales + Open-Meteo)." },
  { id: "f_marea", symbol: "f_{marea}(t)", label: "Marea", color: "#B000FF", description: "Caudal de agua por influencia del mar (datos NOAA)." },
  { id: "f_drenaje", symbol: "f_{drenaje}(t)", label: "Drenaje", color: "#F1FAEE", description: "Capacidad de absorción del suelo y alcantarillado (DEM topográfico)." },
];

export default function InteractiveEquation() {
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);
  const [fijado, setFijado] = useState<string | null>(null);

  const activo = fijado ?? hoveredVar;
  const colorActivo = activo ? VARIABLES.find((v) => v.id === activo)?.color : null;

  return (
    <div className="glass-strong rounded-2xl p-6 md:p-8">
      {/* Equation */}
      <div className="mb-8 flex justify-center">
        <motion.div
          animate={{
            boxShadow: colorActivo
              ? `0 0 38px ${colorActivo}45, inset 0 0 24px ${colorActivo}18`
              : "0 0 24px rgba(0,229,255,0.15), inset 0 0 24px rgba(0,229,255,0.06)",
            borderColor: colorActivo ? `${colorActivo}70` : "rgba(0,229,255,0.3)",
          }}
          transition={{ duration: 0.4 }}
          className="glass rounded-xl px-6 py-5 md:px-10 md:py-7 border bg-ocean-mid relative overflow-hidden"
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-current to-transparent animate-pulse-slow"
            style={{ color: colorActivo ? `${colorActivo}12` : "rgba(0,229,255,0.08)" }}
          />
          <div className="relative z-10">
            <KaTeXBlock
              math="H''(t) + c(t) \cdot H'(t) + k(t) \cdot H(t) = f_{\text{lluvia}}(t) + f_{\text{marea}}(t) + f_{\text{drenaje}}(t)"
              displayMode
            />
          </div>
        </motion.div>
      </div>

      {/* Interactive legend */}
      <div className="flex flex-wrap justify-center gap-3">
        {VARIABLES.map((v) => {
          const esActivo = activo === v.id;
          return (
            <motion.button
              key={v.id}
              onMouseEnter={() => setHoveredVar(v.id)}
              onMouseLeave={() => setHoveredVar(null)}
              onFocus={() => setHoveredVar(v.id)}
              onBlur={() => setHoveredVar(null)}
              onClick={() => { setFijado(esActivo ? null : v.id); setHoveredVar(null); }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                borderColor: esActivo ? v.color : `${v.color}30`,
                backgroundColor: esActivo ? `${v.color}18` : "transparent",
                boxShadow: esActivo ? `0 0 18px ${v.color}45` : "none",
              }}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-200 cursor-pointer"
              aria-pressed={esActivo}
              title={v.description}
            >
              <span className="relative flex h-2.5 w-2.5">
                {esActivo && (
                  <motion.span
                    className="absolute inline-flex h-full w-full rounded-full"
                    style={{ backgroundColor: v.color }}
                    animate={{ opacity: [0.7, 0], scale: [1, 2.6] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: esActivo ? v.color : `${v.color}80` }} />
              </span>
              <span className="font-mono text-xs" style={{ color: v.color }}>{v.symbol.replace(/[{}]/g, "")}</span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">{v.label}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-slate-600 transition ${esActivo ? "opacity-100" : "opacity-0"}`}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </motion.button>
          );
        })}
      </div>

      {/* Description tooltip animado */}
      <div className="mt-5 min-h-[44px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {activo ? (
            <motion.div
              key={activo}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-xl text-center"
            >
              <span
                className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                style={{ backgroundColor: colorActivo ?? "#00E5FF" }}
              />
              <span className="text-sm text-slate-300">
                {VARIABLES.find((v) => v.id === activo)?.description}
              </span>
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-slate-600 font-mono"
            >
              Pasa el mouse (o toca) una variable para explorarla
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
