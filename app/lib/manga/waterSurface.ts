import type { Cell, Grid, Triangle, Vec3, WaterResult } from './types';

function clipped(triangle:Triangle,level:number):Vec3[] {
  const wet:Vec3[]=[];
  for(let i=0;i<3;i++){
    const a=triangle[i],b=triangle[(i+1)%3],aWet=a[2]<level,bWet=b[2]<level;
    if(aWet)wet.push(a);
    if(aWet!==bWet){const t=(level-a[2])/(b[2]-a[2]);
      wet.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),level]);
    }
  }
  return wet;
}
/** Exact integral of positive depth over linear terrain triangles. */
export function surfaceVolume(cell:Cell,level:number) {
  let volume=0;
  for(const t of cell.triangles){const p=clipped(t,level);
    for(let i=1;i+1<p.length;i++){
      const a=p[0],b=p[i],c=p[i+1];
      const area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
      volume+=area*(3*level-a[2]-b[2]-c[2])/3;
    }
  }
  return volume;
}
/** Reconstruct a level containing the stored volume over this cell's mesh.
 * This is not a higher-resolution hydraulic simulation. */
export function cellWaterLevel(cell:Cell,depth:number) {
  if(!cell.triangles.length)return cell.z+Math.max(0,depth);
  let low=Infinity,high=-Infinity,area=0;
  for(const t of cell.triangles){for(const v of t){low=Math.min(low,v[2]);high=Math.max(high,v[2]);}
    const [a,b,c]=t;area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
  }
  if(!(depth>0)||!(area>0))return low;
  const target=cell.area*depth;high+=target/area;
  for(let i=0;i<28;i++){const mid=(low+high)/2;if(surfaceVolume(cell,mid)<target)low=mid;else high=mid;}
  return (low+high)/2;
}
export function waterLevels(grid:Grid,result:WaterResult) {
  return grid.cells.map((cell,i)=>cellWaterLevel(cell,result.depth[i]));
}

/** Visual reconstruction of coarse cell levels, not a sub-cell hydraulic solve.
 * Clip the terrain triangles at the cell's water level so water stays level and
 * does not cover high vertices. Level is reconstructed from the stored volume.
 */
export function waterSurface(grid: Grid, result: WaterResult | null) {
  const positions: number[] = [], depths: number[] = [];
  if (!result) return { positions, depths };
  grid.cells.forEach((cell, index) => {
    const depth = result.depth[index];
    if (!Number.isFinite(depth) || depth < .004) return;
    const level = result.levels?.[index] ?? cellWaterLevel(cell,depth);
    for (const triangle of cell.triangles) {
      const wet: Vec3[] = [];
      for (let i = 0; i < 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3];
        const aWet = a[2] < level, bWet = b[2] < level;
        if (aWet) wet.push(a);
        if (aWet !== bWet) {
          const t = (level - a[2]) / (b[2] - a[2]);
          wet.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), level]);
        }
      }
      for (let i = 1; i + 1 < wet.length; i++) {
        for (const vertex of [wet[0], wet[i], wet[i + 1]]) {
          positions.push(vertex[0], level + .008, -vertex[1]);
          depths.push(Math.max(0, level - vertex[2]));
        }
      }
    }
  });
  return { positions, depths };
}
