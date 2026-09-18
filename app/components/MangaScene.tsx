"use client";
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Bvh, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Building, MangaData, Scenario } from '@/app/lib/manga/types';

export type RenderQuality='high'|'balanced'|'performance';
export interface LandscapeInstances {trees:{position:number[];height:number;kind:string;rotation:number}[];lamps:number[][];shrubs?:number[][];perimeter?:number[][];parks?:{name:string;osmId:number;position:number[];source:string}[]}
interface Props {data:MangaData;buildings:boolean;vegetation:boolean;quality:RenderQuality;rainMmH?:number;rainFootprint?:Scenario['rainFootprint'];instances:LandscapeInstances|null;heights?:Record<string,number>;onBuilding:(b:Building)=>void;onReady:()=>void}

const noRaycast=()=>{};
function surfaces(material:THREE.Material,facade=false,ground=false,wet={value:0},field={value:new THREE.Vector3()}) {
  const m=material.clone() as THREE.MeshStandardMaterial;
  m.side=THREE.DoubleSide;m.roughness=.85;m.metalness=0;
  // World-scale grain: stable across LODs, no unique texture per building.
  m.onBeforeCompile=shader=>{
    shader.uniforms.mangaWet=wet;
    shader.uniforms.mangaRainField=field;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 surfacePosition; varying vec3 surfaceNormal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nsurfacePosition=(modelMatrix*vec4(position,1.)).xyz; surfaceNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float mangaWet; uniform vec3 mangaRainField; varying vec3 surfacePosition; varying vec3 surfaceNormal;
      float grain(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,39.425)))*43758.5453);}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
      float variation=sin(surfacePosition.x*.63+sin(surfacePosition.z*.21))*sin(surfacePosition.z*.71);
      diffuseColor.rgb*=.97+.045*variation+.025*grain(floor(surfacePosition*18.));
      float up=smoothstep(.4,.9,abs(surfaceNormal.y));
      float localWet=mangaWet*(mangaRainField.z>0.?1.-smoothstep(.65,1.,distance(surfacePosition.xz,mangaRainField.xy)/mangaRainField.z):1.);
      diffuseColor.rgb*=1.-localWet*up*.22;
      // Roof texture is artistic, derivative-filtered and adds no geometry.
      float clay=smoothstep(.025,.12,diffuseColor.r-diffuseColor.g)*smoothstep(.55,.9,abs(surfaceNormal.y));
      vec2 roofUV=surfacePosition.xz*vec2(3.5,2.4);
      float tileAA=max(fwidth(roofUV.x),fwidth(roofUV.y));
      float seam=1.-smoothstep(.035,.035+max(.01,tileAA),min(fract(roofUV.y),1.-fract(roofUV.y)));
      float rib=sin(roofUV.x*6.2831853)*.06;
      float tileFade=1.-smoothstep(.2,.7,tileAA);
      diffuseColor.rgb*=1.+clay*tileFade*(rib-seam*.13);
      float wallWear=(1.-up)*(.035*sin(surfacePosition.y*.3+surfacePosition.x*.027));
      diffuseColor.rgb*=1.+wallWear;
      ${ground?`// Asphalt identification uses the exported mineral material color.
      float grey=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
      float asphalt=(1.-smoothstep(.015,.05,grey))*(1.-smoothstep(.09,.16,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))));
      float grainFade=1.-smoothstep(.025,.12,max(length(dFdx(surfacePosition)),length(dFdy(surfacePosition))));
      float aggregate=grain(floor(surfacePosition*35.))-.5;
      diffuseColor.rgb*=1.+asphalt*(aggregate*.32*grainFade+variation*.09);`:''}
      ${facade?`// Inferred facade only on distant LOD; close buildings retain modeled details.
      float wall=1.-smoothstep(.15,.45,abs(surfaceNormal.y));
      vec2 uv=vec2(abs(surfaceNormal.x)>.5?surfacePosition.z:surfacePosition.x,surfacePosition.y)/vec2(3.2,3.1);
      vec2 q=fract(uv);
      float pane=smoothstep(.18,.25,q.x)*(1.-smoothstep(.68,.75,q.x))*smoothstep(.28,.35,q.y)*(1.-smoothstep(.73,.80,q.y));
      float fade=1.-smoothstep(.15,.65,max(fwidth(uv.x),fwidth(uv.y)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.29,.31),pane*wall*fade*.6);`:''}`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,.3,localWet*smoothstep(.4,.9,abs(surfaceNormal.y)));`);
  };
  m.customProgramCacheKey=()=>`manga-surface11-${facade}-${ground}`;
  return m;
}

