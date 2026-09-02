"use client";

import { memo, useMemo, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import type { PuntoPrediccion } from "@/app/lib/api";
import { riskColor, formatHour } from "@/app/lib/api";

interface ForecastChartProps {
  puntos: PuntoPrediccion[];
  onSeleccionarPunto?: (punto: PuntoPrediccion) => void;
}

type ViewMode = "nivel" | "lluvia" | "marea" | "todos";

const W = 900;
const H = 280;
const PAD_L = 50;
const PAD_R = 15;
const PAD_T = 25;
const PAD_B = 40;
const PW = W - PAD_L - PAD_R;
const PH = H - PAD_T - PAD_B;

function ForecastChart({ puntos, onSeleccionarPunto }: ForecastChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("nivel");
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState<PuntoPrediccion | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, offset: 0 });

  const chartData = useMemo(() => {
    if (puntos.length === 0) return null;

    const maxH = puntos[puntos.length - 1].tiempo_hora;
    const maxNivel = Math.max(120, ...puntos.map((p) => p.nivel_agua_cm));
    const maxLluvia = Math.max(5, ...puntos.map((p) => p.lluvia_mm_h));
    const maxMarea = Math.max(30, ...puntos.map((p) => Math.abs(p.marea_cm)));

    return { maxH, maxNivel, maxLluvia, maxMarea };
  }, [puntos]);

  const xScale = useCallback((h: number) => {
    if (!chartData) return 0;
    const visibleHours = chartData.maxH / zoom;
    const baseX = (h / chartData.maxH) * PW;
    const zoomedX = ((h - panOffset) / visibleHours) * PW;
    return zoom > 1 ? PAD_L + zoomedX : PAD_L + baseX;
  }, [chartData, zoom, panOffset]);

  const yScale = useCallback((v: number, max: number) => {
    return PAD_T + PH - (v / max) * PH;
  }, []);

  const visiblePoints = useMemo(() => {
    if (!chartData) return puntos;
    if (zoom <= 1) return puntos;
    const visibleHours = chartData.maxH / zoom;
    const startH = panOffset;
    const endH = panOffset + visibleHours;
    return puntos.filter((p) => p.tiempo_hora >= startH && p.tiempo_hora <= endH);
  }, [puntos, chartData, zoom, panOffset]);

  const buildPath = useCallback((data: PuntoPrediccion[], getValue: (p: PuntoPrediccion) => number, max: number) => {
    if (!chartData || data.length === 0) return "";
    return data.map((p, i) => {
      const x = xScale(p.tiempo_hora);
      const y = yScale(getValue(p), max);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [chartData, xScale, yScale]);

  const buildArea = useCallback((data: PuntoPrediccion[], getValue: (p: PuntoPrediccion) => number, max: number) => {
    if (!chartData || data.length === 0) return "";
    const linePath = buildPath(data, getValue, max);
    const lastX = xScale(data[data.length - 1].tiempo_hora);
    const firstX = xScale(data[0].tiempo_hora);
    const baseY = PAD_T + PH;
    return `${linePath} L${lastX.toFixed(1)},${baseY} L${firstX.toFixed(1)},${baseY} Z`;
  }, [chartData, buildPath, xScale]);

  const thresholdLines = useMemo(() => {
    if (!chartData) return [];
    return [
      { y: yScale(30, chartData.maxNivel), color: "#FFD600", label: "30 cm" },
      { y: yScale(60, chartData.maxNivel), color: "#FF0055", label: "60 cm" },
      { y: yScale(100, chartData.maxNivel), color: "#B000FF", label: "100 cm" },
    ];
  }, [chartData, yScale]);

  const hourTicks = useMemo(() => {
    if (!chartData) return [];
    const step = zoom >= 4 ? 6 : zoom >= 2 ? 12 : 24;
    const ticks: { x: number; label: string; day?: string }[] = [];
    const startH = zoom > 1 ? Math.floor(panOffset / step) * step : 0;
    const endH = zoom > 1 ? panOffset + chartData.maxH / zoom : chartData.maxH;
    for (let h = startH; h <= endH; h += step) {
      const x = xScale(h);
      if (x >= PAD_L && x <= W - PAD_R) {
        ticks.push({ x, label: `${h}h` });
      }
    }
    return ticks;
  }, [chartData, zoom, panOffset, xScale]);

  const dayTicks = useMemo(() => {
    if (!chartData) return [];
    const ticks: { x: number; label: string }[] = [];
    for (let d = 0; d <= Math.ceil(chartData.maxH / 24); d++) {
      const x = xScale(d * 24);
      if (x >= PAD_L - 20 && x <= W - PAD_R + 20) {
        ticks.push({ x, label: `Día ${d + 1}` });
      }
    }
    return ticks;
  }, [chartData, xScale]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    setZoom((z) => {
      const newZ = Math.max(1, Math.min(8, z + delta));
      if (newZ <= 1) setPanOffset(0);
      return newZ;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, offset: panOffset };
  }, [zoom, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current || !chartData) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const hoursPerPixel = (chartData.maxH / zoom) / PW;
      const newOffset = dragStart.current.offset - dx * hoursPerPixel;
      const maxOffset = chartData.maxH - chartData.maxH / zoom;
      setPanOffset(Math.max(0, Math.min(maxOffset, newOffset)));
      return;
    }

    // Find nearest point
    const visibleHours = chartData.maxH / zoom;
    const hoverH = panOffset + ((svgX - PAD_L) / PW) * visibleHours;
    let nearest = puntos[0];
    let minDist = Infinity;
    for (const p of puntos) {
      const dist = Math.abs(p.tiempo_hora - hoverH);
      if (dist < minDist) { minDist = dist; nearest = p; }
    }
    if (minDist < 2) setHoveredPoint(nearest);
    else setHoveredPoint(null);
  }, [chartData, zoom, panOffset, puntos]);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);
  const handleMouseLeave = useCallback(() => { isDragging.current = false; setHoveredPoint(null); setMousePos(null); }, []);

  // Clic: sincroniza esa hora con el visor 3D (evento global página).
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !chartData || !onSeleccionarPunto) return;
    const rect = svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const scaleW = W / rect.width;
    const visibleHours = chartData.maxH / zoom;
    const hoverH = panOffset + ((svgX * scaleW - PAD_L) / PW) * visibleHours;
    let nearest = puntos[0];
    let minDist = Infinity;
    for (const p of puntos) {
      const dist = Math.abs(p.tiempo_hora - hoverH);
      if (dist < minDist) { minDist = dist; nearest = p; }
    }
    if (minDist < 2) onSeleccionarPunto(nearest);
  }, [chartData, zoom, panOffset, puntos, onSeleccionarPunto]);

  if (!chartData) return null;

  const showNivel = viewMode === "nivel" || viewMode === "todos";
  const showLluvia = viewMode === "lluvia" || viewMode === "todos";
  const showMarea = viewMode === "marea" || viewMode === "todos";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass rounded-2xl p-4"
    >
      {/* Header + Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Pronóstico 7 Días · H(t)
          </p>
          <p className="font-display text-sm text-white">Nivel del agua en el punto crítico</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* View mode buttons */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(["nivel", "lluvia", "marea", "todos"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-all ${
                  viewMode === mode
                    ? "bg-cyan/15 text-cyan border border-cyan/30"
                    : "text-slate-500 hover:text-slate-300 border border-transparent"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              className="h-6 w-6 rounded glass flex items-center justify-center text-slate-400 hover:text-cyan transition text-xs"
            >
              −
            </button>
            <span className="font-mono text-[9px] text-slate-500 w-10 text-center">{zoom.toFixed(1)}—</span>
            <button
              onClick={() => setZoom((z) => Math.min(8, z + 0.5))}
              className="h-6 w-6 rounded glass flex items-center justify-center text-slate-400 hover:text-cyan transition text-xs"
            >
              +
            </button>
          </div>
          {zoom > 1 && (
            <button
              onClick={() => { setZoom(1); setPanOffset(0); }}
              className="rounded-lg px-2 py-1 font-mono text-[9px] text-slate-500 hover:text-cyan transition border border-transparent hover:border-cyan/20"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-2 text-[9px] font-mono text-slate-500">
        {showNivel && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan rounded inline-block" />Nivel H(t)</span>}
        {showLluvia && <span className="flex items-center gap-1"><span className="w-3 h-2 bg-cyan/20 rounded inline-block" />Lluvia</span>}
        {showMarea && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-500 rounded inline-block border-b border-dashed border-slate-400" />Marea</span>}
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500/60 rounded inline-block" style={{ borderBottom: "1px dashed #FFD600" }} />30cm</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500/60 rounded inline-block" style={{ borderBottom: "1px dashed #FF0055" }} />60cm</span>
      </div>

      {zoom > 1 && (
        <p className="font-mono text-[9px] text-slate-600 mb-2">
          ← Arrastrá para navegar · Scroll para zoom →
        </p>
      )}

      {/* Chart */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto cursor-crosshair"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{ userSelect: "none" }}
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="mareaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0.01} />
            </linearGradient>
            <clipPath id="plotArea">
              <rect x={PAD_L} y={PAD_T} width={PW} height={PH} />
            </clipPath>
          </defs>

          {/* Grid */}
          <rect x={PAD_L} y={PAD_T} width={PW} height={PH} fill="rgba(0,0,0,0.2)" rx="4" />

          {/* Threshold lines */}
          {thresholdLines.map((t, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke={t.color} strokeWidth="1.5" strokeDasharray="8 5" opacity="0.5" />
              <text x={PAD_L - 6} y={t.y + 3} textAnchor="end" fill={t.color} fontSize="9" fontFamily="monospace" opacity="0.7">{t.label}</text>
            </g>
          ))}

          {/* Data (clipped) */}
          <g clipPath="url(#plotArea)">
            {/* Lluvia bars */}
            {showLluvia && visiblePoints.filter((_, i) => i % 2 === 0).map((p, i) => {
              const barH = (p.lluvia_mm_h / chartData.maxLluvia) * PH * 0.3;
              const bx = xScale(p.tiempo_hora);
              return <rect key={i} x={bx - 2} y={PAD_T + PH - barH} width="4" height={barH} fill="#00F3FF" opacity="0.2" rx="1" />;
            })}

            {/* Marea area + line */}
            {showMarea && (
              <>
                <path d={buildArea(visiblePoints, (p) => Math.abs(p.marea_cm), chartData.maxMarea)} fill="url(#mareaGrad)" />
                <path d={buildPath(visiblePoints, (p) => Math.abs(p.marea_cm), chartData.maxMarea)} fill="none" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
              </>
            )}

            {/* Nivel area + line */}
            {showNivel && (
              <>
                <path d={buildArea(visiblePoints, (p) => p.nivel_agua_cm, chartData.maxNivel)} fill="url(#areaGrad)" />
                <path d={buildPath(visiblePoints, (p) => p.nivel_agua_cm, chartData.maxNivel)} fill="none" stroke="#00E5FF" strokeWidth="2.5" strokeLinejoin="round" />
              </>
            )}
          </g>

          {/* Hover crosshair */}
          {hoveredPoint && mousePos && (
            <g>
              <line x1={xScale(hoveredPoint.tiempo_hora)} y1={PAD_T} x2={xScale(hoveredPoint.tiempo_hora)} y2={PAD_T + PH} stroke="#00E5FF" strokeWidth="1" opacity="0.3" />
              <line x1={PAD_L} y1={yScale(hoveredPoint.nivel_agua_cm, chartData.maxNivel)} x2={W - PAD_R} y2={yScale(hoveredPoint.nivel_agua_cm, chartData.maxNivel)} stroke="#00E5FF" strokeWidth="1" opacity="0.3" />
              <circle cx={xScale(hoveredPoint.tiempo_hora)} cy={yScale(hoveredPoint.nivel_agua_cm, chartData.maxNivel)} r="5" fill="#00E5FF" stroke="#050A0F" strokeWidth="2" />
              <circle cx={xScale(hoveredPoint.tiempo_hora)} cy={yScale(hoveredPoint.nivel_agua_cm, chartData.maxNivel)} r="10" fill="rgba(0,229,255,0.15)" />
            </g>
          )}

          {/* Hour ticks */}
          {hourTicks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={PAD_T + PH} x2={t.x} y2={PAD_T + PH + 4} stroke="#475569" strokeWidth="1" />
              <text x={t.x} y={PAD_T + PH + 16} textAnchor="middle" fill="#64748B" fontSize="8" fontFamily="monospace">{t.label}</text>
            </g>
          ))}

          {/* Day labels */}
          {dayTicks.map((t, i) => (
            <text key={i} x={t.x} y={PAD_T + PH + 30} textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="sans-serif" fontWeight="600">{t.label}</text>
          ))}

          {/* Y axis */}
          <text x={14} y={PAD_T + PH / 2} textAnchor="middle" fill="#64748B" fontSize="9" fontFamily="monospace" transform={`rotate(-90, 14, ${PAD_T + PH / 2})`}>
            {viewMode === "lluvia" ? "mm/h" : viewMode === "marea" ? "cm" : "Altura (cm)"}
          </text>

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T + PH} x2={W - PAD_R} y2={PAD_T + PH} stroke="#334155" strokeWidth="1" />
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PH} stroke="#334155" strokeWidth="1" />
        </svg>

        {/* Tooltip */}
        {hoveredPoint && mousePos && (
          <div
            className="absolute z-20 pointer-events-none glass-strong rounded-lg px-3 py-2 text-[10px] font-mono"
            style={{
              left: Math.min(mousePos.x + 12, 280),
              top: Math.max(mousePos.y - 60, 4),
            }}
          >
            <p className="text-cyan font-bold">{formatHour(hoveredPoint.tiempo_hora)}</p>
            <p className="text-slate-300">Nivel: <span style={{ color: riskColor(hoveredPoint.estado) }}>{hoveredPoint.nivel_agua_cm.toFixed(1)} cm</span></p>
            <p className="text-slate-400">Lluvia: {hoveredPoint.lluvia_mm_h.toFixed(1)} mm/h</p>
            <p className="text-slate-400">Marea: {hoveredPoint.marea_cm.toFixed(1)} cm</p>
            <p className="text-slate-500">Estado: <span style={{ color: riskColor(hoveredPoint.estado) }}>{hoveredPoint.estado}</span></p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(ForecastChart);
