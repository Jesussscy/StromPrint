"use client";
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { GroundSampler } from '@/app/lib/manga/ground';

type P=[number,number];
type BoxItem={x:number;y:number;ground:number;angle:number;size:[number,number,number];lift:number};
const box=new THREE.BoxGeometry(1,1,1);
const mats={soil:new THREE.MeshStandardMaterial({color:'#bcb69f',roughness:.96,side:THREE.DoubleSide}),
  wall:new THREE.MeshStandardMaterial({color:'#d0c9b2',roughness:.9}),stone:new THREE.MeshStandardMaterial({color:'#a8aaa2',roughness:.88}),
  marble:new THREE.MeshStandardMaterial({color:'#e4e1d3',roughness:.8}),trim:new THREE.MeshStandardMaterial({color:'#8d917f',roughness:.87})};
function inside(x:number,y:number,poly:P[]){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function Boxes({items,material}:{items:BoxItem[];material:THREE.Material}){
  const ref=useMemo(()=>new THREE.InstancedMesh(box,material,items.length),[items,material]);
  useLayoutEffect(()=>{const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();items.forEach((item,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),item.angle);scale.set(...item.size);matrix.compose(new THREE.Vector3(item.x,item.ground+item.lift+item.size[1]/2,-item.y),q,scale);ref.setMatrixAt(i,matrix);});ref.instanceMatrix.needsUpdate=true;ref.computeBoundingSphere();return()=>{ref.dispose();};},[items,ref]);
  if(!items.length)return null;
  return <primitive object={ref} castShadow receiveShadow/>;
}

/** Raised reconstruction of Santa Cruz de Manga cemetery using the mapped OSM
 * perimeter and 306 small graves / 30 mausoleums from the existing v6.1 model. */
export default function MangaCemetery({polygon,ground,visible}:{polygon:readonly (readonly number[])[];ground:GroundSampler|null;visible:boolean}){
  const built=useMemo(()=>{
    const poly=polygon.map(p=>[p[0],p[1]] as P),segments=poly.slice(0,-1).map((p,i)=>[p,poly[i+1]] as [P,P]);
    const northIndex=segments.reduce((best,s,i)=>(s[0][1]+s[1][1])>(segments[best][0][1]+segments[best][1][1])?i:best,0);
    const [na,nb]=segments[northIndex];
    const entry:P=[(na[0]+nb[0])/2,(na[1]+nb[1])/2],angle=Math.atan2(nb[1]-na[1],nb[0]-na[0]);
    const cp=(x:number,y:number):P=>[entry[0]+x*Math.cos(angle)-y*Math.sin(angle),entry[1]+x*Math.sin(angle)+y*Math.cos(angle)];
    const direction=inside(...cp(0,8),poly)?1:-1, height=(x:number,y:number)=>ground?.(x,y)??0;
    const soilVertices:number[]=[],contour=poly.slice(0,-1).map(([x,y])=>new THREE.Vector2(x,y)),tris=THREE.ShapeUtils.triangulateShape(contour,[]);
    for(const tri of tris)for(const index of tri){const [x,y]=poly[index],z=height(x,y)+.3;soilVertices.push(x,z,-y);}
    const soil=new THREE.BufferGeometry();soil.setAttribute('position',new THREE.Float32BufferAttribute(soilVertices,3));soil.computeVertexNormals();
    const graves:BoxItem[]=[],mausoleums:BoxItem[]=[],crosses:BoxItem[]=[],crossBars:BoxItem[]=[],walls:BoxItem[]=[],pillars:BoxItem[]=[];
    for(let row=10;row<160;row+=6)for(let col=-100;col<=100;col+=5){
      if(Math.abs(col)<4||row%30===10)continue;
      const footprint=[[-2,-2],[2,-2],[2,2],[-2,2]].map(([dx,dy])=>cp(col+dx,(row+dy)*direction));
      if(!footprint.every(([x,y])=>inside(x,y,poly)))continue;
      const [x,y]=cp(col,row*direction),base=height(x,y)+.32,item={x,y,ground:base,angle:angle,size:[2.8,.42,3.8] as [number,number,number],lift:0};
      graves.push(item);
      if((Math.floor(col/5)+Math.floor(row/6))%11===0){
        mausoleums.push({...item,size:[2.55,2.4,3.5],lift:.42});
        mausoleums.push({...item,size:[2.95,.34,3.9],lift:2.65});
      }else{
        graves.push({...item,size:[2.3,.72,3.25],lift:.42});
        crosses.push({...item,size:[.16,.85,.18],lift:1.25});
        crossBars.push({...item,size:[.68,.15,.18],lift:1.52});
      }
    }
    segments.forEach(([a,b],i)=>{
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),theta=Math.atan2(b[1]-a[1],b[0]-a[0]);
      const pieces=i===northIndex?[[0,.42],[.58,1]]:[[0,1]];
      for(const [start,end] of pieces){const t=(start+end)/2,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,len=length*(end-start);if(len<1)continue;walls.push({x,y,ground:height(x,y),angle:theta,size:[len,2.35,.5],lift:.3});}
    });
    for(const side of [-1,1]){const [x,y]=cp(side*10,0);pillars.push({x,y,ground:height(x,y),angle,size:[1.1,4.6,1.1],lift:.3});}
    const [gx,gy]=entry;const gate:BoxItem={x:gx,y:gy,ground:height(gx,gy),angle,size:[20,.5,.65],lift:4.15};
    return {soil,walls,graves,mausoleums,crosses,crossBars,pillars,gate};
  },[polygon,ground]);
  useEffect(()=>()=>built.soil.dispose(),[built]);
  return <group visible={visible}>
    <mesh geometry={built.soil} receiveShadow><primitive object={mats.soil} attach="material"/></mesh>
    <Boxes items={built.walls} material={mats.wall}/><Boxes items={built.pillars} material={mats.marble}/><Boxes items={[built.gate]} material={mats.trim}/>
    <Boxes items={built.graves} material={mats.stone}/><Boxes items={built.mausoleums} material={mats.marble}/><Boxes items={built.crosses} material={mats.marble}/><Boxes items={built.crossBars} material={mats.marble}/>
  </group>;
}
