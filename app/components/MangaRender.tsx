"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import type { OrbitControls as Controls } from 'three-stdlib';
import * as THREE from 'three';
import metadata from '@/public/models/manga/v6.1/metadata.json';
import './MangaRender.css';
import { ArrowLeft, CloudRain, Compass, Layers3, Map as MapIcon, Mountain, Moon, Search, Siren, Sun, Trees, Building2, Sparkles, X } from 'lucide-react';
import type { MangaMapProps } from './MangaMap';
import { ZONAS_MANGA } from '@/app/lib/zonasManga';
import { zoneLocal } from '@/app/lib/manga/adapter';
import { RainWeather } from './MangaRain';
import MangaFlood from './MangaFlood';
import MangaTerrain from './MangaTerrain';
import MangaBuildings from './MangaBuildings';
import MangaCemetery from './MangaCemetery';
import MangaRoads from './MangaRoads';
import { useMangaDem, useGroundSampler, useRoadMask, useRoadSnapper } from '@/app/lib/manga/ground';
import { useMangaWeather, WeatherPanel } from './MangaWeatherPanel';
import MangaPort, { AnimatedSea } from './MangaPort';
import { insidePortYard } from '@/app/lib/manga/portLayout';
import type { MangaData } from '@/app/lib/manga/types';
import { MANGA_POIS, type MangaPoi } from '@/app/lib/manga/poi';

type View = 'district' | 'zone' | 'top';
type Sample = { fps: number; calls: number; triangles: number };
const landmarks = metadata.landmarks;
type Place = {name:string;detail:string;description:string;position:[number,number,number];zone:typeof ZONAS_MANGA[number]|null;source:string;poi?:MangaPoi};
const locations:Place[] = [...ZONAS_MANGA.map(z=>({name:z.nombre,detail:z.ubicacion,description:z.descripcion,position:[...zoneLocal(...z.coordenadas),0] as [number,number,number],zone:z,source:`https://www.google.com/maps/search/?api=1&query=${z.coordenadas.join(',')}`})),
  ...landmarks.map(m=>({name:m.name,detail:'Lugar emblemático',description:'Lugar registrado en la cartografía del modelo.',position:m.position as [number,number,number],zone:null,source:m.source})),
  ...MANGA_POIS.map(p=>({name:p.name,detail:p.address,description:p.description,position:[...zoneLocal(p.latitude,p.longitude),0] as [number,number,number],zone:null,source:p.source,poi:p})),
  {name:'Sociedad Portuaria de Cartagena',detail:'Terminal de Manga',description:'Patios de contenedores, grúas y muelles. Recreación conceptual basada en las referencias compartidas.',position:[500,-620,0],zone:null,source:'https://www.google.com/maps/search/?api=1&query=Sociedad+Portuaria+de+Cartagena'},
  {name:'Muelle de cruceros',detail:'Sociedad Portuaria',description:'Crucero a escala y muelle de pasajeros; representación conceptual.',position:[-65,-728,0],zone:null,source:'https://www.google.com/maps/search/?api=1&query=Sociedad+Portuaria+de+Cartagena'},
  {name:'Buque portacontenedores',detail:'Sociedad Portuaria',description:'Buque de carga y operación de contenedores; representación conceptual.',position:[651,-780,0],zone:null,source:'https://www.google.com/maps/search/?api=1&query=Sociedad+Portuaria+de+Cartagena'}];
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function City({ buildings, vegetation, quality, showDem, ground,roadMask,onReady }: { buildings: boolean; vegetation: boolean; quality: boolean; showDem: boolean; ground:ReturnType<typeof useGroundSampler>;roadMask:ReturnType<typeof useRoadMask>;onReady?:()=>void }) {
  const { scene } = useGLTF('/models/manga/v6.1/manga-v6.1.glb', '/models/manga/draco/');
  useEffect(()=>{onReady?.();},[onReady]);
  const local = useMemo(() => {
    const copy=scene.clone(true);
    copy.updateMatrixWorld(true);
    // The source bakes trees and old generic buildings into shared tiles.
    // Clear only the operating yard; residential streets outside it remain.
    copy.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||!['Vegetation','Buildings','Details'].includes(o.userData.category))return;
      // Each exported GLB object is a 300 m material/tile batch, not one house.
      // Move the intact batch to its local ground datum; per-vertex clamping
      // distorted roofs and trees and made them look torn through the earth.
      if(showDem&&ground&&o.userData.category==='Vegetation'){
        const bounds=new THREE.Box3().setFromObject(o),center=bounds.getCenter(new THREE.Vector3());
        const datum=ground(center.x,-center.z);
        if(datum!=null)o.position.y+=datum+.28;
      }
      let geometry=o.geometry as THREE.BufferGeometry;
      const position=geometry.getAttribute('position');
      const indices=geometry.getIndex();
      if(!position)return;
      const keep:number[]=[];
      const count=indices?indices.count:position.count;
      const point=new THREE.Vector3();
      for(let i=0;i+2<count;i+=3){
        let x=0,y=0;
        for(let j=0;j<3;j++){
          const vertex=indices?indices.getX(i+j):i+j;
          point.fromBufferAttribute(position,vertex).applyMatrix4(o.matrixWorld);
          x+=point.x;y-=point.z;
        }
        const cx=x/3,cy=y/3;
        const onStreet=o.userData.category==='Vegetation'&&roadMask?.(cx,cy);
        if(!insidePortYard(cx,cy)&&!onStreet){
          keep.push(indices?indices.getX(i):i,indices?indices.getX(i+1):i+1,indices?indices.getX(i+2):i+2);
        }
      }
      if(keep.length<count){
        const filtered=geometry.clone();filtered.setIndex(keep);
        o.geometry=filtered;o.userData.portFilteredGeometry=true;
      }
    });
    return copy;
  }, [scene,showDem,ground,roadMask]);
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
      if (o.userData.category === 'Sea') o.visible = false;
      if (o.userData.category === 'Terrain') o.visible = !showDem;
      if (o.userData.category === 'Buildings') o.visible = buildings&&!showDem;
      if (o.userData.category === 'Details') o.visible = buildings&&!showDem;
      if (o.userData.category === 'Vegetation') o.visible = vegetation;
    });
  }, [local, buildings, vegetation, showDem]);
  useEffect(()=>()=>{local.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.portFilteredGeometry)o.geometry.dispose();});},[local]);
  useFrame(({ camera }) => {
    for (const item of detail) item.mesh.visible = buildings && !showDem && camera.position.distanceToSquared(item.center) < (quality ? 1000 : 500) ** 2;
  });
  return <primitive object={local} dispose={null} />;
}

