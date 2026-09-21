import * as THREE from 'three';
import meta from '@/public/models/manga/weather/surfaces.json';
import { ZONAS_MANGA } from '../zonasManga';
import { zoneLocal } from './adapter';

export interface RainSurface { texture: THREE.DataTexture; bounds: THREE.Vector4 }
let loading: Promise<RainSurface> | undefined;
/** Shared immutable collision texture: dispose only with the whole application.
 * Cached across fullscreen and StrictMode mounts; no disposed texture reuse. */
export function loadRainSurface(): Promise<RainSurface> {
  if (!loading) loading=(async()=>{
    const response=await fetch('/models/manga/weather/surfaces.bin.gz');
    if(!response.ok||!response.body)throw new Error('No se pudo cargar la superficie de colisión');
    const bytes=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    if(bytes.byteLength!==meta.size*meta.size*16)throw new Error('Superficie de colisión incompleta');
    const texture=new THREE.DataTexture(new Float32Array(bytes),meta.size,meta.size,THREE.RGBAFormat,THREE.FloatType);
    texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
    return {texture,bounds:new THREE.Vector4(...meta.bounds as [number,number,number,number])};
  })().catch(error=>{loading=undefined;throw error;});
  return loading;
}
export function surfaceUniforms(surface:RainSurface) {
  return {surfaceMap:{value:surface.texture},surfaceBounds:{value:surface.bounds},zones:{value:ZONAS_MANGA.map(z=>{
    const [x,y]=zoneLocal(...z.coordenadas);return new THREE.Vector4(x,-y,z.radio_influencia,0);
  })}};
}
/** Shared surface and flood equations: rain lands on precisely the water surface
 * drawn by MangaFlood, and never produces an impact underneath a roof. */
export const SURFACE_GLSL=`
uniform sampler2D surfaceMap;uniform vec4 surfaceBounds;uniform vec4 zones[20];
vec4 surfaceAt(vec2 p){vec2 uv=(p-surfaceBounds.xy)/surfaceBounds.zw;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec4(0.);
  return texture2D(surfaceMap,uv);}
float waterAt(vec2 p){float depth=0.;
  for(int i=0;i<20;i++){
    vec4 z=zones[i];float reach=clamp(sqrt(max(0.,z.w)/.18),.08,1.25);
    float irregular=1.+.12*sin(p.x*.045)*sin(p.y*.037)+.06*sin(p.x*.09+p.y*.07);
    float d=length((p-z.xy)*vec2(1.,.88))/z.z*irregular;
    float basin=1.-smoothstep(reach*.35,reach,d);
    depth=max(depth,z.w*basin);
  }return depth;}
vec3 surfaceNormal(vec4 s){return normalize(vec3(s.y,sqrt(max(.05,1.-s.y*s.y-s.z*s.z)),s.z));}
`;
