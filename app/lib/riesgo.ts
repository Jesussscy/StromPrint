// ---------------------------------------------------------------------------
// StormPrint :: riesgo.ts
// Fuente de verdad de los umbrales de riesgo y su paleta de colores (frontend).
// Debe mantenerse sincronizado con api/physics_engine.py:
//   Normal < 30cm · Alerta 30-59 · Emergencia 60-99 · Critico >= 100
// ---------------------------------------------------------------------------

export const UMBRAL_ALERTA = 30; // cm
export const UMBRAL_EMERGENCIA = 60; // cm
export const UMBRAL_CRITICO = 100; // cm

export type NivelRiesgoES = "Normal" | "Alerta" | "Emergencia" | "Critico";

// Paleta central de color por nivel (en espanol)
export const COLOR_POR_NIVEL: Record<NivelRiesgoES, string> = {
  Normal: "#00E5FF",
  Alerta: "#FFD600",
  Emergencia: "#FF0055",
  Critico: "#B000FF",
};

// Aliases en ingles para backwards compatibility (registros legacy)
const COLOR_ALIAS: Record<string, string> = {
  low: COLOR_POR_NIVEL.Normal,
  moderate: COLOR_POR_NIVEL.Alerta,
  high: COLOR_POR_NIVEL.Emergencia,
  critical: COLOR_POR_NIVEL.Critico,
};

export function clasificarNivel(cm: number): NivelRiesgoES {
  if (cm >= UMBRAL_CRITICO) return "Critico";
  if (cm >= UMBRAL_EMERGENCIA) return "Emergencia";
  if (cm >= UMBRAL_ALERTA) return "Alerta";
  return "Normal";
}

/** Color segun el nivel (acepta estado en espanol o los aliases legacy en ingles). */
export function riscoColorEstilo(estado: string): string {
  const base: NivelRiesgoES = estado as NivelRiesgoES;
  if (base in COLOR_POR_NIVEL) return COLOR_POR_NIVEL[base];
  if (estado in COLOR_ALIAS) return COLOR_ALIAS[estado];
  return COLOR_POR_NIVEL.Normal;
}

/** Color segun el nivel de agua en cm. */
export function colorDeNivelCm(cm: number): string {
  return COLOR_POR_NIVEL[clasificarNivel(cm)];
}

/** Etiqueta normalizada en espanol para un estado (espanol o ingles legacy). */
export function etiquetaNivel(estado: string): NivelRiesgoES {
  const alias: Record<string, NivelRiesgoES> = {
    low: "Normal",
    moderate: "Alerta",
    high: "Emergencia",
    critical: "Critico",
  };
  const base = estado as NivelRiesgoES;
  if (base in COLOR_POR_NIVEL) return base;
  return alias[estado] ?? "Normal";
}
