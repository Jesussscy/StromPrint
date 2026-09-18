import { SurfaceWater } from './solver';
import type { Grid, Scenario } from './types';
let engine: SurfaceWater | null=null;
let key='';
self.onmessage=(event: MessageEvent<{id:number;grid:Grid;scenario:Scenario;seconds:number}>)=>{
  const {id,grid,scenario,seconds}=event.data;
  try {
    const nextKey=JSON.stringify(scenario);
    if(!engine || key!==nextKey || seconds<engine.seconds) {engine=new SurfaceWater(grid,scenario);key=nextKey;}
    const start=performance.now();
    const result=engine.advanceTo(seconds);
    self.postMessage({id,result,computeMs:performance.now()-start});
  } catch(error) { self.postMessage({id,error:error instanceof Error?error.message:'No se pudo calcular el agua.'}); }
};
