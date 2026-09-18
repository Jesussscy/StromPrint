export type Vec3 = [number, number, number];
export type Triangle = [Vec3, Vec3, Vec3];
export interface Building {
  id: string; name: string; height: number; heightMethod: string; base: number;
  rings: [number, number][][]; roofTriangles: [number, number][][];
}
export interface Cell { x: number; y: number; z: number; area: number; built: number; coastal: boolean; triangles: Triangle[]; ij: [number, number] }
export interface Grid { dx: number; cells: Cell[]; edges: [number, number, number][] }
export interface MangaData {
  metadata: { name: string; origin: [number, number]; dem: string; areaM2: number; downloadDate: string; buildings: number; cells: number };
  boundary: [number, number][]; terrain: Triangle[]; buildings: Building[];
  roads: { id: string; name: string; triangles: Triangle[] }[];
  parks: Triangle[]; sea: Triangle[]; grid: Grid;
}
export interface Forcing { hour: number; rainMmH: number }
export interface Scenario {
  rainMmH: number; durationH: number; infiltrationMmH: number; drainageMmH: number;
  /** Hypothetical boundary head in EGM96; never automatic MSL addition. */
  seaHeadM: number | null; forcing?: Forcing[];
}
export interface WaterResult {
  /** Volume-preserving visual levels over terrain triangles, computed in worker. */
  levels?: number[];
  seconds: number; depth: number[]; flux: number[]; rainM3: number; lossM3: number;
  seaM3: number; storedM3: number; balanceM3: number; maxDepthM: number;
}
