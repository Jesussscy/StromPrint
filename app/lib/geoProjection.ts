// ---------------------------------------------------------------------------
// StormPrint :: geoProjection.ts
// Escalado y disposición espacial para la escena 3D de inundación por zona.
// Convierte altura de agua (cm) en unidades 3D y define la micro-topografía
// urbana de cada tipo de amenaza de las 20 zonas críticas de Manga.
// ---------------------------------------------------------------------------

import type { TipoAmenaza } from "@/app/lib/zonasManga";

// Escala: 1 unidad 3D = 20 cm de agua. Así 120 cm (máximo crítico) ≈ 6 u.
export const CM_POR_UNIDAD = 20;

// Tamaño base de la plataforma 3D (en unidades), todas las escenas cuadradas.
export const ESCENA_TAM = 10;

// Altura máxima previsible de la columna de agua en unidades 3D.
export const NIEVEL_TECHO_U = 6.5;

/** Convierte centímetros de agua a unidades 3D, siempre [0, techo]. */
export function cmToU(cm: number): number {
  const u = cm / CM_POR_UNIDAD;
  return Math.max(0, Math.min(NIEVEL_TECHO_U, u));
}

// Orden visual de construcción por tipo de amenaza (para consistencia).
export const ORDEN_CASTAS: TipoAmenaza[] = [
  "Marea Alta",
  "Mixto",
  "Lluvias Intensas",
  "Drenaje",
];

/**
 * Barras de manzanas (calles y casas) para la micro-escena de una zona.
 * Devuelve listas de objetos base -> el componente les aplica altura/color.
 */
export interface ManzanaSpec {
  x: number; // centro x en unidades (0=centro escena)
  z: number; // centro z en unidades
  w: number; // ancho en x
  d: number; // profundidad en z
  nCasas: number; // cantidad de casas sobre la manzana
  casaMaxH: number; // altura máxima de casas (unidades 3D)
  orientacion?: number; // rotación del bloque en rad
}

/** Genera un bloque de manzana residencial dentro de la plataforma. */
function manzana(x: number, z: number, w: number, d: number, nCasas: number, casaMaxH: number): ManzanaSpec {
  return { x, z, w, d, nCasas, casaMaxH };
}

export interface EscenaDiseno {
  calles: { x: number; z: number; w: number; d: number }[];
  manzanas: ManzanaSpec[];
  aceras: { x: number; z: number; w: number; d: number }[];
  // agua lateral (bahía/ciénaga) siempre a un costado
  aguaCostado: "e" | "w" | "n" | "s";
  esMarea: boolean;
  tieneAguaLateral: boolean;
}

const CASAS_POR_MANZANA = 4;

/** Genera la disposición urbana según el tipo de amenaza de la zona. */
export function disenarEscena(tipo: TipoAmenaza): EscenaDiseno {
  const calles = [
    { x: 0, z: -4.4, w: 8.6, d: 0.7 },
    { x: 0, z: 0, w: 8.6, d: 0.7 },
    { x: 0, z: 4.4, w: 8.6, d: 0.7 },
    { x: -4.4, z: 0, w: 0.7, d: 8.6 },
    { x: 4.4, z: 0, w: 0.7, d: 8.6 },
  ];
  const aceras = [
    { x: 0, z: -3.3, w: 8.6, d: 0.35 },
    { x: 0, z: 3.3, w: 8.6, d: 0.35 },
    { x: -3.3, z: 0, w: 0.35, d: 8.6 },
    { x: 3.3, z: 0, w: 0.35, d: 8.6 },
  ];

  // Casas distribuidas en 4 manzanas típicas (arte 2x2).
  const manzanas: ManzanaSpec[] = [
    manzana(-2.2, -2.2, 2.0, 2.0, CASAS_POR_MANZANA, 1.6),
    manzana(2.2, -2.2, 2.0, 2.0, CASAS_POR_MANZANA, 1.6),
    manzana(-2.2, 2.2, 2.0, 2.0, CASAS_POR_MANZANA, 1.6),
    manzana(2.2, 2.2, 2.0, 2.0, CASAS_POR_MANZANA, 1.6),
  ];

  // Caso borde de bahía: una franja de agua a un costado y espejo de baja altura.
  if (tipo === "Marea Alta" || tipo === "Mixto") {
    return {
      calles: [{ x: 0, z: 0, w: 6.6, d: 5.6 }, { x: 0, z: -4.0, w: 8.6, d: 0.7 }, { x: 0, z: 4.0, w: 8.6, d: 0.7 }],
      manzanas: [
        manzana(-2.4, 0, 2.4, 4.6, 3, 1.4),
        manzana(0.0, 0, 2.4, 4.6, 3, 1.4),
        manzana(2.4, 0, 2.4, 4.6, 3, 1.4),
      ],
      aceras: [{ x: 0, z: -4.5, w: 8.6, d: 0.4 }],
      aguaCostado: "w",
      esMarea: true,
      tieneAguaLateral: true,
    };
  }

  // Ciénaga (borde húmedo trasero) y demás: agua de drenaje desde un costado.
  const esCienaga = tipo === "Drenaje";
  return {
    calles,
    manzanas,
    aceras,
    aguaCostado: esCienaga ? "s" : "n",
    esMarea: false,
    tieneAguaLateral: true,
  };
}

/** Devuelve el ángulo de levante de la cámara (elevación) por tipo. */
export function camaraPorTipo(tipo: TipoAmenaza): { pos: [number, number, number]; target: [number, number, number] } {
  return {
    pos: [9, 6.5, 9],
    target: [0, 1, 0],
  };
}
