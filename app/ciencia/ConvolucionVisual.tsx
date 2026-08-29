"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const PASOS = [
  {
    titulo: "1 · F(τ) — Forzamiento de lluvia",
    descripcion:
      "La lluvia empuja el sistema con intensidad variable: un pulso que sube, alcanza su pico en la hora de tormenta y vuelve a bajar. En cada instante τ se inyecta una fuerza F(τ).",
    formula: "F(τ) = I_max · exp( -((τ - μ)²) / (2σ²) )",
  },
  {
    titulo: "2 · g(t−τ) — Respuesta al impulso",
    descripcion:
      "El territorio responde a cada gota como un sistema masa-resorte amortiguado: un impulso unitario en τ=0 produce una onda que crece, oscila (si ζ<1) y decae por el drenaje.",
    formula: "g(t) = (1 / (m·ω_d)) · e^(−ζω_n·t) · sin(ω_d · t)",
  },
  {
    titulo: "3 · H(t) = ∫₀ᵗ F(τ)·g(t−τ) dτ — Convolución",
    descripcion:
      "El nivel total de agua H(t) es la superposición de TODAS las respuestas: cada impulso de lluvia F(τ) contribuye con su respuesta al impulso g desplazada y pesada. La integral suma eso sobre todo el pasado τ desde 0 hasta t.",
    formula: "H(t) = ∫₀ᵗ F(τ) · g(t−τ) · dτ",
  },
];

export default function ConvolucionVisual() {
  const [paso, setPaso] = useState(0);
  const activo = PASOS[paso];

  return (
    <div className="glass rounded-2xl p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">
        Integral de convolución (Duhamel)
      </p>
      <h3 className="font-display text-lg font-bold text-white mb-2">
        Cómo la analítica &lsquo;predice&rsquo; la lluvia sin paso a paso
      </h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-5">
        En vez de integrar paso a paso, la solución analítica usa la
        <strong className="text-white"> integral de convolución</strong>: multiplica la fuerza de lluvia por la
        respuesta del barrio y suma todo el historial. Explora los tres pasos:
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {PASOS.map((p, i) => (
          <button
            key={i}
            onClick={() => setPaso(i)}
            className={`rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition ${
              paso === i
                ? "bg-cyan/20 text-cyan shadow-glow border border-cyan/30"
                : "bg-[#0A1119] text-slate-400 border border-white/5 hover:text-white"
            }`}
          >
            Paso {i + 1}
          </button>
        ))}
      </div>

      <motion.div
        key={paso}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl bg-[#0A1119] p-5 border border-white/5"
      >
        <h4 className="font-semibold text-white">{activo.titulo}</h4>
        <p className="text-slate-400 text-sm mt-2 leading-relaxed">{activo.descripcion}</p>
        <div className="mt-4 rounded-lg bg-[#0D1520] p-3 border-l-2 border-cyan font-mono text-cyan text-center text-sm">
          {activo.formula}
        </div>
      </motion.div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 text-center text-[11px]">
        <div className="rounded-lg bg-[#0A1119] p-2 text-slate-500">
          <span className="text-white font-semibold">Tramos:</span> coeficientes c(t), k(t) constantes
        </div>
        <div className="rounded-lg bg-[#0A1119] p-2 text-slate-500">
          <span className="text-white font-semibold">Analítica:</span> 96 evaluaciones de la integral
        </div>
        <div className="rounded-lg bg-[#0A1119] p-2 text-emerald-400/80">
          Resultado: <span className="text-white font-semibold">curva cerrada exacta</span>
        </div>
      </div>
    </div>
  );
}
