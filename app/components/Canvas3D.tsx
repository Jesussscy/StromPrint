"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import CityModel from "./CityModel";
import type { PuntoPrediccion } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";

interface Canvas3DProps {
  punto: PuntoPrediccion | null;
  stormMode?: boolean;
  waterLevelOverride?: number;
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-cyan font-mono text-xs">
        <div className="h-8 w-8 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin" />
        <span>Inicializando ciudad 3D...</span>
      </div>
    </Html>
  );
}

export default function Canvas3D({ punto, stormMode = false, waterLevelOverride }: Canvas3DProps) {
  const nivel = punto?.nivel_agua_cm ?? 0;
  const normalized = Math.min(nivel / 100, 1);
  const displayLevel = waterLevelOverride ?? normalized;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      <Canvas
        camera={{ position: [4, 3, 5], fov: 40 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#050A0F"]} />
        <fog attach="fog" args={["#050A0F", 8, 20]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 6, 3]} intensity={0.9} color="#B8DFFF" />
        <pointLight position={[-3, 2, -3]} intensity={0.4} color="#00D2FF" />

        <Suspense fallback={<LoadingFallback />}>
          <CityModel
            waterLevel={displayLevel}
            stormMode={stormMode}
            riskColor={punto ? riskColor(punto.estado) : "#00E5FF"}
          />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2.1}
          autoRotate
          autoRotateSpeed={stormMode ? 1.2 : 0.3}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 grid-scan opacity-20" />
      <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-widest text-cyan/60">
        Simulador · Barrio Manga 3D
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

      {stormMode && (
        <div className="pointer-events-none absolute top-3 left-3 glass rounded-lg px-3 py-2 border border-red-500/40">
          <p className="font-mono text-[9px] uppercase tracking-widest text-red-400 animate-pulse">
            ⚡ Simulación Activa
          </p>
        </div>
      )}
    </div>
  );
}
