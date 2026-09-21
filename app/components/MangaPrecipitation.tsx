"use client";
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { OrbitControls } from 'three-stdlib';
import * as THREE from 'three';
import { SURFACE_GLSL, surfaceUniforms, type RainSurface } from '@/app/lib/manga/surfaces';
import reference from '@/public/models/manga/rain-reference.json';

const random=(i:number)=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
const QUAD=[-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,-.5,0,.5,.5,0,-.5,.5,0];
const GLOBAL=36000,LOCAL=14000,COUNT=GLOBAL+LOCAL;
const COMMON=`${SURFACE_GLSL}
attribute vec2 anchor;attribute float seed;attribute float localLayer;
uniform float time;uniform float screenHeight;uniform float strength;uniform float density;uniform vec2 wind;
uniform vec2 focus;uniform float localRadius;uniform float localBlend;
varying vec2 vUv;varying float alpha;
vec3 landing;vec3 normalHit;float phase;float falling;float speed;float pixel;float valid;
void collision(){
  vec2 xz=mix(surfaceBounds.xy+anchor*surfaceBounds.zw,focus+(anchor-.5)*localRadius*2.,localLayer);
  vec4 surface=surfaceAt(xz);float water=waterAt(xz);
  landing=vec3(xz.x,max(surface.x,water+.045),xz.y);
  normalHit=water+.045>surface.x?vec3(0.,1.,0.):surfaceNormal(surface);
  vec4 view=modelViewMatrix*vec4(landing,1.);
  pixel=max(.001,-2.*view.z/(projectionMatrix[1][1]*screenHeight));
  speed=max(19.+seed*8.,pixel*65.);
  float period=.85+seed*.9;float age=mod(time+seed*37.,period);
  float fallTime=period-.32;falling=max(0.,fallTime-age);phase=(age-fallTime)/.32;
  valid=step(.5,surface.w)*mix(1.,localBlend,localLayer)*step(seed,density);
  vUv=position.xy+.5;
}
`;
const DROP_VERTEX=`${COMMON}
varying vec2 fallXZ;varying float fallY;
void main(){collision();
  vec3 p=landing+vec3(-wind.x*falling,falling*speed,-wind.y*falling);
  fallXZ=p.xz;fallY=p.y;
  vec4 view=modelViewMatrix*vec4(p,1.);
  vec3 velocity=mat3(modelViewMatrix)*vec3(-wind.x,speed,-wind.y);
  vec2 axis=normalize(velocity.xy+vec2(.0001)),across=vec2(-axis.y,axis.x);
  float width=max(.022,pixel*.72);
  float len=max(.28+seed*.32,pixel*(3.+seed*3.));
  view.xy+=across*position.x*width+axis*(position.y+.5)*len;
  gl_Position=projectionMatrix*view;
  alpha=valid*step(0.,falling)*step(phase,0.)*smoothstep(0.,.04,falling)*(.45+seed*.45);
}`;
const DROP_FRAGMENT=`${SURFACE_GLSL}
uniform float strength;varying vec2 vUv;varying float alpha;varying vec2 fallXZ;varying float fallY;
void main(){vec4 s=surfaceAt(fallXZ);if(fallY<s.x+.025)discard;
  float edge=1.-smoothstep(.12,.5,abs(vUv.x-.5));
  float tail=sin(vUv.y*3.14159265);
  gl_FragColor=vec4(mix(vec3(.57,.73,.81),vec3(.94,.98,1.),tail),alpha*edge*tail*strength);
}`;
const RING_VERTEX=`${COMMON}
void main(){collision();
  float age=clamp(phase,0.,1.);float radius=(.04+age*.48)*max(1.,min(pixel*2.5,3.));
  vec3 tangent=normalize(cross(normalHit,vec3(0.,0.,1.)));
  vec3 bitangent=cross(normalHit,tangent);
  vec3 p=landing+normalHit*.025+(tangent*position.x+bitangent*position.y)*radius*2.;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  alpha=valid*step(0.,phase)*(1.-age)*(1.-age);
}`;
const RING_FRAGMENT=`uniform float strength;varying vec2 vUv;varying float alpha;
void main(){float r=length(vUv-.5)*2.;float aa=max(fwidth(r),.025);
  float ring=1.-smoothstep(.035,.035+aa,abs(r-.76));
  float center=1.-smoothstep(0.,.24,r);
  gl_FragColor=vec4(.73,.89,.96,(ring*.8+center*.3)*alpha*strength);
}`;
const SPLASH_VERTEX=`${COMMON}
attribute float shard;uniform float splashPower;
void main(){collision();float age=clamp(phase,0.,1.);
  float a=(shard/${reference.splash.drops.toFixed(1)}+seed)*6.2831853;
  vec3 tangent=normalize(cross(normalHit,vec3(0.,0.,1.))),bitangent=cross(normalHit,tangent);
  vec3 radial=cos(a)*tangent+sin(a)*bitangent;
  vec3 p=landing+normalHit*(.025+4.*age*(1.-age)*splashPower)+radial*age*.58;
  vec4 view=modelViewMatrix*vec4(p,1.);
  float width=max(${reference.splash.radius.toFixed(3)}*2.,min(pixel*.9,.17));
  view.xy+=position.xy*vec2(width,width*1.55);
  gl_Position=projectionMatrix*view;alpha=valid*step(0.,phase)*(1.-age)*.95;
}`;
const SPLASH_FRAGMENT=`uniform float strength;varying vec2 vUv;varying float alpha;
void main(){float r=length((vUv-.5)*2.);float shape=1.-smoothstep(.2,1.,r);
  gl_FragColor=vec4(.87,.96,1.,shape*alpha*strength);
}`;

