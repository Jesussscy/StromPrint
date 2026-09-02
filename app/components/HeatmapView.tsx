"use client";

import { useEffect, useRef } from "react";
import h337, { type HeatmapConfiguration } from "heatmap.js";
import {
  ZONAS_MANGA,
  RIESGO_META,
  riesgoVivo,
  type ZonaManga,
} from "@/app/lib/zonasManga";

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface HeatmapViewProps {
  bounds: Bounds;
  zonas?: ZonaManga[];
  nivelAguaCm?: number;
  nivelMaximoCm?: number;
  velocidad?: number;
  visible: boolean;
}

const MAP_SIZE = 800;

// Proyección equirectangular simple de lat/lng -> pixel dentro del canvas.
// Es la misma convención que usa el proyecto (cesiumTextures.heatmapTexture).
function latLngToPixel(
  lat: number,
  lng: number,
  width: number,
  height: number,
  bounds: Bounds
) {
  const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * width;
  const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height;
  return { x: Math.max(0, Math.min(width, Math.round(x))), y: Math.max(0, Math.min(height, Math.round(y))) };
}

function intensidadAnimada(
  zona: ZonaManga,
  nivelAguaCm: number,
  nivelMaximoCm: number,
  tiempo: number,
  velocidad: number
): number {
  const riesgo = riesgoVivo(zona, nivelAguaCm, nivelMaximoCm);
  const peso = RIESGO_META[riesgo].peso; // 1..4
  const nivelZona = Math.max(40, zona.altura_critica || 60);

  // Base por riesgo + poblacion
  const base = (peso / 4) * (0.8 + (zona.poblacion_afectada ?? 60) / 900);

  // Factor por nivel de agua global (0..1)
  const factorNivel = Math.min(1, Math.max(0.25, nivelAguaCm / Math.max(nivelMaximoCm, 1)));

  // Latido suave (pulso)
  const pulso = 0.85 + 0.15 * Math.sin(tiempo * 0.003 * velocidad);

  // Onda viajera según posición dentro del mapa (efecto de flujo)
  const p = latLngToPixel(zona.coordenadas[0], zona.coordenadas[1], 1, 1, {
    west: -75.5238, south: 10.3922, east: -75.5085, north: 10.4098,
  });
  const onda = 0.75 + 0.25 * Math.sin(tiempo * 0.004 * velocidad + (p.x + p.y) * 9);

  // Norma: 0..1
  return Math.min(1, base * (0.35 + 0.65 * factorNivel) * pulso * onda * (nivelZona / 140));
}

export default function HeatmapView({
  bounds,
  zonas = ZONAS_MANGA,
  nivelAguaCm = 0,
  nivelMaximoCm = 100,
  velocidad = 1,
  visible,
}: HeatmapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heatRef = useRef<ReturnType<typeof h337.create> | null>(null);
  const rafRef = useRef<number>(0);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  // Inicializar heatmap.js (una sola vez, canvas de tamaño fijo)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const cfg: HeatmapConfiguration = {
      container: el,
      radius: 60,
      maxOpacity: 0.7,
      minOpacity: 0,
      blur: 0.85,
      gradient: {
        "0.0": "rgba(0, 229, 255, 0)",
        "0.25": "rgba(0, 229, 255, 0.55)",
        "0.5": "rgba(255, 214, 0, 0.9)",
        "0.75": "rgba(255, 120, 0, 1)",
        "1.0": "rgba(255, 0, 85, 1)",
      },
    };
    heatRef.current = h337.create(cfg);

    return () => {
      cancelAnimationFrame(rafRef.current);
      heatRef.current = null;
    };
  }, []);

  // Loop de animación: redibuja el heatmap con intensidades animadas
  useEffect(() => {
    if (!visible) return;
    const inst = heatRef.current;
    if (!inst) return;

    const start = performance.now();
    const step = () => {
      const tk = performance.now() - start;
      const data = zonas.map((z) => {
        const p = latLngToPixel(z.coordenadas[0], z.coordenadas[1], MAP_SIZE, MAP_SIZE, boundsRef.current);
        return {
          x: p.x,
          y: p.y,
          value: intensidadAnimada(z, nivelAguaCm, nivelMaximoCm, tk, velocidad) * 100,
        };
      });
      inst.setData({ max: 100, min: 0, data });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, zonas, nivelAguaCm, nivelMaximoCm, velocidad]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-ocean-deep"
      style={{ height: "100%", width: "100%" }}
    />
  );
}
