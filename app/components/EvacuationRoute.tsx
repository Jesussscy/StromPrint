"use client";

import { useEffect, useRef } from "react";

interface EvacuationRouteProps {
  mapRef: React.RefObject<any>;
  active: boolean;
  origin?: [number, number];
}

const SHELTER: [number, number] = [10.4045, -75.5145];
const ROUTE_POINTS: [number, number][] = [
  [10.4000, -75.5167],
  [10.4005, -75.5160],
  [10.4012, -75.5155],
  [10.4020, -75.5150],
  [10.4030, -75.5148],
  [10.4045, -75.5145],
];

export default function EvacuationRoute({ mapRef, active, origin }: EvacuationRouteProps) {
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const draw = async () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }

      if (!active) return;

      const L = (await import("leaflet")).default;
      const start = origin || ROUTE_POINTS[0];
      const points = [start, ...ROUTE_POINTS.slice(1)];

      const line = L.polyline(points, {
        color: "#00E5FF",
        weight: 4,
        opacity: 0.8,
        dashArray: "10 8",
        className: "evacuation-route",
      });

      const shelterIcon = L.divIcon({
        className: "shelter-marker",
        html: `<div style="
          background: #00E5FF;
          width: 24px; height: 24px;
          border-radius: 4px;
          border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px;
          box-shadow: 0 0 15px rgba(0,229,255,0.6);
        ">🏥</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const shelter = L.marker(SHELTER, { icon: shelterIcon })
        .bindPopup("<b>Refugio seguro</b><br/>Punto más alto del sector");

      const startIcon = L.divIcon({
        className: "start-marker",
        html: `<div style="
          background: #FF0055;
          width: 20px; height: 20px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 12px rgba(255,0,85,0.6);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const startMarker = L.marker(start, { icon: startIcon })
        .bindPopup("<b>Tu ubicación</b><br/>Ruta de evacuación recomendada");

      layerRef.current = L.layerGroup([line, shelter, startMarker]).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [60, 60] });
    };

    draw();

    return () => {
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [mapRef, active, origin]);

  return null;
}
