"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import type { PuntoPrediccion } from "@/app/lib/api";
import { riskColor } from "@/app/lib/api";

interface Canvas3DProps {
  punto: PuntoPrediccion | null;
}

const BASE_ELEVATION_MULTIPLIER = 0.045;
const MAX_ELEVATION = 4.2;

function MangaModel({ punto }: { punto: PuntoPrediccion | null }) {
  const { scene } = useGLTF("/models/manga_model.glb");
  const waterMeshRef = useRef<THREE.Object3D | null>(null);
  const materialColorRef = useRef(new THREE.Color("#00F3FF"));

  const waterObject = useMemo<THREE.Object3D | null>(() => {
    let found: THREE.Object3D | null = null;
    scene.traverse((child) => {
      if (child.name === "WaterLevel_Animated") {
        found = child;
      }
    });
    waterMeshRef.current = found;
    return found;
  }, [scene]);

  useFrame((_, delta) => {
    const obj = waterObject;
    if (!obj || !punto) return;

    const targetY = Math.min(
      (punto.nivel_agua_cm * BASE_ELEVATION_MULTIPLIER) / 100,
      MAX_ELEVATION
    );

    obj.position.y = THREE.MathUtils.damp(
      obj.position.y,
      targetY,
      4,
      delta
    );

    const targetColor = new THREE.Color(riskColor(punto.estado));
    materialColorRef.current.lerp(targetColor, Math.min(delta * 3, 1));

    const mesh = obj as THREE.Mesh;
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        const standardMat = mat as THREE.MeshStandardMaterial;
        if (standardMat.color) {
          standardMat.color.copy(materialColorRef.current);
        }
        if ("emissive" in standardMat) {
          standardMat.emissive = materialColorRef.current;
          standardMat.emissiveIntensity = 0.35;
        }
      });
    }
  });

  return <primitive object={scene} scale={1.4} position={[0, -0.6, 0]} />;
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-cyan font-mono text-xs">
        <div className="h-8 w-8 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin" />
        <span>Cargando modelo territorial...</span>
      </div>
    </Html>
  );
}

export default function Canvas3D({ punto }: Canvas3DProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      <Canvas
        camera={{ position: [6, 5, 8], fov: 42 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#080C14"]} />
        <fog attach="fog" args={["#080C14", 10, 26]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} color="#B8DFFF" />
        <pointLight position={[-4, 2, -4]} intensity={0.6} color="#00F3FF" />

        <Suspense fallback={<LoadingFallback />}>
          <MangaModel punto={punto} />
          <Environment preset="night" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={16}
          maxPolarAngle={Math.PI / 2.1}
          autoRotate
          autoRotateSpeed={0.4}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 grid-scan opacity-20" />
      <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-widest text-cyan/60">
        Visor territorial \u00b7 Manga 3D
      </div>

      {/* Indicador de nivel de agua en la esquina */}
      {punto && (
        <div className="pointer-events-none absolute top-3 right-3 glass-panel px-3 py-2">
          <p className="font-mono text-[9px] uppercase tracking-widest text-mist">Nivel H(t)</p>
          <p className="font-display text-lg font-tabular" style={{ color: riskColor(punto.estado) }}>
            {punto.nivel_agua_cm.toFixed(1)}
            <span className="ml-1 text-xs text-mist">cm</span>
          </p>
        </div>
      )}
    </div>
  );
}

useGLTF.preload("/models/manga_model.glb");
