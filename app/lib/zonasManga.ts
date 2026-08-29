// ---------------------------------------------------------------------------
// StormPrint :: zonasManga.ts
// Las 20 zonas críticas de inundación del Barrio Manga, Cartagena
// ---------------------------------------------------------------------------

export type NivelRiesgo = "CRITICO" | "EMERGENCIA" | "ALERTA" | "NORMAL";
export type TipoAmenaza = "Marea Alta" | "Lluvias Intensas" | "Drenaje" | "Mixto";

export interface ZonaManga {
  id: number;
  nombre: string;
  ubicacion: string;
  coordenadas: [number, number]; // [lat, lng]
  nivel_riesgo: NivelRiesgo;
  altura_critica: number; // cm (nivel característico de inundación de la zona)
  tipo_amenaza: TipoAmenaza;
  descripcion: string;
  radio_influencia: number; // metros
  poblacion_afectada?: number;
}

export const ZONAS_MANGA: ZonaManga[] = [
  // ── ZONA 1 · Borde de la Bahía (Marea Alta) ────────────────────────────
  {
    id: 1, nombre: "Av. Miramar × Calle 24", ubicacion: "Borde de la Bahía",
    coordenadas: [10.399, -75.5185], nivel_riesgo: "CRITICO", altura_critica: 120,
    tipo_amenaza: "Marea Alta", descripcion: "Punto más bajo frente a la bahía, anegado con marea alta.",
    radio_influencia: 100, poblacion_afectada: 320,
  },
  {
    id: 2, nombre: "Av. Miramar (C25-26)", ubicacion: "Borde de la Bahía",
    coordenadas: [10.3985, -75.518], nivel_riesgo: "CRITICO", altura_critica: 115,
    tipo_amenaza: "Marea Alta", descripcion: "Invasión del agua de mar sobre la avenida costera.",
    radio_influencia: 100, poblacion_afectada: 295,
  },
  {
    id: 3, nombre: "Av. Miramar × Calle 27", ubicacion: "Borde de la Bahía",
    coordenadas: [10.398, -75.5175], nivel_riesgo: "EMERGENCIA", altura_critica: 85,
    tipo_amenaza: "Marea Alta", descripcion: "Acumulación costera recurrente en viviendas aledañas.",
    radio_influencia: 85, poblacion_afectada: 180,
  },
  {
    id: 4, nombre: "Carrera 23 × Calle 28", ubicacion: "Borde de la Bahía",
    coordenadas: [10.3975, -75.517], nivel_riesgo: "EMERGENCIA", altura_critica: 70,
    tipo_amenaza: "Marea Alta", descripcion: "Desagüe insuficiente frente al borde de la bahía.",
    radio_influencia: 85, poblacion_afectada: 165,
  },
  {
    id: 5, nombre: "C24 × C25 (Pte. Román)", ubicacion: "Acceso Puente Román",
    coordenadas: [10.3988, -75.5165], nivel_riesgo: "CRITICO", altura_critica: 105,
    tipo_amenaza: "Mixto", descripcion: "Acceso al puente: mezcla de marea y escorrentía.",
    radio_influencia: 95, poblacion_afectada: 260,
  },

  // ── ZONA 2 · Borde Ciénaga de Las Quintas (Marea + Drenaje) ────────────
  {
    id: 6, nombre: "Callejón Dandy (C29A)", ubicacion: "Ciénaga de Las Quintas",
    coordenadas: [10.397, -75.516], nivel_riesgo: "CRITICO", altura_critica: 110,
    tipo_amenaza: "Mixto", descripcion: "Foco de marea + drenaje junto a la ciénaga.",
    radio_influencia: 100, poblacion_afectada: 300,
  },
  {
    id: 7, nombre: "Carrera 23A × Calle 29B", ubicacion: "Ciénaga de Las Quintas",
    coordenadas: [10.3965, -75.5155], nivel_riesgo: "EMERGENCIA", altura_critica: 90,
    tipo_amenaza: "Mixto", descripcion: "Retroceso de la ciénaga hacia las viviendas.",
    radio_influencia: 90, poblacion_afectada: 200,
  },
  {
    id: 8, nombre: "Calle 29 × Carrera 22", ubicacion: "Ciénaga de Las Quintas",
    coordenadas: [10.396, -75.515], nivel_riesgo: "EMERGENCIA", altura_critica: 75,
    tipo_amenaza: "Drenaje", descripcion: "Colapso del alcantarillado por escorrentía.",
    radio_influencia: 80, poblacion_afectada: 150,
  },
  {
    id: 9, nombre: "Calle 29A × Carrera 21", ubicacion: "Ciénaga de Las Quintas",
    coordenadas: [10.3955, -75.5145], nivel_riesgo: "ALERTA", altura_critica: 55,
    tipo_amenaza: "Drenaje", descripcion: "Acumulación moderada en la entrada de la zona.",
    radio_influencia: 70, poblacion_afectada: 90,
  },
  {
    id: 10, nombre: "Pte. Las Palmas → C29", ubicacion: "Salida Puente Las Palmas",
    coordenadas: [10.395, -75.514], nivel_riesgo: "EMERGENCIA", altura_critica: 80,
    tipo_amenaza: "Mixto", descripcion: "Cuello de botella de tránsito que retiene agua.",
    radio_influencia: 85, poblacion_afectada: 175,
  },

  // ── ZONA 3 · Ejes Viales Internos (Acumulación Pluvial) ────────────────
  {
    id: 11, nombre: "Av. Brujo (C26×C24)", ubicacion: "Eje vial interno",
    coordenadas: [10.3995, -75.517], nivel_riesgo: "ALERTA", altura_critica: 50,
    tipo_amenaza: "Lluvias Intensas", descripcion: "Laminación de agua en intersección principal.",
    radio_influencia: 70, poblacion_afectada: 85,
  },
  {
    id: 12, nombre: "Av. Brujo (C26×C22)", ubicacion: "Eje vial interno",
    coordenadas: [10.4, -75.516], nivel_riesgo: "ALERTA", altura_critica: 45,
    tipo_amenaza: "Lluvias Intensas", descripcion: "Encharcamiento rápido con lluvias fuertes.",
    radio_influencia: 65, poblacion_afectada: 75,
  },
  {
    id: 13, nombre: "C. Trébol (C28×C22)", ubicacion: "Eje vial interno",
    coordenadas: [10.398, -75.5155], nivel_riesgo: "ALERTA", altura_critica: 48,
    tipo_amenaza: "Lluvias Intensas", descripcion: "Punto bajo de la calle del Trébol.",
    radio_influencia: 65, poblacion_afectada: 70,
  },
  {
    id: 14, nombre: "C. Trébol (C28×C25)", ubicacion: "Eje vial interno",
    coordenadas: [10.3975, -75.5165], nivel_riesgo: "ALERTA", altura_critica: 52,
    tipo_amenaza: "Lluvias Intensas", descripcion: "Acumulación pluvial con drenaje lento.",
    radio_influencia: 70, poblacion_afectada: 80,
  },
  {
    id: 15, nombre: "C25 Jiménez × C21", ubicacion: "Eje vial interno",
    coordenadas: [10.4005, -75.515], nivel_riesgo: "NORMAL", altura_critica: 20,
    tipo_amenaza: "Drenaje", descripcion: "Zona con buen drenaje, mínima afectación.",
    radio_influencia: 55, poblacion_afectada: 25,
  },

  // ── ZONA 4 · Intersecciones Residenciales Bajas (Drenaje) ──────────────
  {
    id: 16, nombre: "Carrera 26 × Calle 27", ubicacion: "Residencial bajo",
    coordenadas: [10.399, -75.5175], nivel_riesgo: "NORMAL", altura_critica: 25,
    tipo_amenaza: "Drenaje", descripcion: "Charcones ocasionales, recupera rápido.",
    radio_influencia: 55, poblacion_afectada: 35,
  },
  {
    id: 17, nombre: "Carrera 27 × Calle 26", ubicacion: "Residencial bajo",
    coordenadas: [10.3995, -75.518], nivel_riesgo: "NORMAL", altura_critica: 22,
    tipo_amenaza: "Drenaje", descripcion: "Acumulación leve en patios y andenes.",
    radio_influencia: 50, poblacion_afectada: 30,
  },
  {
    id: 18, nombre: "Carrera 25 × Calle 29", ubicacion: "Residencial bajo",
    coordenadas: [10.397, -75.5165], nivel_riesgo: "NORMAL", altura_critica: 18,
    tipo_amenaza: "Drenaje", descripcion: "Sector elevado, riesgo mínimo.",
    radio_influencia: 50, poblacion_afectada: 20,
  },
  {
    id: 19, nombre: "Carrera 21 × Calle 26", ubicacion: "Residencial bajo",
    coordenadas: [10.4005, -75.5145], nivel_riesgo: "NORMAL", altura_critica: 28,
    tipo_amenaza: "Drenaje", descripcion: "Encharcamiento breve tras tormentas.",
    radio_influencia: 60, poblacion_afectada: 40,
  },
  {
    id: 20, nombre: "Av. Jiménez × Carrera 27", ubicacion: "Residencial bajo",
    coordenadas: [10.399, -75.5185], nivel_riesgo: "NORMAL", altura_critica: 26,
    tipo_amenaza: "Drenaje", descripcion: "Punto estable, escurrimiento natural.",
    radio_influencia: 55, poblacion_afectada: 32,
  },
];

