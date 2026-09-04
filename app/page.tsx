"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Navbar from "@/app/components/Navbar";
import TopographicMesh from "@/app/components/TopographicMesh";
import ParticleCanvas from "@/app/components/ParticleCanvas";
import CursorTracker from "@/app/components/CursorTracker";
import TimelineSlider from "@/app/components/TimelineSlider";
import WeatherBadge from "@/app/components/WeatherBadge";
import ForecastDayCard from "@/app/components/ForecastDayCard";
import ForecastChart from "@/app/components/ForecastChart";
import CommandCenter from "@/app/components/CommandCenter";
import RainParticles from "@/app/components/RainParticles";
import AlertDrawer from "@/app/components/AlertDrawer";
import AnimatedCounter from "@/app/components/AnimatedCounter";
import SummaryDashboard from "@/app/components/SummaryDashboard";
import NotificationBanner from "@/app/components/NotificationBanner";
// Cesium (WebGL) es pesado (varios MB). Se carga de forma diferida (dynamic)
// solo cuando el cliente lo monta, con ssr:false para no renderizar en el
// servidor. En móvil además se carga apenas entra en viewport (loading lazy).
import ZonasMangaPanel from "@/app/components/ZonasMangaPanel";
import WeatherStation from "@/app/components/WeatherStation";
import HistoryPanel from "@/app/components/HistoryPanel";
import ScenarioComparator from "@/app/components/ScenarioComparator";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import LazyMount from "@/app/components/LazyMount";
import MonitoringMetricsRow from "@/app/components/MonitoringMetricsRow";
import ProjectionChart from "@/app/components/ProjectionChart";
import NeighborhoodStatusBar from "@/app/components/NeighborhoodStatusBar";
import Footer from "@/app/components/Footer";
import {
  predecir,
  computeDaySummaries,
  type PrediccionResponse,
} from "@/app/lib/api";
import { ZONAS_MANGA } from "@/app/lib/zonasManga";

// Simulación 3D de inundación por zona (WebGL pesado, carga diferida).
const ZonaFlood3D = dynamic(() => import("@/app/components/ZonaFlood3D"), {
  ssr: false,
  loading: () => (
    <div className="glass-strong rounded-2xl p-6 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan/40 border-t-cyan" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan/70">
          Cargando simulación 3D…
        </span>
      </div>
    </div>
  ),
});

const FADE = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5 },
};

// Mapa 3D Cesium cargado de forma diferida (rendimiento móvil).
// ssr:false evita ejecutar WebGL/cesium en el servidor; el skeleton se muestra
// mientras se descarga el bundle del visor.
const CesiumMap = dynamic(() => import("@/app/components/CesiumMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-ocean">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan/40 border-t-cyan" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan/70">
          Cargando visor 3D…
        </span>
      </div>
    </div>
  ),
});

