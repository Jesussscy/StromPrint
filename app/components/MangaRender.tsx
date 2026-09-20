"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import type { OrbitControls as Controls } from 'three-stdlib';
import * as THREE from 'three';
import metadata from '@/public/models/manga/v6.1/metadata.json';
import './MangaRender.css';

type View = 'district' | 'cemetery' | 'top' | 'street';
type Sample = { fps: number; calls: number; triangles: number };
const landmarks = metadata.landmarks;

function City({ buildings, vegetation, quality }: { buildings: boolean; vegetation: boolean; quality: boolean }) {
  const { scene } = useGLTF('/models/manga/v6.1/manga-v6.1.glb', '/models/manga/draco/');
  const local = useMemo(() => scene.clone(true), [scene]);
  const detail = useMemo(() => {
    const items: { mesh: THREE.Mesh; center: THREE.Vector3 }[] = [];
    local.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = !['Sea', 'Terrain', 'Roads'].includes(o.userData.category);
      o.receiveShadow = o.userData.category !== 'Sea';
      if (o.userData.category === 'Details') items.push({ mesh: o, center: new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()) });
    });
    return items;
  }, [local]);
  useEffect(() => {
    local.traverse(o => {
      if (o.userData.category === 'Buildings') o.visible = buildings;
      if (o.userData.category === 'Vegetation') o.visible = vegetation;
    });
  }, [local, buildings, vegetation]);
  useFrame(({ camera }) => {
    for (const item of detail) item.mesh.visible = buildings && camera.position.distanceToSquared(item.center) < (quality ? 1000 : 500) ** 2;
  });
  return <primitive object={local} dispose={null} />;
}

function Navigation({ view, selected, revision, onSample }: { view: View; selected: number; revision: number; onSample: (s: Sample) => void }) {
  const controls = useRef<Controls>(null);
  const { camera, size } = useThree();
  const timer = useRef(0), frames = useRef(0);
  useEffect(() => {
    if (!controls.current) return;
    const fit = Math.max(1, 1.15 / (size.width / size.height));
    const mark = landmarks[selected];
    let target = new THREE.Vector3(0, 0, -50);
    let offset = new THREE.Vector3(1275, 1575, 1575).multiplyScalar(fit);
    if (view === 'cemetery' || selected !== 0) {
      target = new THREE.Vector3(mark.position[0], 0, -mark.position[1]);
      offset = new THREE.Vector3(90, 150, -160).multiplyScalar(fit);
    }
    if (view === 'top') offset = new THREE.Vector3(0, 3100 * fit, .01);
    if (view === 'street') {
      target = new THREE.Vector3(metadata.entry[0], 5, -metadata.entry[1]);
      offset = new THREE.Vector3(metadata.entryApproach[0] - metadata.entry[0], metadata.entryApproach[2] - 5, -metadata.entryApproach[1] + metadata.entry[1]).multiplyScalar(fit);
    }
    controls.current.target.copy(target);camera.position.copy(target).add(offset);controls.current.update();
  }, [camera, view, selected, revision, size.width, size.height]);
  useFrame(({ gl }, dt) => {
    timer.current += dt;frames.current++;
    if (timer.current >= 1) {
      onSample({ fps: Math.round(frames.current / timer.current), calls: gl.info.render.calls, triangles: gl.info.render.triangles });
      timer.current = 0;frames.current = 0;
    }
  });
  return <OrbitControls ref={controls} makeDefault enableDamping minDistance={12} maxDistance={8500} maxPolarAngle={Math.PI / 2.04} />;
}

function Progress() {
  const { active, progress } = useProgress();
  return active ? <div className="manga6-loading" role="status">Preparando Manga · {Math.round(progress)} %</div> : null;
}

class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="manga6-error" role="alert">No se pudo cargar Manga. <button onClick={() => window.location.reload()}>Reintentar</button></div> : this.props.children; }
}

