"use client";
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MangaData, Scenario } from '@/app/lib/manga/types';
import { insideBoundary } from '@/app/lib/manga/adapter';
import type { RenderQuality } from './MangaScene';
import reference from '@/public/models/manga/rain-reference.json';

// ---------------------------------------------------------------------------
// Module-level constants: deterministic hashing, inert raycast and the GLSL
// strings, so nothing is reallocated per render.
// ---------------------------------------------------------------------------
const random=(i:number)=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
const noRaycast=()=>{};

const COVERAGE_SHADER=`uniform sampler2D boundaryMask; uniform vec4 bounds; uniform vec3 rainField; varying vec2 groundXZ;
  float coverage(){vec2 uv=(groundXZ-bounds.xy)/bounds.zw;
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;
    float local=rainField.z>0.?1.-smoothstep(.65,1.,distance(groundXZ,rainField.xy)/rainField.z):1.;
    return texture2D(boundaryMask,uv).r*local;}`;

const DROP_VERTEX=`attribute vec3 origin; attribute float seed;
  uniform float time; uniform float screenHeight; uniform float aspect; uniform vec2 drift; varying vec2 uvDrop; varying float alphaDrop; varying vec2 groundXZ;
  void main(){
    float near=step(.5,fract(seed*2.));float layer=fract(seed*2.);
    float speed=mix(mix(7.,10.,layer),mix(13.,17.,layer),near);
    float age=mod(time+seed*71.,220./speed);
    float height=220.-age*speed;
    float lengthDrop=mix(mix(.5,1.,layer),mix(1.2,2.4,layer),near);
    vec3 p=origin+vec3(drift.x*age,height,drift.y*age);
    groundXZ=p.xz;
    vec4 view=modelViewMatrix*vec4(p,1.);
    vec3 velocity=mat3(modelViewMatrix)*vec3(-drift.x,speed,-drift.y);
    vec2 axis=normalize(velocity.xy+vec2(.0001));vec2 across=vec2(-axis.y,axis.x);
    float width=clamp(-2.*view.z/(projectionMatrix[1][1]*screenHeight),.02,8.)*mix(.65,1.,near);
    view.xy+=across*position.x*width+axis*position.y*max(lengthDrop,width*aspect);
    gl_Position=projectionMatrix*view;uvDrop=position.xy;
    float alphaBase=mix(.28+.5*seed,.45+.5*seed,near);
    alphaDrop=smoothstep(1.5,6.,height)*(1.-smoothstep(195.,220.,height))*alphaBase;
  }`;
const DROP_FRAGMENT=`${COVERAGE_SHADER} uniform float strength; uniform float flash; varying vec2 uvDrop; varying float alphaDrop;
  void main(){
    float edge=1.-smoothstep(.08,.5,abs(uvDrop.x));
    float taper=pow(sin(uvDrop.y*3.14159265),.75);
    vec3 base=mix(vec3(.62,.74,.90),vec3(.88,.93,.98),taper*.4);
    vec3 col=mix(base,vec3(.97,.98,1.),flash*.85);
    gl_FragColor=vec4(col,edge*taper*alphaDrop*strength*coverage());
  }`;

