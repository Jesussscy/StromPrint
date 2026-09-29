"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, CloudRain, Pause, Play, RotateCcw, Waves } from 'lucide-react';
import type { MangaMapProps } from './MangaMap';
import type { MangaData } from '@/app/lib/manga/types';
import type { Grid, Scenario, Triangle, WaterResult } from '@/app/lib/manga/types';
import { ZONAS_MANGA, ZONAS_PARAMETROS } from '@/app/lib/zonasManga';
import { RAIN_PRESETS, finiteRain, rainLabel, accumulatedRain, type RainPreset } from '@/app/lib/manga/weather';
import { FORECAST_TIMELINE_EVENT } from '@/app/lib/manga/timeline';
import { displayGroundElevation } from '@/app/lib/manga/portLayout';
import { zoneLocal } from '@/app/lib/manga/adapter';
import { repairInteriorDemVoids } from '@/app/lib/manga/ground';

function lerp(a:number,b:number,t:number){return a+(b-a)*t;}
/** Rain or wind at an arbitrary hour: linear interpolation between the surrounding
 * forecast points, flat-clamped outside the series. Keeps the 3D rain in sync
 * with the timeline even at fractional hours (playback steps of 0.5h). */
function interpolateSeries<T extends { tiempo_hora:number },K extends keyof T>(
  points:T[]|undefined, hour:number, key:K, fallback:number
): number {
  if(!points?.length) return fallback;
  const read=(p:T)=>typeof p[key]==='number'&&Number.isFinite(p[key])?p[key] as unknown as number:fallback;
  if(hour<=points[0].tiempo_hora) return read(points[0]);
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    if(hour>=a.tiempo_hora&&hour<=b.tiempo_hora){
      const span=b.tiempo_hora-a.tiempo_hora;
      return lerp(read(a),read(b),span===0?0:(hour-a.tiempo_hora)/span);
    }
  }
  return read(points[points.length-1]);
}
/** Wind direction is circular: interpolate the shortest arc. */
function interpolateDirection(points:({tiempo_hora:number;wind_direction_deg:number|null})[]|undefined,hour:number){
  if(!points?.length) return undefined;
  const pick=(p:{wind_direction_deg:number|null})=>typeof p.wind_direction_deg==='number'?p.wind_direction_deg:undefined;
  if(hour<=points[0].tiempo_hora) return pick(points[0]);
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    if(hour>=a.tiempo_hora&&hour<=b.tiempo_hora){
      const da=pick(a),db=pick(b);
      if(da==null||db==null) return db??da;
      const span=b.tiempo_hora-a.tiempo_hora,t=span===0?0:(hour-a.tiempo_hora)/span;
      const delta=((db-da+540)%360)-180;
      return (da+delta*t+360)%360;
    }
  }
  return pick(points[points.length-1]);
}

