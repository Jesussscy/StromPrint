"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Sparkles, Float, Html } from "@react-three/drei";
import * as THREE from "three";
import { compararMetodos, ComparacionResponse } from "../lib/api";

// Escalado: tiempo→x (h/12), nivel→y (cm/60).
const Y_MAX = 4.5;

// Partícula que viaja a lo largo de la curva, dejando un halo luminoso.
function CorrientePunto({ puntos, tamaño, color }: { puntos: [number, number, number][]; tamaño: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const idx = useRef(0);
  const segundos = useRef(0);

  useFrame((_, delta) => {
    if (puntos.length < 2) return;
    // Avance fluido en función de la longitud recorrida (delta)
    segundos.current += delta;
    const velocidad = 8.5; // unidades de índice por segundo
    idx.current = (idx.current + velocidad * delta) % (puntos.length - 1);
    const i = Math.floor(idx.current);
    const frac = idx.current - i;
    const a = puntos[i];
    const b = puntos[Math.min(i + 1, puntos.length - 1)];
    const pos: [number, number, number] = [
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac,
    ];
    if (ref.current) {
      ref.current.position.set(pos[0], pos[1], pos[2]);
      // Pulse de brillo
      const s = tamaño * (0.9 + 0.25 * Math.sin(segundos.current * 8));
      ref.current.scale.setScalar(s);
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}

// Línea que se "traza" progresivamente según el prop progreso (0..1).
function LineaTrazo({ puntos, color }: { puntos: [number, number, number][]; color: string }) {
  const [progreso, setProgreso] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    const inicio = performance.now();
    const dur = 2200;
    const step = (now: number) => {
      const t = Math.min(1, (now - inicio) / dur);
      setProgreso(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seg = useMemo(() => {
    if (!puntos.length) return [];
    const n = Math.max(2, Math.round(progreso * puntos.length));
    return puntos.slice(0, n);
  }, [puntos, progreso]);

  // Punto de luz en el extremo del trazo
  const cabecera = seg.length ? seg[seg.length - 1] : null;

  return (
    <group>
      <Line points={seg} color={color} lineWidth={3} />
      <Line points={seg} color="#ffffff" lineWidth={0.8} transparent opacity={0.35} />
      {cabecera && (
        <mesh position={cabecera}>
          <sphereGeometry args={[0.28, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
}

// Rejilla base + ejes con etiquetas
function EscenaBase() {
  return (
    <group>
      <gridHelper args={[12, 24, "#1a3a4a", "#0f1a24"]} position={[0, -0.6, 0]} />
      <Line points={[[0, -0.6, 0], [12.5, -0.6, 0]]} color="#00E5FF" lineWidth={1} transparent opacity={0.25} />
    </group>
  );
}

export default function AnalyticalWave3D() {
  const [res, setRes] = useState<ComparacionResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [reproducir, setReproducir] = useState(true);
  const grupoRef = useRef<THREE.Group>(null);

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
      pts.push([x, Math.min(y, Y_MAX), 0]);
    }
    return pts;
  }, [res]);

  const pico = useMemo(() => {
    if (!res || !res.analitico_cm.length) return null;
    let idx = 0;
    let mv = -Infinity;
    for (let i = 0; i < res.analitico_cm.length; i++) {
      if (res.analitico_cm[i] > mv) {
        mv = res.analitico_cm[i];
        idx = i;
      }
    }
    return { hora: res.horas[idx], nivel: res.analitico_cm[idx], x: res.horas[idx] / 12, y: Math.min(res.analitico_cm[idx] / 60, Y_MAX) };
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
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">
            Vista 3D de la solución analítica
          </p>
          <h3 className="font-display text-lg font-bold text-white mb-1">
            Analítica por tramos — curva 3D
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            La curva se <strong className="text-white">traza sola en vivo</strong> mientras orbita. Girá
            la escena para inspeccionar el nivel de agua H(t) durante las 96 h de pronóstico.
          </p>
        </div>
        <button
          onClick={() => setReproducir((v) => !v)}
          className="glass-glow rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition flex items-center gap-1.5"
        >
          {reproducir ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              Pausar
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
              Reproducir
            </>
          )}
        </button>
      </div>

      <div className="h-[340px] rounded-xl overflow-hidden bg-gradient-to-b from-ocean-mid to-ocean relative">
        <Canvas camera={{ position: [9, 6, 10], fov: 42 }} dpr={[1, 2]}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} />
          <group ref={grupoRef}>
            <Rotador activo={reproducir} grupo={grupoRef}>
              <EscenaBase />
              <Float speed={2} rotationIntensity={0.15} floatIntensity={0.4}>
                {reproducir ? <LineaTrazo puntos={anaPts} color="#00E5FF" /> : <Line points={anaPts} color="#00E5FF" lineWidth={3} />}
              </Float>
              {reproducir && <CorrientePunto puntos={anaPts} tamaño={0.18} color="#00FF87" />}
              <Sparkles count={90} scale={[13, 7, 6]} size={1.6} speed={0.6} color="#00E5FF" opacity={0.35} />
              {pico && (
                <Float speed={1.4} rotationIntensity={0} floatIntensity={0.8}>
                  <PicoSeñal x={pico.x} y={pico.y} label={`Pico ${pico.nivel.toFixed(0)} cm`} />
                </Float>
              )}
            </Rotador>
          </group>
        </Canvas>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-0.5 w-5 bg-[#00E5FF]" /> Analítica (Duhamel)
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-[#00FF87]" /> Flujo en vivo
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-white" /> Pico
        </span>
      </div>
    </div>
  );
}

// Auto-rotación suave del grupo
function Rotador({ activo, grupo, children }: { activo: boolean; grupo: React.RefObject<THREE.Group>; children: React.ReactNode }) {
  useFrame((_, delta) => {
    if (!activo || !grupo.current) return;
    grupo.current.rotation.y += delta * 0.28;
  });
  return <>{children}</>;
}

// Marcador flotante del pico con etiqueta
function PicoSeñal({ x, y, label }: { x: number; y: number; label: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + 0.3 * Math.sin(clock.elapsedTime * 4);
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <group position={[x, y, 0]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Html center position={[0, 0.7, 0]} style={{ pointerEvents: "none" }}>
        <div className="pointer-events-none whitespace-nowrap rounded-md bg-ocean/90 border border-cyan/20 px-2 py-1 font-mono text-[9px] text-cyan shadow-glow">
          {label}
        </div>
      </Html>
    </group>
  );
}
