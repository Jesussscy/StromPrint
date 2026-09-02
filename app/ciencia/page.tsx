"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import InteractiveEquation from "./InteractiveEquation";
import ValidationChart from "./ValidationChart";
import AnalyticalChart from "./AnalyticalChart";
import ParametrosVariables from "./ParametrosVariables";
import ConvolucionVisual from "./ConvolucionVisual";
import AnalyticalWave3D from "./AnalyticalWave3D";
import DataFlowDiagram from "@/app/components/DataFlowDiagram";
import Navbar from "@/app/components/Navbar";
import NotificationBanner from "@/app/components/NotificationBanner";
import MobileBottomNav, {
  type MobileNavItem,
  IconPanel,
  IconChart,
  IconWeather,
  IconBell,
  IconHistory,
  IconScience,
} from "@/app/components/MobileBottomNav";

const KaTeXBlock = dynamic(() => import("./KaTeXBlock"), { ssr: false });

const FADE = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const SECCIONES = [
  { id: "modelo", num: "01", label: "Modelo Físico" },
  { id: "analitica", num: "02", label: "Solución Analítica" },
  { id: "flujo", num: "03", label: "Flujo de Datos" },
  { id: "validacion", num: "04", label: "Validación" },
  { id: "hardware", num: "05", label: "Hardware y Software" },
];

// Barra de navegación inferior móvil específica de la página /ciencia:
// secciones de la página + acceso al panel principal.
const NAV_CIENCIA: MobileNavItem[] = [
  { href: "/", label: "Panel", action: "route", icon: <IconPanel /> },
  { href: "#modelo", label: "Modelo", action: "scroll", icon: <IconScience /> },
  { href: "#analitica", label: "Analítica", action: "scroll", icon: <IconChart /> },
  { href: "#flujo", label: "Flujo", action: "scroll", icon: <IconWeather /> },
  { href: "#validacion", label: "Validación", action: "scroll", icon: <IconBell /> },
  { href: "#hardware", label: "Hardware", action: "scroll", icon: <IconHistory /> },
];

