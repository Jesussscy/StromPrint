import type { Grid, Scenario, WaterResult } from './types';

export const STEP_SECONDS = 10;
export function validateScenario(s: Scenario, seconds: number) {
  for (const n of [s.rainMmH,s.durationH,s.infiltrationMmH,s.drainageMmH,seconds]) if (!Number.isFinite(n) || n<0) throw new Error('Parámetros no finitos o negativos.');
  if (s.rainMmH>300 || s.durationH>168 || seconds>168*3600 || s.infiltrationMmH>100 || s.drainageMmH>100 || (s.seaHeadM!==null && (!Number.isFinite(s.seaHeadM) || s.seaHeadM < -2 || s.seaHeadM>15))) throw new Error('Fuera del rango exploratorio: lluvia 0–300 mm/h, duración 0–168 h y cota marina −2–15 m.');
  if (s.forcing) {
    if (!s.forcing.length || s.forcing[0].hour!==0) throw new Error('Serie de lluvia sin inicio en t=0.');
    s.forcing.forEach((p,i)=>{if (!Number.isFinite(p.hour) || !Number.isFinite(p.rainMmH) || p.rainMmH<0 || p.rainMmH>300 || (i>0 && p.hour<=s.forcing![i-1].hour)) throw new Error('Serie de lluvia incompleta o fuera del rango exploratorio.');});
  }
}

/** Conservative diffusive storage model. Volumes m³, heights m, seconds.
 * Pair fluxes share donor limit so no negative depth can be produced.
 * Not a calibrated shallow-water/momentum solver. */
export class SurfaceWater {
  private volume: Float64Array;
  private outgoing: Float64Array;
  private transfer: Float64Array;
  private flow: Float64Array;
  seconds=0; rainM3=0; lossM3=0; seaM3=0;
  constructor(readonly grid: Grid, readonly scenario: Scenario) {
    validateScenario(scenario,0);
    this.volume=new Float64Array(grid.cells.length);
    this.outgoing=new Float64Array(grid.cells.length);
    this.flow=new Float64Array(grid.cells.length*2);
    this.transfer=new Float64Array(grid.edges.length);
  }
  step(dt=STEP_SECONDS) {
    if (!(dt>0 && dt<=STEP_SECONDS)) throw new Error('Paso temporal no admisible.');
    const {cells,edges}=this.grid, s=this.scenario;
    const hour=this.seconds/3600;
    let rain=hour<s.durationH?s.rainMmH:0;
    if (s.forcing) {
      let k=0; while(k+1<s.forcing.length && s.forcing[k+1].hour<=hour) k++;
      if (hour>s.forcing[s.forcing.length-1].hour+1) throw new Error('No hay lluvia disponible para esta hora.');
      rain=s.forcing[k].rainMmH;
    }
    this.outgoing.fill(0); this.flow.fill(0);
    for(let i=0;i<cells.length;i++) {
      const c=cells[i], added=rain/3600000*dt*c.area;
      this.volume[i]+=added; this.rainM3+=added;
      const loss=Math.min(this.volume[i],(s.infiltrationMmH*(1-c.built)+s.drainageMmH)/3600000*dt*c.area);
      this.volume[i]-=loss; this.lossM3+=loss;
      if(c.coastal && s.seaHeadM!==null) {
        const target=Math.max(0,s.seaHeadM-c.z)*c.area;
        // Finite exchange time; reservoir only touches mapped coastline cells.
        const delta=(target-this.volume[i])*(1-Math.exp(-dt/600));
        this.volume[i]+=delta; this.seaM3+=delta;
      }
    }
    for(let k=0;k<edges.length;k++) {
      const [a,b,widthRatio]=edges[k], ca=cells[a],cb=cells[b];
      const ha=this.volume[a]/ca.area, hb=this.volume[b]/cb.area;
      const diff=ca.z+ha-cb.z-hb;
      const donor=diff>0?a:b;
      const wet=Math.max(0,(diff>0?ca.z+ha:cb.z+hb)-Math.max(ca.z,cb.z));
      // 3 m/s conductance, subgrid obstruction reduces conveyance, never removes rain volume.
      const permeability=Math.max(.05,1-(ca.built+cb.built)/2);
      const v=3*widthRatio*wet*diff*dt*permeability;
      this.transfer[k]=v; this.outgoing[donor]+=Math.abs(v);
    }
    for(let k=0;k<edges.length;k++) {
      const [a,b]=edges[k],raw=this.transfer[k],donor=raw>0?a:b;
      const v=raw*Math.min(1,this.volume[donor]*.45/(this.outgoing[donor]||1));
      this.transfer[k]=v;
    }
    for(let k=0;k<edges.length;k++) {
      const [a,b]=edges[k],v=this.transfer[k];
      this.volume[a]-=v;this.volume[b]+=v;
      const x=cells[b].x-cells[a].x,y=cells[b].y-cells[a].y,len=Math.hypot(x,y)||1;
      for(const i of [a,b]) {this.flow[i*2]+=v/dt*x/len;this.flow[i*2+1]+=v/dt*y/len;}
    }
    this.seconds+=dt;
  }
  advanceTo(seconds: number) {
    validateScenario(this.scenario,seconds);
    // Quantization to fixed 10 s steps makes frame rate and seek order irrelevant.
    const target=Math.floor(seconds/STEP_SECONDS)*STEP_SECONDS;
    if(target<this.seconds) throw new Error('Retroceder requiere reinicio y recálculo.');
    while(this.seconds+STEP_SECONDS<=target) this.step();
    return this.result();
  }
  result(): WaterResult {
    let storedM3=0,maxDepthM=0;
    const depth=Array.from(this.volume,(v,i)=>{storedM3+=v;const d=v/this.grid.cells[i].area;maxDepthM=Math.max(maxDepthM,d);return d;});
    return {seconds:this.seconds,depth,flux:Array.from(this.flow),rainM3:this.rainM3,lossM3:this.lossM3,seaM3:this.seaM3,storedM3,balanceM3:storedM3-(this.rainM3-this.lossM3+this.seaM3),maxDepthM};
  }
}
