"use client";
import "./MangaMap.css";

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Layers, Home, Compass, Play, Pause, RotateCcw, X, Droplets, Building2, Search, MapPin, Sun, Sunset, Waves, Focus, ChevronRight, LoaderCircle } from 'lucide-react';
import { ZONAS_MANGA, type ZonaManga, type ZonaViva } from '@/app/lib/zonasManga';
import type { MeteorologiaResumen, PuntoPrediccion, WaterStateResponse, SpatialForcing } from '@/app/lib/api';
import { apiScenario, insideBoundary, zoneLocal } from '@/app/lib/manga/adapter';
import type { Building, MangaData, Scenario, WaterResult } from '@/app/lib/manga/types';
import { District, RenderBudget, type RenderQuality, type LandscapeInstances } from './MangaScene';
import { waterSurface } from '@/app/lib/manga/waterSurface';
import { zoneCells, summarizeZones, waterColor } from '@/app/lib/manga/zones';
import { RainWeather } from './MangaRain';

interface Props {
  nivelAguaCm?: number; nivelMaximoCm?: number; zonasVivas?: Map<number,ZonaViva>;
  focusZonaId?: number|null; onSelectZona?: (zona:ZonaManga|null)=>void; horaLocal?: number;
  puntoMeteo?: {lluvia_mm_h?:number;marea_cm?:number}|null;
  meteorologia?: MeteorologiaResumen|null; liveWater?: WaterStateResponse|null; liveLatenciaMs?:number|null;
  forecastPoints?: PuntoPrediccion[]; currentHour?:number; sourceLabel?:string;
  spatialForcing?: SpatialForcing|null;
}
const PRESETS: Record<string,Scenario> = {
  'Lluvia intensa':{rainMmH:120,durationH:4,infiltrationMmH:2,drainageMmH:3,seaHeadM:null},
  'Suelo saturado':{rainMmH:80,durationH:6,infiltrationMmH:0,drainageMmH:3,seaHeadM:null},
  'Drenaje obstruido':{rainMmH:100,durationH:6,infiltrationMmH:1,drainageMmH:0,seaHeadM:null},
  'Marea hipotética':{rainMmH:0,durationH:6,infiltrationMmH:2,drainageMmH:3,seaHeadM:2},
  'Extremo combinado':{rainMmH:200,durationH:12,infiltrationMmH:0,drainageMmH:0,seaHeadM:3},
};
type LayersState={buildings:boolean;vegetation:boolean;water:boolean;rain:boolean;zones:boolean;flow:boolean};
type ViewKind='general'|'coast'|'urban'|'top';
type LightMode='day'|'sunset'|'night';
type CameraView={kind:ViewKind;revision:number};
interface BuildingVisual {
  name?:string|null; sourceUrl?:string; osmId?:number; buildingType?:string;
  visualHeightM?:number;visualHeightMethod?:string;visualHeightSourceUrl?:string;
  architectureProfile?:string;architectureConfidence?:string;architectureNote?:string;architectureSourceUrl?:string;
  address?:{street?:string;houseNumber?:string;houseName?:string;city?:string;postcode?:string;full?:string};
  confidence?:{footprint?:string;height?:string;facade?:string};
}
interface StreetCamera { name:string;position:[number,number,number];target:[number,number,number] }
interface VisualMetadata { buildings:Record<string,BuildingVisual>;streetCamera?:StreetCamera }
const VIEWS=[{kind:'general',label:'General',Icon:Home},{kind:'coast',label:'Costa',Icon:Waves},{kind:'urban',label:'Urbana',Icon:Building2},{kind:'top',label:'Superior',Icon:Compass}] as const;
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function buildingName(building:Building,visual?:BuildingVisual) { return visual?.name===null?'Edificio sin nombre':visual?.name||building.name||'Edificio sin nombre'; }
function buildingAddress(visual?:BuildingVisual) { const a=visual?.address;return a?.full||[a?.street,a?.houseNumber].filter(Boolean).join(' ')||a?.houseName||''; }
function visualBuilding(building:Building,visual?:BuildingVisual):Building {
  return visual?.visualHeightM!==undefined&&Number.isFinite(visual.visualHeightM)&&visual.visualHeightM>0&&visual.visualHeightM<500?{...building,height:visual.visualHeightM,heightMethod:visual.visualHeightMethod||'Altura visual derivada de referencia'}:building;
}
function buildingCenter(building:Building):[number,number,number] {
  const points=building.rings[0];let area=0,x=0,y=0;
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],cross=a[0]*b[1]-b[0]*a[1];area+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}
  return Math.abs(area)>1e-6?[x/(3*area),building.base+building.height*.5,-y/(3*area)]:[points[0][0],building.base+building.height*.5,-points[0][1]];
}
const INITIAL_CAMERA={position:[1450,1850,1850] as [number,number,number],fov:43,near:1,far:16000};

class GraphicsBoundary extends Component<{children:ReactNode;onRetry:()=>void},{error:boolean}> {
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<div className="manga-fallback">No se pudo abrir el modelo 3D. Revisa la aceleración gráfica.<button onClick={this.props.onRetry}>Reintentar visor</button></div>:this.props.children;}
}

