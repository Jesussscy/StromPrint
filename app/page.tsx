"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/app/components/Navbar";
import LeafletMap from "@/app/components/LeafletMap";
import TimelineSlider from "@/app/components/TimelineSlider";
import MetricsPanel from "@/app/components/MetricsPanel";
import WeatherBadge from "@/app/components/WeatherBadge";
import ForecastDayCard from "@/app/components/ForecastDayCard";
import ForecastChart from "@/app/components/ForecastChart";
import {
  predecir,
  computeDaySummaries,
  type PrediccionResponse,
} from "@/app/lib/api";

const FADE_UP = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6 },
};

/* ─── Hero ────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-16">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,180,216,0.3) 1px, transparent 0)",
        backgroundSize: "40px 40px",
      }} />
      <div className="relative mx-auto max-w-7xl px-6 py-20 md:px-12 lg:px-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] items-center">
          <motion.div {...FADE_UP}>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/20 px-4 py-1.5 mb-6">
              <span className="h-2 w-2 rounded-full bg-risk-normal animate-pulse-slow" />
              <span className="font-mono text-xs text-accent uppercase tracking-wider">Sistema activo en Manga, Cartagena</span>
            </div>
            <h1 className="font-display text-4xl font-bold text-white leading-tight md:text-5xl lg:text-6xl">
              Monitoreo Inteligente de{" "}
              <span className="text-accent">Inundaciones</span>{" "}
              para el Barrio Manga
            </h1>
            <p className="mt-5 text-lg text-slate-300 max-w-xl leading-relaxed">
              Simulación predictiva en tiempo real que integra datos climáticos,
              mareas y drenaje territorial para proteger a la comunidad de
              Cartagena de Indias.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#panel-vivo" className="btn-primary">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><polygon points="4,2 14,8 4,14" /></svg>
                Explorar panel en vivo
              </a>
              <a href="#como-funciona" className="btn-outline !border-white/20 !text-white hover:!border-accent hover:!text-accent">
                Cómo funciona
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-8">
              {[
                { value: "98%", label: "Precisión del modelo" },
                { value: "24/7", label: "Monitoreo continuo" },
                { value: "48h", label: "Horas de pronóstico" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-2xl font-bold text-accent">{stat.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...FADE_UP} transition={{ duration: 0.6, delay: 0.2 }} className="hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-4 bg-accent/5 rounded-3xl blur-2xl" />
              <div className="card-dark relative rounded-3xl p-6 border border-navy-light">
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-risk-normal" />
                  <span className="font-mono text-xs text-risk-normal uppercase">Estado: Normal</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: "💧", label: "Nivel actual", value: "12.3 cm", color: "#2A9D8F" },
                    { icon: "🌧", label: "Lluvia", value: "4.2 mm/h", color: "#00B4D8" },
                    { icon: "🌊", label: "Marea", value: "8.1 cm", color: "#1D3557" },
                    { icon: "💨", label: "Viento", value: "15 km/h", color: "#6366F1" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-navy-light/60 p-3">
                      <p className="text-xs text-slate-400 mb-1">{item.icon} {item.label}</p>
                      <p className="font-display text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-20 rounded-xl bg-navy-light/40 flex items-center justify-center">
                  <svg width="100%" height="60" viewBox="0 0 300 60">
                    <path d="M0 40 Q50 20 100 35 Q150 50 200 30 Q250 10 300 25" fill="none" stroke="#00B4D8" strokeWidth="2" />
                    <path d="M0 45 Q50 30 100 42 Q150 52 200 38 Q250 25 300 32" fill="none" stroke="#2A9D8F" strokeWidth="1.5" strokeDasharray="4 3" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─── El Problema ──────────────────────────────────────────────────────── */

