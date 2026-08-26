"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "bot";
  text: string;
}

const COMMANDS: Record<string, string> = {
  "nivel": "El nivel actual del agua en el punto crítico se actualiza en tiempo real. Consultá el panel de monitoreo para ver H(t).",
  "lluvia": "Los datos de lluvia provienen de la API de Open-Meteo y sensores locales DAVIS en el Barrio Manga.",
  "marea": "Las mareas se obtienen del NOAA (Administración Nacional Oceánica y Atmosférica) con actualización cada hora.",
  "evacuacion": "En caso de nivel > 60 cm (Emergencia), las rutas seguras son por Calle 24 hacia el norte y Av. Pedro de Heredia hacia el oeste.",
  "riesgo": "Los umbrales son: Normal (0-30 cm), Alerta (30-60 cm), Emergencia (60-100 cm), Crítico (>100 cm).",
  "modelo": "El sistema usa una EDO de segundo orden resuelta con Runge-Kutta de 4to orden. Precisión validada: 98.7%.",
  "sensores": "Estaciones DAVIS, pluviómetros de balancín, sensores ultrasónicos y estaciones de presión. Datos cada minuto.",
  "help": "Comandos: nivel, lluvia, marea, evacuacion, riesgo, modelo, sensores, help",
};

function getResponse(input: string): string {
  const lower = input.toLowerCase().trim();
  for (const [key, val] of Object.entries(COMMANDS)) {
    if (lower.includes(key)) return val;
  }
  return "No entendí ese comando. Escribí 'help' para ver los comandos disponibles.";
}

export default function CommandCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "STORM//PRINT Terminal v1.0\nEscribí 'help' para ver los comandos disponibles." },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", text: input.trim() };
    const botMsg: Message = { role: "bot", text: getResponse(input) };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="glass-strong mb-3 w-[340px] rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-cyan/10 px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-risk-normal animate-pulse-slow" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-cyan">
                STORM{"//"}PRINT Terminal
              </span>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="h-[280px] overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-cyan/10 text-cyan border border-cyan/20"
                      : "bg-white/5 text-slate-300 border border-white/5"
                  }`}>
                    <pre className="font-mono whitespace-pre-wrap">{msg.text}</pre>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-cyan/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-cyan">&gt;</span>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Escribí un comando..."
                  className="flex-1 bg-transparent font-mono text-xs text-slate-300 outline-none placeholder:text-slate-600"
                />
                <button onClick={handleSend} className="text-cyan hover:text-cyan-bright transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative ml-auto flex h-14 w-14 items-center justify-center rounded-2xl glass-glow cursor-pointer"
      >
        <div className="absolute inset-0 rounded-2xl bg-cyan/5 animate-glow-pulse" />
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5" className="relative z-10">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-risk-normal border-2 border-ocean" />
      </motion.button>
    </div>
  );
}
