// ---------------------------------------------------------------------------
// StormPrint :: streetNetwork.ts
// Grafo estilizado de las calles principales de Manga, Cartagena.
//
// No es cartografia OSM completa: son polilineas [lat, lng] que conectan las
// 20 zonas criticas (app/lib/zonasManga.ts) con los ejes viales reales del
// barrio (Av. Miramar, Av. del Brujo, C. del Trébol, carreras 21-27 y calles
// 24-29). Sirve de "cauce" para la animacion de agua fluyendo por las calles
// en el visor 3D (FloodRenderer) y para la capa de calles inundables.
// ---------------------------------------------------------------------------

export interface StreetSegment {
  id: string;
  nombre: string;
  /** Polilinea en orden [lat, lng] (mismo formato que ZONAS_MANGA). */
  points: [number, number][];
  /** Direccion del flujo: 1 = points[0] -> points[n-1], -1 = inverso.
   *  Se eligio de modo que el agua tienda a drenar hacia la Bahia (oeste)
   *  o hacia la Ciénaga de Las Quintas (este), imitando la pendiente real. */
  sentido: 1 | -1;
  /** Peso visual: calles principales (avenidas) fluyen mas. */
  peso: number;
}

// Ejes norte-sur (carreras), de este (ciénaga) a oeste (bahía).
const CARRERA_21: StreetSegment = {
  id: "cr21",
  nombre: "Carrera 21",
  sentido: 1,
  peso: 2,
  points: [
    [10.4048, -75.514], [10.4035, -75.5135], [10.4022, -75.5142],
    [10.4005, -75.5145], [10.3998, -75.515], [10.3983, -75.5148],
    [10.3968, -75.514], [10.3955, -75.5112], [10.3942, -75.5105],
  ],
};

const CARRERA_22: StreetSegment = {
  id: "cr22",
  nombre: "Carrera 22",
  sentido: -1,
  peso: 2,
  points: [
    [10.4055, -75.5155], [10.4048, -75.5152], [10.4035, -75.5148],
    [10.4022, -75.5152], [10.4009, -75.5154], [10.4005, -75.5158],
    [10.3998, -75.516], [10.3983, -75.5155], [10.3968, -75.512],
  ],
};

const CARRERA_23: StreetSegment = {
  id: "cr23",
  nombre: "Carrera 23",
  sentido: -1,
  peso: 3,
  points: [
    [10.4078, -75.5216], [10.4071, -75.5218], [10.4053, -75.5213],
    [10.4038, -75.5208], [10.4021, -75.5201], [10.4005, -75.5193],
    [10.3983, -75.518],
  ],
};

const CARRERA_23A: StreetSegment = {
  id: "cr23a",
  nombre: "Carrera 23A",
  sentido: -1,
  peso: 2,
  points: [
    [10.407, -75.5196], [10.4055, -75.5198], [10.4045, -75.52],
    [10.4032, -75.5192], [10.4018, -75.5188], [10.3993, -75.519],
    [10.3983, -75.5126],
  ],
};

const CARRERA_25: StreetSegment = {
  id: "cr25",
  nombre: "Carrera 25",
  sentido: 1,
  peso: 2,
  points: [
    [10.4062, -75.5175], [10.4053, -75.5178], [10.4042, -75.5181],
    [10.4029, -75.5183], [10.4018, -75.5188], [10.4008, -75.5173],
    [10.3998, -75.515],
  ],
};

const CARRERA_26: StreetSegment = {
  id: "cr26",
  nombre: "Carrera 26",
  sentido: 1,
  peso: 2,
  points: [
    [10.4065, -75.5188], [10.4055, -75.5192], [10.4044, -75.5193],
    [10.4032, -75.5192], [10.4022, -75.5152], [10.4011, -75.5166],
    [10.4005, -75.518],
  ],
};

const CARRERA_27: StreetSegment = {
  id: "cr27",
  nombre: "Carrera 27",
  sentido: 1,
  peso: 2,
  points: [
    [10.4065, -75.5198], [10.4055, -75.5198], [10.4045, -75.52],
    [10.4038, -75.5199], [10.4032, -75.5192], [10.4025, -75.5206],
  ],
};

// Ejes este-oeste (calles), de norte a sur.
const CALLE_24: StreetSegment = {
  id: "ca24",
  nombre: "Calle 24",
  sentido: -1,
  peso: 3,
  points: [
    [10.4078, -75.5215], [10.4078, -75.5195], [10.4075, -75.5175],
    [10.407, -75.515], [10.4068, -75.5135],
  ],
};

const CALLE_25: StreetSegment = {
  id: "ca25",
  nombre: "Calle 25",
  sentido: -1,
  peso: 2,
  points: [
    [10.4071, -75.5218], [10.407, -75.52], [10.4065, -75.518],
    [10.4055, -75.516], [10.4048, -75.514],
  ],
};

const CALLE_26: StreetSegment = {
  id: "ca26",
  nombre: "Calle 26",
  sentido: 1,
  peso: 3,
  points: [
    [10.4053, -75.5213], [10.405, -75.5195], [10.4039, -75.5173],
    [10.4022, -75.5152], [10.4035, -75.5135],
  ],
};