function ProblemSection() {
  return (
    <section className="section-padding bg-white">
      <div className="mx-auto max-w-7xl">
        <motion.div {...FADE_UP} className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">El problema</p>
          <h2 className="section-title">Cartagena se inunda.<br />La comunidad necesita respuestas.</h2>
          <p className="section-subtitle mx-auto">
            El Barrio Manga, ubicado en una península costera a solo 1.2 msnm,
            sufre inundaciones recurrentes durante la temporada de lluvias
            (Ago-Nov). El drenaje actual es insuficiente.
          </p>
        </motion.div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              num: "01",
              title: "Cambio Climático",
              desc: "Las lluvias torrenciales en el Caribe colombiano han aumentado un 30% en la última década. Eventos extremos son más frecuentes.",
              color: "#E63946",
            },
            {
              num: "02",
              title: "Infraestructura Limitada",
              desc: "Las alcantarillas del Barrio Manga no están dimensionadas para el volumen actual de agua. Calles angostas y canales obstruidos.",
              color: "#E9C46A",
            },
            {
              num: "03",
              title: "Sin Datos en Tiempo Real",
              desc: "No existe un sistema que combine datos meteorológicos, mareas y topografía para alertar a la comunidad antes de que el agua llegue.",
              color: "#1D3557",
            },
          ].map((item) => (
            <motion.div key={item.num} {...FADE_UP} className="card-light group hover:shadow-lg transition-shadow">
              <span className="font-display text-4xl font-bold" style={{ color: item.color, opacity: 0.2 }}>{item.num}</span>
              <h3 className="font-display text-xl font-bold text-navy mt-3">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Cómo Funciona ────────────────────────────────────────────────────── */

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="section-padding bg-surface">
      <div className="mx-auto max-w-7xl">
        <motion.div {...FADE_UP} className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">La solución</p>
          <h2 className="section-title">Cómo funciona StormPrint</h2>
          <p className="section-subtitle mx-auto">
            Tres pasos para convertir datos climáticos en decisiones
            que protegen vidas.
          </p>
        </motion.div>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Captura de datos",
              desc: "Estaciones meteorológicas DAVIS y pluviómetros miden lluvia, viento y temperatura cada minuto en puntos estratégicos de Manga. Las mareas se obtienen del NOAA.",
              icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00B4D8" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              ),
            },
            {
              step: "2",
              title: "Modelo predictivo",
              desc: "Un sistema de ecuaciones diferenciales de segundo orden calcula la acumulación de agua H(t) usando el método de Runge-Kutta de 4to orden.",
              icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1D3557" strokeWidth="1.5">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              ),
            },
            {
              step: "3",
              title: "Acción inmediata",
              desc: "El dashboard muestra el nivel de riesgo en tiempo real con recomendaciones claras para la comunidad y las autoridades.",
              icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ),
            },
          ].map((item) => (
            <motion.div key={item.step} {...FADE_UP} className="card-light text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface">
                {item.icon}
              </div>
              <div className="font-mono text-xs text-accent mb-2">Paso {item.step}</div>
              <h3 className="font-display text-xl font-bold text-navy">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Origen de los Datos ──────────────────────────────────────────────── */

function DataSourceSection() {
  return (
    <section id="datos" className="section-padding bg-white">
      <div className="mx-auto max-w-7xl">
        <motion.div {...FADE_UP} className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">Arquitectura de datos</p>
          <h2 className="section-title">¿De dónde salen los datos?</h2>
          <p className="section-subtitle mx-auto">
            Combinamos fuentes de datos locales, satelitales y de modelos
            globales para alimentar nuestro sistema predictivo.
          </p>
        </motion.div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Estaciones Meteorológicas",
              desc: "Sensores DAVIS y pluviómetros de balancín instalados en puntos estratégicos de Manga que miden lluvia, viento y temperatura cada minuto.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00B4D8" strokeWidth="1.5">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              ),
              color: "#00B4D8",
            },
            {
              title: "Satélites y Modelos Globales",
              desc: "API de Open-Meteo y datos del NOAA (Administración Nacional Oceánica y Atmosférica) para predicciones de lluvia y mareas a 7 días.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D3557" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              ),
              color: "#1D3557",
            },
            {
              title: "Topografía y Batimetría",
              desc: "Modelos de Elevación Digital (DEM) del terreno de Cartagena para saber por dónde corre el agua y dónde se acumula.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2A9D8F" strokeWidth="1.5">
                  <path d="M3 20l5-10 4 6 4-4 5 8" />
                  <line x1="3" y1="20" x2="21" y2="20" />
                </svg>
              ),
              color: "#2A9D8F",
            },
            {
              title: "Conexión IoT",
              desc: "Los datos viajan por red 4G/5G a nuestro servidor en la nube para procesamiento en tiempo real con latencia menor a 30 segundos.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.5">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <circle cx="12" cy="20" r="1" fill="#6366F1" />
                </svg>
              ),
              color: "#6366F1",
            },
          ].map((item) => (
            <motion.div key={item.title} {...FADE_UP} className="card-light group hover:shadow-lg transition-shadow">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface" style={{ border: `1px solid ${item.color}22` }}>
                {item.icon}
              </div>
              <h3 className="font-display text-base font-bold text-navy mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Beneficios ───────────────────────────────────────────────────────── */

function BenefitsSection() {
  return (
    <section className="section-padding bg-surface">
      <div className="mx-auto max-w-7xl">
        <motion.div {...FADE_UP} className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">Beneficios</p>
          <h2 className="section-title">Protección basada en datos</h2>
        </motion.div>
        <div className="grid gap-8 md:grid-cols-2">
          {[
            {
              title: "Para la Alcaldía",
              items: [
                "Reducción de costos en respuesta a emergencias",
                "Planificación urbana basada en datos históricos",
                "Cumplimiento de agendas de gestión de riesgo",
              ],
              color: "#1D3557",
            },
            {
              title: "Para la Comunidad",
              items: [
                "Alertas tempranas antes de que el agua llegue",
                "Rutas de evacuación seguras en tiempo real",
                "Acceso público a información vital",
              ],
              color: "#2A9D8F",
            },
          ].map((group) => (
            <motion.div key={group.title} {...FADE_UP} className="card-light">
              <h3 className="font-display text-xl font-bold mb-4" style={{ color: group.color }}>
                {group.title}
              </h3>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg width="18" height="18" viewBox="0 0 18 18" className="mt-0.5 shrink-0" fill={group.color}>
                      <circle cx="9" cy="9" r="9" opacity="0.15" />
                      <path d="M6 9l2 2 4-4" stroke={group.color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Tecnología ───────────────────────────────────────────────────────── */

function TechnologySection() {
  return (
    <section id="tecnologia" className="section-padding gradient-dark">
      <div className="mx-auto max-w-7xl">
        <motion.div {...FADE_UP} className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">Tecnología</p>
          <h2 className="font-display text-3xl font-bold text-white md:text-4xl">Ingeniería que salva vidas</h2>
          <p className="mt-3 text-lg text-slate-400 max-w-2xl mx-auto">
            Combina modelos matemáticos rigurosos con datos meteorológicos en
            tiempo real para una predicción confiable.
          </p>
        </motion.div>

        <motion.div {...FADE_UP} className="card-dark mb-10">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
            {[
              { label: "Estaciones + API", sub: "Sensores locales y Open-Meteo" },
              { label: "Cálculo ODE", sub: "Runge-Kutta de 4to orden" },
              { label: "Dashboard", sub: "React + Leaflet + Recharts" },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-4">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-navy-light border border-accent/20">
                    <span className="font-display text-lg font-bold text-accent">{i + 1}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{step.label}</p>
                  <p className="text-xs text-slate-400">{step.sub}</p>
                </div>
                {i < 2 && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" className="shrink-0 mt-[-20px]">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "EDO de Segundo Orden", desc: "Modela la acumulación de agua como un sistema masa-resorte-amortiguador con forzamiento externo de lluvia y mareas." },
            { title: "Datos en Tiempo Real", desc: "Integra la API de Open-Meteo para obtener pronósticos horarios de lluvia, viento y temperatura con cobertura global." },
            { title: "Modelo Territorial", desc: "La topografía de Manga (1.2 msnm) determina la capacidad de absorción y esclusión natural del agua." },
          ].map((item) => (
            <motion.div key={item.title} {...FADE_UP} className="rounded-xl bg-navy-light/50 p-5 border border-navy-lighter">
              <h4 className="font-display text-base font-semibold text-white mb-1">{item.title}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div {...FADE_UP} className="mt-8 text-center">
          <a href="/ciencia" className="btn-outline !border-accent/30 !text-accent hover:!bg-accent/10">
            Conocer el modelo matemático en detalle
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Pronóstico 48h ───────────────────────────────────────────────────── */

function ForecastSection({ puntos }: { puntos: import("@/app/lib/api").PuntoPrediccion[] }) {
  return (
    <section id="pronostico" className="section-padding bg-surface">
      <div className="mx-auto max-w-7xl">
        <motion.div {...FADE_UP} className="text-center mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">Pronóstico</p>
          <h2 className="section-title">Evolución del nivel en 48 horas</h2>
          <p className="section-subtitle mx-auto">
            Observá cómo el nivel del agua H(t) evoluciona a lo largo del tiempo
            en función de la lluvia, la marea y la capacidad de drenaje.
          </p>
        </motion.div>

        {puntos.length > 0 ? (
          <ForecastChart puntos={puntos} />
        ) : (
          <motion.div {...FADE_UP} className="card-dark p-8 text-center">
            <p className="text-slate-400 text-sm">
              Desplazá el panel de monitoreo para ver la curva de pronóstico.
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ─── CTA ──────────────────────────────────────────────────────────────── */

function CTASection() {
  return (
    <section id="contacto" className="section-padding bg-white">
      <div className="mx-auto max-w-3xl text-center">
        <motion.div {...FADE_UP}>
          <h2 className="section-title">
            ¿Interesado en proteger tu ciudad?
          </h2>
          <p className="section-subtitle mx-auto mt-4">
            Entidades públicas, universidades y organizaciones comunitarias:
            contactanos para una demo del sistema completo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href="mailto:contacto@stormprint.app" className="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              Solicitar demo
            </a>
            <a href="/ciencia" className="btn-outline">
              Ver documentación técnica
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────────────────────────────── */

function FooterSection() {
  return (
    <footer className="gradient-dark py-10">
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="#00B4D8" strokeWidth="2" />
              <path d="M16 8C16 8 10 15 10 19a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill="#00B4D8" opacity="0.85" />
            </svg>
            <span className="font-display text-sm font-bold text-white">StormPrint</span>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-slate-400">
            <span>Barrio Manga, Cartagena de Indias</span>
            <span>Coordenadas: 10.4°N, 75.5°W</span>
            <span>Datos: Open-Meteo (CC BY 4.0)</span>
          </div>
          <p className="text-xs text-slate-500">© 2026 StormPrint. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Dashboard Embebido ───────────────────────────────────────────────── */

const PLAYBACK_SPEED_MS = 200;

function DashboardEmbedded() {
  const [prediccion, setPrediccion] = useState<PrediccionResponse | null>(null);
  const [currentHour, setCurrentHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lluvia, setLluvia] = useState(0.6);
  const [marea, setMarea] = useState(8);
  const [drenaje, setDrenaje] = useState(70);
  const [usarMeteo, setUsarMeteo] = useState(true);
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPrediction = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await predecir({
        horas_pronostico: 48,
        intensidad_lluvia_mm_h: usarMeteo ? undefined : lluvia,
        nivel_marea_cm: marea,
        usar_datos_meteo: usarMeteo,
      });
      setPrediccion(result);
      setCurrentHour(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar predicción.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lluvia, marea, usarMeteo]);

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
    <div className="mx-auto max-w-7xl">
      {/* Controls */}
      <div className="card-dark mb-4 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-risk-normal animate-pulse-slow" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
              MONITOREO DE INUNDACIONES · BARRIO MANGA
            </p>
          </div>
          <WeatherBadge meteorologia={prediccion?.meteorologia_resumen ?? null} isLoading={isLoading} />
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Sector costero a 1.2 msnm. Simulación del nivel de acumulación de agua H(t)
          con datos meteorológicos en tiempo real.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
          <Slider label="Lluvia" value={lluvia} onChange={setLluvia} min={0} max={50} step={0.1} unit="mm/h" color="#00B4D8" disabled={usarMeteo} />
          <Slider label="Marea" value={marea} onChange={setMarea} min={0} max={100} step={0.5} unit="cm" color="#6366F1" />
          <Slider label="Drenaje" value={drenaje} onChange={setDrenaje} min={0} max={100} step={1} unit="%" color="#2A9D8F" />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={usarMeteo} onChange={(e) => setUsarMeteo(e.target.checked)} className="accent-accent" />
            <span className="text-xs text-slate-400">Usar datos meteorológicos reales</span>
          </label>
          <button onClick={loadPrediction} disabled={isLoading} className="btn-primary !py-2 !px-4 text-xs">
            {isLoading ? "Calculando..." : "Simular"}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card-dark h-[380px] p-1 md:h-[500px]">
          <LeafletMap punto={activePunto} />
        </div>
        <MetricsPanel punto={activePunto} prediccion={prediccion} isLoading={isLoading} error={error} />
      </div>

      {/* Forecast Cards */}
      {daySummaries.length > 0 && (
        <div className="mt-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Pronóstico por día
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {daySummaries.slice(0, 3).map((s, i) => (
              <ForecastDayCard key={s.dayIndex} summary={s} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="mt-4">
        <TimelineSlider puntos={prediccion?.puntos ?? []} currentHour={currentHour} onScrub={setCurrentHour} isPlaying={isPlaying} onTogglePlay={() => setIsPlaying((p) => !p)} />
      </div>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, unit, color, disabled }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string; color: string; disabled?: boolean;
}) {
  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <div className="flex justify-between mb-1">
        <span className="font-mono text-[10px] text-slate-400 uppercase">{label}</span>
        <span className="font-mono text-xs font-tabular" style={{ color }}>{value.toFixed(step < 1 ? 1 : 0)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
  );
}

/* ─── Página Principal ─────────────────────────────────────────────────── */

export default function LandingPage() {
  const [prediccion, setPrediccion] = useState<PrediccionResponse | null>(null);

  useEffect(() => {
    predecir({ horas_pronostico: 48, usar_datos_meteo: true })
      .then(setPrediccion)
      .catch(() => {});
  }, []);

  return (
    <>
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <DataSourceSection />

      {/* Panel en Vivo */}
      <section id="panel-vivo" className="section-padding gradient-dark">
        <div className="mx-auto max-w-7xl mb-8">
          <motion.div {...FADE_UP} className="text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">Datos en vivo</p>
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
              Panel de Monitoreo
            </h2>
            <p className="mt-3 text-lg text-slate-400 max-w-2xl mx-auto">
              Explorá la simulación en tiempo real. Ajustá los parámetros y
              observá cómo responde el modelo predictivo.
            </p>
          </motion.div>
        </div>
        <DashboardEmbedded />
      </section>

      {/* Pronóstico 48h */}
      <ForecastSection puntos={prediccion?.puntos ?? []} />

      <BenefitsSection />
      <TechnologySection />
      <CTASection />
      <FooterSection />
    </>
  );
}
