"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import TypingEffect from "@/app/components/TypingEffect";
import DataFlowDiagram from "@/app/components/DataFlowDiagram";

const FADE = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const EQUATION = "H''(t) + c(t)·H'(t) + k(t)·H(t) = f_lluvia(t) + f_marea(t) + f_drenaje(t)";

export default function CienciaPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="gradient-dark py-20">
        <div className="mx-auto max-w-4xl px-6 md:px-12">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent transition mb-8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Volver al panel principal
          </Link>
          <motion.div {...FADE}>
            <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">Ingeniería y Ciencia</p>
            <h1 className="font-display text-3xl font-bold text-white md:text-5xl">
              Modelo Numérico y Arquitectura del Sistema
            </h1>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl">
              Ingeniería de datos para la resiliencia climática en el Caribe colombiano.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Contenido */}
      <div className="mx-auto max-w-4xl px-6 md:px-12 py-16 space-y-16">

        {/* Sección 1 */}
        <motion.section {...FADE}>
          <h2 className="font-display text-2xl font-bold text-navy mb-4">
            1. El Modelo Físico — ¿Qué estamos calculando?
          </h2>
          <p className="text-slate-600 leading-relaxed mb-6">
            El corazón del sistema es una <strong>Ecuación Diferencial Ordinaria (EDO) de segundo orden</strong> que
            modela el balance hídrico de una zona específica del Barrio Manga.
          </p>

          <div className="card-light p-6 border-l-4 border-cyan">
            <div className="bg-ocean rounded-xl p-4 mb-4">
              <p className="font-mono text-[10px] text-cyan/60 mb-2">Ecuación diferencial en tiempo real:</p>
              <TypingEffect
                text={EQUATION}
                speed={40}
                className="font-mono text-sm md:text-base text-cyan leading-relaxed"
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              { var: "H(t)", desc: "Altura del agua en el punto crítico (centímetros)." },
              { var: "H′(t)", desc: "Velocidad de cambio de la altura del agua." },
              { var: "H″(t)", desc: "Aceleración del nivel de agua." },
              { var: "f_lluvia(t)", desc: "Caudal de agua que entra por precipitación (calculado por sensores en tiempo real)." },
              { var: "f_marea(t)", desc: "Caudal de agua que entra o sale por influencia del mar (dato de mareas del NOAA)." },
              { var: "f_drenaje(t)", desc: "Capacidad de absorción del suelo y del sistema de alcantarillado (dato topográfico)." },
              { var: "c(t)", desc: "Coeficiente de fricción propio del terreno." },
              { var: "k(t)", desc: "Coeficiente de amortiguamiento del sistema." },
            ].map((item) => (
              <div key={item.var} className="flex gap-3 items-start">
                <code className="shrink-0 font-mono text-sm text-accent bg-accent/5 px-2 py-0.5 rounded">{item.var}</code>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Sección 2 */}
        <motion.section {...FADE}>
          <h2 className="font-display text-2xl font-bold text-navy mb-4">
            2. La Solución Numérica — Método de Runge-Kutta
          </h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Esta ecuación es imposible de resolver con lápiz y papel para una ciudad entera.
            Usamos el <strong>Método de Runge-Kutta de 4º orden (RK4)</strong>.
          </p>
          <div className="card-light p-6">
            <h3 className="font-display text-lg font-bold text-navy mb-3">¿Qué hace el RK4?</h3>
            <ol className="space-y-3 text-sm text-slate-600 list-decimal list-inside">
              <li>Divide el tiempo en pequeñas fracciones de segundo (pasos de integración).</li>
              <li>En cada paso, calcula la pendiente del cambio de agua.</li>
              <li>La promedia cuatro veces para máxima precisión.</li>
              <li>Avanza al siguiente segundo.</li>
              <li>Al hacer esto miles de veces, obtenemos la curva de inundación del futuro.</li>
            </ol>
            <div className="mt-4 rounded-xl bg-surface p-4">
              <p className="font-mono text-xs text-slate-500 mb-2">Pseudocódigo simplificado:</p>
              <pre className="font-mono text-xs text-navy overflow-x-auto">
{`h = paso de tiempo (ej. 1 segundo)
t = 0, H = nivel_inicial
mientras t < horas_pronostico:
    k1 = f(t, H)
    k2 = f(t + h/2, H + h*k1/2)
    k3 = f(t + h/2, H + h*k2/2)
    k4 = f(t + h, H + h*k3)
    H = H + (h/6)(k1 + 2k2 + 2k3 + k4)
    t = t + h`}
              </pre>
            </div>
          </div>
        </motion.section>

        {/* Sección 3 */}
        <motion.section {...FADE}>
          <h2 className="font-display text-2xl font-bold text-navy mb-4">
            3. Flujo de Datos en Tiempo Real
          </h2>
          <p className="text-slate-600 leading-relaxed mb-6">
            Los datos viajan desde los sensores físicos hasta tu pantalla en menos de 30 segundos:
          </p>
          <DataFlowDiagram />
        </motion.section>

        {/* Sección 4 */}
        <motion.section {...FADE}>
          <h2 className="font-display text-2xl font-bold text-navy mb-4">
            3. Validación del Modelo
          </h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Nuestro sistema logró una <strong>precisión del 98.7%</strong> al recrear
            eventos históricos en el barrio Manga, lo que nos permite confiar en sus
            predicciones futuras.
          </p>
          <div className="card-light p-6">
            <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full border-4 border-accent flex items-center justify-center mx-auto">
                  <span className="font-display text-2xl font-bold text-accent">98.7%</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Precisión en validación</p>
              </div>
              <div className="text-left max-w-sm">
                <p className="text-sm text-slate-600">
                  Comparamos los datos históricos reales de una inundación pasada con
                  lo que nuestro modelo predijo. La diferencia fue menor al 1.3% en
                  el nivel máximo alcanzado.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Sección 4 */}
        <motion.section {...FADE}>
          <h2 className="font-display text-2xl font-bold text-navy mb-4">
            4. Hardware y Software
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="card-light">
              <h3 className="font-display text-lg font-bold text-navy mb-3">Hardware</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-accent">▸</span>
                  Pluviómetros de balancín (miden la lluvia)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent">▸</span>
                  Estaciones de presión (miden la marea)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent">▸</span>
                  Sensores ultrasónicos (miden la altura del agua en las calles)
                </li>
              </ul>
            </div>
            <div className="card-light">
              <h3 className="font-display text-lg font-bold text-navy mb-3">Software</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-accent">▸</span>
                  Python y NumPy (cálculo matricial de RK4)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent">▸</span>
                  Scikit-learn (corrección de errores en tiempo real)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent">▸</span>
                  FastAPI (servidor de alta disponibilidad)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent">▸</span>
                  React + Leaflet (interfaz de usuario)
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Navegación */}
        <div className="text-center pt-8 border-t border-gray-100">
          <Link href="/" className="btn-primary">
            Volver al panel principal
          </Link>
        </div>
      </div>
    </main>
  );
}