/* ——— HERO ——————————————————————————————————————————————————————————————— */

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "var(--ocean-deep)" }}>
      <TopographicMesh />
      <ParticleCanvas />

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-normal animate-pulse-slow" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">Sistema activo · Manga, Cartagena</span>
          </div>

          <h1
            className="title-storm glitch-title text-4xl sm:text-5xl md:text-7xl lg:text-8xl text-white mb-6"
            data-text="STORM//PRINT"
          >
            STORM<span className="neon-text">{"//"}</span>PRINT
          </h1>

          <p className="font-body text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10 px-2">
            Ingeniería de datos para la resiliencia climática en el Caribe colombiano.
          </p>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-12">
            {[
              { value: "48 h", label: "Ventana de pronóstico" },
              { value: "24/7", label: "Monitoreo" },
              { value: "7 días", label: "Pronóstico" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl px-4 sm:px-5 py-3 flex-1 min-w-[100px] max-w-[160px]">
                <p className="font-display text-lg sm:text-xl font-bold neon-text">{stat.value}</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <motion.a
            href="#panel-vivo"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="group inline-flex items-center gap-3 rounded-2xl px-8 py-4 font-mono text-sm uppercase tracking-widest text-ocean-deep font-bold transition-all min-h-[52px]"
            style={{
              background: "linear-gradient(135deg, #00E5FF 0%, #00B4D8 50%, #0077B6 100%)",
              boxShadow: "0 0 30px rgba(0, 229, 255, 0.3), 0 0 60px rgba(0, 229, 255, 0.1)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>
            Iniciar Simulación
          </motion.a>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-ocean-deep to-transparent" />
    </section>
  );
}

/* ——— EL PROBLEMA ————————————————————————————————————————————————————————— */

function ProblemSection() {
  return (
    <section className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div {...FADE} className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">El problema</p>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white mb-4">
            Cartagena se inunda.<br />La comunidad necesita respuestas.
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            El Barrio Manga, una península costera que apenas alcanza 1.2 metros sobre el nivel del mar (m s. n. m.),
            sufre inundaciones recurrentes a lo largo de todo el año por la combinación de lluvias intensas,
            mareas altas y un drenaje insuficiente.
          </p>
        </motion.div>

        {/* Impact counters */}
        <motion.div {...FADE} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { end: 340, suffix: "+", label: "Familias afectadas" },
            { end: 187, suffix: " mm", label: "Lluvia récord 2023" },
            { end: 12, suffix: " h", label: "Tiempo de respuesta" },
            { end: 0, suffix: " cm", label: "Sistema de alerta previo" },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl p-4 text-center">
              <p className="text-2xl md:text-3xl"><AnimatedCounter end={stat.end} suffix={stat.suffix} /></p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { num: "01", title: "Cambio Climático", desc: "Lluvias torrenciales en el Caribe colombiano han aumentado un 30% en la última década.", color: "#FF0055" },
            { num: "02", title: "Infraestructura Limitada", desc: "Alcantarillas sin dimensionar, calles angostas y canales obstruidos.", color: "#FFD600" },
            { num: "03", title: "Sin Datos en Tiempo Real", desc: "No existe un sistema que combine clima, mareas y topografía para alertar antes.", color: "#00F3FF" },
          ].map((item) => (
            <motion.div key={item.num} {...FADE} className="glass glow-card rounded-2xl p-6 group">
              <span className="font-display text-5xl font-black" style={{ color: item.color, opacity: 0.15 }}>{item.num}</span>
              <h3 className="font-display text-lg font-bold text-white mt-3">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ——— CÓMO FUNCIONA —————————————————————————————————————————————————————— */

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div {...FADE} className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">La solución</p>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white">Cómo funciona StormPrint</h2>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {[
            { step: "01", title: "Captura", desc: "Estaciones DAVIS y pluviómetros miden lluvia, viento y temperatura cada minuto. Mareas reales de Cartagena vía Open-Meteo Marine.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg> },
            { step: "02", title: "Modelo", desc: "Solución analítica por tramos con la integral de convolución de Duhamel. Validada en cada corrida contra la solución numérica (solve_ivp) y contrastada con la estación DAVIS.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /><circle cx="12" cy="12" r="4" /></svg> },
            { step: "03", title: "Acción", desc: "Dashboard en tiempo real con niveles de riesgo, recomendaciones y rutas de evacuación.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF0055" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
          ].map((item) => (
            <motion.div key={item.step} {...FADE} className="glass glow-card rounded-2xl p-6 text-center hud-connector float-card group">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl glass-glow">
                {item.icon}
              </div>
              <p className="font-mono text-[10px] text-cyan mb-2">Paso {item.step}</p>
              <h3 className="font-display text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ——— ORIGEN DE DATOS ————————————————————————————————————————————————————— */

function DataSourceSection() {
  return (
    <section id="datos" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div {...FADE} className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Arquitectura de datos</p>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white mb-4">¿De dónde salen los datos?</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">Fuentes locales, satelitales y de modelos globales alimentan el sistema predictivo.</p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Estaciones Meteorológicas", desc: "Sensores DAVIS y pluviómetros de balancín en puntos estratégicos de Manga.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /><circle cx="12" cy="12" r="4" /></svg> },
            { title: "Satélites y Modelos Globales", desc: "API de Open-Meteo para clima y mareas marinas reales, con predicciones a 7 días.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg> },
            { title: "Topografía y Batimetría", desc: "Modelos de Elevación Digital del terreno de Cartagena.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><path d="M3 20l5-10 4 6 4-4 5 8" /><line x1="3" y1="20" x2="21" y2="20" /></svg> },
            { title: "Conexión IoT", desc: "Datos por 4G/5G al servidor en la nube. Latencia < 30 segundos.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" fill="#00F3FF" /></svg> },
          ].map((item) => (
            <motion.div key={item.title} {...FADE} className="glass glow-card rounded-2xl p-5 group float-card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl glass-glow">
                {item.icon}
              </div>
              <h3 className="font-display text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ——— PANEL EN VIVO (HUD) ———————————————————————————————————————————————— */

const PLAYBACK_SPEED_MS = 200;

// URL compartible: ?hora=NN adelanta la simulación y ?zona=ID enfoca la zona.
function leerParamURL(nombre: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(nombre);
}

function DashboardEmbedded({ stormMode, onToggleStorm }: { stormMode: boolean; onToggleStorm: () => void }) {
  const [prediccion, setPrediccion] = useState<PrediccionResponse | null>(null);
  const [currentHour, setCurrentHour] = useState(() => {
    const h = parseFloat(leerParamURL("hora") ?? "");
    return Number.isFinite(h) && h >= 0 ? h : 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lluvia, setLluvia] = useState(0.6);
  const [marea, setMarea] = useState(8);
  const [drenaje, setDrenaje] = useState(70);
  const [usarMeteo, setUsarMeteo] = useState(true);
  const [zonaEnfocada, setZonaEnfocada] = useState<number | null>(() => {
    const z = leerParamURL("zona");
    return z ? Number(z) : null;
  });
  const [controlesAbiertos, setControlesAbiertos] = useState(false);
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlHoraRef = useRef(false);

  const onSelectZona = useCallback((z: { id: number } | null) => {
    setZonaEnfocada(z ? z.id : null);
  }, []);

  // Zona completa seleccionada (para la simulación 3D de inundación).
  const zonaSeleccionada = useMemo(
    () => (zonaEnfocada != null ? ZONAS_MANGA.find((z) => z.id === zonaEnfocada) ?? null : null),
    [zonaEnfocada]
  );

  const onTogglePlay = useCallback(() => setIsPlaying((p) => !p), []);

  const handleScrub = useCallback((h: number) => {
    setCurrentHour(h);
    if (typeof window !== "undefined") history.replaceState(null, "", `?hora=${h}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHora = (e: Event) => {
      const hora = Number((e as CustomEvent).detail?.hora);
      if (Number.isFinite(hora)) {
        setCurrentHour(hora);
        setIsPlaying(false);
        if (typeof window !== "undefined") history.replaceState(null, "", `?hora=${hora}`);
        document.getElementById("panel-vivo")?.scrollIntoView({ behavior: "smooth" });
      }
    };
    window.addEventListener("stormprint:hora", onHora);
    return () => window.removeEventListener("stormprint:hora", onHora);
  }, []);

  useEffect(() => {
    if (prediccion && !urlHoraRef.current) {
      urlHoraRef.current = true;
      const h = parseFloat(leerParamURL("hora") ?? "");
      if (Number.isFinite(h) && h >= 0) {
        setCurrentHour(h);
        setIsPlaying(false);
      }
    }
  }, [prediccion]);

  const loadPrediction = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await predecir({
        horas_pronostico: 168,
        intensidad_lluvia_mm_h: usarMeteo ? undefined : lluvia,
        nivel_marea_cm: marea,
        eficiencia_drenaje: drenaje,
        usar_datos_meteo: usarMeteo,
      });
      setPrediccion(result);
      setCurrentHour(0);
      setIsPlaying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar predicción.");
    } finally {
      setIsLoading(false);
    }
  }, [lluvia, marea, drenaje, usarMeteo]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPrediction(); }, []);

  useEffect(() => {
    if (isPlaying && prediccion && prediccion.puntos.length > 0) {
      playbackRef.current = setInterval(() => {
        setCurrentHour((prev) => {
          const max = prediccion.puntos[prediccion.puntos.length - 1].tiempo_hora;
          if (prev >= max) { setIsPlaying(false); return max; }
          return prev + 1;
        });
      }, PLAYBACK_SPEED_MS);
    }
    return () => { if (playbackRef.current) clearInterval(playbackRef.current); };
  }, [isPlaying, prediccion]);

  const activePunto = useMemo(() => {
    if (!prediccion || prediccion.puntos.length === 0) return null;
    return prediccion.puntos.reduce((c, p) =>
      Math.abs(p.tiempo_hora - currentHour) < Math.abs(c.tiempo_hora - currentHour) ? p : c
    );
  }, [prediccion, currentHour]);

  const daySummaries = useMemo(() => prediccion ? computeDaySummaries(prediccion.puntos) : [], [prediccion]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">

      {/* ═══ FILA 1: HEADER + MÉTRICAS PRINCIPALES ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-risk-normal animate-pulse-slow" />
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400">
              MONITOREO · BARRIO MANGA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <WeatherBadge
              meteorologia={prediccion?.meteorologia_resumen ?? null}
              isLoading={isLoading}
              estado={prediccion?.estado_meteorologico ?? (usarMeteo ? "sin_datos" : "soleado")}
              confianza={prediccion?.confianza_meteo}
            />
            <button
              onClick={() => setControlesAbiertos(!controlesAbiertos)}
              className="glass rounded-lg px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-cyan active:scale-95 transition-all duration-150 flex items-center gap-1.5 select-none touch-manipulation"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              Controles
            </button>
          </div>
        </div>
        <MonitoringMetricsRow punto={activePunto} prediccion={prediccion} isLoading={isLoading} />
      </div>

      {/* ═══ CONTROLES (colapsables) ═══ */}
      {controlesAbiertos && (
        <div className="glass-strong rounded-2xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            <Slider label="Lluvia" value={lluvia} onChange={setLluvia} min={0} max={50} step={0.1} unit="mm/h" color="#00F3FF" disabled={usarMeteo} />
            <Slider label="Marea" value={marea} onChange={setMarea} min={0} max={100} step={0.5} unit="cm" color="#B000FF" disabled={usarMeteo} />
            <Slider label="Drenaje" value={drenaje} onChange={setDrenaje} min={0} max={100} step={1} unit="%" color="#00E5FF" disabled={usarMeteo} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px] select-none">
              <input type="checkbox" checked={usarMeteo} onChange={(e) => setUsarMeteo(e.target.checked)} className="accent-cyan h-4 w-4" />
              <span className="text-xs text-slate-500">Usar datos meteorológicos reales</span>
            </label>
            {usarMeteo ? (
              <span className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                Simulación bloqueada · meteo en vivo
              </span>
            ) : (
              <button onClick={loadPrediction} disabled={isLoading} className="glass-glow rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 active:scale-95 active:bg-cyan/15 transition-all duration-150 min-h-[44px]">
                {isLoading ? "Calculando..." : "Simular"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ FILA 2: MAPA 3D (ANCHO COMPLETO) ═══ */}
      <div className="glass-strong rounded-2xl h-[420px] p-1 md:h-[560px] lg:h-[600px] overflow-hidden relative hud-scanlines">
        <LazyMount
          placeholder={
            <div className="absolute inset-0 flex items-center justify-center bg-ocean">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan/40 border-t-cyan" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan/70">
                  Visor 3D listo al hacer scroll…
                </span>
              </div>
            </div>
          }
        >
          <CesiumMap
            nivelAguaCm={activePunto?.nivel_agua_cm ?? 0}
            nivelMaximoCm={prediccion?.nivel_maximo_cm ?? 100}
            focusZonaId={zonaEnfocada}
            onSelectZona={onSelectZona}
            horaLocal={Math.floor(currentHour) % 24}
            stormMode={stormMode}
            puntoMeteo={activePunto}
            meteorologia={prediccion?.meteorologia_resumen ?? null}
          />
        </LazyMount>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleStorm}
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] rounded-xl px-6 py-3 font-mono text-[11px] uppercase tracking-wider transition-all duration-300 ${
            stormMode
              ? "glass-glow text-risk-emergency border-risk-emergency/30"
              : "glass-glow text-cyan"
          }`}
        >
          {stormMode ? (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="2" /></svg>
              Detener tormenta
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
              Simular tormenta
            </span>
          )}
        </motion.button>
      </div>

      {/* ═══ FILA 3: ZONAS DE RIESGO ═══ */}
      <ZonasMangaPanel
        nivelAguaCm={activePunto?.nivel_agua_cm ?? 0}
        nivelMaximoCm={prediccion?.nivel_maximo_cm ?? 100}
        selectedId={zonaEnfocada}
        onSelect={onSelectZona}
      />

      {/* ═══ FILA 3.5: SIMULACIÓN 3D DE INUNDACIÓN POR ZONA ═══ */}
      {zonaSeleccionada && (
        <ZonaFlood3D
          zona={zonaSeleccionada}
          nivelAguaCm={activePunto?.nivel_agua_cm ?? 0}
          nivelMaximoCm={prediccion?.nivel_maximo_cm ?? 100}
          horaLocal={Math.floor(currentHour) % 24}
          onClose={() => onSelectZona(null)}
        />
      )}

      {/* ═══ FILA 4: GRÁFICO DE PROYECCIÓN ═══ */}
      <ProjectionChart puntos={prediccion?.puntos ?? []} currentHour={currentHour} />

      {/* ═══ FILA 5: ESTADO DEL BARRIO ═══ */}
      <NeighborhoodStatusBar prediccion={prediccion} punto={activePunto} />

      {/* ═══ NARRATIVA DEL MODELO ═══ */}
      {prediccion && (
        <div className="glass rounded-2xl p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">
            Análisis del Modelo
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">{prediccion.narrativa}</p>
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">Recomendación</p>
            <p className="text-sm font-medium" style={{ color: "#00E5FF" }}>{prediccion.recomendacion}</p>
          </div>
        </div>
      )}

      {/* ═══ TIMELINE ═══ */}
      <TimelineSlider puntos={prediccion?.puntos ?? []} currentHour={currentHour} onScrub={handleScrub} isPlaying={isPlaying} onTogglePlay={onTogglePlay} />

      {/* ═══ PRONÓSTICO POR DÍA ═══ */}
      {daySummaries.length > 0 && (
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Pronóstico por día
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {daySummaries.map((s, i) => (
              <ForecastDayCard key={s.dayIndex} summary={s} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ═══ RESUMEN 7 DÍAS ═══ */}
      {prediccion && prediccion.puntos.length > 0 && (
        <SummaryDashboard puntos={prediccion.puntos} daySummaries={daySummaries} />
      )}

      {/* ═══ ERRORES ═══ */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <span>{error}</span>
          <button
            onClick={loadPrediction}
            className="glass-glow shrink-0 rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/10 active:scale-95 transition-all duration-150 min-h-[44px] min-w-[44px]"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, unit, color, disabled }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string; color: string; disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={disabled ? "opacity-40 pointer-events-none select-none" : ""}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-mono text-xs font-tabular" style={{ color }}>{value.toFixed(step < 1 ? 1 : 0)} {unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-6 slider-cyber"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
          boxShadow: disabled ? "none" : `0 0 12px ${color}33`,
        }}
      />
    </div>
  );
}

/* ——— PRONÓSTICO 48H ————————————————————————————————————————————————————— */

function ForecastSection({ puntos, onSeleccionarPunto }: { puntos: import("@/app/lib/api").PuntoPrediccion[]; onSeleccionarPunto?: (p: import("@/app/lib/api").PuntoPrediccion) => void }) {
  return (
    <section id="pronostico" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div {...FADE} className="text-center mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Pronóstico</p>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white mb-4">Evolución del nivel en 7 días</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Curva de pronóstico horario con líneas de umbral de riesgo.
          </p>
        </motion.div>
        {puntos.length > 0 ? (
          <ForecastChart puntos={puntos} onSeleccionarPunto={onSeleccionarPunto} />
        ) : (
          <motion.div {...FADE} className="glass rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">Desplazá el panel de monitoreo para ver la curva de pronóstico.</p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ——— NARRATIVA (Timeline) ——————————————————————————————————————————————— */

function NarrativeSection() {
  const events = [
    { year: "2023", title: "El pasado", desc: "Inundaciones recurrentes sin sistema de alerta. Daños materiales y desplazamiento forzado.", color: "#FF0055" },
    { year: "2025", title: "El presente", desc: "Sensores DAVIS instalados. Datos meteorológicos en tiempo real. Primera versión del modelo.", color: "#FFD600" },
    { year: "2026", title: "El futuro", desc: "Alertas automáticas tempranas, validación continua del modelo contra la solución numérica y datos reales de la estación DAVIS. Resiliencia climática para Manga.", color: "#00E5FF" },
  ];

  return (
    <section className="relative py-24 px-6">
      <div className="mx-auto max-w-3xl">
        <motion.div {...FADE} className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">La narrativa</p>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white">Por qué importa</h2>
        </motion.div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-risk-emergency via-risk-alert to-cyan opacity-30" />

          <div className="space-y-12">
            {events.map((ev, i) => (
              <motion.div key={ev.year} {...FADE} className="relative pl-16">
                <div className="absolute left-4 top-1 h-4 w-4 rounded-full border-2" style={{ borderColor: ev.color, backgroundColor: `${ev.color}20` }}>
                  <div className="absolute inset-1 rounded-full" style={{ backgroundColor: ev.color }} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: ev.color }}>{ev.year}</p>
                <h3 className="font-display text-xl font-bold text-white mb-1">{ev.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{ev.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ——— TECNOLOGÍA —————————————————————————————————————————————————————————— */

function TechnologySection() {
  return (
    <section id="tecnologia" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div {...FADE} className="text-center mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Tecnología</p>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white mb-4">Ingeniería que salva vidas</h2>
        </motion.div>

        {/* Pipeline */}
        <motion.div {...FADE} className="glass-strong rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
            {[
              { label: "Estaciones + API", sub: "Sensores y Open-Meteo" },
              { label: "Modelo Analítico", sub: "Duhamel · convolución" },
              { label: "Dashboard", sub: "React + Cesium / Leaflet" },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-4">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl glass-glow">
                    <span className="font-display text-sm font-bold text-cyan">{i + 1}</span>
                  </div>
                  <p className="text-xs font-semibold text-white">{step.label}</p>
                  <p className="text-[10px] text-slate-500">{step.sub}</p>
                </div>
                {i < 2 && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5" className="shrink-0 mt-[-16px] opacity-40">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Modelo Analítico (Duhamel)", desc: "Resolución por integral de convolución por tramos. Responde a cada impulso de lluvia y marea sin integración numérica escalón a escalón." },
            { title: "Datos en Tiempo Real", desc: "API de Open-Meteo para pronósticos horarios de lluvia, viento y temperatura, más mareas marinas reales de Cartagena." },
            { title: "Modelo Territorial", desc: "La topografía de Manga, casi a nivel del mar (1.2 m s. n. m.), modula la capacidad de absorción y acumulación del agua." },
          ].map((item) => (
            <motion.div key={item.title} {...FADE} className="glass rounded-xl p-5">
              <h4 className="font-display text-sm font-semibold text-white mb-1">{item.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div {...FADE} className="mt-8 text-center">
          <a href="/ciencia" className="glass-glow rounded-lg px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 active:scale-95 transition-all duration-150 inline-block select-none">
            Conocer el modelo matemático
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* ——— CTA + FOOTER ———————————————————————————————————————————————————————— */

function CTASection() {
  return (
    <section id="contacto" className="relative py-24 px-6">
      <div className="mx-auto max-w-3xl text-center">
        <motion.div {...FADE}>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white mb-4">
            ¿Interesado en proteger tu ciudad?
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8">
            Entidades públicas, universidades y organizaciones comunitarias:
            contactanos para una demo del sistema completo.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="mailto:contacto@stormprint.app" className="glass-glow rounded-lg px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 active:scale-95 transition-all duration-150 inline-flex items-center gap-2 select-none">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              Solicitar demo
            </a>
            <a href="/ciencia" className="glass rounded-lg px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-cyan active:scale-95 active:text-cyan transition-all duration-150 select-none">
              Ciencia
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ——— PÁGINA PRINCIPAL ———————————————————————————————————————————————————— */

export default function LandingPage() {
  const [prediccion, setPrediccion] = useState<PrediccionResponse | null>(null);
  const [cargandoPrediccion, setCargandoPrediccion] = useState(true);
  const [errorPrediccion, setErrorPrediccion] = useState<string | null>(null);
  const [stormMode, setStormMode] = useState(false);

  const cargarPrediccion = useCallback(() => {
    setCargandoPrediccion(true);
    setErrorPrediccion(null);
    predecir({ horas_pronostico: 168, usar_datos_meteo: true })
      .then((r) => setPrediccion(r))
      .catch((e) => setErrorPrediccion(e instanceof Error ? e.message : "Error al cargar la predicción."))
      .finally(() => setCargandoPrediccion(false));
  }, []);

  useEffect(() => {
    cargarPrediccion();
  }, [cargarPrediccion]);

  // Clic en el gráfico de la sección Pronóstico: reproduce esa hora en el
  // visor 3D (evento global que escucha DashboardEmbedded).
  const onSeleccionarPunto = useCallback(
    (p: import("@/app/lib/api").PuntoPrediccion) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("stormprint:hora", { detail: { hora: p.tiempo_hora } }));
      }
    },
    []
  );

  return (
    <>
      <Navbar />
      <CursorTracker />
      <NotificationBanner />
      <RainParticles active={stormMode} intensity={stormMode ? 0.8 : 0} />
      <AlertDrawer
        nivelAguaCm={prediccion?.nivel_actual_cm}
        nivelMaximo={prediccion?.nivel_maximo_cm}
        tendenciaCmH={prediccion?.puntos?.at(-1)?.velocidad_cambio}
        onVerEnMapa={() => {
          document.getElementById("panel-vivo")?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      {errorPrediccion && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:bottom-8" role="alert">
          <div className="glass-glow rounded-xl border border-red-500/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 shrink-0 text-red-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-red-300">No se pudo cargar la predicción</p>
                <p className="mt-0.5 text-xs text-slate-400">{errorPrediccion}</p>
                <button
                  onClick={cargarPrediccion}
                  disabled={cargandoPrediccion}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-cyan/30 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 active:scale-95 transition-all duration-150 min-h-[36px] disabled:opacity-40"
                >
                  {cargandoPrediccion ? "Cargando…" : "Reintentar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main id="contenido">
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <DataSourceSection />

      {/* Panel en Vivo */}
      <section id="panel-vivo" className="relative py-24 px-6">
        <div className="mx-auto max-w-7xl mb-8">
          <motion.div {...FADE} className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Datos en vivo</p>
            <h2 className="font-display text-2xl md:text-4xl font-bold text-white">
              Panel de Monitoreo
            </h2>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
              Explorá la simulación en tiempo real. Ajustá los parámetros y observá cómo responde el modelo.
            </p>
          </motion.div>
        </div>
        <DashboardEmbedded stormMode={stormMode} onToggleStorm={() => setStormMode((s) => !s)} />
      </section>

      <ForecastSection puntos={prediccion?.puntos ?? []} onSeleccionarPunto={onSeleccionarPunto} />
      <NarrativeSection />

      {/* Estación Meteorológica */}
      <section id="meteo" className="relative py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div {...FADE} className="text-center mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Datos meteorológicos</p>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white">Estación Meteorológica — Manga</h2>
          </motion.div>
          <WeatherStation />
        </div>
      </section>

      {/* Comparador de escenarios */}
      <section id="comparador" className="relative py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div {...FADE} className="text-center mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Planificación</p>
            <h2 className="font-display text-2xl md:text-4xl font-bold text-white">Comparador de Escenarios</h2>
          </motion.div>
          <ScenarioComparator />
        </div>
      </section>

      {/* Historial */}
      <section id="historial" className="relative py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div {...FADE} className="text-center mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan mb-4">Datos históricos</p>
            <h2 className="font-display text-2xl md:text-4xl font-bold text-white">Historial y Predicciones</h2>
          </motion.div>
          <HistoryPanel />
        </div>
      </section>

      <TechnologySection />
      <CTASection />
      <Footer />
      </main>
      <CommandCenter />
      <MobileBottomNav />
    </>
  );
}
