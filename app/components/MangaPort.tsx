"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PORT_YARDS, insidePortYard } from '@/app/lib/manga/portLayout';
import type { GroundSampler } from '@/app/lib/manga/ground';

type Finish = 'navy'|'navyLight'|'white'|'ivory'|'teal'|'orange'|'yellow'|'red'|'concrete'|'steel'|'glass'|'dark'|'roof'|'grass';
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
const lifeboatGeometry = new THREE.SphereGeometry(1, 8, 5);
const containerRibMaterial = new THREE.MeshStandardMaterial({color:'#52676a',metalness:.28,roughness:.7});
const materials: Record<Finish, THREE.MeshStandardMaterial> = {
  navy: new THREE.MeshStandardMaterial({color:'#173c52',metalness:.25,roughness:.6}),
  navyLight: new THREE.MeshStandardMaterial({color:'#346b83',metalness:.18,roughness:.57}),
  white: new THREE.MeshStandardMaterial({color:'#e9eee9',roughness:.67}),
  ivory: new THREE.MeshStandardMaterial({color:'#d9d5bf',roughness:.76}),
  teal: new THREE.MeshStandardMaterial({color:'#1c8d98',metalness:.2,roughness:.55}),
  orange: new THREE.MeshStandardMaterial({color:'#e8944a',roughness:.64}),
  yellow: new THREE.MeshStandardMaterial({color:'#eac666',metalness:.08,roughness:.62}),
  red: new THREE.MeshStandardMaterial({color:'#a84e42',roughness:.62}),
  concrete: new THREE.MeshStandardMaterial({color:'#aeb4ac',roughness:.89}),
  steel: new THREE.MeshStandardMaterial({color:'#72858a',metalness:.45,roughness:.52}),
  glass: new THREE.MeshStandardMaterial({color:'#254d59',metalness:.15,roughness:.22}),
  dark: new THREE.MeshStandardMaterial({color:'#26383a',roughness:.8}),
  roof: new THREE.MeshStandardMaterial({color:'#ba7554',roughness:.8}),
  grass: new THREE.MeshStandardMaterial({color:'#557968',roughness:.86}),
};
const at = (x:number, y:number, height=0): [number,number,number] => [x,height,-y];

function Solid({p,s,finish,shadow=true}:{p:[number,number,number];s:[number,number,number];finish:Finish;shadow?:boolean}) {
  return <mesh geometry={boxGeometry} material={materials[finish]} position={p} scale={s} castShadow={shadow} receiveShadow />;
}
function Beam({from,to,r=.25,finish='steel'}:{from:[number,number,number];to:[number,number,number];r?:number;finish?:Finish}) {
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
  const position=a.add(b).multiplyScalar(.5);
  const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
  const length=delta.length();
  return <mesh geometry={beamGeometry} material={materials[finish]} position={position} quaternion={quaternion} scale={[r,length,r]} castShadow />;
}