export default function MangaRender() {
  const [view, setView] = useState<View>('district');
  const [selected, setSelected] = useState(0), [revision, setRevision] = useState(0);
  const [buildings, setBuildings] = useState(true), [vegetation, setVegetation] = useState(true);
  const [sunset, setSunset] = useState(false), [quality, setQuality] = useState(false), [labels, setLabels] = useState(true);
  const [sample, setSample] = useState<Sample | null>(null);
  const [visible, setVisible] = useState(true);
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = container.current;if (!element) return;
    let intersects = true;
    const update = () => setVisible(intersects && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersects = entry.isIntersecting;update(); });
    observer.observe(element);document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect();document.removeEventListener('visibilitychange', update); };
  }, []);
  function focus(next: View, index = 0) { setView(next);setSelected(index);setRevision(r => r + 1); }
  return <section className="manga6" ref={container} aria-label="Manga: nuevo modelo 3D, versión 6.1">
    <RenderBoundary>
      <Canvas frameloop={visible ? 'always' : 'never'} shadows={quality} dpr={[1, 1.5]} camera={{ position: [1700, 2100, 2100], fov: 43, near: .5, far: 15000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={[sunset ? '#e0bfa4' : '#bad4d7']} />
        <hemisphereLight args={[sunset ? '#ffd4a5' : '#eef7ff', '#6e7961', 1.6]} />
        <directionalLight position={sunset ? [-900, 550, 800] : [700, 1600, -600]} intensity={sunset ? 2.4 : 2.1} color={sunset ? '#ffc58f' : '#fff4db'} castShadow={quality}
          shadow-mapSize={[2048, 2048]} shadow-camera-left={-1400} shadow-camera-right={1400} shadow-camera-top={1400} shadow-camera-bottom={-1400} shadow-camera-far={5000} shadow-bias={-.0002} />
        <Suspense fallback={null}><City buildings={buildings} vegetation={vegetation} quality={quality} /></Suspense>
        <Navigation view={view} selected={selected} revision={revision} onSample={setSample} />
        {labels && landmarks.map((mark, index) => <group key={mark.name} position={[mark.position[0], 18, -mark.position[1]]}>
          <mesh><sphereGeometry args={[1.2, 8, 6]} /><meshBasicMaterial color="#f9d48a" /></mesh>
          <Html center position={[0, 10, 0]} zIndexRange={[10, 0]}><button aria-label={mark.name} title={mark.name} className={`manga6-marker ${view !== "district" && selected === index ? "expanded" : ""}`} onClick={() => focus('cemetery', index)}>{index + 1}<span>{mark.name}</span></button></Html>
        </group>)}
      </Canvas>
    </RenderBoundary>
    <Progress />
    <header className="manga6-heading"><span>CARTAGENA DE INDIAS · V6.1</span><h3>Manga</h3><p>Arquitectura y memoria del barrio</p></header>
    <div className="manga6-actions">
      <button onClick={() => setSunset(v => !v)} aria-pressed={sunset}>{sunset ? 'Atardecer' : 'Luz de día'}</button>
      <details><summary>Capas y calidad</summary><div>
        <label><input type="checkbox" checked={buildings} onChange={e => setBuildings(e.target.checked)} />Casas y edificios</label>
        <label><input type="checkbox" checked={vegetation} onChange={e => setVegetation(e.target.checked)} />Vegetación</label>
        <label><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} />Lugares emblemáticos</label>
        <label><input type="checkbox" checked={quality} onChange={e => setQuality(e.target.checked)} />Sombras y más detalle</label>
        <p>{sample ? `${sample.fps} FPS · ${sample.calls} llamadas · ${sample.triangles.toLocaleString('es-CO')} triángulos` : 'Cargando geometría…'}</p>
        <a href="/models/manga/v6.1/manga-v6.1.glb" download>Descargar modelo 6.1</a>
      </div></details>
    </div>
    <nav className="manga6-views" aria-label="Vistas del barrio">
      {([['district', 'Toda Manga'], ['cemetery', 'Cementerio'], ['street', 'Entrada'], ['top', 'Desde arriba']] as const).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => focus(key)}>{label}</button>)}
    </nav>
    <footer className="manga6-footer"><span>Render conceptual · geometría nueva, sin simulación hidráulica</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></footer>
  </section>;
}
