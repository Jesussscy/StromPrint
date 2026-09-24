"use client";
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Grid, WaterResult } from '@/app/lib/manga/types';
import { waterSurface } from '@/app/lib/manga/waterSurface';

/** Render the conserved 2D water volume over its terrain cells. Water remains
 * visible after rain stops and drains only through the model's cell losses and
 * downhill connections. */
export default function MangaFlood({grid,result,showDem}:{grid:Grid|null;result:WaterResult|null;showDem:boolean}) {
  const geometry=useMemo(()=>{
    const g=new THREE.BufferGeometry();
    if(!grid||!result)return g;
    const surface=waterSurface(grid,result),positions=surface.positions,flowDirs:number[]=[],flowStrength:number[]=[];
    for(let i=0;i<positions.length;i+=3){
      const depth=surface.depths[i/3]??0;
      const cell=surface.cellIndices[i/3]??0,fx=result.flux[cell*2]??0,fy=result.flux[cell*2+1]??0,speed=Math.hypot(fx,fy);
      flowDirs.push(speed?fx/speed:0,speed?-fy/speed:0);
      flowStrength.push(Math.min(1,Math.log1p(speed)*.3));
      // DEM meshes are lifted by 0.12 m. Keep the water film just above them;
      // in flat-map mode preserve the same wet-cell footprint at a flat datum.
      positions[i+1]=showDem?positions[i+1]+.13:.19+depth;
    }
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('waterDepth',new THREE.Float32BufferAttribute(surface.depths,1));
    g.setAttribute('flowDir',new THREE.Float32BufferAttribute(flowDirs,2));
    g.setAttribute('flowStrength',new THREE.Float32BufferAttribute(flowStrength,1));
    g.computeVertexNormals();
    return g;
  },[grid,result,showDem]);
  const material=useMemo(()=>new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{time:{value:0}},
    vertexShader:`attribute float waterDepth;attribute vec2 flowDir;attribute float flowStrength;
      varying float depth;varying vec2 world;varying vec2 direction;varying float flow;
      void main(){depth=waterDepth;world=position.xz;direction=flowDir;flow=flowStrength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;varying float depth;varying vec2 world;varying vec2 direction;varying float flow;
      void main(){float ripple=.045*sin(world.x*.12+world.y*.13+time*2.2)*sin(world.y*.08-time*1.7);
        float swell=.5+.5*sin(world.x*.045-world.y*.04+time*1.35);
        float travel=dot(world,direction)*.32-time*(1.2+flow*6.);
        float streak=pow(max(0.,sin(travel)),22.)*flow;
        float d=clamp(depth/.2,0.,1.);vec3 shallow=vec3(.16,.73,.82),deep=vec3(.012,.19,.34);
        vec3 colour=mix(shallow,deep,d)+vec3(ripple)+vec3(.035,.09,.11)*swell+vec3(.52,.76,.79)*streak;
        float alpha=clamp(.68+depth*.8,.68,.94);gl_FragColor=vec4(colour,alpha);}`
  }),[]);
  useFrame((_,dt)=>{material.uniforms.time.value+=Math.min(dt,.1);});
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  return <mesh geometry={geometry} material={material} renderOrder={3} visible={(geometry.getAttribute('position')?.count??0)>0} frustumCulled={false} raycast={()=>{}}/>;
}