function Model({data,layers,onBuilding,onEmpty,onReady}:{data:MangaData;layers:LayersState;onBuilding:(b:Building)=>void;onEmpty:()=>void;onReady:()=>void}) {
  const {scene}=useGLTF('/models/manga/manga.glb','/models/manga/draco/');
  const local=useMemo(()=>scene.clone(true),[scene]);
  const byId=useMemo(()=>new Map(data.buildings.map(b=>[b.id,b])),[data]);
  useEffect(()=>{onReady();},[local,onReady]);
  useEffect(()=>{local.traverse(o=>{
    if(o.name.startsWith('Manga_Edificios'))o.visible=layers.buildings;
    if(o.name.startsWith('Manga_Vegetacion'))o.visible=layers.vegetation;
    if(o instanceof THREE.Mesh){o.castShadow=o.name.startsWith('Manga_Edificios')||o.name.startsWith('Manga_Vegetacion');o.receiveShadow=true;}
  });},[local,layers.buildings,layers.vegetation]);
  function select(e:ThreeEvent<MouseEvent>){
    if(e.delta>4)return;
    e.stopPropagation();
    if(e.object.name.startsWith('Manga_Edificios')) {
      const direct=typeof e.object.userData.osm_id==='string'?byId.get(e.object.userData.osm_id):undefined;
      const b=direct??data.buildings.find(b=>insideBoundary(e.point.x,-e.point.z,b.rings[0])&&!b.rings.slice(1).some(r=>insideBoundary(e.point.x,-e.point.z,r)));
      if(b)onBuilding(b);
    } else onEmpty();
  }
  return <primitive object={local} onClick={select} />;
}

function Camera({view,focus,buildingFocus,data,reduced,street}:{view:CameraView;focus:number|null;buildingFocus:{building:Building;revision:number}|null;data:MangaData;reduced:boolean;street?:StreetCamera}) {
  const ref=useRef<OrbitControlsImpl>(null);
  const destination=useRef<{position:THREE.Vector3;target:THREE.Vector3}|null>(null);
  const {camera,size}=useThree();
  const move=useMemo(()=> (position:[number,number,number],target:[number,number,number])=>{
    if(reduced){camera.position.set(...position);ref.current?.target.set(...target);ref.current?.update();destination.current=null;}
    else destination.current={position:new THREE.Vector3(...position),target:new THREE.Vector3(...target)};
  },[camera,reduced]);
  useEffect(()=>{
    const aspect=size.width/size.height;
    const fit=Math.max(1,1.3/aspect);
    if(view.kind==='top')move([0,2800*fit,.1],[0,0,0]);
    else if(view.kind==='coast'){
      const coastal=data.buildings.find(b=>normalized(b.name).includes('club de pesca'));
      const [x,y,z]=coastal?buildingCenter(coastal):[-800,5,-300];
      move([x-250*fit,y+180*fit,z+350*fit],[x+90,y,z]);
    } else if(view.kind==='urban'){
      if(street){const p=street.position,q=street.target;move([p[0],p[2]+2.7,-p[1]],[q[0],q[2]+3.2,-q[1]]);return;}
      // Choose a real road triangle for the viewpoint, keeping the camera above its surface.
      const roads=data.roads.flatMap(r=>r.triangles).filter(t=>t.every(p=>Math.abs(p[0])<500&&Math.abs(p[1])<400));
      const t=roads[0]??data.roads.find(r=>r.triangles.length)?.triangles[0];
      if(t){const x=t.reduce((s,p)=>s+p[0],0)/3,y=t.reduce((s,p)=>s+p[2],0)/3,z=-t.reduce((s,p)=>s+p[1],0)/3;move([x,y+16*fit,z+8],[x+100,y+9,z-110]);}
    } else move([1450*fit,1850*fit,1850*fit],[0,0,0]);
  },[move,view,size.width,size.height,data,street]);
  useEffect(()=>{
    if(focus===null)return;const z=ZONAS_MANGA.find(z=>z.id===focus);if(!z)return;
    // Preserve legacy coordinates, including points outside the model coverage.
    // The UI flags their unverified location instead of silently ignoring taps.
    const [x,y]=zoneLocal(...z.coordenadas);
    // A zone selection is a destination, especially on a phone: keep it close
    // enough to identify streets instead of returning to the full district.
    const compact=size.width<768,reach=compact?150:350,altitude=compact?210:480;
    move([x+reach,altitude,-y+reach],[x,0,-y]);
  },[move,focus,data,size.width]);
  useEffect(()=>{
    if(!buildingFocus)return;
    const b=buildingFocus.building,[x,y,z]=buildingCenter(b),points=b.rings[0];
    const span=Math.max(...points.map(p=>Math.hypot(p[0]-x,-p[1]-z)))*2;
    const distance=Math.max(65,span*1.4,b.height*2.2)*Math.max(1,1/ (size.width/size.height));
    move([x+distance*.75,y+distance*.72,z+distance],[x,y,z]);
  },[move,buildingFocus,size.width,size.height]);
  useFrame((_,dt)=>{
    if(!destination.current||!ref.current)return;
    const {position,target}=destination.current,alpha=1-Math.exp(-Math.min(dt,.05)*5);
    camera.position.lerp(position,alpha);ref.current.target.lerp(target,alpha);ref.current.update();
    if(camera.position.distanceToSquared(position)<.03){camera.position.copy(position);ref.current.target.copy(target);ref.current.update();destination.current=null;}
  });
  // The street target follows an uphill road. Allow its slightly upward gaze;
  // the aerial limit otherwise raises the camera and prevents arrival.
  return <OrbitControls ref={ref} makeDefault minDistance={12} maxDistance={8000} maxPolarAngle={view.kind==='urban'?Math.PI*.53:Math.PI*.485} enableDamping={!reduced} dampingFactor={size.width<768?.14:.1} rotateSpeed={size.width<768?.72:1} zoomSpeed={size.width<768?.82:1} panSpeed={size.width<768?.8:1} onStart={()=>{destination.current=null;}} touches={{ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN}} />;
}

