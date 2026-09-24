import { useEffect, useMemo, useState } from 'react';
import { displayGroundElevation } from './portLayout';

export type MangaDemCell = { x:number; y:number; z:number; triangles:number[][][] };
export type MangaRoad = {triangles:number[][][]};
export type MangaDem = { grid:{ dx?:number; cells:MangaDemCell[] }; roads?:MangaRoad[]; sidewalks?:number[][][]; markings?:number[][][] };
export type GroundSampler = (x:number,y:number)=>number|null;
export type RoadSnap = {x:number;y:number;distance:number};
export type RoadSnapper = (x:number,y:number,maxDistance?:number)=>RoadSnap|null;

/** Repair isolated zero-valued interior DEM voids from nearby land cells. True
 * coastal zeroes are preserved; a single missing SRTM sample must not become
 * an artificial pit that traps the entire rainfall simulation. */
export function repairInteriorDemVoids<T extends {x:number;y:number;z:number;coastal?:boolean;triangles:number[][][]}>(cells:T[]):T[] {
  const isVoid=(cell:T)=>!cell.coastal&&cell.triangles.length>0&&cell.triangles.every(t=>t.every(p=>Math.abs(p[2])<1e-8));
  const voids=new Set(cells.map((cell,i)=>isVoid(cell)?i:-1).filter(i=>i>=0));
  if(!voids.size)return cells;
  const candidates=cells.map((cell,i)=>({cell,i})).filter(({cell,i})=>!voids.has(i)&&!cell.coastal&&Number.isFinite(cell.z)&&Math.abs(cell.z)>.03&&cell.z>=-2&&cell.z<=12);
  const sample=(x:number,y:number)=>{
    const near=candidates.map(({cell})=>({cell,d:(cell.x-x)**2+(cell.y-y)**2})).filter(n=>n.d<=100**2).sort((a,b)=>a.d-b.d).slice(0,8);
    if(!near.length)return 0;
    let value=0,weight=0;
    for(const n of near){const w=1/Math.max(25,n.d);value+=n.cell.z*w;weight+=w;}
    return Math.max(-2,Math.min(12,value/weight));
  };
  return cells.map((cell,i)=>{
    if(!voids.has(i))return cell;
    const z=sample(cell.x,cell.y),triangles=cell.triangles.map(tri=>tri.map(p=>[p[0],p[1],sample(p[0],p[1])]));
    return {...cell,z,triangles} as T;
  });
}

function closestOnSegment(x:number,y:number,a:number[],b:number[]) {
  const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den)):0;
  return {x:a[0]+dx*t,y:a[1]+dy*t};
}

function insideTriangle(x:number,y:number,t:number[][]) {
  const [a,b,c]=t,den=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  if(Math.abs(den)<1e-8)return false;
  const u=((x-a[0])*(c[1]-a[1])-(c[0]-a[0])*(y-a[1]))/den;
  const v=((b[0]-a[0])*(y-a[1])-(x-a[0])*(b[1]-a[1]))/den;
  return u>=-1e-6&&v>=-1e-6&&u+v<=1.000001;
}

/** Snaps a geographic hazard point onto the mapped road surface, only when
 * the source point is already close enough to plausibly refer to that road. */
export function createRoadSnapper(roads:MangaRoad[]|undefined):RoadSnapper {
  const triangles=(roads??[]).flatMap(road=>road.triangles).filter(t=>t.length===3);
  return (x,y,maxDistance=25)=>{
    let best:RoadSnap|null=null;
    for(const t of triangles){
      let px:number,py:number;
      if(insideTriangle(x,y,t)){px=x;py=y;}
      else {
        const candidates=[closestOnSegment(x,y,t[0],t[1]),closestOnSegment(x,y,t[1],t[2]),closestOnSegment(x,y,t[2],t[0])];
        const near=candidates.reduce((a,b)=>Math.hypot(a.x-x,a.y-y)<=Math.hypot(b.x-x,b.y-y)?a:b);
        px=near.x;py=near.y;
      }
      const distance=Math.hypot(px-x,py-y);
      if(!best||distance<best.distance)best={x:px,y:py,distance};
      if(distance===0)return {x,y,distance:0};
    }
    return best&&best.distance<=maxDistance?best:null;
  };
}

export function useRoadSnapper(dem:MangaDem|null):RoadSnapper|null {
  return useMemo(()=>dem?createRoadSnapper(dem.roads):null,[dem]);
}

