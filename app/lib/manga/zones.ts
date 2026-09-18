import { insideBoundary, zoneLocal } from './adapter';
import type { MangaData, WaterResult } from './types';

export interface SpatialZone { id:number; coordenadas:[number,number]; radio_influencia:number }
export interface ZoneWater { meanCm:number; maxCm:number; wetAreaM2:number; cells:number; seconds:number }

/** Cell-centre membership in each reference radius; overlapping zones may
 * share cells. These are spatial model summaries, not the separate zonal EDO. */
export function zoneCells(data:MangaData,zones:SpatialZone[]) {
  return new Map(zones.map(zone=>{
    const [x,y]=zoneLocal(...zone.coordenadas);
    const ids=insideBoundary(x,y,data.boundary)?data.grid.cells.flatMap((c,i)=>
      Math.hypot(c.x-x,c.y-y)<=zone.radio_influencia?[i]:[]):[];
    return [zone.id,ids];
  }));
}
export function summarizeZones(data:MangaData,members:Map<number,number[]>,result:WaterResult|null) {
  const summary=new Map<number,ZoneWater>();
  if(!result)return summary;
  for(const [id,ids] of members){
    if(!ids.length)continue;
    let area=0,volume=0,max=0,wetArea=0;
    for(const i of ids){const c=data.grid.cells[i],d=result.depth[i];if(!Number.isFinite(d))continue;
      area+=c.area;volume+=c.area*d;max=Math.max(max,d);if(d>=.01)wetArea+=c.area;
    }
    if(area)summary.set(id,{meanCm:100*volume/area,maxCm:100*max,wetAreaM2:wetArea,cells:ids.length,seconds:result.seconds});
  }
  return summary;
}
export function waterColor(cm:number|undefined) {
  return cm===undefined?'#9ba6ae':cm<1?'#a6d1b1':cm<10?'#69c9eb':cm<30?'#248abe':'#183b88';
}