/** One draw call per paint colour, even when the yard is full of containers. */
function ContainerBatch({items,finish,height=2.65,depth=2.5}:{items:ReadonlyArray<[number,number,number,number]>;finish:Finish;height?:number;depth?:number}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  const ribs=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const matrix=new THREE.Matrix4();
    items.forEach(([x,y,z,length],i)=>{
      matrix.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(length,height,depth));
      ref.current!.setMatrixAt(i,matrix);
    });
    ref.current.instanceMatrix.needsUpdate=true;
    ref.current.computeBoundingSphere();
    if(ribs.current){
      let index=0;
      items.forEach(([x,y,z,length])=>[-1,1].forEach(side=>{
        for(let groove=1;groove<10;groove++){
          const ribX=x-length/2+length*groove/10;
          matrix.compose(new THREE.Vector3(ribX,y,z+side*(depth/2+.025)),new THREE.Quaternion(),new THREE.Vector3(.12,height*.9,.05));
          ribs.current!.setMatrixAt(index++,matrix);
        }
      }));
      ribs.current.count=index;ribs.current.instanceMatrix.needsUpdate=true;ribs.current.computeBoundingSphere();
    }
  },[items,height,depth]);
  return <group>
    <instancedMesh ref={ref} args={[boxGeometry,materials[finish],items.length]} castShadow receiveShadow />
    {finish!=='glass'&&<instancedMesh ref={ribs} args={[boxGeometry,containerRibMaterial,items.length*18]} castShadow receiveShadow />}
  </group>;
}
const containerColours:Finish[]=['teal','white','navyLight','orange','red'];
function YardContainers() {
  const batches=useMemo(()=>{
    const out:Record<string,[number,number,number,number][]>={};
    containerColours.forEach(c=>out[c]=[]);
    // Three mapped container blocks with circulation lanes through the yard.
    for(let block=0;block<3;block++)for(let row=0;row<4;row++)for(let col=0;col<8;col++)for(let level=0;level<2+(col+row+block)%2;level++){
      const x=205+block*175+col*14.5, y=-610-row*10.5;
      const colour=containerColours[(block*3+row*2+col+level)%containerColours.length];
      out[colour].push([x,1.5+level*2.8,-y,12.2]);
    }
    // Expand storage onto the two defined port aprons only; every added stack
    // is clipped against the port boundary and leaves marked access aisles.
    for(const [x0,x1,y0,y1] of [[820,995,-535,-640],[680,975,-390,-480]] as const){
      for(let row=0,y=y0;y>=y1;y-=15,row++)for(let col=0,x=x0;x<=x1;x+=15,col++){
        if(!insidePortYard(x,y))continue;
        const nearEquipment=[[778,-724,38],[760,-456,30],[834,-583,22],[968,-754,35],[925,-570,20]];
        if(nearEquipment.some(([ex,ey,r])=>Math.hypot(x-ex,y-ey)<r))continue;
        // A 15 m gap every fifth column and fourth row is a forklift lane.
        if(col%5===4||row%4===3)continue;
        const levels=1+(row+col)%3;
        for(let level=0;level<levels;level++){
          const colour=containerColours[(row*3+col+level)%containerColours.length];
          out[colour].push([x,1.5+level*2.8,-y,12.2]);
        }
      }
    }
    return out;
  },[]);
  return <group>{containerColours.map(c=><ContainerBatch key={c} finish={c} items={batches[c]} />)}</group>;
}

function PortBoundary({ground}:{ground:GroundSampler|null}) {
  return <group>
    {PORT_YARDS.flatMap((ring,ri)=>ring.map(([ax,ay],i)=>{
      const [bx,by]=ring[(i+1)%ring.length],dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
      const x=(ax+bx)/2,y=(ay+by)/2,base=(ground?.(x,y)??1.56)+.14,angle=Math.atan2(-dy,dx);
      return <group key={`${ri}-${i}`} position={[x,base,-y]} rotation={[0,angle,0]}>
        <Solid p={[0,1.65,0]} s={[length,3.3,1.05]} finish="concrete" shadow={false}/>
        <Solid p={[0,2.88,.55]} s={[length,.16,.08]} finish="teal" shadow={false}/>
        {Array.from({length:Math.floor(length/24)+1},(_,j)=>{
          const along=-length/2+Math.min(length,j*24);
          return <Solid key={j} p={[along,1.95,0]} s={[.8,3.9,1.35]} finish="steel" shadow={false}/>;
        })}
      </group>;
    }))}
  </group>;
}

