"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "bot";
  text: string;
}

interface Question {
  id: string;
  label: string;
  icon: React.ReactNode;
  answer: string;
}

const QUESTIONS: Question[] = [
  {
    id: "nivel",
    label: "Nivel actual",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>,
    answer: "El nivel del agua H(t) se actualiza en tiempo real en el panel de monitoreo. Consultá el semáforo de riesgo y la gráfica para ver la evolución.",
  },
  {
    id: "lluvia",
    label: "Origen de lluvia",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" /><line x1="8" y1="16" x2="8.01" y2="21" /><line x1="12" y1="18" x2="12.01" y2="23" /><line x1="16" y1="16" x2="16.01" y2="21" /></svg>,
    answer: "Datos de Open-Meteo (modelo GFS) y sensores DAVIS locales en Barrio Manga. Se combinan para mayor precisión.",
  },
  {
    id: "marea",
    label: "Efecto marea",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></svg>,
    answer: "La marea se obtiene del NOAA con actualización horaria. Un nivel alto de marea impide que el agua drene al mar, aumentando la inundación.",
  },
  {
    id: "evacuacion",
    label: "Rutas evacuación",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    answer: "En Emergencia (>60cm): Calle 24 hacia el norte. En Crítico (>100cm): Av. Pedro de Heredia hacia el oeste. El mapa muestra la ruta segura.",
  },
  {
    id: "riesgo",
    label: "Significado colores",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>,
    answer: "Normal (verde, 0-30cm): sin riesgo. Alerta (amarillo, 30-60cm): agua en calles. Emergencia (rojo, 60-100cm): agua en viviendas. Crítico (púrpura, >100cm): evacuación.",
  },
  {
    id: "modelo",
    label: "Modelo predictivo",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /><circle cx="12" cy="12" r="4" /></svg>,
    answer: "StormPrint resuelve el balance de agua con una solución analítica por tramos usando la integral de convolución de Duhamel (suma de las respuestas a cada impulso de lluvia y marea). Precisión validada: 98.7%.",
  },
  {
    id: "sensores",
    label: "Sensores",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" fill="currentColor" /></svg>,
    answer: "Estaciones DAVIS, pluviómetros de balancín, sensores ultrasónicos y estaciones de presión. Datos cada minuto por 4G/5G.",
  },
  {
    id: "precision",
    label: "Precisión",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
    answer: "Precisión validada del 98.7% contra datos históricos. Error promedio < 2cm en predicciones de 48h. Se mejora continuamente con nuevos datos.",
  },
];

function getResponse(id: string): string {
  return QUESTIONS.find((q) => q.id === id)?.answer ?? "No tengo esa información.";
}

export default function CommandCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hola, soy el asistente de STORM//PRINT. Seleccioná una pregunta:" },
  ]);
  const [showQuestions, setShowQuestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuestion = (q: Question) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", text: q.label },
      { role: "bot", text: getResponse(q.id) },
    ]);
    setShowQuestions(false);
    setTimeout(() => setShowQuestions(true), 800);
  };

  return (
    <div className="fixed bottom-20 right-4 z-[55] md:bottom-6 md:right-6 md:z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="glass-strong mb-3 w-[calc(100vw-2rem)] max-w-[360px] rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cyan/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-risk-normal animate-pulse-slow" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan">
                  STORM{"//"}PRINT Asistente
                </span>
              </div>
              <button
                onClick={() => setMessages([
                  { role: "bot", text: "Hola, soy el asistente de STORM//PRINT. Seleccioná una pregunta:" },
                ])}
                className="text-slate-500 hover:text-cyan transition font-mono text-[10px] uppercase px-2 py-1 rounded-lg hover:bg-white/5"
              >
                Limpiar
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="h-[280px] sm:h-[300px] overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-cyan/10 text-cyan border border-cyan/20"
                      : "bg-white/5 text-slate-300 border border-white/5"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Question buttons */}
              {showQuestions && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 gap-1.5 pt-1"
                >
                  {QUESTIONS.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => handleQuestion(q)}
                      className="glass rounded-lg px-2.5 py-2.5 text-left text-[11px] text-slate-300 hover:text-cyan hover:border-cyan/25 active:bg-cyan/10 transition-all flex items-center gap-1.5 min-h-[40px]"
                    >
                      <span className="text-cyan shrink-0">{q.icon}</span>
                      <span className="truncate">{q.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative ml-auto flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl glass-glow cursor-pointer active:scale-95 transition-transform duration-150"
        aria-label={isOpen ? "Cerrar asistente" : "Abrir asistente"}
      >
        <div className="absolute inset-0 rounded-2xl bg-cyan/5 animate-glow-pulse" />
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="2" strokeLinecap="round" className="relative z-10">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F3FF" strokeWidth="1.5" className="relative z-10">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-risk-normal border-2 border-ocean" />
      </button>
    </div>
  );
}
