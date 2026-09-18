"use client";

import { Component, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/** H(t): absolute hypothetical MSL metres. glTF is Y-up; never add EGM96 levels. */
export function MangaContractModel({ heightAtTime }: { heightAtTime: (seconds: number) => number }) {
  const gltf = useGLTF('/models/manga/contract/manga-contract.glb');
  // Clone transforms only; geometry/materials remain owned by useGLTF's cache.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const water = useMemo(() => {
    const node = scene.getObjectByName('WaterLevel_Animated');
    if (!(node instanceof THREE.Mesh)) throw new Error('GLB sin WaterLevel_Animated');
    return node;
  }, [scene]);
  useFrame(({ clock }) => {
    const height = heightAtTime(clock.elapsedTime);
    if (Number.isFinite(height)) water.position.y = height;
  });
  return <primitive object={scene} dispose={null} />;
}

class ModelError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p role="alert">No se pudo cargar el modelo 3D. Recarga la página o descarga el GLB.</p>
      : this.props.children;
  }
}

export default function MangaContractViewer() {
  const [level, setLevel] = useState(0);
  const [animate, setAnimate] = useState(false);
  return <main style={{ padding: 24, maxWidth: 1400, margin: 'auto' }}>
    <a href="/">← StormPrint</a>
    <h1 style={{ fontSize: 28, marginTop: 16 }}>Manga · modelo georreferenciado ligero</h1>
    <p>Terreno hipotético a partir de las cotas del encargo. Hitos esquemáticos con posiciones sin verificar.
      Esta vista no ejecuta el solver hidráulico ni muestra una predicción de inundación.</p>
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '16px 0' }}>
      <label>H base: {level.toFixed(2)} m MSL hipotético{' '}
        <input aria-label="Nivel de agua hipotético en metros" type="range" min={-1} max={3} step={0.05}
          value={level} onChange={event => setLevel(Number(event.target.value))} />
      </label>
      <label><input type="checkbox" checked={animate} onChange={e => setAnimate(e.target.checked)} />
        {' '}Demostración H(t) = H base + 0,25 sen(t/4) m</label>
      <a href="/models/manga/contract/manga-contract.glb" download>Descargar GLB</a>
      <a href="/models/manga/contract/metadata.json">Georreferencia y procedencia</a>
    </div>
    <ModelError>
      <div style={{ height: '65vh', minHeight: 360, background: '#19333c' }}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [2400, 2800, 3000], near: 1, far: 15000, fov: 45 }}>
          <color attach="background" args={['#19333c']} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[1500, 3000, 1000]} intensity={2.5} />
          <Suspense fallback={null}>
            <MangaContractModel heightAtTime={seconds => level + (animate ? .25 * Math.sin(seconds / 4) : 0)} />
          </Suspense>
          <OrbitControls target={[-350, 0, 150]} minDistance={50} maxDistance={6500} maxPolarAngle={Math.PI / 2.02} />
        </Canvas>
      </div>
    </ModelError>
    <p>1 unidad = 1 metro · UTM 18N · origen 10.4130° N, −75.5325° · +Y arriba.
      © OpenStreetMap contributors, <a href="https://www.openstreetmap.org/copyright">ODbL 1.0</a>.</p>
  </main>;
}