function GantryCrane({x,y,angle=0,quay=false}:{x:number;y:number;angle?:number;quay?:boolean}) {
  const span=quay?54:35, high=quay?57:29, leg=quay?26:17;
  return <group position={at(x,y)} rotation={[0,angle,0]}>
    {[-span/2,span/2].flatMap(side=>[-13,13].map(end=><Solid key={`${side}-${end}`} p={[end,high/2,side]} s={[1.25,high,1.25]} finish="steel" />))}
    <Solid p={[0,high,0]} s={[39,2.2,span+6]} finish={quay?'teal':'yellow'} />
    <Solid p={[0,high+1.5,0]} s={[7,2,span+8]} finish="white" />
    <Solid p={[0,high-3,-span/2-3]} s={[9,5,6]} finish="glass" />
    {[-span/2,span/2].map(side=><Beam key={side} from={[-13,leg,side]} to={[13,high-2,side]} r={.36} finish="white" />)}
    <Solid p={[5,high-2,0]} s={[3,2.2,3]} finish="yellow" />
    {[-4,4].map(side=><Beam key={side} from={[5,high-3,side]} to={[5,5,side]} r={.12} finish="dark" />)}
    <Solid p={[5,5,0]} s={[12,.55,10]} finish="yellow" />
    {[-13,13].flatMap(end=>[-span/2,span/2].map(side=><Solid key={`${end}-${side}`} p={[end,.8,side]} s={[4,1.6,4]} finish="dark" />))}
  </group>;
}

function QuayCrane({x,y,angle=0}:{x:number;y:number;angle?:number}) {
  return <group position={at(x,y)} rotation={[0,angle,0]}>
    {[-11,11].flatMap(xx=>[-8,8].map(zz=><Solid key={`${xx}-${zz}`} p={[xx,23,zz]} s={[1.5,46,1.5]} finish="teal" />))}
    <Solid p={[0,47,0]} s={[28,3,21]} finish="teal" />
    <Solid p={[22,50,0]} s={[78,2,3.2]} finish="white" />
    <Solid p={[-28,51,0]} s={[28,1.4,2.2]} finish="teal" />
    <Solid p={[0,52,0]} s={[8,5,7]} finish="glass" />
    <Beam from={[-11,47,0]} to={[-29,52,0]} r={.32} finish="steel" />
    <Beam from={[11,47,0]} to={[60,51,0]} r={.32} finish="steel" />
    {[35,48].map(xx=><Beam key={xx} from={[xx,49,0]} to={[xx,8,0]} r={.11} finish="dark" />)}
    <Solid p={[41,8,0]} s={[16,.7,12]} finish="yellow" />
    <Solid p={[-7,2,0]} s={[32,3,23]} finish="steel" />
  </group>;
}

function Warehouse({x,y,length=70}:{x:number;y:number;length?:number}) {
  return <group position={at(x,y)}>
    <Solid p={[0,.4,0]} s={[length+5,.8,37]} finish="concrete" />
    <Solid p={[0,9,0]} s={[length,17,32]} finish="ivory" />
    <Solid p={[0,18.3,0]} s={[length+3,2.8,36]} finish="roof" />
    {[-1,0,1].map(i=><group key={i} position={[i*length*.25,0,-16.2]}>
      <Solid p={[0,5,0]} s={[11,9,.25]} finish="navyLight" />
      <Solid p={[0,9.6,.15]} s={[12,.6,.5]} finish="white" />
    </group>)}
    <Solid p={[0,13,16.2]} s={[length*.63,3,.25]} finish="glass" />
  </group>;
}

function WorkerHouse({x,y,finish}:{x:number;y:number;finish:Finish}) {
  return <group position={at(x,y)}>
    <Solid p={[0,.22,0]} s={[17,.45,15]} finish="concrete" />
    <Solid p={[0,3.5,0]} s={[14,6.6,11]} finish={finish} />
    <Solid p={[0,7,0]} s={[16,1,12.8]} finish="roof" />
    <Solid p={[0,2.1,-5.6]} s={[2.4,4,.18]} finish="dark" />
    {[-4,4].map(xx=><Solid key={xx} p={[xx,4,-5.65]} s={[2.5,2,.18]} finish="glass" />)}
    <Solid p={[0,2.4,5.7]} s={[8,2,.2]} finish="glass" />
    <Solid p={[0,1.1,-9]} s={[4,2.2,6]} finish="concrete" />
  </group>;
}

