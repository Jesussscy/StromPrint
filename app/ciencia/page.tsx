"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import InteractiveEquation from "./InteractiveEquation";
import ValidationChart from "./ValidationChart";
import AnalyticalChart from "./AnalyticalChart";
import ParametrosVariables from "./ParametrosVariables";
import ConvolucionVisual from "./ConvolucionVisual";
import AnalyticalWave3D from "./AnalyticalWave3D";
import DataFlowDiagram from "@/app/components/DataFlowDiagram";

const KaTeXBlock = dynamic(() => import("./KaTeXBlock"), { ssr: false });

const FADE = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export default function CienciaPage() {
  return (
    <main className="min-h-screen bg-ocean">
      {/* Hero */}
      <div className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,210,255,0.4) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative mx-auto max-w-4xl px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-cyan transition mb-8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Volver al panel principal
          </Link>
          <motion.div {...FADE}>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Ingeniería y Ciencia</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
              El Cerebro de{" "}
              <span className="neon-text">StormPrint</span>
              <br />
              Cómo Predecimos el Futuro
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl">
              Ingeniería de datos para la resiliencia climática en el Caribe colombiano.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 md:px-12 py-16 space-y-20">

        {/* 1. Modelo Físico */}
        <motion.section {...FADE}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-glow">
              <span className="font-display text-sm font-bold text-cyan">01</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white">El Modelo Físico</h2>
          </div>
          <p className="text-slate-400 leading-relaxed mb-6">
            El corazón del sistema es una <strong className="text-white">Ecuación Diferencial Ordinaria (EDO) de segundo orden</strong> que
            modela el balance hídrico del Barrio Manga. Pasa el mouse sobre cada variable para explorarla.
          </p>
          <InteractiveEquation />
        </motion.section>

        {/* 2. Solución Analítica */}
        <motion.section {...FADE}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-glow">
              <span className="font-display text-sm font-bold text-cyan">02</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white">Solución Analítica por Tramos</h2>
          </div>
          <p className="text-slate-400 leading-relaxed mb-6">
            StormPrint resuelve el modelo mediante una solución <strong className="text-white">analítica por tramos</strong>.
            Dividimos el tiempo en intervalos donde <code className="font-mono text-cyan">c(t)</code> y{" "}
            <code className="font-mono text-cyan">k(t)</code> son constantes y, en cada tramo, la ecuación
            característica <code className="font-mono">m·r² + c·r + k = 0</code> da una solución cerrada
            (suma de exponenciales, senos amortiguados o el caso crítico). El pulso de lluvia, al no tener
            primitiva elemental, se resuelve con la{" "}
            <strong className="text-white">integral de convolución de Duhamel</strong>:
          </p>

          <div className="glass-strong rounded-2xl p-6 mb-6 text-center">
            <KaTeXBlock
              math="m \cdot H''(t) + c \cdot H'(t) + k \cdot H(t) = F_{\text{lluvia}}(t) + F_{\text{marea}}(t)"
              displayMode
            />
            <KaTeXBlock
              math="H_p(t) = \int_0^t F(\tau)\, g(t-\tau)\, d\tau \qquad g(\tau)= \text{respuesta al impulso}"
              displayMode
            />
          </div>

          <p className="text-slate-400 leading-relaxed mb-6">
            Aquí tienes la curva resultante en vivo. Ajustá el número de tramos para ver cómo se refina
            la solución. Los parámetros físicos del sistema se muestran a la derecha:
          </p>
          <AnalyticalChart />

          {/* Parámetros c(t)/k(t) + explicación de la convolución + vista 3D */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ParametrosVariables />
            <ConvolucionVisual />
          </div>
          <div className="mt-6">
            <AnalyticalWave3D />
          </div>
        </motion.section>

        {/* 3. Flujo de Datos */}
        <motion.section {...FADE}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-glow">
              <span className="font-display text-sm font-bold text-cyan">03</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white">Flujo de Datos en Tiempo Real</h2>
          </div>
          <p className="text-slate-400 leading-relaxed mb-6">
            Los datos viajan desde los sensores físicos hasta tu pantalla en menos de 30 segundos:
          </p>
          <div className="glass-strong rounded-2xl p-6">
            <DataFlowDiagram />
          </div>
        </motion.section>

        {/* 4. Validación */}
        <motion.section {...FADE}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-glow">
              <span className="font-display text-sm font-bold text-cyan">04</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white">Validación del Modelo</h2>
          </div>
          <p className="text-slate-400 leading-relaxed mb-6">
            Comparamos los datos históricos reales de una inundación pasada con
            lo que nuestro modelo predijo. La diferencia fue mínima.
          </p>
          <ValidationChart />
        </motion.section>

        {/* 5. Hardware y Software */}
        <motion.section {...FADE}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-glow">
              <span className="font-display text-sm font-bold text-cyan">05</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white">Hardware y Software</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Hardware */}
            <div className="glass-strong rounded-2xl p-6">
              <h3 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" /><line x1="12" y1="11" x2="12" y2="15" /><circle cx="12" cy="17" r="1" fill="#00E5FF" /></svg>
                Hardware
              </h3>
              <div className="space-y-3">
                {[
                  { icon: "🌧", name: "Pluviómetros de balancín", desc: "Miden la lluvia en mm" },
                  { icon: "📡", name: "Estaciones de presión", desc: "Miden la marea oceánica" },
                  { icon: "📏", name: "Sensores ultrasónicos", desc: "Miden altura del agua en calles" },
                  { icon: "📶", name: "Transmisor 4G/5G", desc: "Envía datos al servidor en la nube" },
                ].map((item) => (
                  <div key={item.name} className="flex items-start gap-3 glass rounded-lg p-3">
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Software */}
            <div className="glass-strong rounded-2xl p-6">
              <h3 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B000FF" strokeWidth="1.5"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                Software
              </h3>
              <div className="space-y-3">
                {[
                  { icon: "🐍", name: "Python + NumPy", desc: "Solución analítica por tramos y convolución", color: "#FFD600" },
                  { icon: "📊", name: "Scikit-learn", desc: "Corrección de errores en tiempo real", color: "#00E5FF" },
                  { icon: "⚡", name: "FastAPI", desc: "Servidor de alta disponibilidad", color: "#00FF87" },
                  { icon: "⚛", name: "React + Leaflet", desc: "Interfaz de usuario interactiva", color: "#B000FF" },
                ].map((item) => (
                  <div key={item.name} className="flex items-start gap-3 glass rounded-lg p-3">
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: item.color }}>{item.name}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 glass rounded-lg p-3">
                <p className="font-mono text-[10px] text-slate-500 mb-1">$ pip install stormprint</p>
                <p className="font-mono text-[10px] text-risk-normal">✓ Instalado correctamente</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Navigation */}
        <div className="text-center pt-8 border-t border-cyan/10">
          <Link href="/" className="glass-glow rounded-lg px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition inline-block">
            Volver al panel principal
          </Link>
        </div>
      </div>
    </main>
  );
}
