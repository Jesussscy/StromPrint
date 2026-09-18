import type { SpatialForcing } from '../api';
import type { Scenario } from './types';

export function apiScenario(source: SpatialForcing | null | undefined): {scenario:Scenario|null;label:string;updated:string|null} {
  if(source?.hours.length) {
    if(source.step_seconds!==3600||source.hours.some((p,i)=>p.hour!==i||p.rain_mm_h===null||!Number.isFinite(p.rain_mm_h)||p.rain_mm_h<0||p.rain_mm_h>300)) return {scenario:null,label:'Serie meteorológica incompleta o fuera de rango: agua no calculada',updated:source.retrieved_at};
    return {scenario:{rainMmH:0,durationH:Math.min(168,source.hours.length),infiltrationMmH:2,drainageMmH:3,seaHeadM:null,forcing:source.hours.map(p=>({hour:p.hour,rainMmH:p.rain_mm_h!}))},label:'Open-Meteo horario · cálculo espacial exploratorio',updated:source.retrieved_at};
  }
  // A snapshot is not a historical series: do not extend it into a false forecast.
  return {scenario:null,label:'Sin serie meteorológica original; usa un escenario manual',updated:null};
}

/** Geographic azimuthal equidistant local approximation, < metre at neighbourhood scale.
 * GIS builder uses ellipsoidal PROJ AEQD; this is used for legacy zone markers only. */
export function zoneLocal(lat:number,lon:number): [number,number] {
  return [(lon+75.5357)*109501.7,(lat-10.41145)*110611.2];
}
export function insideBoundary(x:number,y:number,ring:[number,number][]) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
