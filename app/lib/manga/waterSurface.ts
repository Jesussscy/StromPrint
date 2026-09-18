import type { Grid, Vec3, WaterResult } from './types';

/** Visual reconstruction of coarse cell levels, not a sub-cell hydraulic solve.
 * Clip the terrain triangles at the cell's water level so water stays level and
 * does not cover high vertices. Keep all stored cells regardless of built ratio.
 */
export function waterSurface(grid: Grid, result: WaterResult | null) {
  const positions: number[] = [], depths: number[] = [];
  if (!result) return { positions, depths };
  grid.cells.forEach((cell, index) => {
    const depth = result.depth[index];
    if (!Number.isFinite(depth) || depth < .004) return;
    const level = cell.z + depth;
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
          positions.push(vertex[0], level + .015, -vertex[1]);
          depths.push(Math.max(0, level - vertex[2]));
        }
      }
    }
  });
  return { positions, depths };
}
