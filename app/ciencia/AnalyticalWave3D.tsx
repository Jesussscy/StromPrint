"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { compararMetodos, ComparacionResponse } from "../lib/api";

// Dibuja la curva 3D de la solución analítica.
// Escalado: tiempo→x (h/12), nivel→y (cm/60).
export default function AnalyticalWave3D() {
  const [res, setRes] = useState<ComparacionResponse | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    compararMetodos({ duration_hours: 96, storm_peak_hour: 24, storm_intensity: 60, subtramos: 6 })
      .then((r) => {
        if (activo) setRes(r);
      })
      .catch(() => undefined)
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const anaPts = useMemo(() => {
    if (!res) return [];
    const pts: [number, number, number][] = [];
    for (let i = 0; i < res.horas.length; i++) {
      const x = res.horas[i] / 12;
      const y = res.analitico_cm[i] / 60;
      pts.push([x, y, 0]);
    }
    return pts;
  }, [res]);

  if (cargando)
    return (
      <div className="glass rounded-2xl p-6 animate-pulse h-[300px]" />
    );

  if (!res || anaPts.length === 0)
    return (
      <div className="glass rounded-2xl p-6 text-sm text-slate-500 h-[300px] flex items-center justify-center">
        Sin datos para la vista 3D
      </div>
    );

  return (
    <div className="glass rounded-2xl p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">
        Vista 3D de la solución analítica
      </p>
      <h3 className="font-display text-lg font-bold text-white mb-2">
        Analítica por tramos — curva 3D
      </h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-3">
        Girá la escena para inspeccionar la curva cerrada que define el nivel de agua
        H(t) sobre el territorio en las 96 horas de pronóstico.
      </p>

      <div className="h-[300px] rounded-xl overflow-hidden bg-gradient-to-b from-ocean-mid to-ocean">
        <Canvas camera={{ position: [8, 5, 9], fov: 40 }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} />
          <gridHelper args={[12, 20, "#1a2a3a", "#0f1a24"]} position={[0, -0.5, 0]} />
          <Line points={anaPts} color="#00E5FF" lineWidth={2} />
        </Canvas>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-0.5 w-5 bg-[#00E5FF]" /> Analítica (Duhamel)
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-0.5 w-5 bg-[#FF7700]" /> Intensidad de lluvia
        </span>
      </div>
    </div>
  );
}