const IMPACT_POS=new Float32Array([-1,0,-1,1,0,-1,1,0,1,-1,0,-1,1,0,1,-1,0,1]);
const IMPACT_VERTEX=`attribute vec3 origin; attribute float seed;uniform float time;varying vec2 q;varying float phase;varying vec2 groundXZ;
  void main(){phase=fract(time*1.8+seed*29.);q=position.xz;
    vec3 p=origin+position*(.05+phase*.5);groundXZ=p.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const IMPACT_FRAGMENT=`${COVERAGE_SHADER} uniform float strength;varying vec2 q;varying float phase;
  void main(){float r=length(q);float aa=max(fwidth(r),.035);
    float ring=1.-smoothstep(.03,.03+aa,abs(r-.72));
    float core=1.-smoothstep(.02,.09,r);
    float env=(1.-phase)*(1.-phase);
    vec3 col=mix(vec3(.52,.66,.80),vec3(.96,.97,1.),core*.7);
    gl_FragColor=vec4(col,(ring*.9+core*.3)*env*strength*coverage());}`;

const SPRAY_POS=new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,-.5,0,.5,.5,0,-.5,.5,0]);
const SPRAY_VERTEX=`attribute vec3 origin; attribute float seed;
  uniform float time; uniform vec2 drift; uniform float splashSpeed; varying vec2 uvSpray; varying float alphaSpray; varying vec2 groundXZ;
  void main(){float phase=fract(time*splashSpeed*2.4+floor(seed*100.)*.17);float h=4.*phase*(1.-phase)*.7;
    float angle=fract(seed*100.)*6.2831853;
    vec3 p=origin+vec3(cos(angle)*phase*.8+drift.x*phase*.03,h,sin(angle)*phase*.8+drift.y*phase*.03);groundXZ=p.xz;uvSpray=position.xy;
    vec4 view=modelViewMatrix*vec4(p,1.);
    float size=clamp(-view.z/900.,.035,.4)*(.5+.5*seed);
    view.xy+=position.xy*vec2(size,size*1.5);
    gl_Position=projectionMatrix*view;
    float env=sin(phase*3.14159265);env*=env;
    alphaSpray=env*(.25+.4*seed);
  }`;
const SPRAY_FRAGMENT=`${COVERAGE_SHADER} uniform float strength;varying vec2 uvSpray;varying float alphaSpray;
  void main(){float r=length(uvSpray);float dot=smoothstep(.55,.16,r);
    gl_FragColor=vec4(.86,.92,.97,dot*alphaSpray*strength*coverage());}`;

const SKY_VERTEX=`varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SKY_FRAGMENT=`uniform float time;uniform float strength;uniform float flash;varying vec3 vWorld;
  float shash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float snoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(shash(i),shash(i+vec2(1,0)),f.x),mix(shash(i+vec2(0,1)),shash(i+vec2(1,1)),f.x),f.y);}
  float sfbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*snoise(p);p*=2.03;a*=.5;}return v;}
  void main(){
    vec3 d=normalize(vWorld-cameraPosition);
    vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,clamp(d.y,-1.,1.)*0.5+.5);
    float base=sfbm(uv*3.5+vec2(time*.008,0.));
    float patches=sfbm(uv*7.+vec2(time*.012,time*.006)+.31);
    float horizon=exp((uv.y-.42)*-7.);
    float dens=smoothstep(.28,.74,base*.55+patches*.45*.65+horizon*.4);
    float alpha=clamp(strength*2.1*dens*mix(1.4,1.,uv.y),0.,.55);
    vec3 col=mix(vec3(.14,.17,.26),vec3(.26,.32,.48),base*.5+patches*.2);
    col=mix(col,vec3(.95,.97,1.),flash*.85);
    gl_FragColor=vec4(col,alpha);
  }`;