export function useMangaDem() {
  const [dem,setDem]=useState<MangaDem|null>(null);
  useEffect(()=>{
    let alive=true;
    Promise.all([
      fetch('/models/manga/manga.json').then(r=>{if(!r.ok)throw new Error(`DEM ${r.status}`);return r.json() as Promise<MangaDem>;}),
      fetch('/models/manga/visual-geometry.json').then(r=>r.ok?r.json() as Promise<{roads:number[][][];sidewalks:number[][][];markings:number[][][]}>:null).catch(()=>null),
    ]).then(([v,visual])=>{
      if(!alive)return;
      v.grid.cells=repairInteriorDemVoids(v.grid.cells);
      if(visual){v.roads=[{triangles:visual.roads}];v.sidewalks=visual.sidewalks;v.markings=visual.markings;}
      setDem(v);
    }).catch(e=>console.error('No se pudo cargar el DEM de Manga:',e));
    return ()=>{alive=false;};
  },[]);
  return dem;
}

export function useGroundSampler(dem:MangaDem|null):GroundSampler|null {
  return useMemo(()=>{
    if(!dem)return null;
    const step=dem.grid.dx||40,buckets=new Map<string,number[][][]>(),cellBuckets=new Map<string,MangaDemCell[]>();
    const keyAt=(x:number,y:number)=>`${Math.floor(x/step)},${Math.floor(y/step)}`;
    for(const c of dem.grid.cells){const key=keyAt(c.x,c.y),cb=cellBuckets.get(key)||[];cb.push(c);cellBuckets.set(key,cb);for(const tri of c.triangles){
      const minX=Math.min(...tri.map(p=>p[0])),maxX=Math.max(...tri.map(p=>p[0]));
      const minY=Math.min(...tri.map(p=>p[1])),maxY=Math.max(...tri.map(p=>p[1]));
      for(let ix=Math.floor(minX/step);ix<=Math.floor(maxX/step);ix++)for(let iy=Math.floor(minY/step);iy<=Math.floor(maxY/step);iy++){
        const key=`${ix},${iy}`,bucket=buckets.get(key)||[];bucket.push(tri);buckets.set(key,bucket);
      }
    }}
    return (x:number,y:number)=>{
      const ix=Math.floor(x/step),iy=Math.floor(y/step);
      for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++)for(const tri of buckets.get(`${ix+ox},${iy+oy}`)||[]){
        const [a,b,c]=tri,den=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(den)<1e-8)continue;
        const u=((x-a[0])*(c[1]-a[1])-(c[0]-a[0])*(y-a[1]))/den;
        const v=((b[0]-a[0])*(y-a[1])-(x-a[0])*(b[1]-a[1]))/den;
        if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001){
          const h=displayGroundElevation(a[0],a[1],a[2])*(1-u-v)+displayGroundElevation(b[0],b[1],b[2])*u+displayGroundElevation(c[0],c[1],c[2])*v;
          return h;
        }
      }
      const candidates:MangaDemCell[]=[];for(let ox=-2;ox<=2;ox++)for(let oy=-2;oy<=2;oy++)candidates.push(...(cellBuckets.get(`${ix+ox},${iy+oy}`)||[]));
      if(!candidates.length)return null;
      const near=candidates.map(c=>({c,d:(c.x-x)**2+(c.y-y)**2})).sort((a,b)=>a.d-b.d).slice(0,4);
      if(!near.length||near[0].d>step*step*4)return null;
      let total=0,weights=0;for(const {c,d} of near){const w=1/Math.max(1,d);total+=displayGroundElevation(c.x,c.y,c.z)*w;weights+=w;}
      return weights?total/weights:0;
    };
  },[dem]);
}

export function useRoadMask(dem:MangaDem|null) {
  return useMemo(()=>{
    if(!dem)return null;
    const step=25,buckets=new Map<string,number[][][]>();
    for(const road of dem.roads||[])for(const tri of road.triangles){
      const minX=Math.min(...tri.map(p=>p[0]))-3,maxX=Math.max(...tri.map(p=>p[0]))+3;
      const minY=Math.min(...tri.map(p=>p[1]))-3,maxY=Math.max(...tri.map(p=>p[1]))+3;
      for(let ix=Math.floor(minX/step);ix<=Math.floor(maxX/step);ix++)for(let iy=Math.floor(minY/step);iy<=Math.floor(maxY/step);iy++){
        const key=`${ix},${iy}`,items=buckets.get(key)||[];items.push(tri);buckets.set(key,items);
      }
    }
    return (x:number,y:number)=>{
      for(const tri of buckets.get(`${Math.floor(x/step)},${Math.floor(y/step)}`)||[]){
        const [a,b,c]=tri,den=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(den)<1e-8)continue;
        const u=((x-a[0])*(c[1]-a[1])-(c[0]-a[0])*(y-a[1]))/den;
        const v=((b[0]-a[0])*(y-a[1])-(x-a[0])*(b[1]-a[1]))/den;
        if(u>=0&&v>=0&&u+v<=1)return true;
      }
      return false;
    };
  },[dem]);
}