function geometry(shards=1) {
  const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(QUAD,3));
  const anchors=new Float32Array(COUNT*shards*2),seeds=new Float32Array(COUNT*shards),layers=new Float32Array(COUNT*shards),s=new Float32Array(COUNT*shards);
  for(let i=0;i<COUNT*shards;i++){
    const drop=Math.floor(i/shards);
    anchors[i*2]=random(drop*3);anchors[i*2+1]=random(drop*3+1);seeds[i]=random(drop*3+2);
    layers[i]=drop>=GLOBAL?1:0;s[i]=i%shards;
  }
  g.setAttribute('anchor',new THREE.InstancedBufferAttribute(anchors,2));g.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,1));
  g.setAttribute('localLayer',new THREE.InstancedBufferAttribute(layers,1));g.setAttribute('shard',new THREE.InstancedBufferAttribute(s,1));
  g.instanceCount=COUNT*shards;return g;
}

/** Falling drops and their splash share the same anchor, seed and collision clock.
 * Collision heights/normals were raycast in Blender against the rendered GLB. */
export default function MangaPrecipitation({surface,rate,wind,direction,depths,reduced}:{surface:RainSurface;rate:number;wind:number;direction:number|null|undefined;depths:number[];reduced:boolean}) {
  const resources=useMemo(()=>{
    const uniforms={...surfaceUniforms(surface),time:{value:0},screenHeight:{value:800},strength:{value:0},density:{value:0},wind:{value:new THREE.Vector2()},focus:{value:new THREE.Vector2()},localRadius:{value:120},localBlend:{value:0},splashPower:{value:reference.splash.speed*.7}};
    const make=(vertexShader:string,fragmentShader:string)=>new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    return {uniforms,drop:geometry(),ring:geometry(),splash:geometry(reference.splash.drops),materials:[make(DROP_VERTEX,DROP_FRAGMENT),make(RING_VERTEX,RING_FRAGMENT),make(SPLASH_VERTEX,SPLASH_FRAGMENT)],seconds:0};
  },[surface]);
  // R3F owns geometries/materials and disposes them on real unmount. An effect
  // cleanup would dispose live GPU objects during React StrictMode's effect replay.
  useEffect(()=>{resources.seconds=0;},[resources]);
  useFrame(({size,controls,camera,clock})=>{
    const u=resources.uniforms;
    // Absolute monotonic clock, independent from API polling and timeline play.
    u.time.value=clock.elapsedTime;
    u.screenHeight.value=size.height;
    const wet=Math.max(0,Math.min(300,Number.isFinite(rate)?rate:0));
    u.strength.value=wet>.01?Math.min(.95,.30+Math.sqrt(wet/100)*.65):0;
    const target=(controls as OrbitControls|null)?.target;
    if(target){u.focus.value.set(target.x,target.z);const distance=camera.position.distanceTo(target);u.localBlend.value=1-THREE.MathUtils.smoothstep(distance,350,950);u.localRadius.value=THREE.MathUtils.clamp(distance*.65,28,180);}
    const angle=(direction??0)*Math.PI/180;
    const windSpeed=direction==null?0:Math.min(9,Math.max(0,wind)/3.6);
    u.wind.value.set(-Math.sin(angle)*windSpeed,Math.cos(angle)*windSpeed);
    u.zones.value.forEach((v,i)=>{v.w=Math.max(0,depths[i]??0);});
    // Stable per-seed density thinning happens in the shader, including local drops.
    u.density.value=Math.min(1,.08+Math.sqrt(wet/100)*.92)*(reduced?.25:1);
  });
  return <group visible={rate>.01}>
    <mesh geometry={resources.drop} material={resources.materials[0]} frustumCulled={false} raycast={()=>{}}/>
    <mesh geometry={resources.ring} material={resources.materials[1]} frustumCulled={false} raycast={()=>{}}/>
    <mesh geometry={resources.splash} material={resources.materials[2]} frustumCulled={false} raycast={()=>{}}/>
  </group>;
}