function ServiceBridge() {
  return <group position={at(968,-754)} rotation={[0,-.35,0]}>
    <Solid p={[0,7,0]} s={[80,2.4,14]} finish="concrete" />
    {[-29,0,29].map(xx=><group key={xx}>
      <Solid p={[xx,3.1,0]} s={[3,6.2,10]} finish="steel" />
      <Beam from={[xx-9,6,-7]} to={[xx,12,-7]} r={.27} finish="white" />
      <Beam from={[xx,12,-7]} to={[xx+9,6,-7]} r={.27} finish="white" />
    </group>)}
    {[-6.7,6.7].map(zz=><Solid key={zz} p={[0,9,zz]} s={[80,1,1]} finish="yellow" />)}
    <Solid p={[0,8.28,0]} s={[74,.06,.18]} finish="white" shadow={false} />
  </group>;
}

function Vehicle({x,y,angle=0,kind='truck'}:{x:number;y:number;angle?:number;kind?:'truck'|'stacker'}) {
  const stacker=kind==='stacker';
  return <group position={at(x,y)} rotation={[0,angle,0]}>
    <Solid p={[0,2,0]} s={[stacker?12:18,2.2,3.6]} finish={stacker?'yellow':'navyLight'} />
    <Solid p={[-5,4.2,0]} s={[4,3.3,3.4]} finish={stacker?'orange':'white'} />
    <Solid p={[-5,4.8,-1.8]} s={[2.7,1.2,.12]} finish="glass" />
    {[-6,5].flatMap(xx=>[-2,2].map(zz=><Solid key={`${xx}-${zz}`} p={[xx,.9,zz]} s={[1.3,1.8,1.2]} finish="dark" />))}
    {stacker?<><Beam from={[1,3.5,0]} to={[10,16,0]} r={.53} finish="steel" /><Beam from={[10,16,0]} to={[13,4,0]} r={.14} finish="dark" /><Solid p={[13,3.8,0]} s={[8,.4,4]} finish="steel" /></>:<Solid p={[3,4.1,0]} s={[11,2.7,2.7]} finish="teal" />}
  </group>;
}

