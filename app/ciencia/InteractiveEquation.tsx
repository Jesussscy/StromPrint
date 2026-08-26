"use client";

import { useState } from "react";
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

  return (
    <div className="glass-strong rounded-2xl p-6 md:p-8">
      {/* Equation */}
      <div className="mb-8 flex justify-center">
        <div className="glass rounded-xl px-6 py-5 md:px-10 md:py-7 border border-cyan/20 shadow-glow relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan/5 via-transparent to-cyan/5 animate-pulse-slow" />
          <div className="relative z-10">
            <KaTeXBlock
              math="H''(t) + c(t) \cdot H'(t) + k(t) \cdot H(t) = f_{\text{lluvia}}(t) + f_{\text{marea}}(t) + f_{\text{drenaje}}(t)"
              displayMode
              highlightedVar={hoveredVar}
              variables={VARIABLES}
            />
          </div>
        </div>
      </div>

      {/* Interactive legend */}
      <div className="flex flex-wrap justify-center gap-3">
        {VARIABLES.map((v) => (
          <button
            key={v.id}
            onMouseEnter={() => setHoveredVar(v.id)}
            onMouseLeave={() => setHoveredVar(null)}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-200 cursor-help"
            style={{
              borderColor: hoveredVar === v.id ? v.color : `${v.color}30`,
              backgroundColor: hoveredVar === v.id ? `${v.color}15` : "transparent",
              boxShadow: hoveredVar === v.id ? `0 0 15px ${v.color}30` : "none",
            }}
          >
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.color }} />
            <span className="font-mono text-xs" style={{ color: v.color }}>{v.symbol.replace(/[{}]/g, "")}</span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>

      {/* Description tooltip */}
      {hoveredVar && (
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-400">
            {VARIABLES.find((v) => v.id === hoveredVar)?.description}
          </p>
        </div>
      )}
    </div>
  );
}