export function useMangaWeather(props:MangaMapProps) {
  const [data,setData]=useState<MangaData|null>(null),[error,setError]=useState(false);
  const [waterResult,setWaterResult]=useState<WaterResult|null>(null),[simulationError,setSimulationError]=useState<string|null>(null);
  const [computing,setComputing]=useState(false),[manualTime,setManualTime]=useState(0),[playing,setPlaying]=useState(false);
  const workerRef=useRef<Worker|null>(null),requestRef=useRef(0),sentGridRef=useRef<Grid|null>(null);
  const [manual,setManual]=useState<RainPreset|null>(null),[duration,setDuration]=useState(2);
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{const q=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);
  useEffect(()=>{
    const c=new AbortController();
    fetch('/models/manga/manga.json',{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then((d:MangaData)=>{
      // Keep the DEM heights intact. The display uses EGM96 elevations as-is;
      // no tide datum is added to road or grid elevations here.
      setData(d);
    }).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>c.abort();
  },[]);
  useEffect(()=>{const activate=()=>{setManual(null);setManualTime(0);setPlaying(false);};window.addEventListener(FORECAST_TIMELINE_EVENT,activate);return()=>window.removeEventListener(FORECAST_TIMELINE_EVENT,activate);},[]);
  useEffect(()=>{setManual(null);setManualTime(0);setPlaying(false);},[props.currentHour,props.sourceLabel]);
  const point=props.puntoMeteo;
  const hour=Math.max(0,props.currentHour??0);
  const hours=useMemo(()=>props.spatialForcing?.hours.map(h=>({tiempo_hora:h.hour,wind_kmh:h.wind_kmh,wind_direction_deg:h.wind_direction_deg}))??[],[props.spatialForcing]);
  const series=useMemo(()=>props.forecastPoints??props.spatialForcing?.hours.map(h=>({tiempo_hora:h.hour,lluvia_mm_h:finiteRain(h.rain_mm_h)}))??[],[props.forecastPoints,props.spatialForcing]);
  const weather=props.spatialForcing?.hours.find(h=>h.hour===Math.floor(hour));
  const rate=manual?(manualTime<duration?RAIN_PRESETS[manual]:0):interpolateSeries(series.length?series:undefined,hour,'lluvia_mm_h',point?.lluvia_mm_h??weather?.rain_mm_h??0);
  const hasWeather=manual!==null||Number.isFinite(point?.lluvia_mm_h)||Boolean(series.length);
  const depths=useMemo(()=>ZONAS_MANGA.map(z=>{
    if(!manual&&props.zonasVivas?.has(z.id)) {
      const n=props.zonasVivas.get(z.id)!.nivel;
      return Number.isFinite(n)?Math.max(0,n)/100:0;
    }
    const p=ZONAS_PARAMETROS[z.id];
    const s=manual?[{tiempo_hora:0,lluvia_mm_h:RAIN_PRESETS[manual]},{tiempo_hora:duration,lluvia_mm_h:0}]:series;
    // Rain bucket + documented tidal exposure so water appears where it floods
    // (Av. Miramar / ciénaga) even during high tide without rain.
    const tideM=manual?0:(point?.marea_cm??0)*p.exposicion_marea_pct/100/100;
    const rainM=accumulatedRain(s,manual?duration:hour,p.drenaje==='bajo'?2:p.drenaje==='medio'?5:10,p.exposicion_lluvia_pct/100)*(1+Math.max(0,1.4-p.altura_base_m));
    return Math.max(0,rainM+tideM);
  }),[manual,duration,props.zonasVivas,series,hour,point]);
  const wind=manual?0:interpolateSeries(hours,hour,'wind_kmh',0);
  const direction=manual?undefined:interpolateDirection(hours,hour);
  const simulationGrid=useMemo<Grid|null>(()=>data?{
    ...data.grid,
    cells:repairInteriorDemVoids(data.grid.cells).map(cell=>{
      const triangles:Triangle[]=cell.triangles.map(tri=>tri.map(p=>[p[0],p[1],displayGroundElevation(p[0],p[1],p[2])] as [number,number,number]) as Triangle);
      return {...cell,z:displayGroundElevation(cell.x,cell.y,cell.z),triangles};
    }),
  }:null,[data]);
  const finalRainHour=series.length?series[series.length-1].tiempo_hora:0;
  const simulationEnd=Math.min(168,Math.max(Math.ceil(hour)+1,Math.ceil(finalRainHour)+1,1));
  const scenario=useMemo<Scenario>(()=>manual?{
    rainMmH:RAIN_PRESETS[manual],durationH:duration,infiltrationMmH:2,drainageMmH:4,seaHeadM:null,
  }:{
    rainMmH:0,durationH:168,infiltrationMmH:2,drainageMmH:4,seaHeadM:null,
    forcing:Array.from({length:simulationEnd+1},(_,h)=>({hour:h,rainMmH:interpolateSeries(series.length?series:undefined,h,'lluvia_mm_h',0)})),
  },[manual,duration,simulationEnd,series]);
  const simulationSeconds=Math.min(168*3600,Math.max(0,Math.floor((manual?manualTime:hour)*3600)));
  useEffect(()=>{
    if(!manual||!playing)return;
    const timer=window.setInterval(()=>setManualTime(t=>Math.min(duration+6,t+.1)),250);
    return()=>window.clearInterval(timer);
  },[manual,playing,duration]);
  useEffect(()=>{if(manual&&playing&&manualTime>=duration+6)setPlaying(false);},[manual,playing,manualTime,duration]);
  useEffect(()=>{if(manualTime>duration+6)setManualTime(duration+6);},[manualTime,duration]);
  useEffect(()=>{
    const worker=new Worker(new URL('@/app/lib/manga/water.worker.ts',import.meta.url),{type:'module'});
    workerRef.current=worker;sentGridRef.current=null;
    worker.onmessage=(event:MessageEvent<{id:number;result?:WaterResult;error?:string}>)=>{
      if(event.data.id!==requestRef.current)return;
      setComputing(false);
      if(event.data.error){setSimulationError(event.data.error);return;}
      setSimulationError(null);setWaterResult(event.data.result??null);
    };
    worker.onerror=()=>setSimulationError('No se pudo ejecutar el modelo 2D de agua.');
    return()=>{worker.terminate();if(workerRef.current===worker)workerRef.current=null;sentGridRef.current=null;};
  },[]);
  useEffect(()=>{
    if(!simulationGrid||!workerRef.current)return;
    const id=++requestRef.current;
    const includeGrid=sentGridRef.current!==simulationGrid;
    setComputing(true);
    const timer=window.setTimeout(()=>{
      if(!workerRef.current)return;
      workerRef.current.postMessage({id,grid:includeGrid?simulationGrid:undefined,scenario,seconds:simulationSeconds});
      if(includeGrid)sentGridRef.current=simulationGrid;
    },80);
    return()=>window.clearTimeout(timer);
  },[simulationGrid,scenario,simulationSeconds]);
  const modeledDepths=useMemo(()=>{
    if(!simulationGrid||!waterResult)return depths;
    return ZONAS_MANGA.map((zone,index)=>{
      const [x,y]=zoneLocal(...zone.coordenadas),radius=Math.max(40,zone.radio_influencia??80);
      const local=simulationGrid.cells.map((cell,i)=>({d:Math.hypot(cell.x-x,cell.y-y),depth:waterResult.depth[i]??0})).filter(p=>p.d<=radius).sort((a,b)=>a.d-b.d).slice(0,8);
      return local.length?Math.max(...local.map(p=>p.depth)):depths[index]??0;
    });
  },[simulationGrid,waterResult,depths]);
  const area=useMemo(()=>simulationGrid?.cells.reduce((sum,cell)=>sum+cell.area,0)??0,[simulationGrid]);
  const accumulatedMm=area&&waterResult?waterResult.rainM3/area*1000:0;
  const selectManual=(preset:RainPreset|null)=>{setManual(preset);setManualTime(0);setPlaying(false);};
  const togglePlayback=()=>{if(playing){setPlaying(false);return;}if(manualTime>=duration+6)setManualTime(0);setPlaying(true);};
  return {data,error,manual,setManual:selectManual,duration,setDuration,rate,hasWeather,depths:modeledDepths,reduced,wind,direction,waterResult,simulationGrid,simulationError,manualTime,setManualTime,playing,setPlaying,togglePlayback,computing,accumulatedMm,timelinePlaying:!!props.isPlaying};
}

function formatSimulationTime(hours:number){const mins=Math.round(hours*60),h=Math.floor(mins/60),m=mins%60;return `${h} h ${String(m).padStart(2,'0')} min`;}

export function WeatherPanel({weather:w,source,hour,standalone=false}:{weather:ReturnType<typeof useMangaWeather>;source?:string;hour?:number;standalone?:boolean}) {
  const [collapsed,setCollapsed]=useState(true);
  if(standalone) return <aside className={`manga6-weather manga6-weather--studio${collapsed?' is-collapsed':''}`} aria-label="Laboratorio de lluvia">
    <button className="manga6-weather__trigger" type="button" aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>
      <span className="manga6-weather__icon"><CloudRain size={22}/></span>
      <span className="manga6-weather__trigger-copy"><small>ATMÓSFERA · MANGA</small><strong>{w.manual?`Simulación: ${w.manual==='Critico'?'crítico':w.manual.toLowerCase()}`:w.hasWeather?rainLabel(w.rate):'Sin datos meteorológicos'}</strong></span>
      <span className="manga6-weather__rate">{w.rate.toFixed(1)}<small>mm/h</small></span>
      <ChevronDown className="manga6-weather__chevron" size={18}/>
    </button>
    {!collapsed&&<div className="manga6-weather__body">
      <div className="manga6-weather__intro"><span className="manga6-weather__eyebrow"><Waves size={15}/> ESCENARIOS EXPLORATORIOS</span><h3>Haz llover sobre Manga.</h3><p>Elige una intensidad, define cuántas horas llueve y observa cómo evoluciona el agua en el terreno.</p></div>
      <div className="manga6-weather__presets" role="group" aria-label="Intensidad de lluvia">
        {(Object.keys(RAIN_PRESETS) as RainPreset[]).map(k=><button type="button" key={k} aria-pressed={w.manual===k} onClick={()=>w.setManual(k)}><span>{k==='Critico'?'Crítico':k}</span><b>{RAIN_PRESETS[k]}<small>mm/h</small></b></button>)}
      </div>
      {w.manual?<div className="manga6-weather__simulation">
        <div className="manga6-weather__time-head"><span><b>{w.manualTime<w.duration?'Lluvia activa':'Drenaje posterior'}</b><small>{formatSimulationTime(w.manualTime)} de {formatSimulationTime(w.duration+6)}</small></span><button type="button" onClick={w.togglePlayback}>{w.playing?<Pause size={16}/>:<Play size={16}/>} {w.playing?'Pausar':'Reproducir'}</button></div>
        <input aria-label="Línea de tiempo de inundación" type="range" min="0" max={w.duration+6} step="0.05" value={Math.min(w.manualTime,w.duration+6)} onChange={e=>{w.setManualTime(Number(e.target.value));w.setPlaying(false);}}/>
        <div className="manga6-weather__scale"><span>0 h</span><span>{w.duration} h de lluvia</span><span>+6 h drenaje</span></div>
        <label className="manga6-weather__duration">Duración de la lluvia <strong>{w.duration} horas</strong><input aria-label="Duración de lluvia artificial" type="range" min="1" max="24" value={w.duration} onChange={e=>w.setDuration(Number(e.target.value))}/></label>
        <div className="manga6-weather__metrics"><span><small>ACUMULADO</small><b>{w.accumulatedMm.toFixed(1)} mm</b></span><span><small>PROFUNDIDAD MÁX.</small><b>{w.waterResult?(w.waterResult.maxDepthM*100).toFixed(0):'—'} cm</b></span></div>
        <div className="manga6-weather__foot-actions"><button type="button" onClick={()=>{w.setPlaying(false);w.setManualTime(0);}}><RotateCcw size={14}/> Reiniciar</button><button type="button" onClick={()=>w.setManual(null)}>Salir de simulación</button></div>
      </div>:<p className="manga6-weather__empty">Selecciona un escenario para activar la lluvia y la línea temporal. {w.hasWeather?`Ahora se muestran ${source??'datos meteorológicos'}.`:'Aún no hay datos meteorológicos para esta vista.'}</p>}
      {(w.error||w.simulationError)&&<p className="manga6-weather__error" role="alert">{w.simulationError??'No se pudo cargar la capa de lluvia.'}</p>}
      {w.computing&&<p role="status" className="manga6-weather__working">Calculando escorrentía…</p>}
      <details className="manga6-weather__method"><summary>Cómo se calcula</summary><p>Modelo exploratorio 2D sobre celdas DEM de ~40 m. Infiltración 2 mm/h, drenaje 4 mm/h y lluvia uniforme. No es una alerta real ni un pronóstico validado.</p></details>
    </div>}
  </aside>;
  return <aside className={`manga6-weather${collapsed?' is-collapsed':''}`} aria-label="Control de lluvia">
    <div><CloudRain size={20}/><strong>{w.hasWeather?rainLabel(w.rate):'Sin datos meteorológicos'}</strong><span>{w.rate.toFixed(1)} mm/h</span><button type="button" aria-expanded={!collapsed} aria-label={collapsed?'Expandir control de lluvia':'Minimizar control de lluvia'} onClick={()=>setCollapsed(value=>!value)}>{collapsed?'Expandir':'Minimizar'}</button></div>
    {!collapsed&&<>
    <p>{w.manual?'Escenario de lluvia':source??'Datos de la aplicación'} · {w.manual?`${w.duration} h de lluvia + 6 h de drenaje`:`Línea temporal ${w.timelinePlaying?'reproduciéndose':'pausada'} · +${(hour??0).toFixed(1)} h`}</p>
    <p>La línea temporal principal controla lluvia, gotas y agua acumulada. El mismo cálculo 2D con DEM se conserva al mostrar u ocultar el relieve; solo cambia su representación visual.</p>
    <details><summary>Simular lluvia</summary><div className="manga6-presets">{(Object.keys(RAIN_PRESETS) as RainPreset[]).map(k=><button key={k} aria-pressed={w.manual===k} onClick={()=>w.setManual(k)}>{k==='Critico'?'Crítico':k}</button>)}</div>
      {w.manual&&<div className="manga6-simcontrols"><button onClick={w.togglePlayback}>{w.playing?<Pause size={15}/>:<Play size={15}/>} {w.playing?'Pausar':'Reproducir simulación'}</button></div>}
      {w.manual&&<>
        <label>Duración de lluvia: {w.duration} h<input aria-label="Duración de lluvia artificial" type="range" min="1" max="24" value={w.duration} onChange={e=>w.setDuration(Number(e.target.value))}/></label>
        <div className="manga6-simtime"><strong>{w.manualTime<w.duration?'Lluvia':'Drenaje'} · {formatSimulationTime(w.manualTime)}</strong><span>Duración total {formatSimulationTime(w.duration+6)}</span></div>
        <input aria-label="Línea de tiempo de inundación" type="range" min="0" max={w.duration+6} step="0.05" value={Math.min(w.manualTime,w.duration+6)} onChange={e=>{w.setManualTime(Number(e.target.value));w.setPlaying(false);}}/>
        <p>Reproducción ×24 · 1 s equivale a 24 min simulados.</p>
        <div className="manga6-simcontrols"><button onClick={()=>{w.setPlaying(false);w.setManualTime(0);}}><RotateCcw size={14}/> Reiniciar</button><button onClick={()=>w.setManual(null)}>Volver a datos de la aplicación</button></div>
      </>}
    </details>
    {w.error&&<p role="alert">No se pudo cargar la capa de lluvia. Recarga la página.</p>}
    {w.simulationError&&<p role="alert">Simulación 2D: {w.simulationError}</p>}
    {w.computing&&<p role="status">Calculando paso de la simulación…</p>}
    {w.waterResult&&<p>Precipitación acumulada: {w.accumulatedMm.toFixed(1)} mm · agua almacenada: {Math.round(w.waterResult.storedM3).toLocaleString('es-CO')} m³ · profundidad máxima local: {(w.waterResult.maxDepthM*100).toFixed(1)} cm</p>}
    <p>Celda DEM ~40 m · infiltración 2 mm/h · drenaje 4 mm/h. La tasa de lluvia se aplica igual a toda la malla; el DEM redistribuye el agua por las cotas. Si se ve agua extensa, representa este escenario uniforme con parámetros fijos, no una medición de inundación real ni un pronóstico validado.</p>
    </>}
  </aside>;
}
