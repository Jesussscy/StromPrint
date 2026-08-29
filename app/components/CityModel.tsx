"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CityModelProps {
  waterLevel: number; // 0-1 normalized
  stormMode: boolean;
  riskColor: string;
}

function Buildings() {
  const buildings = useMemo(() => {
    const arr: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];
    const gridSize = 8;
    const spacing = 0.45;
    const offset = (gridSize * spacing) / 2;

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const px = x * spacing - offset + (Math.random() - 0.5) * 0.1;
        const pz = z * spacing - offset + (Math.random() - 0.5) * 0.1;
        const h = 0.15 + Math.random() * 0.4;
        const w = 0.15 + Math.random() * 0.15;
        const d = 0.15 + Math.random() * 0.15;
        const shade = 0.08 + Math.random() * 0.06;
        arr.push({
          pos: [px, h / 2, pz],
          size: [w, h, d],
          color: `rgb(${Math.floor(shade * 255)}, ${Math.floor(shade * 280)}, ${Math.floor(shade * 320)})`,
        });
      }
    }
    return arr;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} roughness={0.8} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function TronGrid() {
  const gridRef = useRef<THREE.Group>(null);

  const lines = useMemo(() => {
    const arr: THREE.Vector3[][] = [];
    const size = 2;
    const step = 0.2;
    for (let i = -size; i <= size; i += step) {
      arr.push([new THREE.Vector3(i, 0.001, -size), new THREE.Vector3(i, 0.001, size)]);
      arr.push([new THREE.Vector3(-size, 0.001, i), new THREE.Vector3(size, 0.001, i)]);
    }
    return arr;
  }, []);

  return (
    <group ref={gridRef}>
      {lines.map((pts, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return <lineSegments key={i} geometry={geo}>
          <lineBasicMaterial color="#00F3FF" transparent opacity={0.08} />
        </lineSegments>;
      })}
    </group>
  );
}

function RainSystem({ active }: { active: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 500;

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 1] = Math.random() * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
      vel[i] = 2 + Math.random() * 3;
    }
    return [pos, vel];
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !active) return;
    const pos = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      let y = pos.getY(i) - velocities[i] * delta;
      if (y < 0) {
        y = 2.5 + Math.random();
        pos.setX(i, (Math.random() - 0.5) * 4);
        pos.setZ(i, (Math.random() - 0.5) * 4);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#00F3FF" size={0.02} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function WaterPlane({ level, color }: { level: number; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const targetY = level * 0.8;
    meshRef.current.position.y = THREE.MathUtils.damp(meshRef.current.position.y, targetY, 3, 0.016);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[4, 4]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.35 + level * 0.3}
        emissive={color}
        emissiveIntensity={0.2 + level * 0.4}
        roughness={0.1}
        metalness={0.8}
      />
    </mesh>
  );
}

export default function CityModel({ waterLevel, stormMode, riskColor: rc }: CityModelProps) {
  return (
    <group>
      <TronGrid />
      <Buildings />
      <WaterPlane level={waterLevel} color={rc} />
      <RainSystem active={stormMode} />
    </group>
  );
}