// ---------------------------------------------------------------------------
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
  const coverageUniforms=useMemo(()=>({boundaryMask:{value:mask.texture},bounds:{value:mask.bounds},rainField:{value:new THREE.Vector3()}}),[mask]);

  const drops=useMemo(()=>{
    const g=new THREE.InstancedBufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,.5,1,0,-.5,0,0,.5,1,0,-.5,1,0],3));
    const origins=new Float32Array(48000*3),seeds=new Float32Array(48000);
    const cells=data.grid.cells,n=cells.length;
    for(let i=0;i<48000;i++){
      const c=cells[Math.floor(random(i+16001)*n)];
      origins[i*3]=c.x+(random(i*3)-.5)*data.grid.dx;origins[i*3+1]=c.z;origins[i*3+2]=-c.y+(random(i*3+1)-.5)*data.grid.dx;
      seeds[i]=random(i*3+2);
    }
    g.setAttribute('origin',new THREE.InstancedBufferAttribute(origins,3));
    g.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,1));g.instanceCount=0;return g;
  },[data]);
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{...coverageUniforms,time:{value:0},drift:{value:new THREE.Vector2()},strength:{value:0},aspect:{value:reference.droplet.length/reference.droplet.radius*.45},screenHeight:{value:600},flash:{value:0}},
    vertexShader:DROP_VERTEX,fragmentShader:DROP_FRAGMENT
  }),[coverageUniforms]);

  const impacts=useMemo(()=>{
    const g=new THREE.InstancedBufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(IMPACT_POS),3));
    const triangles=data.roads.flatMap(r=>r.triangles),count=Math.min(1600,triangles.length);
    const p=new Float32Array(count*3),s=new Float32Array(count);
    for(let i=0;i<count;i++){
      const t=triangles[Math.floor(i*triangles.length/count)];
      p[i*3]=(t[0][0]+t[1][0]+t[2][0])/3;p[i*3+1]=(t[0][2]+t[1][2]+t[2][2])/3+.045;p[i*3+2]=-(t[0][1]+t[1][1]+t[2][1])/3;s[i]=random(i+123);
    }
    g.setAttribute('origin',new THREE.InstancedBufferAttribute(p,3));
    g.setAttribute('seed',new THREE.InstancedBufferAttribute(s,1));g.instanceCount=count;return g;
  },[data]);
  const impactMaterial=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{...coverageUniforms,time:{value:0},strength:{value:0}},
    vertexShader:IMPACT_VERTEX,fragmentShader:IMPACT_FRAGMENT
  }),[coverageUniforms]);

  const spray=useMemo(()=>{
    const g=new THREE.InstancedBufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(SPRAY_POS),3));
    const cells=data.grid.cells,n=cells.length,dx=data.grid.dx,count=Math.min(2200,n)*reference.splash.drops;
    const p=new Float32Array(count*3),s=new Float32Array(count);
    for(let i=0;i<count;i++){
      const c=cells[Math.floor(Math.floor(i/reference.splash.drops)*n/(count/reference.splash.drops))];
      p[i*3]=c.x+(random(i*11)-.5)*dx;p[i*3+1]=c.z+.10;p[i*3+2]=-c.y+(random(i*11+1)-.5)*dx;
      s[i]=(Math.floor(random(Math.floor(i/reference.splash.drops)+2)*100)+(i%reference.splash.drops)/reference.splash.drops)/100;
    }
    g.setAttribute('origin',new THREE.InstancedBufferAttribute(p,3));
    g.setAttribute('seed',new THREE.InstancedBufferAttribute(s,1));g.instanceCount=0;return g;
  },[data]);
  const sprayMaterial=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{...coverageUniforms,time:{value:0},splashSpeed:{value:reference.splash.speed},drift:{value:new THREE.Vector2()},strength:{value:0}},
    vertexShader:SPRAY_VERTEX,fragmentShader:SPRAY_FRAGMENT
  }),[coverageUniforms]);

  const skyGeometry=useMemo(()=>new THREE.SphereGeometry(8000,24,14),[]);
  const skyMaterial=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,toneMapped:false,
    uniforms:{time:{value:0},strength:{value:0},flash:{value:0}},
    vertexShader:SKY_VERTEX,fragmentShader:SKY_FRAGMENT
  }),[]);

  const skyMesh=useRef<THREE.Mesh>(null);
  const rateRef=useRef(0);
  const tRef=useRef(0);
  const fieldRef=useRef<{x:number;y:number;r:number}>({x:0,y:0,r:0});
  useEffect(()=>()=>{
    mask.texture.dispose();drops.dispose();impacts.dispose();spray.dispose();
    material.dispose();impactMaterial.dispose();sprayMaterial.dispose();
    skyGeometry.dispose();skyMaterial.dispose();
  },[mask,drops,impacts,spray,material,impactMaterial,sprayMaterial,skyGeometry,skyMaterial]);

  useFrame(({size},dt)=>{
    if(reduced)return;
    const ddt=Math.min(dt,.1);
    tRef.current+=ddt;
    // Update the hypothetical rain footprint only when it actually changed.
    const fx=field?.x??0,fy=-(field?.y??0),fr=field?.radiusM??0,last=fieldRef.current;
    if(fx!==last.x||fy!==last.y||fr!==last.r){last.x=fx;last.y=fy;last.r=fr;coverageUniforms.rainField.value.set(fx,fy,fr);}
    const target=Number.isFinite(intensity)?Math.max(0,intensity):0;
    // Inertia: smooth the visible rate so drops never pop when the API changes.
    rateRef.current+=(target-rateRef.current)*Math.min(1,ddt*2.5);
    const rate=rateRef.current;
    const ramp=Math.min(1,.08+.92*Math.sqrt(rate/100));
    const u=material.uniforms;
    drops.instanceCount=rate>.01?Math.round((quality==='high'?48000:quality==='balanced'?24000:9000)*ramp*(moving?.65:1)):0;
    u.screenHeight.value=Math.max(1,size.height);
    // Gusts: wind and rain breathe instead of staying frozen.
    const gust=1+.18*Math.sin(tRef.current*.9)+.12*Math.sin(tRef.current*2.35+1.7);
    const rad=(direction??0)*Math.PI/180;
    const speed=direction==null||!Number.isFinite(wind)?0:Math.max(0,wind)/3.6*gust;
    u.drift.value.set(-Math.sin(rad)*speed,Math.cos(rad)*speed);
    u.time.value+=ddt;
    u.strength.value=Math.min(.9,(.20+Math.min(rate/100,.6))*gust)*Math.min(1,rate);
    // Splash spray follows the same smoothed rain and wind.
    const su=sprayMaterial.uniforms;
    spray.instanceCount=quality==='performance'?0:rate>.01?Math.round(spray.getAttribute('seed').count*ramp*(moving?0:1)):0;
    su.time.value=u.time.value;
    su.drift.value.copy(u.drift.value);
    su.strength.value=Math.min(.7,rate/25);
    if(skyMesh.current)skyMesh.current.visible=rate>1;
    const k=skyMaterial.uniforms;
    k.time.value=tRef.current;k.strength.value=Math.min(.5,rate/50);
    const iu=impactMaterial.uniforms;
    iu.time.value=u.time.value;iu.strength.value=Math.min(.55,rate/30);
  });
  return reduced?null:<group>
    <mesh ref={skyMesh} geometry={skyGeometry} material={skyMaterial} frustumCulled={false} raycast={noRaycast}/>
    <mesh geometry={drops} material={material} frustumCulled={false} raycast={noRaycast}/>
    {quality!=='performance'&&!moving&&<><mesh geometry={impacts} material={impactMaterial} frustumCulled={false} raycast={noRaycast}/><mesh geometry={spray} material={sprayMaterial} frustumCulled={false} raycast={noRaycast}/></>}
  </group>;
}