function hullGeometry(length:number,beam:number) {
  const half=length/2;
  const stations:[number,number][]= [[-half,.65],[-half*.82,1],[-half*.35,1],[half*.55,.98],[half*.88,.64],[half,.08]];
  const vertices:number[]=[],indices:number[]=[];
  stations.forEach(([x,part])=>{
    const w=beam*part/2;
    vertices.push(x,4,-w, x,4,w, x,-.45,-w*.74, x,-.45,w*.74);
  });
  for(let i=0;i<stations.length-1;i++){
    const a=i*4,b=(i+1)*4;
    indices.push(a,b,a+2,b,b+2,a+2,a+1,a+3,b+1,b+1,a+3,b+3,a,a+1,b,a+1,b+1,b,a+2,b+2,a+3,a+3,b+2,b+3);
  }
  indices.push(0,2,1,1,2,3,(stations.length-1)*4,(stations.length-1)*4+1,(stations.length-1)*4+2,(stations.length-1)*4+1,(stations.length-1)*4+3,(stations.length-1)*4+2);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function CruiseShip({x,y,angle=0}:{x:number;y:number;angle?:number}) {
  const hull=useMemo(()=>hullGeometry(176,27),[]);
  const windows=useMemo(()=>{
    const out:[number,number,number,number][]=[];
    for(let side of [-1,1])for(let row=0;row<2;row++)for(let i=0;i<55;i++)out.push([-73+i*2.65,1.7+row*1.3,side*12.85,.95]);
    return out;
  },[]);
  useEffect(()=>()=>hull.dispose(),[hull]);
  return <group position={at(x,y)} rotation={[0,angle,0]}>
    <mesh geometry={hull} material={materials.white} castShadow receiveShadow />
    <ContainerBatch finish="glass" items={windows} height={.42} depth={.12} />
    <Solid p={[-10,5.2,0]} s={[153,2.5,24]} finish="navy" />
    {[0,1,2,3].map(level=><group key={level}>
      <Solid p={[-10-level*2,8.4+level*3.3,0]} s={[145-level*9,3.1,22-level*1.3]} finish="white" />
      {[-1,1].map(side=><Solid key={side} p={[-10-level*2,8.8+level*3.3,side*(11-level*.65)]} s={[135-level*10,1.1,.16]} finish="glass" />)}
    </group>)}
    <Solid p={[49,21.5,0]} s={[24,4.5,17]} finish="glass" />
    <Solid p={[-12,22.5,0]} s={[102,.8,15]} finish="ivory" />
    {[-1,1].flatMap(side=>[-47,-24,-1,22,45].map(xx=><mesh key={`${side}-${xx}`} geometry={lifeboatGeometry} material={materials.orange} position={[xx,14.6,side*11.5]} scale={[4.1,1.5,1.35]} castShadow />))}
    {[-34,30].map(xx=><group key={xx}><Solid p={[xx,26,0]} s={[8,5,7]} finish="white" /><Solid p={[xx,29,0]} s={[6,1,7]} finish="navy" /></group>)}
    <Beam from={[38,25,0]} to={[38,39,0]} r={.25} finish="steel" />
    <Beam from={[38,36,-6]} to={[38,36,6]} r={.16} finish="steel" />
    {[-1,1].map(side=><Solid key={side} p={[-10,4.55,side*12.4]} s={[140,.3,.25]} finish="teal" />)}
  </group>;
}

function CargoShip({x,y,angle=0}:{x:number;y:number;angle?:number}) {
  const hull=useMemo(()=>hullGeometry(164,29),[]);
  useEffect(()=>()=>hull.dispose(),[hull]);
  const cargo=useMemo(()=>{
    const out:Record<string,[number,number,number,number][]>={};containerColours.forEach(c=>out[c]=[]);
    for(let col=0;col<10;col++)for(let row=0;row<4;row++)for(let level=0;level<3;level++){
      const finish=containerColours[(col*2+row+level)%containerColours.length];
      out[finish].push([-51+col*12.4,6.4+level*2.7,-9+row*6,11.9]);
    }
    return out;
  },[]);
  return <group position={at(x,y)} rotation={[0,angle,0]}>
    <mesh geometry={hull} material={materials.navy} castShadow receiveShadow />
    <Solid p={[-2,4.3,0]} s={[145,1.3,25]} finish="red" />
    {containerColours.map(c=><ContainerBatch key={c} finish={c} items={cargo[c]} />)}
    <Solid p={[-67,10,0]} s={[17,11,21]} finish="white" />
    <Solid p={[-67,16.2,0]} s={[20,2.1,23]} finish="glass" />
    <Solid p={[-67,19.4,0]} s={[18,3,19]} finish="white" />
    <Solid p={[-70,22,0]} s={[6,2.5,6]} finish="orange" />
    <Beam from={[-62,23,0]} to={[-62,34,0]} r={.18} finish="steel" />
  </group>;
}

function PilotBoat({x,y,angle=0}:{x:number;y:number;angle?:number}) {
  const hull=useMemo(()=>hullGeometry(39,10),[]);
  useEffect(()=>()=>hull.dispose(),[hull]);
  return <group position={at(x,y)} rotation={[0,angle,0]}>
    <mesh geometry={hull} material={materials.orange} castShadow />
    <Solid p={[-3,6.5,0]} s={[20,5.5,8]} finish="white" />
    <Solid p={[0,9.3,0]} s={[10,2,8]} finish="glass" />
    <Solid p={[-3,10.6,0]} s={[22,1,9]} finish="white" />
    <Beam from={[-5,11,0]} to={[-5,18,0]} r={.16} finish="steel" />
  </group>;
}

function Wake({x,y,length,width,angle=0}:{x:number;y:number;length:number;width:number;angle?:number}) {
  const mesh=useRef<THREE.Mesh>(null),material=useRef<THREE.MeshBasicMaterial>(null),elapsed=useRef(0);
  useFrame((_,dt)=>{
    elapsed.current=(elapsed.current+Math.min(dt,.1))%3.2;
    const phase=elapsed.current/3.2,scale=1+phase*.16;
    if(mesh.current)mesh.current.scale.set(length/2*scale,width/2*scale,1);
    if(material.current)material.current.opacity=(.27*(1-phase));
  });
  return <mesh ref={mesh} position={at(x,y,-.85)} rotation={[-Math.PI/2,0,angle]} scale={[length/2,width/2,1]} raycast={()=>{}}>
    <ringGeometry args={[.92,1,64]} />
    <meshBasicMaterial ref={material} color="#e0f1eb" transparent opacity={.27} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}

export function AnimatedSea({storm=0,sunset=false,reduced=false}:{storm?:number;sunset?:boolean;reduced?:boolean}) {
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uStorm:{value:0},uSunset:{value:0},uLightDir:{value:new THREE.Vector3(.42,.82,-.38)}},
    vertexShader:`uniform float uTime;uniform float uStorm;varying vec2 vSea;varying float vWave;varying vec3 vWorld;
      float swellHeight(vec2 p,float t){
        float a=sin(dot(p,vec2(.009,.004))+t*.58)*.42;
        float b=sin(dot(p,vec2(-.003,.012))-t*.76)*.21;
        float c=sin(dot(p,vec2(.021,-.014))+t*1.08)*.08;
        return a+b+c;
      }
      void main(){vSea=position.xy;float h=swellHeight(position.xy,uTime);vWave=h;
        vec3 p=position;p.z=h*(.82+uStorm*.42);
        vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform float uTime;uniform float uStorm;uniform float uSunset;uniform vec3 uLightDir;varying vec2 vSea;varying float vWave;varying vec3 vWorld;
      float waveHeight(vec2 p,float t){
        return .42*sin(dot(p,vec2(.009,.004))+t*.58)
          +.21*sin(dot(p,vec2(-.003,.012))-t*.76)
          +.08*sin(dot(p,vec2(.021,-.014))+t*1.08)
          +.035*sin(dot(p,vec2(.064,.038))+t*1.65);
      }
      void main(){
        vec2 q=vSea;float h=waveHeight(q,uTime);
        float dx=(waveHeight(q+vec2(1.,0.),uTime)-waveHeight(q-vec2(1.,0.),uTime))*.5;
        float dz=(waveHeight(q+vec2(0.,1.),uTime)-waveHeight(q-vec2(0.,1.),uTime))*.5;
        vec3 normal=normalize(vec3(-dx*4.2,1.,-dz*4.2));vec3 viewDir=normalize(cameraPosition-vWorld);
        vec3 halfDir=normalize(normalize(uLightDir)+viewDir);
        float fresnel=pow(1.-max(dot(normal,viewDir),0.),3.2);
        float spec=pow(max(dot(normal,halfDir),0.),72.)*(.32+uStorm*.2);
        float broad=.5+.5*sin(dot(q,vec2(.014,.009))-uTime*.52);
        float chopA=sin(dot(q,vec2(.034,.021))-uTime*1.18+sin(q.y*.009+uTime*.3)*.45);
        float chopB=sin(dot(q,vec2(-.019,.037))+uTime*.91);
        float ripple=chopA*chopB;
        float crest=smoothstep(.25,.42,h)*smoothstep(.008,.035,abs(dx)+abs(dz));
        float foam=clamp(crest*(.12+uStorm*.42)+pow(max(0.,ripple),10.)*(.12+uStorm*.12),0.,.48);
        float glint=pow(max(0.,sin(dot(q,vec2(.047,-.028))+uTime*1.5)*sin(dot(q,vec2(.021,.055))-uTime*1.07)),9.);
        vec3 deep=mix(vec3(.018,.115,.19),vec3(.035,.17,.23),uSunset*.55);
        vec3 shallows=mix(vec3(.045,.29,.34),vec3(.20,.34,.37),uSunset*.48);
        vec3 colour=mix(deep,shallows,clamp(.24+broad*.48+vWave*.15,0.,1.));
        colour=mix(colour,vec3(.24,.54,.57),fresnel*.66);
        colour+=vec3(.8,.91,.87)*(spec*.85+glint*(.22+uStorm*.22));
        colour=mix(colour,vec3(.77,.88,.83),foam);
        colour=mix(colour,vec3(.035,.12,.18),uStorm*.22);
        gl_FragColor=vec4(colour,1.);
      }`,
    side:THREE.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2,
  }),[]);
  useFrame((_,dt)=>{
    if(!reduced)material.uniforms.uTime.value+=Math.min(dt,.1);
    material.uniforms.uStorm.value+=(Math.min(storm/30,1)-material.uniforms.uStorm.value)*Math.min(1,dt*2);
    material.uniforms.uSunset.value=sunset?1:0;
    material.uniforms.uLightDir.value.set(sunset?-.72:.42,sunset?.34:.82,sunset?-.6:-.38).normalize();
  });
  useEffect(()=>()=>material.dispose(),[material]);
  return <mesh position={[0,-1.12,0]} rotation={[-Math.PI/2,0,0]} material={material} raycast={()=>{}}>
    <planeGeometry args={[8000,8000,128,128]} />
  </mesh>;
}