export function District({data,buildings,vegetation,quality,rainMmH=0,rainFootprint,instances,heights,onBuilding,onReady}:Props) {
  const wet=useMemo(()=>({value:0}),[]);
  const field=useMemo(()=>({value:new THREE.Vector3()}),[]);
  field.value.set(rainFootprint?.x??0,-(rainFootprint?.y??0),rainFootprint?.radiusM??0);
  // Instant visual wetness follows the selected hour; no fabricated water volume.
  wet.value=Number.isFinite(rainMmH)?Math.min(1,Math.max(0,rainMmH)/12):0;
  const {scene}=useGLTF('/models/manga/checkpoint08/district.glb','/models/manga/draco/');
  const {scene:landscape}=useGLTF('/models/manga/checkpoint12/landscape.glb','/models/manga/draco/');
  const garden=useMemo(()=>{
    const clone=landscape.clone(true);clone.updateMatrixWorld(true);
    clone.traverse(o=>{if(o.name==='Tree_canopy12'||o.name==='Shrub12')o.visible=false;if(o instanceof THREE.Mesh){o.raycast=noRaycast;o.castShadow=true;o.receiveShadow=true;}});
    return clone;
  },[landscape]);
  const canopy=useMemo(()=>{
    const prototypes:THREE.Mesh[]=[];
    garden.getObjectByName('Tree_canopy12')?.traverse(source=>{if(source instanceof THREE.Mesh)prototypes.push(new THREE.Mesh(source.geometry.clone().applyMatrix4(source.matrixWorld),source.material));});
    return prototypes;
  },[garden]);
  useEffect(()=>()=>canopy.forEach(p=>p.geometry.dispose()),[canopy]);
  const local=useMemo(()=>{
    const clone=scene.clone(true);const materials=new Map<string,THREE.Material>();
    clone.traverse(o=>{if(o instanceof THREE.Mesh){
      const original=o.material as THREE.Material;
      const facade=o.userData.lod==='far',ground=o.userData.lod==='ground',key=original.uuid+`-${facade}-${ground}`;
      if(!materials.has(key))materials.set(key,surfaces(original,facade,ground,wet,field));
      o.material=materials.get(key)!;o.raycast=noRaycast;o.castShadow=true;o.receiveShadow=true;
      if(o.name.startsWith('Tree_')||o.userData.lod==='base'||o.userData.lod==='detail')o.visible=false;
      o.geometry.computeBoundingSphere();
    }});return clone;
  },[scene,wet,field]);
  useEffect(()=>{onReady();return()=>{const mats=new Set<THREE.Material>();local.traverse(o=>{if(o instanceof THREE.Mesh)mats.add(o.material as THREE.Material);});mats.forEach(m=>m.dispose());};},[local,onReady]);
  const groups=useMemo(()=>{
    const list: {mesh:THREE.Mesh;kind:string;center:THREE.Vector3}[]=[];
    local.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.lod){list.push({mesh:o,kind:o.userData.lod,center:new THREE.Vector3((o.userData.tile_x+.5)*240,8,-(o.userData.tile_y+.5)*240)});}});
    return list;
  },[local]);
  const tick=useRef(0);
  useFrame(({camera},dt)=>{
    tick.current+=dt;if(tick.current<.12)return;tick.current=0;
    const near=quality==='high'?420:quality==='balanced'?260:130;
    const far=quality==='high'?1450:quality==='balanced'?1000:650;
    for(const g of groups){
      // Cell edge distance, not distance to the city's origin.
      const d=Math.max(0,camera.position.distanceTo(g.center)-170);
      g.mesh.visible=g.kind==='far'?buildings&&d>=far:g.kind==='base'?buildings&&d<far:g.kind==='detail'?buildings&&d<near:(g.kind==='grass'||g.kind==='soil')?false:true;
    }
  });
  return <><primitive object={local}/>{buildings&&<BuildingPicker data={data} heights={heights} onBuilding={onBuilding}/>}
    {vegetation&&<primitive object={garden}/>}
    {vegetation&&instances&&<Trees scene={local} canopy={canopy} items={instances.trees}/>}
    {vegetation&&instances?.shrubs&&<Shrubs positions={instances.shrubs}/>}
    {instances&&<StreetLamps positions={instances.lamps}/>}
  </>;
}

function BuildingPicker({data,heights,onBuilding}:{data:MangaData;heights?:Record<string,number>;onBuilding:(b:Building)=>void}) {
  const {geometry,ids}=useMemo(()=>{
    const positions:number[]=[];const ids:number[]=[];
    const tri=(points:number[][],id:number)=>{for(const p of points)positions.push(p[0],p[2],-p[1]);ids.push(id);};
    data.buildings.forEach((b,id)=>{
      const z=b.base+(heights?.[b.id]??b.height);
      for(const t of b.roofTriangles)tri(t.map(p=>[p[0],p[1],z]),id);
      for(const ring of b.rings)for(let i=0;i<ring.length-1;i++){
        const a=[...ring[i],b.base],c=[...ring[i+1],b.base],d=[...ring[i+1],z],e=[...ring[i],z];
        tri([a,c,d],id);tri([a,d,e],id);
      }
    });
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    return {geometry,ids};
  },[data,heights]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  function select(e:ThreeEvent<MouseEvent>){if(e.delta>4||e.faceIndex==null)return;e.stopPropagation();const b=data.buildings[ids[e.faceIndex]];if(b)onBuilding(b);}
  // Indirect BVH preserves faceIndex -> original OSM building mapping.
  return <Bvh firstHitOnly indirect><mesh geometry={geometry} onClick={select} renderOrder={-10}>
    <meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide}/>
  </mesh></Bvh>;
}

