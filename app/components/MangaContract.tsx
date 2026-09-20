"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import type { GLTFLoader, OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import metadata from '@/public/models/manga/contract/metadata.json';

type Metrics = { fps: number; triangles: number; calls: number; waterM: number };
type Focus = { position: number[] } | null;

function embeddedAtlasLoader(loader: GLTFLoader) {
  // ImageBitmapLoader fetches blob: under connect-src. TextureLoader uses the
  // existing img-src blob: permission; keep the atlas embedded and CSP intact.
  loader.register(parser => ({
    name: 'STORMPRINT_embedded_atlas',
    beforeRoot: async () => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager)
        .setCrossOrigin(parser.options.crossOrigin);
    },
  }));
}

function CameraAndMetrics({ focus, heightAtTime, onMetrics }: {
  focus: Focus; heightAtTime: (seconds: number) => number; onMetrics: (sample: Metrics) => void;
}) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const elapsed = useRef(0), frames = useRef(0);
  useEffect(() => {
    if (!controls.current) return;
    if (focus) {
      const [e, n, h] = focus.position;
      controls.current.target.set(e, h, -n);
      const aspectScale = Math.max(1, size.height / size.width);
      camera.position.set(e + 180 * aspectScale, h + 220 * aspectScale, -n + 240 * aspectScale);
    } else {
      controls.current.target.set(-350, 0, 150);
      const [x0, y0, x1, y1] = metadata.bounds;
      const radius = Math.hypot(x1-x0, y1-y0, 100) / 2;
      const halfFov = THREE.MathUtils.degToRad(45 / 2);
      const limitingAngle = Math.min(halfFov, Math.atan(Math.tan(halfFov) * size.width / size.height));
      const distance = radius / Math.sin(limitingAngle) * 1.08;
      camera.position.copy(new THREE.Vector3(2400, 2800, 3000).normalize()
        .multiplyScalar(distance).add(controls.current.target));
    }
    controls.current.update();
  }, [camera, focus, size.width, size.height]);
  useFrame(({ gl, clock }, delta) => {
    elapsed.current += delta; frames.current++;
    if (elapsed.current >= 1) {
      onMetrics({ fps: Math.round(frames.current / elapsed.current), triangles: gl.info.render.triangles,
        calls: gl.info.render.calls, waterM: heightAtTime(clock.elapsedTime) });
      elapsed.current = 0; frames.current = 0;
    }
  });
  return <OrbitControls ref={controls} minDistance={30} maxDistance={12000} maxPolarAngle={Math.PI / 2.02} />;
}

/** H(t): absolute hypothetical MSL metres. glTF is Y-up; never add EGM96 levels. */
export function MangaContractModel({ heightAtTime }: { heightAtTime: (seconds: number) => number }) {
  const gltf = useGLTF('/models/manga/contract/manga-contract.glb', false, false, embeddedAtlasLoader);
  // Clone transforms only; geometry/materials remain owned by useGLTF's cache.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const water = useMemo(() => {
    const node = scene.getObjectByName('WaterLevel_Animated');
    if (!(node instanceof THREE.Mesh)) throw new Error('GLB sin WaterLevel_Animated');
    if (!(node.material instanceof THREE.MeshStandardMaterial) || !node.material.normalMap)
      throw new Error('No se pudo cargar el atlas de normales');
    const terrain = scene.getObjectByName('Manga_Terrain_Base');
    if (!(terrain instanceof THREE.Mesh) || !(terrain.material instanceof THREE.MeshStandardMaterial) || !terrain.material.map)
      throw new Error('No se pudo cargar el atlas del terreno');
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
  const [focusName, setFocusName] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const { active, progress } = useProgress();
  const focus = metadata.landmarks.find(item => item.name === focusName) ?? null;
  const heightAtTime = (seconds: number) => level + (animate ? .25 * Math.sin(seconds / 4) : 0);
  return <main id="contenido" style={{ padding: 24, maxWidth: 1400, margin: 'auto' }}>
    <a href="/">← StormPrint</a>
    <h1 style={{ fontSize: 28, marginTop: 16 }}>Manga · modelo georreferenciado ligero</h1>
    <p>Puentes y Pastelillo siguen trazados OSM; sus alturas y detalles siguen siendo aproximados. Marina parcial.
      El terreno usa las cotas hipotéticas del encargo.
      Esta vista no ejecuta el solver hidráulico ni muestra una predicción de inundación.</p>
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '16px 0' }}>
      <label>H base: {level.toFixed(2)} m MSL hipotético{' '}
        <input aria-label="Nivel de agua hipotético en metros" type="range" min={-1} max={3} step={0.05}
          style={{ minHeight: 44 }} value={level} onChange={event => setLevel(Number(event.target.value))} />
      </label>
      <label><input type="checkbox" checked={animate} onChange={e => setAnimate(e.target.checked)} />
        {' '}Demostración H(t) = H base + 0,25 sen(t/4) m</label>
      <a href="/models/manga/contract/manga-contract.glb" download>Descargar GLB</a>
      <a href="/models/manga/contract/metadata.json">Georreferencia y procedencia</a>
      <label>Enfocar{' '}
        <select aria-label="Enfocar hito" style={{ color: '#102d35', backgroundColor: '#e6f0f2', minHeight: 44 }} value={focusName} onChange={e => setFocusName(e.target.value)}>
          <option value="">Toda Manga</option>
          {metadata.landmarks.map(item => <option key={item.name} value={item.name}>{item.name.replaceAll('_', ' ')}</option>)}
        </select>
      </label>
    </div>
    <p role="status">{active ? `Cargando modelo: ${Math.round(progress)} %` : metrics
      ? `${metrics.triangles.toLocaleString('es-CO')} triángulos visibles · ${metrics.calls} llamadas de dibujo · ${metrics.fps} FPS locales · H = ${metrics.waterM.toFixed(2)} m`
      : 'Preparando la escena 3D…'}</p>
    {focus && <aside style={{ padding: 12, border: '1px solid #55727b', marginBottom: 12 }}>
      <strong>{focus.name.replaceAll('_', ' ')}</strong>
      <p>{focus.lat.toFixed(6)}°, {focus.lon.toFixed(6)}° · cota supuesta {focus.position[2].toFixed(2)} m.</p>
      <p>Corrección horizontal respecto al encargo: {focus.horizontalCorrectionM.toFixed(1)} m.
        Planimetría OSM; dimensiones verticales sin levantamiento.</p>
      {focus.sourceUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" style={{ marginRight: 16 }}>Fuente OSM {index + 1}</a>)}
    </aside>}
    <ModelError>
      <div style={{ height: '65vh', minHeight: 360, background: '#19333c' }}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [2400, 2800, 3000], near: 1, far: 15000, fov: 45 }}>
          <color attach="background" args={['#19333c']} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[1500, 3000, 1000]} intensity={2.5} />
          <Suspense fallback={null}>
            <MangaContractModel heightAtTime={heightAtTime} />
          </Suspense>
          <CameraAndMetrics focus={focus} heightAtTime={heightAtTime} onMetrics={setMetrics} />
        </Canvas>
      </div>
    </ModelError>
    <p>1 unidad = 1 metro · UTM 18N · origen 10.4130° N, −75.5325° · +Y arriba.
      © OpenStreetMap contributors, <a href="https://www.openstreetmap.org/copyright">ODbL 1.0</a>.</p>
  </main>;
}
