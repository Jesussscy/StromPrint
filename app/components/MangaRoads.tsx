"use client";
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGroundSampler, type MangaDem } from '@/app/lib/manga/ground';

function surfaceGeometry(triangles:number[][][]|undefined,ground:ReturnType<typeof useGroundSampler>,lift:number) {
  if(!triangles?.length)return null;
  const positions:number[]=[];
  for(const tri of triangles)for(const p of tri)positions.push(p[0],(ground?.(p[0],p[1])??p[2])+lift,-p[1]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

export default function MangaRoads({dem,visible}:{dem:MangaDem|null;visible:boolean}) {
  const ground=useGroundSampler(dem);
  const meshes=useMemo(()=>{
    if(!dem||!ground)return null;
    const roadTriangles=(dem.roads||[]).flatMap(road=>road.triangles);
    return {
      road:surfaceGeometry(roadTriangles,ground,.16),
      sidewalk:surfaceGeometry(dem.sidewalks,ground,.145),
      markings:surfaceGeometry(dem.markings,ground,.18),
    };
  },[dem,ground]);
  useEffect(()=>()=>{if(meshes){meshes.road?.dispose();meshes.sidewalk?.dispose();meshes.markings?.dispose();}},[meshes]);
  if(!meshes?.road)return null;
  return <group visible={visible} frustumCulled={false}>
    {meshes.sidewalk&&<mesh geometry={meshes.sidewalk} receiveShadow renderOrder={1}>
      <meshStandardMaterial color="#b9b5a5" roughness={.96} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
    </mesh>}
    <mesh geometry={meshes.road} receiveShadow renderOrder={2}>
      <meshStandardMaterial color="#454c4b" roughness={.93} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
    </mesh>
    {meshes.markings&&<mesh geometry={meshes.markings} renderOrder={3}>
      <meshStandardMaterial color="#d8d0ae" roughness={.9} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/>
    </mesh>}
  </group>;
}