// ── Paleta y utilidades por nivel de riesgo ───────────────────────────────

export const RIESGO_META: Record<
  NivelRiesgo,
  { color: string; label: string; peso: number }
> = {
  CRITICO: { color: "#B000FF", label: "Crítico", peso: 4 },
  EMERGENCIA: { color: "#FF0055", label: "Emergencia", peso: 3 },
  ALERTA: { color: "#FFD600", label: "Alerta", peso: 2 },
  NORMAL: { color: "#00E5FF", label: "Normal", peso: 1 },
};

export const ORDEN_RIESGO: NivelRiesgo[] = ["CRITICO", "EMERGENCIA", "ALERTA", "NORMAL"];

export function clasificarNivelCm(cm: number): NivelRiesgo {
  if (cm >= 100) return "CRITICO";
  if (cm >= 60) return "EMERGENCIA";
  if (cm >= 30) return "ALERTA";
  return "NORMAL";
}

export function colorDeNivel(cm: number): string {
  return colorDeRiesgo(clasificarNivelCm(cm));
}

export function colorDeRiesgo(nivel: NivelRiesgo): string {
  return RIESGO_META[nivel].color;
}

// Nivel "dinámico" de una zona según la predicción global.
// altura_critica es el valor máximo que alcanza la zona cuando la simulación
// llega a su punto pico (nivelMaximo); por debajo escala linealmente.
export function nivelDinamicoZona(zona: ZonaManga, nivelAguaCm: number, nivelMaximoCm: number): number {
  const max = nivelMaximoCm > 0 ? nivelMaximoCm : 100;
  const ratio = Math.max(0, Math.min(1.15, nivelAguaCm / max));
  return Math.max(0, Math.round(zona.altura_critica * ratio * 10) / 10);
}

export function riesgoVivo(zona: ZonaManga, nivelAguaCm: number, nivelMaximoCm: number): NivelRiesgo {
  return clasificarNivelCm(nivelDinamicoZona(zona, nivelAguaCm, nivelMaximoCm));
}
