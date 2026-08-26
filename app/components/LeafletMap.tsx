"use client";

import { useEffect, useRef } from "react";
import type { PuntoPrediccion } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";
import "leaflet/dist/leaflet.css";

interface LeafletMapProps {
  punto: PuntoPrediccion | null;
  stormMode?: boolean;
}

const MANGA_CENTER: [number, number] = [10.4000, -75.5167];

export default function LeafletMap({ punto, stormMode }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      const map = L.map(mapRef.current!, {
        center: MANGA_CENTER,
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      const streetLabels = [
        { text: "Calle 24", pos: [10.401, -75.517] as [number, number] },
        { text: "Parque de Manga", pos: [10.399, -75.516] as [number, number] },
        { text: "Av. Pedro de Heredia", pos: [10.402, -75.518] as [number, number] },
      ];

      streetLabels.forEach(({ text, pos }) => {
        const labelIcon = L.divIcon({
          className: "",
          html: `<div class="glass" style="
            border-radius: 6px;
            padding: 2px 6px;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 10px;
            font-weight: 500;
            color: #94a3b8;
            white-space: nowrap;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          ">${text}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 12],
        });
        L.marker(pos, { icon: labelIcon, interactive: false }).addTo(map);
      });

      setTimeout(() => map.invalidateSize(), 100);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const updateMap = async () => {
      const L = (await import("leaflet")).default;
      const map = mapInstanceRef.current;

      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }

      if (!punto) return;

      const level = punto.nivel_agua_cm;
      const color = riskColor(punto.estado);

      const radius = Math.max(200, Math.min(800, level * 15));
      const opacity = Math.min(0.5, 0.1 + level * 0.005);

      circleRef.current = L.circle(MANGA_CENTER, {
        radius,
        color,
        fillColor: color,
        fillOpacity: opacity,
        weight: 2,
        opacity: 0.7,
      }).addTo(map);

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          background: ${color};
          width: 28px; height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 10px ${color}80;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 10px; font-weight: 700; color: white;
        ">${level.toFixed(0)}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      markerRef.current = L.marker(MANGA_CENTER, { icon }).addTo(map)
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 4px;">
            <strong style="color: ${color};">${punto.estado}</strong><br/>
            <span style="font-size: 13px;">Nivel: ${level.toFixed(1)} cm</span><br/>
            <span style="font-size: 11px; color: #666;">Hora: ${punto.tiempo_hora}h</span>
          </div>
        `);
    };

    updateMap();
  }, [punto]);

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden">
      <div ref={mapRef} className="h-full w-full" />

      {/* Storm mode overlay */}
      {stormMode && (
        <div className="absolute inset-0 z-[999] pointer-events-none bg-ocean/30 mix-blend-multiply animate-pulse-slow" />
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 glass rounded-lg px-2 py-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Visor territorial · Manga, Cartagena
        </span>
      </div>
      {punto && (
        <div className="pointer-events-none absolute top-3 right-3 glass rounded-lg px-3 py-2">
          <p className="font-mono text-[9px] uppercase tracking-widest text-cyan">Nivel H(t)</p>
          <p className="font-display text-lg font-tabular" style={{ color: riskColor(punto.estado) }}>
            {punto.nivel_agua_cm.toFixed(1)}
            <span className="ml-1 text-xs text-slate-400">cm</span>
          </p>
        </div>
      )}
    </div>
  );
}