export default function CienciaPage() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });
  const [seccionActiva, setSeccionActiva] = useState<number>(0);

  useEffect(() => {
    const ids = SECCIONES.map((s) => s.id);
    const observar = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            const i = ids.indexOf(e.target.id);
            if (i >= 0) setSeccionActiva(i);
          }
        }
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observar.observe(el);
    });
    return () => observar.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-ocean">
      {/* Mismo navbar que el panel principal: marca + navegación y volver */}
      <Navbar />
      {/* Notificaciones del sistema (igual que en el home) */}
      <NotificationBanner />

      {/* Barra de progreso de scroll */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed top-[53px] left-0 right-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-cyan via-[#00FF87] to-[#B000FF]"
      />

      {/* Navegación de secciones (fija, escritorio) */}
      <nav className="fixed right-5 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-1 lg:flex">
        {SECCIONES.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" }); }}
            className="group flex items-center justify-end gap-2"
            aria-label={s.label}
          >
            <motion.span
              animate={{
                opacity: seccionActiva === i ? 1 : 0,
                x: seccionActiva === i ? 0 : 8,
              }}
              transition={{ duration: 0.3 }}
              className="rounded-md bg-ocean/90 border border-cyan/20 px-2 py-1 font-mono text-[10px] text-cyan whitespace-nowrap"
            >
              {s.num} · {s.label}
            </motion.span>
            <span
              className={`block h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                seccionActiva === i
                  ? "bg-cyan shadow-[0_0_10px_#00E5FF] scale-110"
                  : "bg-slate-700 group-hover:bg-slate-500"
              }`}
            />
          </a>
        ))}
      </nav>

      {/* Hero */}
      <div className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,210,255,0.4) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
        {/* Partículas flotantes animadas */}
        <div className="pointer-events-none absolute inset-0 opacity-40">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1 w-1 rounded-full"
              style={{
                left: `${(i * 13 + 7) % 100}%`,
                top: `${(i * 29 + 10) % 100}%`,
                backgroundColor: i % 2 ? "#00E5FF" : "#00FF87",
                boxShadow: i % 2 ? "0 0 10px #00E5FF" : "0 0 10px #00FF87",
              }}
              animate={{ y: [0, -30, 0], x: [0, 12, 0], opacity: [0.2, 0.9, 0.2] }}
              transition={{ duration: 5 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
            />
          ))}
        </div>
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

        {/* Navegación horizontal móvil */}
        <div className="lg:hidden -mx-6 px-6 sticky top-[53px] z-40 bg-ocean/80 backdrop-blur-md border-b border-white/5 -mt-6 -mb-4 py-3 overflow-x-auto whitespace-nowrap flex gap-2">
          {SECCIONES.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" }); }}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${
                seccionActiva === i ? "bg-cyan/20 text-cyan shadow-glow border border-cyan/30" : "bg-ocean text-slate-400 border border-white/5"
              }`}
            >
              {s.num} {s.label}
            </a>
          ))}
        </div>

        {/* 1. Modelo Físico */}
        <motion.section {...FADE} id="modelo" className="scroll-mt-24">
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
        <motion.section {...FADE} id="analitica" className="scroll-mt-24">
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
        <motion.section {...FADE} id="flujo" className="scroll-mt-24">
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
        <motion.section {...FADE} id="validacion" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-glow">
              <span className="font-display text-sm font-bold text-cyan">04</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white">Validación del Modelo</h2>
          </div>
          <p className="text-slate-400 leading-relaxed mb-2">
            Validamos el motor en dos frentes: internamente comparamos la <strong className="text-white">solución analítica por tramos</strong>{" "}
            contra una <strong className="text-white">referencia numérica por pasos</strong> (solve_ivp) en el mismo escenario de
            tormenta — la curva y los errores de abajo se calculan en vivo sobre esa corrida — y en campo, la
            estación DAVIS registra eventos reales para afinar el modelo.
          </p>
          <ValidationChart />
        </motion.section>

        {/* 5. Hardware y Software */}
        <motion.section {...FADE} id="hardware" className="scroll-mt-24">
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
                  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16" y1="3" x2="8" y2="21" /><line x1="8" y1="9" x2="2" y2="9" /><line x1="16" y1="15" x2="22" y2="15" /></svg>, name: "Pluviómetros de balancín", desc: "Miden la lluvia en mm" },
                  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01m2.99-3H8m-4.99 3L8 9l3 3 3-6 2 4h2.01" /></svg>, name: "Estaciones de presión", desc: "Miden la marea oceánica" },
                  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18" /><path d="M7 3v15" /><path d="M17 3v15" /><path d="M3 21h18" /><line x1="3" y1="9" x2="21" y2="9" /></svg>, name: "Sensores ultrasónicos", desc: "Miden altura del agua en calles" },
                  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 5h-8a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" /><line x1="7" y1="17" x2="3" y2="21" /><line x1="11" y1="22" x2="11" y2="17" /><line x1="11" y1="8" x2="4" y2="9" /></svg>, name: "Transmisor 4G/5G", desc: "Envía datos al servidor en la nube" },
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
                  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD600" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4c0 .5-.09.97-.26 1.4A4 4 0 0 1 16 12c0 .5-.09.97-.26 1.4A4 4 0 0 1 20 16v2a2 2 0 0 1-2 2c-1.1 0-2-.9-2-2v-1c0-.5-.09-.97-.26-1.4A4 4 0 0 0 14 13" /><path d="M12 2a4 4 0 0 0-4 4c0 .5.09.97.26 1.4A4 4 0 0 0 8 12c0 .5.09.97.26 1.4A4 4 0 0 0 4 16v2a2 2 0 0 0 2 2c1.1 0 2-.9 2-2v-1c0-.5.09-.97.26-1.4A4 4 0 0 1 10 13" /><circle cx="12" cy="3" r="1.5" /><circle cx="12" cy="13" r="1.5" /></svg>, name: "Python + NumPy", desc: "Solución analítica por tramos y convolución", color: "#FFD600" },
                  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>, name: "Scikit-learn", desc: "Corrección de errores en tiempo real", color: "#00E5FF" },
                  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF87" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>, name: "FastAPI", desc: "Servidor de alta disponibilidad", color: "#00FF87" },
                  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B000FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>, name: "React + Leaflet", desc: "Interfaz de usuario interactiva", color: "#B000FF" },
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
                <p className="font-mono text-[10px] text-risk-normal inline-flex items-center"><svg className="mr-1 inline-block" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Instalado correctamente</p>
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

      {/* Barra de navegación inferior móvil (compartida con el panel principal) */}
      <MobileBottomNav items={NAV_CIENCIA} />
    </main>
  );
}
