"use client";

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Building, MangaData } from '@/app/lib/manga/types';
import type { GroundSampler } from '@/app/lib/manga/ground';
import type { MangaPoi } from '@/app/lib/manga/poi';

const palette=['#e7dfcf','#ddd4c2','#d9c3ae','#cedfdd','#c9d9dc','#ece8dc'];
const roofPalette=['#c28565','#af7558','#d7c49c','#bac9c5','#b7a98d','#6f8584'];

/** Rebuild mapped footprints against the live DEM. The baked GLB groups whole
 * 300 m tiles at one height, which can bury individual houses on uneven ground. */
export default function MangaBuildings({buildings,ground,visible,pois,onSelectPoi}:{buildings:Building[];ground:GroundSampler|null;visible:boolean;pois:MangaPoi[];onSelectPoi:(id:string)=>void}) {
  const geometry=useMemo(()=>{
    if(!buildings.length)return null;
    const positions:number[]=[],colors:number[]=[],windowPositions:number[]=[],windowColors:number[]=[],color=new THREE.Color();
    const faceRanges:{id:string;start:number;end:number}[]=[];
    const push=(x:number,y:number,z:number,c:string)=>{
      positions.push(x,z,-y);color.set(c);colors.push(color.r,color.g,color.b);
    };
    const elevation=(x:number,y:number,fallback:number)=>ground?.(x,y)??fallback;
    for(const building of buildings){
      const start=positions.length/9;
      const ring=building.rings[0]??[];
      const area=Math.abs(ring.slice(0,-1).reduce((sum,p,i)=>{const q=ring[(i+1)%(ring.length-1)];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
      const tier=area<75?0:area<230?1:2;
      // Keep surveyed/mapped heights; give buildings without height tags three
      // visibly different urban typologies instead of repeating one 6 m box.
      const mapped=Number.isFinite(building.height)?building.height:6;
      const height=building.heightMethod?.startsWith('estimada')?Math.max(3.5,[4.6,8.2,12.5][tier]+(parseInt(building.id.replace(/\D/g,'').slice(-2)||'0',10)%4)*.55):Math.max(2,mapped);
      const base=Number.isFinite(building.base)?building.base:0;
      const buildingSeed=parseInt(building.id.replace(/\D/g,'').slice(-3)||'0',10);
      const wall=palette[(buildingSeed+tier)%palette.length];
      const roof=roofPalette[(buildingSeed*3+tier)%roofPalette.length];
      const side=new THREE.Color(wall).multiplyScalar(.78).getStyle();
      for(const footprint of building.rings){
        for(let i=0;i+1<footprint.length;i++){
          const a=footprint[i],b=footprint[i+1],za=elevation(a[0],a[1],base)+.025,zb=elevation(b[0],b[1],base)+.025;
          const topA=za+height,topB=zb+height;
          push(a[0],a[1],za,side);push(b[0],b[1],zb,side);push(b[0],b[1],topB,side);
          push(a[0],a[1],za,side);push(b[0],b[1],topB,side);push(a[0],a[1],topA,side);
          // Recessed-looking facade glazing, repeated according to each wall's
          // length and building height so small homes and larger blocks read differently.
          const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
          if(footprint===ring&&length>=7){
            const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
            const cx=footprint.reduce((s,p)=>s+p[0],0)/footprint.length,cy=footprint.reduce((s,p)=>s+p[1],0)/footprint.length;
            const nx=mx-cx,ny=my-cy,norm=Math.hypot(nx,ny)||1;
            const bays=Math.max(1,Math.min(8,Math.floor(length/5.5)));
            for(let bay=0;bay<bays;bay++)for(let floor=0;floor<Math.min(5,Math.floor(height/3.1));floor++){
              const t=(bay+.5)/bays,u=Math.min(1,(floor*3.1+1.35)/height);
              const x=a[0]+dx*t+nx/norm*.055,y=a[1]+dy*t+ny/norm*.055;
              const z=elevation(x,y,base)+.08+height*u,ww=Math.min(1.45,length/bays*.34),hh=Math.min(1.45,height*.2);
              const tx=dx/length*ww*.5,ty=dy/length*ww*.5;
              for(const [px,py,pz] of [[x-tx,y-ty,z-hh/2],[x+tx,y+ty,z-hh/2],[x+tx,y+ty,z+hh/2],[x-tx,y-ty,z-hh/2],[x+tx,y+ty,z+hh/2],[x-tx,y-ty,z+hh/2]]){
                windowPositions.push(px,pz,-py);color.set(tier===2?'#315762':'#376773');windowColors.push(color.r,color.g,color.b);
              }
            }
          }
        }
      }
      let roofTriangles=building.roofTriangles;
      if(!roofTriangles.length&&ring.length>=4){
        // Keep buildings capped even when an upstream footprint has no roof mesh.
        const contours=building.rings.map(points=>points.length>1&&points[0][0]===points[points.length-1][0]&&points[0][1]===points[points.length-1][1]?points.slice(0,-1):points);
        const vertices=contours.flat();
        try {
          const faces=THREE.ShapeUtils.triangulateShape(contours[0].map(p=>new THREE.Vector2(p[0],p[1])),contours.slice(1).map(points=>points.map(p=>new THREE.Vector2(p[0],p[1]))));
          roofTriangles=faces.map(face=>face.map(i=>vertices[i]) as [number,number][]);
        } catch { roofTriangles=[]; }
      }
      for(const tri of roofTriangles){
        for(const [x,y] of tri)push(x,y,elevation(x,y,base)+height,roof);
      }
      faceRanges.push({id:building.id,start,end:positions.length/9});
    }
    const next=new THREE.BufferGeometry();
    next.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    next.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    next.computeVertexNormals();
    const glazing=new THREE.BufferGeometry();
    glazing.setAttribute('position',new THREE.Float32BufferAttribute(windowPositions,3));
    glazing.setAttribute('color',new THREE.Float32BufferAttribute(windowColors,3));
    glazing.computeVertexNormals();
    return {body:next,glazing,faceRanges};
  },[buildings,ground]);
  useEffect(()=>()=>{geometry?.body.dispose();geometry?.glazing.dispose();},[geometry]);
  if(!geometry)return null;
  const poiByBuilding=new Map(pois.filter(p=>p.buildingId).map(p=>[p.buildingId!,p]));
  return <group visible={visible}>
    <mesh geometry={geometry.body} castShadow receiveShadow frustumCulled={false} onClick={event=>{
      if(event.faceIndex==null)return;
      const range=geometry.faceRanges.find(r=>event.faceIndex!>=r.start&&event.faceIndex!<r.end);
      const poi=range&&poiByBuilding.get(range.id);
      if(poi){event.stopPropagation();onSelectPoi(poi.id);}
    }}><meshStandardMaterial vertexColors roughness={.88} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={geometry.glazing} frustumCulled={false}><meshStandardMaterial vertexColors roughness={.3} metalness={.12} side={THREE.DoubleSide}/></mesh>
  </group>;
}
