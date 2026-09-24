/** Conceptual port-yard footprint in the local Manga coordinate system (metres).
 * Kept separate from the flooding grid: these are visual exclusions only. */
export const PORT_YARDS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-350, -540], [-260, -590], [120, -635], [540, -705], [915, -740], [1050, -580], [925, -490], [680, -500], [350, -505], [-200, -485]],
  [[645, -495], [865, -535], [1005, -460], [910, -365], [765, -385]],
];

function inside(x: number, y: number, polygon: ReadonlyArray<readonly [number, number]>) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

export function insidePortYard(x: number, y: number) {
  return PORT_YARDS.some(polygon => inside(x, y, polygon));
}

/** Display interpolation only: clipped SRTM surface plus two Google Earth
 * platform checks. It is not a surveyed DTM or a hydraulic calibration. */
export function displayGroundElevation(x: number, y: number, source: number) {
  const h = Math.max(-2, Math.min(12, source));
  if (!insidePortYard(x, y)) return h;
  let distance = Infinity;
  for (const polygon of PORT_YARDS) for (let i=0;i<polygon.length;i++) {
    const [ax,ay]=polygon[i], [bx,by]=polygon[(i+1)%polygon.length], dx=bx-ax,dy=by-ay;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  const t=Math.max(0,Math.min(1,distance/35)), weight=t*t*(3-2*t);
  return h+(1.56-h)*weight;
}