function Lighting({mode,lowResolution,layers,modelRevision}:{mode:LightMode;lowResolution:boolean;layers:LayersState;modelRevision:number}) {
  const light=useRef<THREE.DirectionalLight>(null);
  const sunset=mode==='sunset',night=mode==='night';
  useEffect(()=>{if(light.current)light.current.shadow.needsUpdate=true;},[mode,lowResolution,layers,modelRevision]);
  return <><color attach="background" args={[night?'#162c48':sunset?'#d6c4ac':'#b9dce9']}/><fog attach="fog" args={[night?'#162c48':sunset?'#d6c4ac':'#b9dce9',2600,9500]}/>
    <hemisphereLight args={[night?'#738bb6':sunset?'#ffecd5':'#e6f5ff',night?'#36435a':'#b0a78d',night?.7:1.3]}/>
    <directionalLight ref={light} position={sunset?[-1200,900,800]:[700,1800,500]} color={night?'#adc7ff':sunset?'#ffd1a0':'#fff8e9'} intensity={night?.45:sunset?2.2:2.0} castShadow={!lowResolution} shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-1800} shadow-camera-right={1800} shadow-camera-top={1500} shadow-camera-bottom={-1500} shadow-camera-near={1} shadow-camera-far={5500} shadow-bias={-.0003} shadow-normalBias={.12} shadow-autoUpdate={false}/>
  </>;
}

