"use client";

import { Droplets } from "lucide-react";
import "./MapCurtain.css";

export default function MapCurtain({ direction }: { direction: "close" | "open" }) {
  return (
    <div className={`map-curtain map-curtain--${direction}`} aria-hidden="true">
      <div className="map-curtain__panel map-curtain__panel--left" />
      <div className="map-curtain__panel map-curtain__panel--right" />
      <div className="map-curtain__center">
        <div className="map-curtain__orbit"><Droplets size={40} strokeWidth={1.5} /></div>
        <strong>ENTRANDO A MANGA</strong>
        <span>10°24′ N · 75°32′ O</span>
      </div>
      <div className="map-curtain__line" />
    </div>
  );
}
