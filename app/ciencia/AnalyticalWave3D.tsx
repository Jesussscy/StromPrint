"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { compararMetodos, ComparacionResponse } from "../lib/api";

// Dibuja una curva 3D a partir de las series numérica / analítica.
// Escalado: tiempo→x (h/12), nivel→y (cm/60), desplazamiento en z para separar capas.
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

  const { numPts, anaPts } = useMemo(() => {
    if (!res) return { numPts: [], anaPts: [] };
    const min = Math.min(res.horas.length, res.numerico_cm.length, res.analitico_cm.length);
    const num: [number, number, number][] = [];
    const ana: [number, number, number][] = [];
    for (let i = 0; i < min; i++) {
      const x = res.horas[i] / 12;
      const yNum = res.numerico_cm[i] / 60;
      const yAna = res.analitico_cm[i] / 60;
      num.push([x, yNum, 0]);
      ana.push([x, yAna, 0.4]);
    }
    return { numPts: num, anaPts: ana };
  }, [res]);

  if (cargando)
    return (
      <div className="glass rounded-2xl p-6 animate-pulse h-[300px]" />
    );

  if (!res || numPts.length === 0)
    return (
      <div className="glass rounded-2xl p-6 text-sm text-slate-500 h-[300px] flex items-center justify-center">
        Sin datos para la vista 3D
      </div>
    );

  return (
    <div className="glass rounded-2xl p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">
        Vista 3D de ambas soluciones
      </p>
      <h3 className="font-display text-lg font-bold text-white mb-2">
        RK4 vs Analítica — superpuestas
      </h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-3">
        Girá la escena: las dos curvas están desplazadas en el eje Z. Su coincidencia es la
        validación visual de la solución analítica.
      </p>

      <div className="h-[300px] rounded-xl overflow-hidden bg-gradient-to-b from-[#0A1119] to-[#070B12]">
        <Canvas camera={{ position: [8, 5, 9], fov: 40 }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} />
          <gridHelper args={[12, 20, "#1a2a3a", "#0f1a24"]} position={[0, -0.5, 0]} />
          <Line points={numPts} color="#00E5FF" lineWidth={2} />
          <Line points={anaPts} color="#FF7700" lineWidth={2} dashed dashSize={0.15} gapSize={0.08} />
        </Canvas>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-0.5 w-5 bg-[#00E5FF]" /> Numérico (RK4)
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-0.5 w-5 bg-[#FF7700]" style={{ backgroundImage: "repeating-linear-gradient(90deg,#FF7700 0 4px,transparent 4px 8px)" }} /> Analítica (tramos)
        </span>
      </div>
    </div>
  );
}
