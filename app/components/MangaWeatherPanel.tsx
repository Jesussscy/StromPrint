"use client";
import { useEffect, useMemo, useState } from 'react';
import { CloudRain } from 'lucide-react';
import type { MangaMapProps } from './MangaMap';
import type { MangaData } from '@/app/lib/manga/types';
import { ZONAS_MANGA, ZONAS_PARAMETROS } from '@/app/lib/zonasManga';
import { RAIN_PRESETS, finiteRain, rainLabel, accumulatedRain, type RainPreset } from '@/app/lib/manga/weather';
import { FORECAST_TIMELINE_EVENT } from '@/app/lib/manga/timeline';

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
  const weather=props.spatialForcing?.hours.find(h=>h.hour===Math.floor(props.currentHour??0));
  const rate=manual?RAIN_PRESETS[manual]:finiteRain(point?.lluvia_mm_h ?? weather?.rain_mm_h);
  const hasWeather=manual!==null||Number.isFinite(point?.lluvia_mm_h)||Number.isFinite(weather?.rain_mm_h);
  const depths=useMemo(()=>ZONAS_MANGA.map(z=>{
    if(!manual&&props.zonasVivas?.has(z.id)) {
      const n=props.zonasVivas.get(z.id)!.nivel;
      return Number.isFinite(n)?Math.max(0,n)/100:0;
    }
    const p=ZONAS_PARAMETROS[z.id];
    const series=manual?[{tiempo_hora:0,lluvia_mm_h:RAIN_PRESETS[manual]},{tiempo_hora:duration,lluvia_mm_h:0}]:props.forecastPoints??props.spatialForcing?.hours.map(h=>({tiempo_hora:h.hour,lluvia_mm_h:finiteRain(h.rain_mm_h)}))??[];
    return accumulatedRain(series,manual?duration:props.currentHour??0,p.drenaje==='bajo'?2:p.drenaje==='medio'?5:10,p.exposicion_lluvia_pct/100)*(1+Math.max(0,1.4-p.altura_base_m));
  }),[manual,duration,props.zonasVivas,props.forecastPoints,props.spatialForcing,props.currentHour]);
  return {data,error,manual,setManual,duration,setDuration,rate,hasWeather,depths,reduced,wind:weather?.wind_kmh??0,direction:weather?.wind_direction_deg};
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
