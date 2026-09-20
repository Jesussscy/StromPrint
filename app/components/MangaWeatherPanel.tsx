"use client";
import { useEffect, useMemo, useState } from 'react';
import { CloudRain } from 'lucide-react';
import type { MangaMapProps } from './MangaMap';
import type { MangaData } from '@/app/lib/manga/types';
import { ZONAS_MANGA, ZONAS_PARAMETROS } from '@/app/lib/zonasManga';
import { RAIN_PRESETS, finiteRain, rainLabel, accumulatedRain, type RainPreset } from '@/app/lib/manga/weather';
import { FORECAST_TIMELINE_EVENT } from '@/app/lib/manga/timeline';

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
  const [manual,setManual]=useState<RainPreset|null>(null),[duration,setDuration]=useState(2);
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{const q=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);
  useEffect(()=>{
    const c=new AbortController();
    fetch('/models/manga/manga.json',{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then((d:MangaData)=>{
      // v6.1's visual ground is flat. Do not change the source DEM or infer MSL.
      setData({...d,grid:{...d.grid,cells:d.grid.cells.map(c=>({...c,z:0}))},roads:d.roads.map(r=>({...r,triangles:r.triangles.map(t=>t.map(p=>[p[0],p[1],.045]) as typeof t)}))});
    }).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>c.abort();
  },[]);
  useEffect(()=>{const activate=()=>setManual(null);window.addEventListener(FORECAST_TIMELINE_EVENT,activate);return()=>window.removeEventListener(FORECAST_TIMELINE_EVENT,activate);},[]);
  useEffect(()=>setManual(null),[props.currentHour,props.sourceLabel]);
  const point=props.puntoMeteo;
  const hour=Math.max(0,props.currentHour??0);
  const hours=useMemo(()=>props.spatialForcing?.hours.map(h=>({tiempo_hora:h.hour,wind_kmh:h.wind_kmh,wind_direction_deg:h.wind_direction_deg}))??[],[props.spatialForcing]);
  const series=useMemo(()=>props.forecastPoints??props.spatialForcing?.hours.map(h=>({tiempo_hora:h.hour,lluvia_mm_h:finiteRain(h.rain_mm_h)}))??[],[props.forecastPoints,props.spatialForcing]);
  const weather=props.spatialForcing?.hours.find(h=>h.hour===Math.floor(hour));
  const rate=manual?RAIN_PRESETS[manual]:interpolateSeries(series.length?series:undefined,hour,'lluvia_mm_h',point?.lluvia_mm_h??weather?.rain_mm_h??0);
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
  return {data,error,manual,setManual,duration,setDuration,rate,hasWeather,depths,reduced,wind,direction};
}

export function WeatherPanel({weather:w,source,hour}:{weather:ReturnType<typeof useMangaWeather>;source?:string;hour?:number}) {
  return <aside className="manga6-weather" aria-label="Control de lluvia">
    <div><CloudRain size={20}/><strong>{w.hasWeather?rainLabel(w.rate):'Sin datos meteorológicos'}</strong><span>{w.rate.toFixed(1)} mm/h</span></div>
    <p>{w.manual?'Escenario artificial':source??'Datos de la aplicación'} · {w.manual?`${w.duration} h de lluvia`:`Línea temporal +${(hour??0).toFixed(1)} h`}</p>
    <details><summary>Simular lluvia</summary><div className="manga6-presets">{(Object.keys(RAIN_PRESETS) as RainPreset[]).map(k=><button key={k} aria-pressed={w.manual===k} onClick={()=>w.setManual(k)}>{k==='Critico'?'Crítico':k}</button>)}</div>
      {w.manual&&<><label>Duración: {w.duration} h<input aria-label="Duración de lluvia artificial" type="range" min="1" max="24" value={w.duration} onChange={e=>w.setDuration(Number(e.target.value))}/></label><button onClick={()=>w.setManual(null)}>Volver a datos de la aplicación</button></>}
    </details>
    {w.error&&<p role="alert">No se pudo cargar la capa de lluvia. Recarga la página.</p>}
  </aside>;
}