function SelectionOutline({building}:{building:Building}) {
  const geometry=useMemo(()=>{
    const positions:number[]=[];
    building.rings.forEach(r=>{for(let i=0;i<r.length-1;i++)positions.push(r[i][0],building.base+building.height+.7,-r[i][1],r[i+1][0],building.base+building.height+.7,-r[i+1][1]);});
    return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  },[building]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <lineSegments geometry={geometry} renderOrder={5}><lineBasicMaterial color="#ffef9f" transparent opacity={.98} depthTest={false}/></lineSegments>;
}

function ModelLoading() {
  const {active,progress}=useProgress();
  return active?<div className="manga-model-loading" role="status"><LoaderCircle size={16}/><span>Cargando el barrio <b>{Math.round(progress)}%</b></span></div>:null;
}

function Water({data,result,reduced,flow}:{data:MangaData;result:WaterResult|null;reduced:boolean;flow:boolean}) {
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},
    vertexShader:'attribute float depth; varying vec3 pos; varying float d; void main(){pos=position;d=depth;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float time; varying vec3 pos; varying float d;
      void main(){float wave=sin(pos.x*.65+time*1.1)*sin(pos.z*.73-time*.8);
        vec3 view=normalize(cameraPosition-pos);float fresnel=pow(1.-abs(view.y),3.);
        vec3 c=mix(vec3(.24,.34,.32),vec3(.055,.19,.24),clamp(d/.8,0.,1.));
        c=mix(c,vec3(.55,.70,.74),fresnel*.6)+wave*.018;
        float edge=smoothstep(0.,.018,d);gl_FragColor=vec4(c,mix(.18,.76,clamp(d/.18,0.,1.))*edge);}`
  }),[]);
  const geometry=useMemo(()=>{
    const {positions:p,depths:d}=waterSurface(data.grid,result);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('depth',new THREE.Float32BufferAttribute(d,1));return g;
  },[data,result]);
  const arrows=useMemo(()=>{
    const p:number[]=[];
    if(result)data.grid.cells.forEach((c,i)=>{
      if(i%4||result.depth[i]<.01)return;const x=result.flux[i*2],y=result.flux[i*2+1],len=Math.hypot(x,y);if(len<.0001)return;
      const dx=x/len*15,dz=-y/len*15,h=(result.levels?.[i]??c.z+result.depth[i])+2;
      const end=[c.x+dx,h,-c.y+dz];p.push(c.x,h,-c.y,...end,...end,end[0]-dx*.35-dz*.25,h,end[2]-dz*.35+dx*.25,...end,end[0]-dx*.35+dz*.25,h,end[2]-dz*.35-dx*.25);
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));return g;
  },[data,result]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>arrows.dispose(),[arrows]);useEffect(()=>()=>material.dispose(),[material]);
  useFrame((_,dt)=>{if(!reduced)material.uniforms.time.value+=dt;});
  return <group><mesh geometry={geometry} material={material} />{flow&&<lineSegments geometry={arrows}><lineBasicMaterial color="#c2fbef" transparent opacity={.65}/></lineSegments>}</group>;
}

function Metrics({onMetrics,onSlow,benchmark,onBenchmark}:{onMetrics:(fps:number,calls:number,triangles:number,memory:number)=>void;onSlow:()=>void;benchmark:number;onBenchmark:(s:string)=>void}) {
  const time=useRef(0),frames=useRef(0),slow=useRef(0);
  const {gl,scene,camera,get}=useThree();
  const moved=useRef(0);
  const sample=useRef<number[]>([]),duration=useRef(0),active=useRef(false),triangles=useRef<number[]>([]),calls=useRef<number[]>([]);
  useEffect(()=>{if(benchmark){sample.current=[];triangles.current=[];calls.current=[];duration.current=0;moved.current=0;active.current=true;}},[benchmark]);
  const memory=()=>{const arrays=new Set<ArrayBufferLike>();scene.traverse(o=>{if(o instanceof THREE.Mesh){for(const a of Object.values(o.geometry.attributes) as THREE.BufferAttribute[])if(a.array)arrays.add(a.array.buffer);if(o.geometry.index)arrays.add(o.geometry.index.array.buffer);}});return [...arrays].reduce((sum,a)=>sum+a.byteLength,0)/1048576;};
  useFrame((_,dt)=>{
    time.current+=dt;frames.current++;
    if(active.current){
      const orbit=get().controls as OrbitControlsImpl|null;
      if(orbit){const offset=camera.position.clone().sub(orbit.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),dt*.16);camera.position.copy(orbit.target).add(offset);orbit.update();moved.current+=dt*.16;}
      duration.current+=dt;sample.current.push(dt*1000);triangles.current.push(gl.info.render.triangles);calls.current.push(gl.info.render.calls);
      if(duration.current>=10){active.current=false;const sorted=[...sample.current].sort((a,b)=>a-b);const avg=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;onBenchmark(JSON.stringify({seconds:+duration.current.toFixed(2),rotationRadians:+moved.current.toFixed(2),frames:sample.current.length,fps:+(sample.current.length/duration.current).toFixed(1),p95ms:+sorted[Math.floor(sorted.length*.95)].toFixed(1),triangles:Math.round(avg(triangles.current)),calls:Math.round(avg(calls.current)),geometryMiB:+memory().toFixed(1),dpr:gl.getPixelRatio()}));}
    }
    if(time.current>=2){const fps=frames.current/time.current;onMetrics(Math.round(fps),gl.info.render.calls,gl.info.render.triangles,memory());slow.current=fps<35?slow.current+1:0;if(slow.current>=2)onSlow();time.current=0;frames.current=0;}
  });
  return null;
}

export default function MangaMap(props:Props) {
  const [data,setData]=useState<MangaData|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  const [layers,setLayers]=useState<LayersState>({buildings:true,vegetation:true,water:true,rain:true,zones:true,flow:false});
  const [panel,setPanel]=useState(false),[mode,setMode]=useState<'api'|'manual'>('api');
  const [scenario,setScenario]=useState<Scenario>(PRESETS['Lluvia intensa']);
  const [seconds,setSeconds]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(600);
  const [result,setResult]=useState<WaterResult|null>(null),[busy,setBusy]=useState(false),[simError,setSimError]=useState<string|null>(null);
  const [selected,setSelected]=useState<Building|null>(null),[reduced,setReduced]=useState(false);
  const [fps,setFps]=useState(0),[drawCalls,setDrawCalls]=useState(0),[computeMs,setComputeMs]=useState(0);
  const [lowResolution,setLowResolution]=useState(false);
  const [quality,setQuality]=useState<RenderQuality>('balanced'),[moving,setMoving]=useState(false),[coarsePointer,setCoarsePointer]=useState(false);
  const [baseline,setBaseline]=useState(false),[benchmark,setBenchmark]=useState(0),[benchmarkResult,setBenchmarkResult]=useState('');
  const [triangles,setTriangles]=useState(0),[geometryMiB,setGeometryMiB]=useState(0);
  const [instances,setInstances]=useState<LandscapeInstances|null>(null);
  const [inView,setInView]=useState(true);const section=useRef<HTMLElement>(null);
  const [view,setView]=useState<CameraView>({kind:'general',revision:0});
  const [lightMode,setLightMode]=useState<LightMode>('day');
  const [buildingFocus,setBuildingFocus]=useState<{building:Building;revision:number}|null>(null);
  const [visualMetadata,setVisualMetadata]=useState<VisualMetadata|null>(null);
  const [modelRevision,setModelRevision]=useState(0);
  const handleModelReady=useCallback(()=>setModelRevision(revision=>revision+1),[]);
  const [query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false);
  const searchInput=useRef<HTMLInputElement>(null);
  const worker=useRef<Worker|null>(null),requestId=useRef(0);
  const sentGrid=useRef<MangaData['grid']|null>(null);
  const pending=useRef<{id:number;grid:MangaData['grid'];scenario:Scenario;seconds:number}|null>(null),running=useRef(false);
  const dispatchSimulation=useCallback((message:NonNullable<typeof pending.current>)=>{
    if(!worker.current)return;
    // Transfer the large terrain once per worker, not on every timeline tick.
    const {grid,...request}=message;
    worker.current.postMessage({...request,...(sentGrid.current!==grid?{grid}:{})});
    sentGrid.current=grid;running.current=true;
  },[]);
  const api=useMemo(()=>apiScenario(props.spatialForcing),[props.spatialForcing]);
  const activeScenario=mode==='manual'?scenario:api.scenario;
  const targetSeconds=mode==='manual'?seconds:(props.currentHour??0)*3600;
  const forcingHour=props.spatialForcing?.hours.find(hour=>hour.hour===Math.floor(props.currentHour??0));
  const forecastRain=forcingHour?.rain_mm_h??0;
  const hasRain=mode==='manual'||(forcingHour?.rain_mm_h!=null&&Number.isFinite(forcingHour.rain_mm_h));
  const rain=mode==='manual'?(seconds<scenario.durationH*3600?scenario.rainMmH:0):forecastRain;
  useEffect(()=>{setBaseline(new URLSearchParams(location.search).get('mangaBaseline')==='1');},[]);
  useEffect(()=>{const abort=new AbortController();fetch('/models/manga/checkpoint08/instances.json',{signal:abort.signal}).then(r=>r.ok?r.json():null).then(setInstances).catch(()=>{});return()=>abort.abort();},[]);
  useEffect(()=>{const el=section.current;if(!el)return;let intersects=true;const update=()=>setInView(intersects&&!document.hidden);const observer=new IntersectionObserver(([entry])=>{intersects=entry.isIntersecting;update();},{rootMargin:'100px'});observer.observe(el);document.addEventListener('visibilitychange',update);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);};},[]);
  useEffect(()=>{
    const abort=new AbortController();setError(null);
    fetch('/models/manga/manga.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('Datos de Manga no disponibles');return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>abort.abort();
  },[retry]);
  useEffect(()=>{
    const abort=new AbortController();
    Promise.all(['/models/manga/visual-metadata.json','/models/manga/architecture-metadata.json'].map(url=>fetch(url,{signal:abort.signal}).then(r=>r.ok?r.json():null))).then(([value,architecture]:(VisualMetadata|null)[])=>{
      if(value?.buildings&&typeof value.buildings==='object'){
        const buildings=Object.fromEntries(Object.entries(value.buildings).map(([id,entry])=>[id,{...entry,...architecture?.buildings?.[id]}]));
        setVisualMetadata({buildings,streetCamera:architecture?.streetCamera});
      }
    }).catch(()=>{});
    return()=>abort.abort();
  },[retry]);
  useEffect(()=>{if(searchOpen)searchInput.current?.focus();},[searchOpen]);
  useEffect(()=>{const q=matchMedia('(pointer: coarse)');const update=()=>{setCoarsePointer(q.matches);setQuality(current=>q.matches&&current==='balanced'?'performance':current);};update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);
  useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(q.matches);change();q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
  useEffect(()=>{
    const w=new Worker(new URL('../lib/manga/water.worker.ts',import.meta.url));worker.current=w;
    w.onmessage=({data:reply})=>{
      running.current=false;
      if(reply.id===requestId.current){setBusy(false);setResult(reply.result??null);setSimError(reply.error??null);setComputeMs(reply.computeMs??0);if(reply.error)setPlaying(false);}
      if(pending.current){dispatchSimulation(pending.current);pending.current=null;}
    };
    w.onerror=()=>{setBusy(false);setSimError('El cálculo se interrumpió. Reintenta el visor.');setPlaying(false);};
    return()=>{w.terminate();worker.current=null;sentGrid.current=null;running.current=false;pending.current=null;};
  },[retry,dispatchSimulation]);
  useEffect(()=>{
    setSimError(null);
    const id=++requestId.current;
    if(!data||!activeScenario||!worker.current){pending.current=null;setResult(null);setBusy(false);return;}
    const message={id,grid:data.grid,scenario:activeScenario,seconds:targetSeconds};setBusy(true);
    if(running.current)pending.current=message;else dispatchSimulation(message);
  },[data,activeScenario,targetSeconds,retry,dispatchSimulation]);
  useEffect(()=>{if(!playing||mode!=='manual')return;let last=performance.now();const id=setInterval(()=>{const now=performance.now(),dt=(now-last)/1000;last=now;setSeconds(t=>{const next=Math.min(86400,t+dt*speed);if(next===86400)setPlaying(false);return next;});},200);return()=>clearInterval(id);},[playing,speed,mode]);
  const zones=data?ZONAS_MANGA:[];
  const focusedZone=ZONAS_MANGA.find(z=>z.id===props.focusZonaId);
  const outsideCoverage=!!(data&&focusedZone&&!insideBoundary(...zoneLocal(...focusedZone.coordenadas),data.boundary));
  const zoneMembership=useMemo(()=>data?zoneCells(data,ZONAS_MANGA):new Map<number,number[]>(),[data]);
  const spatialZones=useMemo(()=>data?summarizeZones(data,zoneMembership,result):new Map(),[data,zoneMembership,result]);
  const focusedWater=focusedZone?spatialZones.get(focusedZone.id):undefined;
  useEffect(()=>{if(props.focusZonaId!=null){setSelected(null);setBuildingFocus(null);setLayers(previous=>({...previous,zones:true}));}},[props.focusZonaId]);
  const searchResults=useMemo(()=>{
    if(!data)return [];
    const term=normalized(query);
    if(!term)return data.buildings.filter(b=>{const name=buildingName(b,visualMetadata?.buildings[b.id]);return !/^(edificio|osm-|way-)/i.test(name);}).slice(0,6);
    return data.buildings.filter(b=>{const v=visualMetadata?.buildings[b.id];return normalized([buildingName(b,v),buildingAddress(v),b.id].join(' ')).includes(term);}).slice(0,8);
  },[data,query,visualMetadata]);
  const selectedVisual=selected?visualMetadata?.buildings[selected.id]:undefined;
  const visualHeights=useMemo(()=>visualMetadata?Object.fromEntries(Object.entries(visualMetadata.buildings).flatMap(([id,value])=>typeof value.visualHeightM==='number'&&Number.isFinite(value.visualHeightM)?[[id,value.visualHeightM]]:[])):undefined,[visualMetadata]);
  const displayedBuilding=useMemo(()=>selected?visualBuilding(selected,selectedVisual):null,[selected,selectedVisual]);
  const selectedCell=useMemo(()=>{
    if(!data||!selected)return null;const x=selected.rings[0][0][0],y=selected.rings[0][0][1];let idx=0,best=Infinity;
    data.grid.cells.forEach((c,i)=>{const d=(c.x-x)**2+(c.y-y)**2;if(d<best){idx=i;best=d;}});return idx;
  },[data,selected]);
  function changeMode(next:'api'|'manual'){setMode(next);setPlaying(false);setSeconds(0);setResult(null);}
  function updateScenario(p:Partial<Scenario>){setScenario(s=>({...s,...p}));setSeconds(0);setPlaying(false);setResult(null);}
  function focusBuilding(building:Building){setBuildingFocus(previous=>({building:visualBuilding(building,visualMetadata?.buildings[building.id]),revision:(previous?.revision??0)+1}));setLayers(previous=>({...previous,buildings:true}));}
  function chooseView(kind:ViewKind){setView(v=>({kind,revision:v.revision+1}));setBuildingFocus(null);setSelected(null);props.onSelectZona?.(null);}
  function chooseBuilding(building:Building){setSelected(building);focusBuilding(building);setSearchOpen(false);props.onSelectZona?.(null);}
  const freshness=api.updated?new Date(api.updated).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',timeZone:'America/Bogota'}):null;
  const stale=api.updated?Date.now()-new Date(api.updated).getTime()>120000:false;
  return <section ref={section} className="manga-viewer" aria-label="Modelo 3D del barrio Manga">
    {data&&!error?<GraphicsBoundary key={retry} onRetry={()=>setRetry(x=>x+1)}><Canvas frameloop={inView?'always':'never'} shadows={quality==='high'&&!lowResolution&&!moving} dpr={1} camera={INITIAL_CAMERA} gl={{antialias:true,alpha:false,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping}} onCreated={({gl})=>{gl.setClearColor('#c6c5b7');gl.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setError('Se perdió el contexto gráfico. Puedes reintentar el visor.');},{once:true});}}>
      <Lighting mode={lightMode} lowResolution={quality!=='high'||lowResolution||moving} layers={layers} modelRevision={modelRevision}/>
      <Suspense fallback={null}>{baseline?<Model data={data} layers={layers} onBuilding={setSelected} onEmpty={()=>setSelected(null)} onReady={handleModelReady}/>:<District data={data} buildings={layers.buildings} vegetation={layers.vegetation} quality={quality} rainMmH={hasRain?rain:0} instances={instances} heights={visualHeights} onBuilding={setSelected} onReady={handleModelReady}/>}</Suspense>
      {!baseline&&<RenderBudget quality={lowResolution?'performance':quality} onMotion={setMoving}/>}
      <Camera view={view} focus={props.focusZonaId??null} buildingFocus={buildingFocus} data={data} reduced={reduced} street={visualMetadata?.streetCamera}/>
      {displayedBuilding&&layers.buildings&&<SelectionOutline building={displayedBuilding}/>}
      {layers.water&&<Water data={data} result={result} reduced={reduced} flow={layers.flow}/>}
      {layers.rain&&hasRain&&rain>0&&<RainWeather data={data} intensity={rain} wind={mode==='api'?(forcingHour?.wind_kmh??0):0} direction={mode==='api'?forcingHour?.wind_direction_deg:null} quality={quality} moving={moving} reduced={reduced}/>}
      {layers.zones&&zones.map(z=>{const [x,y]=zoneLocal(...z.coordenadas);const water=spatialZones.get(z.id);return <mesh key={z.id} position={[x,35,-y]} onClick={e=>{if(e.delta>4)return;e.stopPropagation();setSelected(null);props.onSelectZona?.(z);}}><sphereGeometry args={[props.focusZonaId===z.id?15:coarsePointer?12:9,10,8]}/><meshBasicMaterial color={waterColor(water?.meanCm)}/></mesh>;})}
      <Metrics onMetrics={(f,c,t,m)=>{setFps(f);setDrawCalls(c);setTriangles(t);setGeometryMiB(m);}} onSlow={()=>setLowResolution(true)} benchmark={benchmark} onBenchmark={setBenchmarkResult}/>
    </Canvas></GraphicsBoundary>:<div className="manga-fallback">{error??'Preparando Manga…'}{error&&<button onClick={()=>setRetry(x=>x+1)}>Reintentar</button>}</div>}

    <ModelLoading/>
    <div className="manga-heading"><span className="manga-eyebrow">CARTAGENA DE INDIAS</span><h3>Manga <span>tu barrio, en perspectiva</span></h3><div className={`manga-tag ${mode==='manual'?'manual':''}`}>{mode==='manual'?'ESCENARIO HIPOTÉTICO':'LLUVIA API · MODELO EXPLORATORIO'}</div></div>
    <div className="manga-tools"><button className={searchOpen?'active':''} title="Buscar un edificio" aria-label="Buscar un edificio" aria-expanded={searchOpen} onClick={()=>{setSearchOpen(!searchOpen);setPanel(false);}}><Search size={18}/></button><button title={lightMode==='sunset'?'Cambiar a luz de día':'Cambiar a atardecer'} aria-label={lightMode==='sunset'?'Cambiar a luz de día':'Cambiar a atardecer'} onClick={()=>setLightMode(m=>m==='sunset'?'day':'sunset')}>{lightMode==='sunset'?<Sunset size={18}/>:<Sun size={18}/>}</button><button className={panel?'active':''} aria-expanded={panel} title="Capas y escenarios" aria-label="Capas y escenarios" onClick={()=>{setPanel(!panel);setSearchOpen(false);}}><Layers size={18}/></button></div>
    <nav className="manga-views" aria-label="Vistas del barrio">{VIEWS.map(({kind,label,Icon})=><button key={kind} title={kind==='top'?'Vista superior, norte arriba':`Vista ${label.toLowerCase()}`} aria-label={`Vista ${label.toLowerCase()}`} aria-pressed={view.kind===kind&&!buildingFocus} className={view.kind===kind&&!buildingFocus?'active':''} onClick={()=>chooseView(kind)}><Icon size={14}/><span>{label}</span></button>)}</nav>
    <div className="manga-light-label" aria-hidden="true">{lightMode==='night'?'Luz nocturna':lightMode==='sunset'?'Luz de atardecer':'Luz de día'}</div>
    {searchOpen&&<aside className="manga-search" aria-label="Buscar en Manga"><div className="manga-search-field"><Search size={17}/><input ref={searchInput} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);if(e.key==='Enter'&&searchResults.length===1)chooseBuilding(searchResults[0]);}} placeholder="Nombre, dirección o código OSM" aria-label="Nombre, dirección o código OSM"/><button aria-label="Cerrar búsqueda" onClick={()=>setSearchOpen(false)}><X size={16}/></button></div><p>{query?'Coincidencias en el mapa':'Lugares para empezar'}</p><div className="manga-search-results">{searchResults.map(b=><button key={b.id} onClick={()=>chooseBuilding(b)}><MapPin size={16}/><span><b>{buildingName(b,visualMetadata?.buildings[b.id])}</b><small>{buildingAddress(visualMetadata?.buildings[b.id])||b.id.replace('osm-way-','OSM · ')}</small></span><ChevronRight size={15}/></button>)}</div>{!searchResults.length&&<div className="manga-search-empty">No encontramos ese edificio. Prueba un nombre más corto o selecciona su huella en el mapa.</div>}<small className="manga-search-note">Las direcciones disponibles provienen de OpenStreetMap; muchos edificios todavía no tienen una.</small></aside>}
    <div className="manga-readings"><div><Droplets size={16}/><b>{hasRain?rain.toFixed(1):'—'}</b><span>{hasRain?'mm/h':'sin dato'}</span></div><div><b>{result?(result.seconds/3600).toFixed(2):'—'}</b><span>h calculadas {busy?`· buscando +${(targetSeconds/3600).toFixed(1)} h…`:''}</span></div><small>{mode==='api'?'Lluvia API del intervalo seleccionado':'Escenario manual'} · inicio seco · SRTM ≈30 m</small></div>
    {focusedZone&&!selected&&!panel&&!searchOpen&&<aside className="manga-zone-water" aria-label="Agua simulada en la zona">
      <b>{focusedZone.nombre}</b>
      {focusedWater?<><div><span>Media <strong>{focusedWater.meanCm.toFixed(1)} cm</strong></span><span>Máx. celda <strong>{focusedWater.maxCm.toFixed(1)} cm</strong></span></div>
        <small>{focusedWater.cells} celdas · {(focusedWater.wetAreaM2/10000).toFixed(2)} ha en celdas ≥1 cm · +{(focusedWater.seconds/3600).toFixed(1)} h{busy?' · actualizando…':''}</small></>:<p>{outsideCoverage?'Fuera de cobertura; coordenada por verificar.':busy?'Calculando el agua de esta zona…':'Sin cálculo disponible para esta hora.'}</p>}
      <small>Acumulación del terreno en radio de {focusedZone.radio_influencia} m. Estimación espacial, distinta del indicador zonal del panel.</small>
    </aside>}
    <div className="manga-status" aria-live="polite">{focusedZone&&<strong>{focusedZone.nombre}{outsideCoverage?' · Coordenada fuera del área modelada; ubicación por verificar.':''}</strong>}{mode==='api'?`${api.label}${freshness?` · actualización ${freshness} COT${stale?' (antigua)':''}`:' · fecha de consulta no disponible'}`:'Lluvia uniforme y condiciones manuales; los paneles externos conservan su serie.'}{simError&&<strong role="alert">{simError}</strong>}</div>
    <div className="manga-credit"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · NASA SRTM <span>{fps} FPS</span></div>

    {selected&&displayedBuilding&&<div className="manga-selection" aria-label="Edificio seleccionado">
      <button className="manga-close" aria-label="Cerrar edificio" onClick={()=>setSelected(null)}><X size={16}/></button>
      <span className="manga-eyebrow"><Building2 size={13}/> TU LUGAR EN MANGA</span><b>{buildingName(selected,selectedVisual)}</b>
      {buildingAddress(selectedVisual)&&<p className="manga-address"><MapPin size={13}/>{buildingAddress(selectedVisual)}</p>}
      <div className="manga-confidence"><span>Huella OSM</span><span>{selectedVisual?.architectureConfidence||'Fachada aproximada'}</span></div>
      {selectedVisual?.architectureProfile&&<p>{selectedVisual.architectureProfile}</p>}
      <p>Altura visual: {displayedBuilding.height} m · {displayedBuilding.heightMethod}</p>
      {displayedBuilding.height!==selected.height&&<p>El dato GIS original conserva {selected.height} m. {selectedVisual?.visualHeightSourceUrl?.startsWith('https://')&&<a href={selectedVisual.visualHeightSourceUrl} target="_blank" rel="noreferrer">Fuente de la estimación visual</a>}</p>}
      <p>Agua media en celda de 40 m: {selectedCell!==null&&result?(result.depth[selectedCell]*100).toFixed(1):'—'} cm.</p>
      <small>{selectedVisual?.architectureNote||'El detalle de fachada aún no está verificado con fotos.'} El agua no es una predicción individual validada.</small>
      {selectedVisual?.architectureSourceUrl?.startsWith('https://')&&<p><a href={selectedVisual.architectureSourceUrl} target="_blank" rel="noreferrer">Referencia arquitectónica y autoría</a></p>}
      <div className="manga-selection-actions"><button onClick={()=>focusBuilding(selected)}><Focus size={15}/>Acercarme</button>{/^osm-way-\d+-\d+$/.test(selected.id)&&<a href={`https://www.openstreetmap.org/way/${selected.id.split('-')[2]}`} target="_blank" rel="noreferrer">Ver en OSM<ChevronRight size={13}/></a>}</div>
    </div>}

    {panel&&<aside className="manga-panel" aria-label="Controles del modelo"><div className="manga-panel-title"><b>Explorar Manga</b><button aria-label="Cerrar controles" onClick={()=>setPanel(false)}><X size={18}/></button></div>
      <label>Calidad visual<select value={quality} onChange={e=>{setQuality(e.target.value as RenderQuality);setLowResolution(false);}}><option value="high">Alta</option><option value="balanced">Equilibrada</option><option value="performance">Rendimiento</option></select></label>
      <label>Iluminación<select value={lightMode} onChange={e=>setLightMode(e.target.value as LightMode)}><option value="day">Día caribeño</option><option value="sunset">Atardecer</option><option value="night">Noche</option></select></label>
      <p className="manga-note">{coarsePointer?'Modo móvil activo: prioridad a respuesta táctil. ':''}El detalle se adapta a la distancia. Jardines y mobiliario aproximados; relieve SRTM original.</p>
      <div className="manga-mode"><button className={mode==='api'?'active':''} onClick={()=>changeMode('api')}>Serie API</button><button className={mode==='manual'?'active':''} onClick={()=>changeMode('manual')}>Escenario</button></div>
      {mode==='manual'?<><label>Condición inicial<select onChange={e=>{setScenario(PRESETS[e.target.value]);setSeconds(0);setPlaying(false);}} defaultValue="Lluvia intensa">{Object.keys(PRESETS).map(p=><option key={p}>{p}</option>)}</select></label>
      {([{key:'rainMmH',label:'Lluvia (mm/h)',max:300,step:5},{key:'durationH',label:'Duración (h)',max:24,step:1},{key:'infiltrationMmH',label:'Infiltración (mm/h)',max:30,step:1},{key:'drainageMmH',label:'Drenaje (mm/h)',max:30,step:1}] as const).map(c=><label key={c.key}>{c.label}<output>{scenario[c.key]}</output><input type="range" min="0" max={c.max} step={c.step} value={scenario[c.key]} onChange={e=>updateScenario({[c.key]:Number(e.target.value)})}/></label>)}
      <label className="manga-toggle"><input type="checkbox" checked={scenario.seaHeadM!==null} onChange={e=>updateScenario({seaHeadM:e.target.checked?2:null})}/>Conexión marina hipotética</label>
      {scenario.seaHeadM!==null&&<label>Cota marina EGM96 (m)<output>{scenario.seaHeadM}</output><input type="range" min="-2" max="15" step=".25" value={scenario.seaHeadM} onChange={e=>updateScenario({seaHeadM:Number(e.target.value)})}/></label>}
      <p className="manga-note">La marea MSL de la API no se suma al terreno EGM96. Falta la transformación vertical local.</p>
      <div className="manga-play"><button aria-label={playing?'Pausar simulación':'Reproducir simulación'} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={17}/>:<Play size={17}/>}</button><button aria-label="Reiniciar simulación" onClick={()=>{setSeconds(0);setPlaying(false);}}><RotateCcw size={17}/></button><select aria-label="Velocidad temporal" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={60}>1 min/s</option><option value={600}>10 min/s</option><option value={1800}>30 min/s</option></select></div>
      <label>Tiempo: {(seconds/3600).toFixed(2)} h<input type="range" min="0" max="86400" step="300" value={seconds} onChange={e=>{setPlaying(false);setSeconds(Number(e.target.value));}}/></label>
      </>:<p className="manga-note">La lluvia y el viento de cada hora vienen de la serie API. Al elegir una hora, el agua se recalcula desde suelo seco sobre la topografía disponible; el resultado es exploratorio, no una predicción hidráulica certificada.</p>}
      <div className="manga-layer-list">{([{key:'buildings',label:'Edificios'},{key:'vegetation',label:'Vegetación tropical'},{key:'water',label:'Agua acumulada'},{key:'rain',label:'Lluvia visual'},{key:'zones',label:'Zonas del modelo existente'},{key:'flow',label:'Dirección de escorrentía'}] as const).map(l=><label className="manga-toggle" key={l.key}><input type="checkbox" checked={layers[l.key]} onChange={()=>setLayers(s=>({...s,[l.key]:!s[l.key]}))}/>{l.label}</label>)}</div>
      <p className="manga-note">Alturas sin exageración. Marcadores: profundidad media del cálculo espacial en cada zona; gris sin cálculo. Gotas, impactos y acabado mojado son efectos visuales, no mediciones ni volumen adicional de agua.</p>
      {data&&<p className="manga-note">{data.metadata.buildings.toLocaleString('es-CO')} edificios · {(data.metadata.areaM2/1e6).toFixed(2)} km² · {ZONAS_MANGA.length-zones.length} coordenadas zonales fuera del límite. Alturas mayormente estimadas.</p>}
      {result&&<dl className="manga-balance"><dt>Volumen almacenado</dt><dd>{result.storedM3.toFixed(0)} m³</dd><dt>Error de balance</dt><dd>{result.balanceM3.toExponential(1)} m³</dd><dt>Profundidad máxima de celda</dt><dd>{result.maxDepthM.toFixed(2)} m</dd></dl>}
      <p className="manga-note">{fps} FPS · {drawCalls} llamadas de dibujo · {triangles.toLocaleString('es-CO')} triángulos · geometría {geometryMiB.toFixed(1)} MiB · cálculo {computeMs.toFixed(0)} ms. Un dedo rota; dos dedos desplazan y acercan. Ratón derecho desplaza.</p>
      <details><summary>Diagnóstico de fluidez</summary><p className="manga-note">Gira la cámara durante 10 segundos y mide el tiempo por fotograma. Memoria de geometría residente estimada; no incluye toda la memoria de GPU.</p><button onClick={()=>{setBenchmarkResult('Midiendo…');setBenchmark(v=>v+1);}}>Medir recorrido de 10 segundos</button><output aria-label="Resultado de rendimiento">{benchmarkResult}</output></details>
    </aside>}
  </section>;
}
