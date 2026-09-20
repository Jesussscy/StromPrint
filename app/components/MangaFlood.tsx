"use client";
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ZONAS_MANGA } from '@/app/lib/zonasManga';
import { zoneLocal } from '@/app/lib/manga/adapter';
import type { MangaData } from '@/app/lib/manga/types';

/** Water is clipped to street geometry in the flat v6.1 model. The depth comes
 * from zone predictions or explicitly exploratory storage, never fake DEM. */
export default function MangaFlood({data, depths, rain}:{data:MangaData;depths:number[];rain:number}) {
  const geometry=useMemo(()=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(data.roads.flatMap(r=>r.triangles.flatMap(t=>t.flatMap(p=>[p[0],.075,-p[1]]))),3));
    return g;
  },[data]);
  const material=useMemo(()=>new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0},rain:{value:0},zones:{value:ZONAS_MANGA.map(z=>{const [x,y]=zoneLocal(...z.coordenadas);return new THREE.Vector4(x,-y,z.radio_influencia,0);})}},
    vertexShader:`uniform vec4 zones[20];varying vec2 world;
      void main(){world=position.xz;float depth=0.;
        for(int i=0;i<20;i++){vec4 z=zones[i];float reach=clamp(sqrt(max(z.w,0.)/.25),0.,1.);
          depth=max(depth,z.w*(1.-smoothstep(reach*.35,reach+.001,distance(world,z.xy)/z.z)));}
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position+vec3(0.,depth,0.),1.);}`,
    fragmentShader:`uniform vec4 zones[20];uniform float time;uniform float rain;varying vec2 world;
      void main(){float depth=0.;
        for(int i=0;i<20;i++){
          vec4 z=zones[i]; float d=distance(world,z.xy)/z.z;
          float irregular=.08*sin(world.x*.13)*sin(world.y*.09)+.04*sin(world.x*.4+world.y*.2);
          float reach=clamp(sqrt(max(z.w,0.)/.25),0.,1.);
          depth=max(depth,z.w*(1.-smoothstep(reach*.35,reach+.001,d+irregular)));
        }
        float wet=clamp(rain/30.,0.,1.)*.14;
        float opacity=smoothstep(.001,.04,depth)*.76+wet;
        if(opacity<.005)discard;
        vec2 tile=floor(world/2.5);vec2 q=fract(world/2.5)-.5;
        float seed=fract(sin(dot(tile,vec2(127.1,311.7)))*43758.5453);
        float phase=fract(time*1.7+seed);float ring=exp(-180.*pow(length(q)-phase*.55,2.))*(1.-phase);
        float shimmer=pow(.5+.5*sin(world.x*.16+world.y*.12+time*1.4),12.);
        vec3 col=mix(vec3(.13,.34,.39),vec3(.32,.57,.61),clamp(depth*2.,0.,1.));
        col+=shimmer*.10+ring*.20*clamp(rain/20.,0.,1.);
        gl_FragColor=vec4(col,clamp(opacity,0.,.88));}`
  }),[]);
  useFrame((_,dt)=>{
    material.uniforms.time.value+=Math.min(dt,.1);
    material.uniforms.rain.value=rain;
    material.uniforms.zones.value.forEach((v:THREE.Vector4,i:number)=>{v.w+=(Math.max(0,depths[i]??0)-v.w)*Math.min(1,dt*5);});
  });
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} raycast={()=>{}}/>;
}