export default function MangaPort({structures=true,ground=null}:{structures?:boolean;ground?:GroundSampler|null}) {
  const yardMachines:Array<{x:number;y:number;kind:'truck'|'stacker';angle:number}>=[
    {x:937,y:-548,kind:'stacker',angle:-.2},{x:872,y:-431,kind:'stacker',angle:.18},
    {x:720,y:-401,kind:'truck',angle:-.12},{x:946,y:-471,kind:'stacker',angle:.32},
  ];
  return <group>
    <CruiseShip x={-65} y={-728} angle={-.09} />
    <CargoShip x={651} y={-780} angle={-.09} />
    <PilotBoat x={1060} y={-802} angle={-.35} />
    <Wake x={-65} y={-728} length={197} width={45} angle={-.09} />
    <Wake x={651} y={-780} length={184} width={47} angle={-.09} />
    <Wake x={1060} y={-802} length={51} width={17} angle={-.35} />
    {structures&&<>
      <PortBoundary ground={ground}/>
      <YardContainers />
      <QuayCrane x={367} y={-689} angle={-.09} />
      <QuayCrane x={778} y={-724} angle={-.09} />
      <GantryCrane x={419} y={-575} />
      <GantryCrane x={645} y={-579} />
      <GantryCrane x={760} y={-456} quay />
      <Warehouse x={-113} y={-575} length={80} />
      <Warehouse x={68} y={-567} length={68} />
      {[-256,-230,-204,-178,-152].map((x,i)=><WorkerHouse key={x} x={x} y={-544+(i%2)*2} finish={i%2?'ivory':'white'} />)}
      <Vehicle x={320} y={-542} kind="stacker" angle={-.2} />
      <Vehicle x={562} y={-552} kind="stacker" angle={.16} />
      <Vehicle x={145} y={-605} angle={-.08} />
      <Vehicle x={834} y={-583} angle={.35} />
      {yardMachines.filter(({x,y})=>insidePortYard(x,y)).map(machine=><Vehicle key={`yard-machine-${machine.x}`} {...machine}/>) }
      <ServiceBridge />
    </>}
  </group>;
}
