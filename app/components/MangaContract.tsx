"use client";

import { useCallback, useEffect, useState } from "react";
import { Droplets } from "lucide-react";
import MangaRender from "./MangaRender";
import MapCurtain from "./MapCurtain";
import "./MangaContract.css";

export default function MangaContractViewer() {
  const [ready, setReady] = useState(false);
  const [curtain, setCurtain] = useState(true);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;
    const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1450;
    const timer = window.setTimeout(() => setCurtain(false), wait);
    return () => window.clearTimeout(timer);
  }, [ready]);

  return <main id="contenido" className="manga-route">
    <MangaRender standalone onReady={onReady} />
    {curtain && (ready ? <MapCurtain direction="open" /> : <div className="manga-route-wait" role="status"><Droplets size={42} strokeWidth={1.5} /><strong>Preparando Manga en 3D</strong><span>Cargando territorio y relieve…</span></div>)}
  </main>;
}
