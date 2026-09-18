import type { Scenario } from './types';
/** Radial hypothetical intensity. Same taper as GPU drops, zero outside radius. */
export function rainCoverage(x:number,y:number,field:Scenario['rainFootprint']) {
  if(!field)return 1;
  const t=Math.max(0,Math.min(1,(Math.hypot(x-field.x,y-field.y)/field.radiusM-.65)/.35));
  return 1-t*t*(3-2*t);
}
