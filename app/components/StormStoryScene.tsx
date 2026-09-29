"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { AnimatedSea } from "./MangaPort";

type Props = { progress: React.MutableRefObject<number>; reducedMotion: boolean };

const SHOTS = [
  { at: 0, position: [1550, 1950, 2350], target: [0, 0, 0] },
  { at: 0.32, position: [1020, 950, 1220], target: [-360, 0, -220] },
  { at: 0.66, position: [-440, 760, 1120], target: [130, 0, 240] },
  { at: 1, position: [1060, 850, -150], target: [420, 0, 620] },
] as const;

function MangaModel() {
  const { scene } = useGLTF("/models/manga/v6.1/manga-v6.1.glb", "/models/manga/draco/");
  const city = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const category = object.userData.category;
      if (category === "Sea") object.visible = false;
      object.castShadow = category !== "Terrain" && category !== "Roads";
      object.receiveShadow = true;
    });
    return copy;
  }, [scene]);
  return <primitive object={city} dispose={null} />;
}

function CameraJourney({ progress, reducedMotion }: Props) {
  const position = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const desiredPosition = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  useFrame(({ camera, pointer, size }, delta) => {
    const value = Math.max(0, Math.min(1, progress.current));
    let next = SHOTS.findIndex((shot) => shot.at >= value);
    if (next < 0) next = SHOTS.length - 1;
    const previous = Math.max(0, next - 1);
    const left = SHOTS[previous];
    const right = SHOTS[next];
    const range = Math.max(0.001, right.at - left.at);
    const raw = previous === next ? 0 : (value - left.at) / range;
    const blend = raw * raw * (3 - 2 * raw);
    desiredPosition.current.set(left.position[0], left.position[1], left.position[2]).lerp(new THREE.Vector3(right.position[0], right.position[1], right.position[2]), blend);
    desiredTarget.current.set(left.target[0], left.target[1], left.target[2]).lerp(new THREE.Vector3(right.target[0], right.target[1], right.target[2]), blend);
    // The pointer adds a small amount of depth while the scroll controls the actual journey.
    if (!reducedMotion) {
      desiredPosition.current.x += pointer.x * 55;
      desiredPosition.current.y += pointer.y * 35;
    }
    const mobileFit = size.width < 700 ? 1.55 : 1;
    desiredPosition.current.sub(desiredTarget.current).multiplyScalar(mobileFit).add(desiredTarget.current);
    const ease = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.2);
    position.current.copy(camera.position).lerp(desiredPosition.current, ease);
    target.current.lerp(desiredTarget.current, ease);
    camera.position.copy(position.current);
    camera.lookAt(target.current);
  });
  return null;
}

export default function StormStoryScene({ progress, reducedMotion }: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [1550, 1950, 2350], fov: 38, near: 1, far: 18000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: "high-performance" }}
      aria-label="Recorrido tridimensional del modelo cartográfico de Manga"
    >
      <color attach="background" args={["#062a3d"]} />
      <fog attach="fog" args={["#062a3d", 2800, 6500]} />
      <ambientLight intensity={1.25} color="#b8dbe0" />
      <hemisphereLight args={["#cce9e7", "#0a3440", 2]} />
      <directionalLight position={[900, 1650, -650]} intensity={3.1} color="#f8d5a4" />
      <directionalLight position={[-800, 780, 900]} intensity={1.25} color="#4fe7dd" />
      <AnimatedSea reduced={reducedMotion} storm={5} />
      <Suspense fallback={null}><MangaModel /></Suspense>
      <CameraJourney progress={progress} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