function Navigation({ view, selected, revision, onSample, roadSnapper }: { view: View; selected: number; revision: number; onSample: (s: Sample) => void; roadSnapper: ReturnType<typeof useRoadSnapper> }) {
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
      const snapped=mark.zone&&roadSnapper?roadSnapper(mark.position[0],mark.position[1],25):null;
      target = new THREE.Vector3(snapped?.x??mark.position[0], 0, -(snapped?.y??mark.position[1]));
      offset = new THREE.Vector3(90, 150, -160).multiplyScalar(fit);
    }
    if (view === 'top') offset = new THREE.Vector3(0, 3100 * fit, .01);
    controls.current.target.copy(target);camera.position.copy(target).add(offset);controls.current.update();
  }, [camera, view, selected, revision, size.width, size.height, roadSnapper]);
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
  const dem=useMangaDem(),ground=useGroundSampler(dem),roadMask=useRoadMask(dem),roadSnapper=useRoadSnapper(dem);
  const surfaceData=useMemo<MangaData|null>(()=>weather.data&&dem?.roads?.length?{...weather.data,roads:dem.roads.map((road,i)=>({id:`surface-${i}`,name:'Red vial continua',triangles:road.triangles as MangaData['roads'][number]['triangles']}))}:weather.data,[weather.data,dem]);
  const [searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState('');
  const results=locations.map((l,index)=>({...l,index})).filter(l=>normalize(l.name+' '+l.detail).includes(normalize(query)));
  const [view, setView] = useState<View>('district');
  const [selected, setSelected] = useState(0), [revision, setRevision] = useState(0);
  const [buildings, setBuildings] = useState(true), [vegetation, setVegetation] = useState(true);
  const [showDem, setShowDem] = useState(true);
  const rainGround=useMemo(()=>showDem?ground:()=>0,[showDem,ground]);
  const [sunset, setSunset] = useState(false), [quality, setQuality] = useState(false);
  const emergency=!!props.standalone&&weather.manual==='Critico';
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
  function focusPoi(poi:MangaPoi) { const index=locations.findIndex(place=>place.poi?.id===poi.id);if(index<0)return;focus('zone',index);props.onSelectZona?.(null); }
  function startEmergency(){weather.setManual('Critico');weather.setDuration(6);weather.setManualTime(2);weather.setPlaying(true);focus('district');}
  function endEmergency(){weather.setPlaying(false);weather.setManual(null);weather.setManualTime(0);focus('district');}
  return <section className={`manga6${props.standalone?' manga6--standalone':''}${emergency?' manga6--emergency':''}`} ref={container} aria-label="Manga: modelo 3D con sociedad portuaria">
    <RenderBoundary>
      <Canvas frameloop={visible ? 'always' : 'never'} shadows={quality} dpr={[1, 1.5]} camera={{ position: [1700, 2100, 2100], fov: 43, near: 2, far: 15000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={[weather.rate>10 ? '#718995' : sunset ? '#e0bfa4' : '#bad4d7']} />
        <hemisphereLight args={[sunset ? '#ffd4a5' : '#eef7ff', '#6e7961', 1.6]} />
        <directionalLight position={sunset ? [-900, 550, 800] : [700, 1600, -600]} intensity={weather.rate>10 ? .9 : sunset ? 2.4 : 2.1} color={sunset ? '#ffc58f' : '#fff4db'} castShadow={quality}
          shadow-mapSize={[2048, 2048]} shadow-camera-left={-1400} shadow-camera-right={1400} shadow-camera-top={1400} shadow-camera-bottom={-1400} shadow-camera-far={5000} shadow-bias={-.0002} />
        <AnimatedSea storm={weather.rate} sunset={sunset} reduced={weather.reduced} boundary={weather.data?.boundary} />
        <Suspense fallback={null}><City buildings={buildings} vegetation={vegetation} quality={quality} showDem={showDem} ground={ground} roadMask={roadMask} onReady={props.onReady} /></Suspense>
        <MangaTerrain visible={showDem} dem={dem} ground={ground} />
        <MangaRoads dem={dem} visible={showDem} />
        <MangaPort structures={buildings} ground={ground} />
        <Navigation view={view} selected={selected} revision={revision} onSample={setSample} roadSnapper={roadSnapper} />
        {surfaceData&&<><MangaBuildings buildings={surfaceData.buildings} ground={ground} visible={showDem&&buildings} pois={MANGA_POIS} onSelectPoi={id=>{const poi=MANGA_POIS.find(p=>p.id===id);if(poi)focusPoi(poi);}}/><MangaCemetery polygon={metadata.cemeteryPolygon} ground={ground} visible={showDem&&buildings}/><RainWeather data={surfaceData} intensity={weather.rate} wind={weather.wind} direction={weather.direction} quality={quality?'high':'balanced'} moving={!!props.isPlaying||weather.playing} reduced={weather.reduced} ground={rainGround} depths={weather.depths} roadSnapper={roadSnapper}/><MangaFlood grid={weather.simulationGrid} result={weather.waterResult} showDem={showDem}/></>}
      </Canvas>
    </RenderBoundary>
    <Progress />
    {props.standalone&&<a className="manga6-back" href="/"><ArrowLeft size={18}/><span>Volver al sitio</span></a>}
    <header className="manga6-heading"><span>CARTAGENA DE INDIAS · V6.1 + PUERTO</span><h3>Manga</h3><p>Monitoreo de lluvia e inundaciones</p></header>
    <div className="manga6-actions">
      <button aria-label="Buscar ubicación" aria-expanded={searchOpen} onClick={()=>setSearchOpen(v=>!v)}><Search size={18}/><span>Buscar</span></button>
      <button onClick={() => setSunset(v => !v)} aria-pressed={sunset}>{sunset?<Moon size={18}/>:<Sun size={18}/>}<span>{sunset ? 'Atardecer' : 'Luz de día'}</span></button>
      <details className="manga6-layer-menu"><summary><Layers3 size={18}/><span>Capas</span></summary><div>
        <div className="manga6-layer-title"><strong>Capas del mapa</strong><small>Personaliza la vista 3D</small></div>
        <label><Mountain size={19}/><span><b>Relieve</b><small>Elevación y pendiente DEM</small></span><input type="checkbox" checked={showDem} onChange={e => setShowDem(e.target.checked)} /></label>
        <label><Building2 size={19}/><span><b>Edificaciones</b><small>Casas y estructuras</small></span><input type="checkbox" checked={buildings} onChange={e => setBuildings(e.target.checked)} /></label>
        <label><Trees size={19}/><span><b>Vegetación</b><small>Árboles y zonas verdes</small></span><input type="checkbox" checked={vegetation} onChange={e => setVegetation(e.target.checked)} /></label>
        <label><Sparkles size={19}/><span><b>Detalle visual</b><small>Sombras de mayor calidad</small></span><input type="checkbox" checked={quality} onChange={e => setQuality(e.target.checked)} /></label>
        <div className="manga6-layer-foot"><span>{sample ? `${sample.fps} FPS · ${sample.triangles.toLocaleString('es-CO')} triángulos` : 'Preparando geometría…'}</span><a href="/models/manga/v6.1/manga-v6.1.glb" download>Descargar modelo ↗</a></div>
      </div></details>
    </div>
    {props.standalone&&<>
      <div className="manga6-quickbar" aria-label="Controles rápidos del mapa">
        <button type="button" aria-label="Ver toda Manga" aria-pressed={view==='district'} onClick={()=>focus('district')} title="Vista general"><Compass size={21}/><span>General</span></button>
        <button type="button" aria-label="Vista desde arriba" aria-pressed={view==='top'} onClick={()=>focus('top')} title="Vista superior"><MapIcon size={21}/><span>Superior</span></button>
        <button type="button" className="manga6-emergency-button" aria-label={emergency?'Detener simulación de emergencia':'Iniciar simulación de emergencia'} aria-pressed={emergency} onClick={emergency?endEmergency:startEmergency} title="Simular emergencia"><Siren size={23}/><span>{emergency?'Detener':'Emergencia'}</span></button>
      </div>
      <div className="manga6-map-hint"><CloudRain size={15}/><span>Arrastra para explorar · acerca para ver las calles</span></div>
      {emergency&&<aside className="manga6-emergency-card" role="status" aria-label="Simulación de emergencia activa">
        <div className="manga6-emergency-card__top"><Siren size={22}/><span>SIMULACIÓN EXTREMA</span><button type="button" onClick={endEmergency} aria-label="Cerrar simulación"><X size={18}/></button></div>
        <strong>Tormenta sobre Manga</strong>
        <p>Tormenta intensa durante {weather.duration} h y drenaje posterior. El agua se calcula sobre el relieve del modelo.</p>
        <div className="manga6-emergency-card__stats"><span><b>{weather.manualTime.toFixed(1)} h</b> tiempo simulado</span><span><b>{weather.waterResult?(weather.waterResult.maxDepthM*100).toFixed(0):'…'} cm</b> profundidad máxima</span></div>
        <small>Escenario exploratorio · no es una alerta real</small>
      </aside>}
    </>}
    {searchOpen&&<aside className="manga6-search" aria-label="Buscar zonas críticas y lugares">
      <div><Search size={18}/><input autoFocus aria-label="Nombre o sector" placeholder="Buscar en Manga…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);}}/><button aria-label="Cerrar búsqueda" onClick={()=>setSearchOpen(false)}><X size={16}/></button></div>
      <p>20 zonas críticas · {landmarks.length+MANGA_POIS.length} lugares emblemáticos · terminal portuaria</p>
      <ul>{results.map(l=><li key={l.index}><button onClick={()=>{focus('zone',l.index);props.onSelectZona?.(l.zone);setSearchOpen(false);}}><strong>{l.name}</strong><span>{l.detail}</span></button></li>)}</ul>
      {!results.length&&<p>No se encontraron ubicaciones.</p>}
    </aside>}
    {view==='zone'&&!searchOpen&&<aside className="manga6-place"><button aria-label="Cerrar lugar" onClick={()=>{focus('district');props.onSelectZona?.(null);}}><X size={16}/></button><strong>{locations[selected].name}</strong><p>{locations[selected].description}</p>{locations[selected].poi&&<p><b>{locations[selected].poi.category}</b><br/>{locations[selected].poi.address}</p>}{locations[selected].zone&&<><p>Agua estimada: {(weather.depths[selected]*100).toFixed(1)} cm</p>{roadSnapper&&!roadSnapper(locations[selected].position[0],locations[selected].position[1],25)&&<p>Fuera de la red de calles modelada; el agua no se dibuja en esta ubicación.</p>}</> }<a href={locations[selected].source} target="_blank" rel="noreferrer">Consultar ubicación ↗</a></aside>}
    <WeatherPanel weather={weather} source={props.sourceLabel} hour={props.currentHour} standalone={props.standalone}/>
    <nav className="manga6-views" aria-label="Vistas del barrio">
      {([['district', 'Toda Manga'], ['top', 'Vista desde arriba']] as const).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => focus(key)}>{label}</button>)}
    </nav>
    <footer className="manga6-footer"><span>Escorrentía 2D por DEM · almacenamiento e infiltración exploratorios</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></footer>
  </section>;
}
