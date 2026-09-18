import { SurfaceWater } from './solver';
import type { Grid, Scenario } from './types';
let engine: SurfaceWater | null=null;
let key='';
let cachedGrid:Grid|null=null;
self.onmessage=(event: MessageEvent<{id:number;grid?:Grid;scenario:Scenario;seconds:number}>)=>{
  const {id,grid,scenario,seconds}=event.data;
  try {
    if(grid){cachedGrid=grid;engine=null;}
    if(!cachedGrid)throw new Error('El terreno todavía no está disponible.');
    const nextKey=JSON.stringify(scenario);
    if(!engine || key!==nextKey || seconds<engine.seconds) {engine=new SurfaceWater(cachedGrid,scenario);key=nextKey;}
    const start=performance.now();
    const result=engine.advanceTo(seconds);
    self.postMessage({id,result,computeMs:performance.now()-start});
  } catch(error) { self.postMessage({id,error:error instanceof Error?error.message:'No se pudo calcular el agua.'}); }
};