const CALLE_27: StreetSegment = {
  id: "ca27",
  nombre: "Calle 27",
  sentido: 1,
  peso: 2,
  points: [
    [10.4038, -75.5208], [10.4035, -75.5199], [10.4032, -75.5192],
    [10.4022, -75.5175], [10.4018, -75.5188],
  ],
};

const CALLE_28: StreetSegment = {
  id: "ca28",
  nombre: "Calle 28",
  sentido: -1,
  peso: 2,
  points: [
    [10.4021, -75.5201], [10.4018, -75.5188], [10.4005, -75.5158],
    [10.3998, -75.515],
  ],
};

const CALLE_29: StreetSegment = {
  id: "ca29",
  nombre: "Calle 29",
  sentido: -1,
  peso: 2,
  points: [
    [10.3995, -75.519], [10.3998, -75.515], [10.3983, -75.5126],
    [10.3968, -75.512], [10.3942, -75.5105],
  ],
};

// Av. del Brujo: arteria interna que atraviesa Manga de norte a sur.
const AVE_BRUJO: StreetSegment = {
  id: "brujo",
  nombre: "Av. del Brujo",
  sentido: -1,
  peso: 4,
  points: [
    [10.4053, -75.518], [10.4044, -75.5176], [10.4039, -75.5173],
    [10.403, -75.5162], [10.4022, -75.5152], [10.401, -75.516],
    [10.4005, -75.5168], [10.3998, -75.518],
  ],
};

// C. del Trébol: eix transversal corto que cruza la Carrera 25.
const CALLE_TREBOL: StreetSegment = {
  id: "trebol",
  nombre: "C. del Trébol",
  sentido: 1,
  peso: 2,
  points: [
    [10.4005, -75.5158], [10.4018, -75.5188],
  ],
};

// Borde de la Ciénaga de Las Quintas (este): callejon Dandy + salida puente.
const BORDE_CIENAGA: StreetSegment = {
  id: "cienaga",
  nombre: "Borde Ciénaga de Las Quintas",
  sentido: -1,
  peso: 3,
  points: [
    [10.3995, -75.5132], [10.3983, -75.5126], [10.3968, -75.512],
    [10.3955, -75.5112], [10.3942, -75.5105],
  ],
};

// Accesos: Puente Román (NE) y Puente Las Palmas (S) desaguan el barrio.
const ACCESO_ROMAN: StreetSegment = {
  id: "roman",
  nombre: "Acceso Pte. Román",
  sentido: 1,
  peso: 3,
  points: [
    [10.4078, -75.5195], [10.4079, -75.5183], [10.408, -75.517],
  ],
};

const ACCESO_LAS_PALMAS: StreetSegment = {
  id: "palmas",
  nombre: "Acceso Pte. Las Palmas",
  sentido: -1,
  peso: 3,
  points: [
    [10.3942, -75.5105], [10.393, -75.5105], [10.3918, -75.5105],
  ],
};

/** Todas las calles que sirven de cauce para el agua animada. */
export const STREETS_MANGA: StreetSegment[] = [
  AVE_BRUJO,
  CALLE_TREBOL,
  ACCESO_ROMAN,
  ACCESO_LAS_PALMAS,
  CARRERA_21,
  CARRERA_22,
  CARRERA_23,
  CARRERA_23A,
  CARRERA_25,
  CARRERA_26,
  CARRERA_27,
  CALLE_24,
  CALLE_25,
  CALLE_26,
  CALLE_27,
  CALLE_28,
  CALLE_29,
  BORDE_CIENAGA,
];

/** Longitud aproximada (en metros) de una polilinea [lat, lng]. */
export function streetLength(points: [number, number][]): number {
  const RAD = Math.PI / 180;
  const R = 6371000;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dLat = (b[0] - a[0]) * RAD;
    const dLng = (b[1] - a[1]) * RAD;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return total;
}

/** Longitud acumulada por vértice: `[0, s1, s1+s2, ...]` en metros. */
export function streetCumulativeLengths(points: [number, number][]): number[] {
  const out: number[] = [0];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dLng = b[1] - a[1];
    const dLat = b[0] - a[0];
    acc += Math.sqrt(dLng * dLng + dLat * dLat) * 111320 * Math.cos((a[0] + b[0]) * (Math.PI / 2) / 90);
    out.push(acc);
  }
  return out.length ? out : [0];
}

/** Interpola una posicion [lat, lng] a lo largo de la polilinea (s en 0..1). */
export function streetPointAt(
  points: [number, number][],
  s: number
): { lat: number; lng: number } {
  const n = points.length;
  if (n === 1) return { lat: points[0][0], lng: points[0][1] };
  const clamped = Math.max(0, Math.min(1, s));
  const cum = streetCumulativeLengths(points);
  const total = cum[cum.length - 1];
  if (total <= 0) return { lat: points[0][0], lng: points[0][1] };
  const target = clamped * total;
  let i = 1;
  while (i < cum.length && cum[i] < target) i++;
  const a = points[Math.max(0, i - 1)];
  const b = points[Math.min(n - 1, i)];
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = (target - cum[Math.max(0, i - 1)]) / segLen;
  return {
    lat: a[0] + (b[0] - a[0]) * t,
    lng: a[1] + (b[1] - a[1]) * t,
  };
}