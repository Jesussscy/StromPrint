"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Binary } from "lucide-react";

const KaTeXBlock = dynamic(() => import("./KaTeXBlock"), { ssr: false });

interface Etapa {
  id: string;
  nombre: string;
  pendiente: string;
  descripcion: string;
  color: string;
}

const ETAPAS: Etapa[] = [
  {
    id: "k1",
    nombre: "k₁",
    pendiente: "k_1 = f(t_n,\, s_n)",
    descripcion: "Pendiente inicial: evaluamos la derivada en el punto de partida (tₙ, sₙ).",
    color: "#00E5FF",
  },
  {
    id: "k2",
    nombre: "k₂",
    pendiente: "k_2 = f\\!\\left(t_n + \\tfrac{h}{2},\\; s_n + \\tfrac{h}{2} k_1\\right)",
    descripcion: "Pendiente intermedia: avanzamos medio paso usando k₁ y reevaluamos en el punto medio.",
    color: "#00FF87",
  },
  {
    id: "k3",
    nombre: "k₃",
    pendiente: "k_3 = f\\!\\left(t_n + \\tfrac{h}{2},\\; s_n + \\tfrac{h}{2} k_2\\right)",
    descripcion: "Corrección central: otra evaluación en el punto medio, ahora guiada por k₂.",
    color: "#FFD600",
  },
  {
    id: "k4",
    nombre: "k₄",
    pendiente: "k_4 = f(t_n + h,\\; s_n + h\\, k_3)",
    descripcion: "Extrapolación final: evaluamos la derivada al final del paso usando k₃.",
    color: "#B000FF",
  },
];

export default function MetodoRK4() {
  const [etapaActiva, setEtapaActiva] = useState<string | null>("k1");
  const activa = ETAPAS.find((e) => e.id === etapaActiva) ?? ETAPAS[0];

  return (
    <div className="glass-strong rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-glow">
          <Binary size={15} className="text-cyan" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-white">¿Cómo se resuelve? · Integración RK4</h3>
          <p className="text-[11px] text-slate-500">
            La EDO de segundo orden se convierte en un sistema de primer orden y se avanza paso a paso
          </p>
        </div>
      </div>

      {/* Estado convertido */}
      <div className="grid gap-3 md:grid-cols-2 mb-6">
        <div className="glass rounded-xl p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">1 · Reducción a primer orden</p>
          <p className="text-sm text-slate-300 leading-relaxed mb-2">
            Definimos el vector de estado <span className="font-mono text-cyan">s = [Z, Z′, X, X′, Y, Y′]</span> para
            convertir las tres EDO de segundo orden en un solo sistema de 6 ecuaciones de primer orden.
          </p>
          <KaTeXBlock math="\underbrace{[Z,\, Z',\, X,\, X',\, Y,\, Y']}_{s(t)} \qquad \dot{s} = f(t,\, s)" />
        </div>
        <div className="glass rounded-xl p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">2 · Paso de integración</p>
          <p className="text-sm text-slate-300 leading-relaxed mb-2">
            Cada hora (<span className="font-mono text-cyan">h = 1 h</span>) el motor avanza el estado mediante el
            promedio ponderado de <span className="font-mono text-slate-200">k₁</span> a{" "}
            <span className="font-mono text-slate-200">k₄</span>:
          </p>
          <KaTeXBlock math="s_{n+1} = s_n + \frac{h}{6}\left(k_1 + 2k_2 + 2k_3 + k_4\right)" />
        </div>
      </div>

      {/* Etapas interactivas */}
      <div className="grid gap-3 md:grid-cols-4 mb-4">
        {ETAPAS.map((e, i) => {
          const esActivo = etapaActiva === e.id;
          const completada = ETAPAS.findIndex((x) => x.id === etapaActiva) > i;
          return (
            <motion.button
              key={e.id}
              onClick={() => setEtapaActiva(e.id)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.96 }}
              animate={{
                borderColor: esActivo ? `${e.color}80` : `${e.color}25`,
                backgroundColor: esActivo ? `${e.color}14` : "transparent",
                boxShadow: esActivo ? `0 0 18px ${e.color}35` : "none",
              }}
              className="relative flex flex-col items-center gap-1 rounded-xl border px-3 py-4 text-center cursor-pointer"
              aria-pressed={esActivo}
            >
              {completada && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#00FF87] text-[#02120B]">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              )}
              <span className="font-mono text-lg font-bold" style={{ color: e.color }}>{e.nombre}</span>
              <span className="font-mono text-[10px] text-slate-500 leading-tight">
                etapa {i + 1} de 4
              </span>
              <span
                className={`mt-1 h-1 w-8 rounded-full transition-all duration-300 ${esActivo ? "opacity-100 scale-110" : "opacity-30"}`}
                style={{ backgroundColor: e.color }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Descripción + fórmula de la etapa activa */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activa.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          style={{ borderColor: `${activa.color}45`, background: `${activa.color}0d` }}
          className="rounded-xl border p-5"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-slate-300 leading-relaxed mb-2">{activa.descripcion}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                f(t, s) = derivada del estado en ese punto
              </p>
            </div>
            <div className="md:w-1/2 md:text-right">
              <KaTeXBlock math={activa.pendiente} />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <p className="mt-5 text-[11px] text-slate-600 border-t border-white/5 pt-4 leading-relaxed">
        Al combinar estas cuatro pendientes —con mayor peso en las evaluaciones centrales (2·k₂ y 2·k₃)— el método
        RK4 aproxima la solución con un error local de orden{" "}
        <span className="font-mono text-slate-300">O(h⁵)</span>, lo que da predicciones estables de nivel de agua para
        cada zona de Manga durante las próximas 48 horas.
      </p>
    </div>
  );
}