function Trees({scene,canopy,items}:{scene:THREE.Object3D;canopy:THREE.Mesh[];items:LandscapeInstances['trees']}) {
  const batches=useMemo(()=>['palm','canopy'].map(kind=>({kind,items:items.filter(t=>t.kind===kind)})),[items]);
  return <>{batches.flatMap(batch=>{const prototypes=batch.kind==='canopy'?canopy:[scene.getObjectByName('Tree_'+batch.kind) as THREE.Mesh];return prototypes.filter(Boolean).map((prototype,i)=><TreeBatch key={batch.kind+i} prototype={prototype} items={batch.items}/>);})}</>;
}
function Shrubs({positions}:{positions:number[][]}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  useEffect(()=>{if(!ref.current)return;const dummy=new THREE.Object3D();positions.forEach((p,i)=>{dummy.position.set(p[0],p[2]+p[3]*.5,-p[1]);dummy.scale.set(p[3]*.7,p[3]*.55,p[3]*.65);dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);});ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();},[positions]);
  return <instancedMesh ref={ref} args={[undefined,undefined,positions.length]} raycast={noRaycast} castShadow receiveShadow><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#55792e" roughness={.95}/></instancedMesh>;
}

export function CoverageBoundary({points}:{points:number[][]}) {
  const geometry=useMemo(()=>{const p:number[]=[];for(let i=1;i<points.length;i++)for(const v of [points[i-1],points[i]])p.push(v[0],v[2],-v[1]);return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p,3));},[points]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <lineSegments geometry={geometry}><lineBasicMaterial color="#bd975d" transparent opacity={.7}/></lineSegments>;
}
function TreeBatch({prototype,items}:{prototype:THREE.Mesh;items:LandscapeInstances['trees']}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  useEffect(()=>{if(!ref.current)return;const dummy=new THREE.Object3D();items.forEach((t,i)=>{
    dummy.position.set(t.position[0],t.position[2],-t.position[1]);dummy.rotation.set(0,t.rotation,0);dummy.scale.setScalar(t.height/8);dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);
  });ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();},[items]);
  return <instancedMesh ref={ref} args={[prototype.geometry,prototype.material,items.length]} raycast={noRaycast} castShadow receiveShadow/>;
}
function StreetLamps({positions}:{positions:number[][]}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  const heads=useRef<THREE.InstancedMesh>(null);
  useEffect(()=>{if(!heads.current)return;const dummy=new THREE.Object3D();positions.forEach((p,i)=>{dummy.position.set(p[0]+.45,p[2]+5,-p[1]);dummy.updateMatrix();heads.current!.setMatrixAt(i,dummy.matrix);});heads.current.instanceMatrix.needsUpdate=true;heads.current.computeBoundingSphere();},[positions]);
  useEffect(()=>{if(!ref.current)return;const dummy=new THREE.Object3D();positions.forEach((p,i)=>{dummy.position.set(p[0],p[2]+2.5,-p[1]);dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);});ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();},[positions]);
  return <><instancedMesh ref={ref} args={[undefined,undefined,positions.length]} raycast={noRaycast}><cylinderGeometry args={[.07,.11,5,6]}/><meshStandardMaterial color="#526363" roughness={.7}/></instancedMesh><instancedMesh ref={heads} args={[undefined,undefined,positions.length]} raycast={noRaycast}><boxGeometry args={[1,.12,.3]}/><meshStandardMaterial color="#9b9d8e" emissive="#ffcd80" emissiveIntensity={.5}/></instancedMesh></>;
}

export function RenderBudget({quality,onMotion}:{quality:RenderQuality;onMotion:(moving:boolean)=>void}) {
  const {camera,setDpr,gl}=useThree();const previous=useRef(new THREE.Vector3());const rotation=useRef(new THREE.Quaternion());
  const still=useRef(0),moving=useRef(false),elapsed=useRef(0),frames=useRef(0),scale=useRef(1),lastDpr=useRef(0);
  useFrame((_,dt)=>{
    const changed=previous.current.distanceToSquared(camera.position)>.0001||rotation.current.angleTo(camera.quaternion)>.00005;
    previous.current.copy(camera.position);rotation.current.copy(camera.quaternion);
    still.current=changed?0:still.current+dt;const active=still.current<.25;
    if(active!==moving.current){moving.current=active;onMotion(active);}
    elapsed.current+=dt;frames.current++;
    if(elapsed.current>1.5){const fps=frames.current/elapsed.current;scale.current=THREE.MathUtils.clamp(scale.current+(fps<42?-.15:fps>57?.05:0),.6,1);elapsed.current=0;frames.current=0;}
    const cap=quality==='high'?1.5:quality==='balanced'?1.15:.8;
    const next=Math.round(Math.min(window.devicePixelRatio,cap)*scale.current*(active?.75:1)*20)/20;
    if(Math.abs(next-lastDpr.current)>.04){lastDpr.current=next;setDpr(next);}
    // Shadow maps refresh only after movement ends, in high quality.
    if(!active&&quality==='high')gl.shadowMap.autoUpdate=false;
  });
  return null;
}
