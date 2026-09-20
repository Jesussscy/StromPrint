"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import type { OrbitControls as Controls } from 'three-stdlib';
import * as THREE from 'three';
import metadata from '@/public/models/manga/v6.1/metadata.json';
import './MangaRender.css';
import { Search, X } from 'lucide-react';
import type { MangaMapProps } from './MangaMap';
import { ZONAS_MANGA } from '@/app/lib/zonasManga';
import { zoneLocal } from '@/app/lib/manga/adapter';
import { RainWeather } from './MangaRain';
import MangaFlood from './MangaFlood';
import { useMangaWeather, WeatherPanel } from './MangaWeatherPanel';

type View = 'district' | 'zone' | 'top';
type Sample = { fps: number; calls: number; triangles: number };
const landmarks = metadata.landmarks;
const locations = [...ZONAS_MANGA.map(z=>({name:z.nombre,detail:z.ubicacion,description:z.descripcion,position:zoneLocal(...z.coordenadas),zone:z,source:`https://www.google.com/maps/search/?api=1&query=${z.coordenadas.join(',')}`})),
  ...landmarks.map(m=>({name:m.name,detail:'Lugar emblemático',description:'Lugar registrado en la cartografía del modelo.',position:m.position,zone:null,source:m.source}))];
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

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
    const mark = locations[selected];
    let target = new THREE.Vector3(0, 0, -50);
    let offset = new THREE.Vector3(1275, 1575, 1575).multiplyScalar(fit);
    if (view === 'zone') {
      target = new THREE.Vector3(mark.position[0], 0, -mark.position[1]);
      offset = new THREE.Vector3(90, 150, -160).multiplyScalar(fit);
    }
    if (view === 'top') offset = new THREE.Vector3(0, 3100 * fit, .01);
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

export default function MangaRender(props: MangaMapProps) {
  const weather=useMangaWeather(props);
  const [searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState('');
  const results=locations.map((l,index)=>({...l,index})).filter(l=>normalize(l.name+' '+l.detail).includes(normalize(query)));
  const [view, setView] = useState<View>('district');
  const [selected, setSelected] = useState(0), [revision, setRevision] = useState(0);
  const [buildings, setBuildings] = useState(true), [vegetation, setVegetation] = useState(true);
  const [sunset, setSunset] = useState(false), [quality, setQuality] = useState(false);
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
  useEffect(()=>{if(props.focusZonaId!=null){const i=locations.findIndex(l=>l.zone?.id===props.focusZonaId);if(i>=0){setSelected(i);setView('zone');setRevision(r=>r+1);}}},[props.focusZonaId]);
  function focus(next: View, index = 0) { setView(next);setSelected(index);setRevision(r => r + 1); }
  return <section className="manga6" ref={container} aria-label="Manga: nuevo modelo 3D, versión 6.1">
    <RenderBoundary>
      <Canvas frameloop={visible ? 'always' : 'never'} shadows={quality} dpr={[1, 1.5]} camera={{ position: [1700, 2100, 2100], fov: 43, near: .5, far: 15000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={[weather.rate>10 ? '#718995' : sunset ? '#e0bfa4' : '#bad4d7']} />
        <hemisphereLight args={[sunset ? '#ffd4a5' : '#eef7ff', '#6e7961', 1.6]} />
        <directionalLight position={sunset ? [-900, 550, 800] : [700, 1600, -600]} intensity={weather.rate>10 ? .9 : sunset ? 2.4 : 2.1} color={sunset ? '#ffc58f' : '#fff4db'} castShadow={quality}
          shadow-mapSize={[2048, 2048]} shadow-camera-left={-1400} shadow-camera-right={1400} shadow-camera-top={1400} shadow-camera-bottom={-1400} shadow-camera-far={5000} shadow-bias={-.0002} />
        <Suspense fallback={null}><City buildings={buildings} vegetation={vegetation} quality={quality} /></Suspense>
        <Navigation view={view} selected={selected} revision={revision} onSample={setSample} />
        {weather.data&&<><RainWeather data={weather.data} intensity={weather.rate} wind={weather.wind} direction={weather.direction} quality={quality?'high':'balanced'} moving={!!props.isPlaying} reduced={weather.reduced}/><MangaFlood data={weather.data} depths={weather.depths} rain={weather.rate}/></>}
      </Canvas>
    </RenderBoundary>
    <Progress />
    <header className="manga6-heading"><span>CARTAGENA DE INDIAS · V6.1</span><h3>Manga</h3><p>Monitoreo de lluvia e inundaciones</p></header>
    <div className="manga6-actions">
      <button aria-label="Buscar ubicación" aria-expanded={searchOpen} onClick={()=>setSearchOpen(v=>!v)}><Search size={18}/></button>
      <button onClick={() => setSunset(v => !v)} aria-pressed={sunset}>{sunset ? 'Atardecer' : 'Luz de día'}</button>
      <details><summary>Capas y calidad</summary><div>
        <label><input type="checkbox" checked={buildings} onChange={e => setBuildings(e.target.checked)} />Casas y edificios</label>
        <label><input type="checkbox" checked={vegetation} onChange={e => setVegetation(e.target.checked)} />Vegetación</label>

        <label><input type="checkbox" checked={quality} onChange={e => setQuality(e.target.checked)} />Sombras y más detalle</label>
        <p>{sample ? `${sample.fps} FPS · ${sample.calls} llamadas · ${sample.triangles.toLocaleString('es-CO')} triángulos` : 'Cargando geometría…'}</p>
        <a href="/models/manga/v6.1/manga-v6.1.glb" download>Descargar modelo 6.1</a>
      </div></details>
    </div>
    {searchOpen&&<aside className="manga6-search" aria-label="Buscar zonas críticas y lugares">
      <div><Search size={18}/><input autoFocus aria-label="Nombre o sector" placeholder="Buscar en Manga…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);}}/><button aria-label="Cerrar búsqueda" onClick={()=>setSearchOpen(false)}><X size={16}/></button></div>
      <p>20 zonas críticas · {landmarks.length} lugares emblemáticos</p>
      <ul>{results.map(l=><li key={l.index}><button onClick={()=>{focus('zone',l.index);props.onSelectZona?.(l.zone);setSearchOpen(false);}}><strong>{l.name}</strong><span>{l.detail}</span></button></li>)}</ul>
      {!results.length&&<p>No se encontraron ubicaciones.</p>}
    </aside>}
    {view==='zone'&&!searchOpen&&<aside className="manga6-place"><button aria-label="Cerrar lugar" onClick={()=>{focus('district');props.onSelectZona?.(null);}}><X size={16}/></button><strong>{locations[selected].name}</strong><p>{locations[selected].description}</p>{locations[selected].zone&&<p>Agua estimada: {(weather.depths[selected]*100).toFixed(1)} cm</p>}<a href={locations[selected].source} target="_blank" rel="noreferrer">Consultar ubicación ↗</a></aside>}
    <WeatherPanel weather={weather} source={props.sourceLabel} hour={props.currentHour}/>
    <nav className="manga6-views" aria-label="Vistas del barrio">
      {([['district', 'Toda Manga'], ['top', 'Vista desde arriba']] as const).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => focus(key)}>{label}</button>)}
    </nav>
    <footer className="manga6-footer"><span>Agua estimada por zona · relieve y drenaje pendientes de calibración</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></footer>
  </section>;
}
