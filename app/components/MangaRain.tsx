"use client";
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MangaData, Scenario } from '@/app/lib/manga/types';
import { insideBoundary } from '@/app/lib/manga/adapter';
import type { RenderQuality } from './MangaScene';

// Deterministic visual samples, not additional input to the water solver.
const random=(i:number)=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
export function RainWeather({data,intensity,wind,direction,quality,moving,reduced,field}:{data:MangaData;intensity:number;wind:number;direction:number|null|undefined;quality:RenderQuality;moving:boolean;reduced:boolean;field?:Scenario['rainFootprint']}) {
  const mask=useMemo(()=>{
    const xs=data.boundary.map(p=>p[0]),ys=data.boundary.map(p=>-p[1]);
    const minX=Math.min(...xs),minZ=Math.min(...ys),dx=Math.max(...xs)-minX,dz=Math.max(...ys)-minZ;
    const pixels=new Uint8Array(512*512);
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){
      // Conservative 4-corner mask: no whole edge pixel outside the polygon.
      pixels[y*512+x]=[[0,0],[1,0],[0,1],[1,1]].every(([u,v])=>insideBoundary(minX+(x+u)/512*dx,-(minZ+(y+v)/512*dz),data.boundary))?255:0;
    }
    const texture=new THREE.DataTexture(pixels,512,512,THREE.RedFormat);texture.needsUpdate=true;
    return {texture,bounds:new THREE.Vector4(minX,minZ,dx,dz)};
  },[data]);
  const coverageUniforms=useMemo(()=>({boundaryMask:{value:mask.texture},bounds:{value:mask.bounds},rainField:{value:new THREE.Vector3(0,0,0)}}),[mask]);
  const coverageShader=`uniform sampler2D boundaryMask; uniform vec4 bounds; uniform vec3 rainField; varying vec2 groundXZ;
    float coverage(){vec2 uv=(groundXZ-bounds.xy)/bounds.zw;
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;
      float local=rainField.z>0.?1.-smoothstep(.65,1.,distance(groundXZ,rainField.xy)/rainField.z):1.;
      return texture2D(boundaryMask,uv).r*local;}`;
  const drops=useMemo(()=>{
    const g=new THREE.InstancedBufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,.5,1,0,-.5,0,0,.5,1,0,-.5,1,0],3));
    const origins:number[]=[],seeds:number[]=[];
    for(let i=0;i<16000;i++){
      const c=data.grid.cells[Math.floor(random(i+16001)*data.grid.cells.length)];
      // Keep the cell elevation; fade before reaching the coarse terrain.
      origins.push(c.x+(random(i*3)-.5)*data.grid.dx,c.z,-c.y+(random(i*3+1)-.5)*data.grid.dx);
      seeds.push(random(i*3+2));
    }
    g.setAttribute('origin',new THREE.InstancedBufferAttribute(new Float32Array(origins),3));
    g.setAttribute('seed',new THREE.InstancedBufferAttribute(new Float32Array(seeds),1));return g;
  },[data]);
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{...coverageUniforms,time:{value:0},drift:{value:new THREE.Vector2()},strength:{value:0},screenHeight:{value:600}},
    vertexShader:`attribute vec3 origin; attribute float seed;
      uniform float time; uniform float screenHeight; uniform vec2 drift; varying vec2 uvDrop; varying float alphaDrop; varying vec2 groundXZ;
      void main(){float speed=mix(7.,11.,seed);float age=mod(time+seed*71.,90./speed);
        float height=90.-age*speed;float lengthDrop=mix(.55,1.6,seed);
        vec3 p=origin+vec3(drift.x*age,height,drift.y*age);
        groundXZ=p.xz;
        vec4 view=modelViewMatrix*vec4(p,1.);
        vec3 velocity=mat3(modelViewMatrix)*vec3(-drift.x,speed,-drift.y);
        vec2 axis=normalize(velocity.xy+vec2(.0001));vec2 across=vec2(-axis.y,axis.x);
        // Pixel-size aid keeps precipitation legible in an aerial viewport.
        float width=clamp(-2.*view.z/(projectionMatrix[1][1]*screenHeight),.025,2.);
        view.xy+=across*position.x*width+axis*position.y*max(lengthDrop,width*3.5);
        gl_Position=projectionMatrix*view;uvDrop=position.xy;
        alphaDrop=smoothstep(1.,7.,height)*(1.-smoothstep(78.,90.,height))*(.4+.6*seed);
      }`,
    fragmentShader:`${coverageShader} uniform float strength; varying vec2 uvDrop; varying float alphaDrop;
      void main(){float edge=1.-smoothstep(.12,.5,abs(uvDrop.x));
        float taper=sin(uvDrop.y*3.14159265);
        gl_FragColor=vec4(.78,.84,.87,edge*taper*alphaDrop*strength*coverage());}`
  }),[coverageUniforms,coverageShader]);
  const impacts=useMemo(()=>{
    const g=new THREE.InstancedBufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,-1,1,0,-1,1,0,1,-1,0,-1,1,0,1,-1,0,1],3));
    const triangles=data.roads.flatMap(r=>r.triangles),p:number[]=[],s:number[]=[];
    // Triangle samples remain on the existing GIS road surface, not on roofs.
    for(let i=0;i<Math.min(1600,triangles.length);i++){
      const t=triangles[Math.floor(i*triangles.length/Math.min(1600,triangles.length))];
      p.push((t[0][0]+t[1][0]+t[2][0])/3,(t[0][2]+t[1][2]+t[2][2])/3+.045,-(t[0][1]+t[1][1]+t[2][1])/3);s.push(random(i+123));
    }
    g.setAttribute('origin',new THREE.InstancedBufferAttribute(new Float32Array(p),3));
    g.setAttribute('seed',new THREE.InstancedBufferAttribute(new Float32Array(s),1));g.instanceCount=s.length;return g;
  },[data]);
  const impactMaterial=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{...coverageUniforms,time:{value:0},strength:{value:0}},
    vertexShader:`attribute vec3 origin; attribute float seed;uniform float time;varying vec2 q;varying float phase;varying vec2 groundXZ;
      void main(){phase=fract(time*1.8+seed*29.);q=position.xz;
        vec3 p=origin+position*(.06+phase*.55);groundXZ=p.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`${coverageShader} uniform float strength;varying vec2 q;varying float phase;
      void main(){float r=length(q);float aa=max(fwidth(r),.035);
        float ring=1.-smoothstep(.035,.035+aa,abs(r-.75));
        gl_FragColor=vec4(.72,.79,.8,ring*(1.-phase)*(1.-phase)*strength*coverage());}`
  }),[coverageUniforms,coverageShader]);
  useEffect(()=>()=>mask.texture.dispose(),[mask]);
  useEffect(()=>()=>{drops.dispose();impacts.dispose();},[drops,impacts]);
  useEffect(()=>()=>{material.dispose();impactMaterial.dispose();},[material,impactMaterial]);
  useFrame(({size},dt)=>{
    if(reduced)return;
    coverageUniforms.rainField.value.set(field?.x??0,-(field?.y??0),field?.radiusM??0);
    const rate=Number.isFinite(intensity)?Math.max(0,intensity):0;
    const budget=quality==='high'?16000:quality==='balanced'?8000:3000;
    drops.instanceCount=rate>0?Math.round(budget*Math.min(1,.15+.85*Math.sqrt(rate/25))*(moving?.65:1)):0;
    material.uniforms.screenHeight.value=Math.max(1,size.height);
    const rad=(direction??0)*Math.PI/180;
    const speed=direction==null||!Number.isFinite(wind)?0:Math.max(0,wind)/3.6;
    material.uniforms.drift.value.set(-Math.sin(rad)*speed,Math.cos(rad)*speed);
    material.uniforms.time.value+=Math.min(dt,.1);material.uniforms.strength.value=.22+Math.min(rate/60,.35);
    impactMaterial.uniforms.time.value=material.uniforms.time.value;
    impactMaterial.uniforms.strength.value=Math.min(.55,rate/30);
  });
  return reduced?null:<group>
    <mesh geometry={drops} material={material} frustumCulled={false} raycast={()=>{}}/>
    {quality!=='performance'&&!moving&&<mesh geometry={impacts} material={impactMaterial} frustumCulled={false} raycast={()=>{}}/>}
  </group>;
}
