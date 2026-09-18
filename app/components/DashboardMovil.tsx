"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  ChevronDown,
  Copy,
  Maximize,
  SkipBack,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { PuntoPrediccion, PrediccionResponse, WaterStateResponse } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";
import { clasificarNivel } from "@/app/lib/riesgo";
import { ZONAS_MANGA, type ZonaViva } from "@/app/lib/zonasManga";
import MonitoringMetricsRow from "@/app/components/MonitoringMetricsRow";
import ProjectionChart from "@/app/components/ProjectionChart";
import TimelineSlider from "@/app/components/TimelineSlider";
import ZonasMangaPanel from "@/app/components/ZonasMangaPanel";
import NeighborhoodStatusBar from "@/app/components/NeighborhoodStatusBar";
import LazyMount from "@/app/components/LazyMount";
import { Slider } from "@/app/components/Slider";

// Mapa 3D y simulación de inundación por zona (WebGL pesado, carga diferida).
const MangaMap = dynamic(() => import("@/app/components/MangaMap"), {
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

export interface DashboardMovilProps {
  prediccion: PrediccionResponse | null;
  activePunto: PuntoPrediccion | null;
  zonasVivas: Map<number, ZonaViva>;
  zonaEnfocada: number | null;
  zonaSeleccionada: (typeof ZONAS_MANGA)[number] | null;
  currentHour: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  stormMode: boolean;
  velocidad: number;
  sonido: boolean;
  copiado: boolean;
  lluvia: number;
  marea: number;
  drenaje: number;
  usarMeteo: boolean;
  liveWater: WaterStateResponse | null;
  liveLatenciaMs: number | null;
  onSelectZona: (z: { id: number } | null) => void;
  onTogglePlay: () => void;
  onScrub: (h: number) => void;
  onToggleStorm: () => void;
  onReintentar: () => void;
  onSetVelocidad: (v: number) => void;
  onToggleSonido: () => void;
  onCopiarResumen: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onIrAlInicio: () => void;
  onIrAlPico: () => void;
  onSetLluvia: (v: number) => void;
  onSetMarea: (v: number) => void;
  onSetDrenaje: (v: number) => void;
  onSetUsarMeteo: (v: boolean) => void;
}

const ESTADO_COLOR: Record<string, string> = {
  Normal: "#00E5FF",
  Alerta: "#FFD600",
  Emergencia: "#FF0055",
  Critico: "#B000FF",
};

const VELOCIDADES = [0.5, 1, 2, 4];

export default function DashboardMovil({
  prediccion,
  activePunto,
  zonasVivas,
  zonaEnfocada,
  zonaSeleccionada,
  currentHour,
  isPlaying,
  isLoading,
  error,
  stormMode,
  velocidad,
  sonido,
  copiado,
  lluvia,
  marea,
  drenaje,
  usarMeteo,
  liveWater,
  liveLatenciaMs,
  onSelectZona,
  onTogglePlay,
  onScrub,
  onToggleStorm,
  onReintentar,
  onSetVelocidad,
  onToggleSonido,
  onCopiarResumen,
  onExportCSV,
  onExportJSON,
  onIrAlInicio,
  onIrAlPico,
  onSetLluvia,
  onSetMarea,
  onSetDrenaje,
  onSetUsarMeteo,
}: DashboardMovilProps) {
  const [controlesAbiertos, setControlesAbiertos] = useState(false);
  const [mapaFull, setMapaFull] = useState(false);

  // Mientras el mapa esté a pantalla completa, bloquea el scroll del body.
  useEffect(() => {
    if (!mapaFull) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mapaFull]);

  const nivel = activePunto?.nivel_agua_cm ?? 0;
  const estado = clasificarNivel(nivel);
  const nivelColor = ESTADO_COLOR[estado] ?? "#00E5FF";
  const velocidadCmH = activePunto?.velocidad_cambio ?? 0;
  const horaPico = prediccion?.hora_pico ?? 0;
  const maxCm = prediccion?.nivel_maximo_cm ?? 0;

  const abrirAlertas = () => {
    window.dispatchEvent(new CustomEvent("stormprint:open-alerts"));
  };

  return (
    <div className="space-y-3 pb-4">
      {/* ═══ BARRA "AHORA" (sticky bajo el navbar) ═══ */}
      <div
        className="sticky z-30 pt-1"
        style={{ top: "calc(56px + env(safe-area-inset-top, 0px))" }}
      >
        <div className="glass-strong rounded-2xl p-3 safe-area-top" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">
                Nivel actual
              </p>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="font-display text-3xl font-bold font-tabular leading-none"
                  style={{ color: nivelColor, textShadow: `0 0 20px ${nivelColor}33` }}
                >
                  {nivel.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400 font-medium">cm</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-sm font-bold uppercase tracking-wide"
                style={{ color: nivelColor, backgroundColor: `${nivelColor}14`, border: `1px solid ${nivelColor}35` }}
              >
                <span className="h-1.5 w-1.5 rounded-full animate-pulse-slow" style={{ backgroundColor: nivelColor }} />
                {estado}
              </span>
              <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                <TrendingUp size={13} className={velocidadCmH > 0 ? "text-risk-emergency" : velocidadCmH < 0 ? "rotate-180 text-emerald-300" : "text-slate-500"} />
                <span className="font-tabular">
                  {velocidadCmH > 0 ? "+" : ""}{velocidadCmH.toFixed(1)} cm/h
                </span>
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-risk-normal animate-pulse-slow" />
              <span className="truncate font-mono text-[9px] uppercase tracking-widest text-slate-500">
                LIVE {liveLatenciaMs != null ? `· ${liveLatenciaMs}ms` : "· Hora"}{" "}
                {`+${currentHour.toFixed(1)}h`} · Pico +{horaPico.toFixed(0)}h · {maxCm.toFixed(0)} cm
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={abrirAlertas}
                aria-label="Abrir centro de alertas"
                className="glass rounded-lg h-11 w-11 min-h-min min-w-min flex items-center justify-center text-slate-300 active:scale-95 transition-all duration-150"
              >
                <Bell size={20} />
              </button>
              <button
                onClick={onToggleSonido}
                aria-pressed={sonido}
                aria-label={sonido ? "Apagar alertas sonoras" : "Encender alertas sonoras"}
                className={`glass rounded-lg h-11 w-11 min-h-min min-w-min flex items-center justify-center active:scale-95 transition-all duration-150 ${sonido ? "text-cyan" : "text-slate-500"}`}
              >
                {sonido ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTROLES (sheet colapsable) ═══ */}
      <button
        onClick={() => setControlesAbiertos((o) => !o)}
        aria-expanded={controlesAbiertos}
        className="w-full glass rounded-2xl px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-cyan flex items-center justify-between active:scale-[0.99] transition-all duration-150 min-h-[48px]"
      >
        <span className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          Escenario · Controles
        </span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${controlesAbiertos ? "rotate-180" : ""}`} />
      </button>

      {controlesAbiertos && (
        <div className="glass-strong rounded-2xl p-4 space-y-4">
          <Slider label="Lluvia" value={lluvia} onChange={onSetLluvia} min={0} max={50} step={0.1} unit="mm/h" color="#00F3FF" disabled={usarMeteo} />
          <Slider label="Marea" value={marea} onChange={onSetMarea} min={0} max={100} step={0.5} unit="cm" color="#B000FF" disabled={usarMeteo} />
          <Slider label="Drenaje" value={drenaje} onChange={onSetDrenaje} min={0} max={100} step={1} unit="%" color="#00E5FF" disabled={usarMeteo} />
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px] select-none">
            <input type="checkbox" checked={usarMeteo} onChange={(e) => onSetUsarMeteo(e.target.checked)} className="accent-cyan h-4 w-4" />
            <span className="text-xs text-slate-400">Usar datos meteorológicos reales</span>
          </label>
          {usarMeteo ? (
            <p className="font-mono text-[11px] text-slate-500">
              Simulación bloqueada · meteo en vivo
            </p>
          ) : (
            <button
              onClick={onReintentar}
              disabled={isLoading}
              className="glass-glow w-full rounded-lg px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-cyan active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40"
            >
              {isLoading ? "Calculando…" : "Simular escenario"}
            </button>
          )}
        </div>
      )}

      {/* ═══ ESTADO + METEOROLOGÍA ═══ */}
      <MonitoringMetricsRow punto={activePunto} prediccion={prediccion} isLoading={isLoading} />

      {/* ═══ MAPA 3D + BTN TORMENTA ═══ */}
      <div className="relative">
        <div
          className={`relative overflow-hidden ${
            mapaFull
              ? "fixed inset-0 z-[90] rounded-none bg-ocean-deep"
              : "glass-strong rounded-2xl h-[55vh] min-h-[320px]"
          }`}
        >
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
            <MangaMap
              nivelAguaCm={activePunto?.nivel_agua_cm ?? 0}
              nivelMaximoCm={prediccion?.nivel_maximo_cm ?? 100}
              zonasVivas={zonasVivas}
              focusZonaId={zonaEnfocada}
              onSelectZona={onSelectZona}
              horaLocal={Math.floor(currentHour) % 24}
              stormMode={stormMode}
              puntoMeteo={activePunto}
              forecastPoints={prediccion?.puntos}
              spatialForcing={prediccion?.forzamiento_espacial}
              currentHour={currentHour}
              sourceLabel={prediccion?.fuente_meteo}
              meteorologia={prediccion?.meteorologia_resumen ?? null}
              liveWater={liveWater}
              liveLatenciaMs={liveLatenciaMs}
            />
          </LazyMount>

          {/* Mapa a pantalla completa / salir */}
          <button
            onClick={() => setMapaFull((f) => !f)}
            aria-label={mapaFull ? "Salir de pantalla completa del mapa" : "Mapa a pantalla completa"}
            className={`absolute bottom-3 z-20 glass rounded-lg px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-cyan flex items-center gap-1.5 min-h-[44px] min-w-[44px] active:scale-95 transition-all duration-150 ${
              mapaFull ? "left-3" : "left-3"
            }`}
          >
            {mapaFull ? <X size={14} /> : <Maximize size={14} />}
            {mapaFull ? "Salir" : "Pantalla completa"}
          </button>
        </div>
      </div>

      {/* Botón "Simular tormenta" a ancho completo (no flotante) */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onToggleStorm}
        aria-pressed={stormMode}
        className={`w-full rounded-xl px-6 py-4 font-mono text-xs uppercase tracking-wider transition-all duration-300 min-h-[48px] ${
          stormMode
            ? "glass-glow text-risk-emergency border-risk-emergency/30"
            : "glass-glow text-cyan"
        }`}
      >
        {stormMode ? (
          <span className="flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="2" /></svg>
            Detener tormenta
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
            Simular tormenta
          </span>
        )}
      </motion.button>

      {/* ═══ LÍNEA TEMPORAL (pegada bajo el mapa + tormenta) ═══ */}
      <TimelineSlider
        puntos={prediccion?.puntos ?? []}
        currentHour={currentHour}
        onScrub={onScrub}
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
      />

      {/* ═══ GRÁFICO ═══ */}
      <div>
        <ProjectionChart puntos={prediccion?.puntos ?? []} currentHour={currentHour} />
      </div>

      {/* ═══ SIMULACIÓN 3D POR ZONA ═══ */}
      {zonaSeleccionada && (
        <ZonaFlood3D
          zona={zonaSeleccionada}
          nivelAguaCm={activePunto?.nivel_agua_cm ?? 0}
          nivelMaximoCm={prediccion?.nivel_maximo_cm ?? 100}
          zonasVivas={zonasVivas}
          horaLocal={Math.floor(currentHour) % 24}
          onClose={() => onSelectZona(null)}
        />
      )}

      {/* ═══ ZONAS DE RIESGO ═══ */}
      <ZonasMangaPanel
        nivelAguaCm={activePunto?.nivel_agua_cm ?? 0}
        nivelMaximoCm={prediccion?.nivel_maximo_cm ?? 100}
        zonasVivas={zonasVivas}
        selectedId={zonaEnfocada}
        onSelect={onSelectZona}
      />

      {/* ═══ ESTADO DEL BARRIO ═══ */}
      <NeighborhoodStatusBar prediccion={prediccion} punto={activePunto} />

      {/* ═══ ACCIONES: reproducción + exportación ═══ */}
      <div className="glass rounded-2xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mr-1">Vel</span>
            {VELOCIDADES.map((v) => (
              <button
                key={v}
                onClick={() => onSetVelocidad(v)}
                aria-pressed={velocidad === v}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] transition min-h-[44px] min-w-[44px] ${
                  velocidad === v ? "bg-cyan/20 text-cyan" : "text-slate-400"
                }`}
              >
                {v}x
              </button>
            ))}
          </div>
          <button
            onClick={onIrAlInicio}
            aria-label="Ir al inicio de la serie"
            className="glass rounded-lg px-3 py-2 font-mono text-[10px] text-slate-300 flex items-center gap-1 min-h-[44px]"
          >
            <SkipBack size={12} />
            Inicio
          </button>
          <button
            onClick={onIrAlPico}
            disabled={!prediccion}
            aria-label="Saltar a la hora del nivel máximo"
            className="glass rounded-lg px-3 py-2 font-mono text-[10px] text-risk-emergency min-h-[44px] disabled:opacity-40"
          >
            ▲ Pico
          </button>
        </div>

        <div className="h-px bg-white/10" />

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={onExportCSV}
            disabled={!prediccion || isLoading}
            className="glass rounded-lg px-2 py-2.5 font-mono text-[9px] uppercase tracking-wider text-slate-300 min-h-[48px] disabled:opacity-40"
          >
            CSV
          </button>
          <button
            onClick={onExportJSON}
            disabled={!prediccion || isLoading}
            className="glass rounded-lg px-2 py-2.5 font-mono text-[9px] uppercase tracking-wider text-slate-300 min-h-[48px] disabled:opacity-40"
          >
            JSON
          </button>
          <button
            onClick={onCopiarResumen}
            disabled={!prediccion || isLoading}
            className={`glass rounded-lg px-2 py-2.5 font-mono text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 min-h-[48px] disabled:opacity-40 ${copiado ? "text-emerald-300" : "text-slate-300"}`}
          >
            {copiado ? <Check size={12} /> : <Copy size={12} />}
            {copiado ? "Listo" : "Copiar"}
          </button>
          <button
            onClick={onToggleSonido}
            aria-pressed={sonido}
            className={`glass rounded-lg px-2 py-2.5 min-h-[48px] flex flex-col items-center justify-center gap-0.5 ${sonido ? "text-cyan" : "text-slate-500"}`}
          >
            {sonido ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="font-mono text-[8px] uppercase tracking-wider">{sonido ? "Sonido" : "Silencio"}</span>
          </button>
        </div>
      </div>

      {/* ═══ NARRATIVA (plegada) ═══ */}
      {prediccion && (
        <details className="glass rounded-2xl p-4 group">
          <summary className="flex items-center justify-between cursor-pointer list-none font-mono text-[10px] uppercase tracking-widest text-slate-500">
            Análisis del modelo
            <ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180 text-slate-500" />
          </summary>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{prediccion.narrativa}</p>
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">Recomendación</p>
            <p className="text-sm font-medium" style={{ color: "#00E5FF" }}>{prediccion.recomendacion}</p>
          </div>
        </details>
      )}

      {/* ═══ ERRORES ═══ */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <span>{error}</span>
          <button
            onClick={onReintentar}
            className="glass-glow shrink-0 rounded-lg px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-cyan min-h-[44px] min-w-[44px]"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}