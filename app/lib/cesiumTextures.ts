// ---------------------------------------------------------------------------
// StormPrint :: cesiumTextures.ts
// Genera texturas (canvas) para billboards/heatmap de Cesium sin librerías.
// ---------------------------------------------------------------------------

import {
  RIESGO_META,
  nivelDinamicoZona,
  riesgoVivo,
  type NivelRiesgo,
  type ZonaManga,
} from "@/app/lib/zonasManga";

// Crea una textura radial: núcleo sólido -> degradado -> transparente.
// Útil para marcadores "glow" y para la capa de calor (heatmap).
export function radialGlowTexture(
  color: string,
  size = 128,
  maxAlpha = 0.9,
  coreRadiusRatio = 0.35
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const r = size / 2;
  // Núcleo central casi opaco
  const core = ctx.createRadialGradient(r, r, 0, r, r, r);
  const stops: [number, number][] = [
    [0, maxAlpha],
    [coreRadiusRatio, maxAlpha],
    [coreRadiusRatio + 0.2, maxAlpha * 0.55],
    [0.85, maxAlpha * 0.12],
    [1, 0],
  ];
  // Aplicar color con alpha variable
  const { hex, a } = parseColor(color);
  for (const [off, alpha] of stops) core.addColorStop(off, `rgba(${hex}, ${alpha * a})`);
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

// Superficie de agua procedural: ondas + caustics deterministas que cambian con
// la fase (animación lenta de ripples) y cuya intensidad/opacidad sube con el
// nivel de inundación. Se re-genera a baja frecuencia (cada ~600 ms).
export function waterTexture(phase = 0, intensidad = 0.5, size = 256): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const image = ctx.createImageData(size, size);
  const d = image.data;
  const baseAlpha = 16 + Math.round(intensidad * 130);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      // Superposición de ondas a 3 frecuencias + anillo radial (ripple)
      const w1 = Math.sin(nx * Math.PI * 6 + phase);
      const w2 = Math.sin(ny * Math.PI * 6 + phase * 0.7);
      const w3 = Math.sin(Math.hypot(nx - 0.5, ny - 0.5) * Math.PI * 10 + phase * 1.3);
      const v = (w1 * 0.5 + w2 * 0.3 + w3 * 0.2 + 1) * 0.5; // 0..1
      const idx = (y * size + x) * 4;
      d[idx] = 0;
      d[idx + 1] = 190 + Math.round(v * 60);
      d[idx + 2] = 225 + Math.round(v * 30);
      d[idx + 3] = baseAlpha + Math.round(v * baseAlpha * 0.8);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// Capa de calor INTERPOLADA (no billboards): una grilla lat/lng alrededor de
// Manga donde cada celda acumula la contribución gaussiana de las 20 zonas
// (peso por riesgo vivo y población afectada). El campo resultante pinta
// bandas de color con líneas de contorno entre bandas (isopleth de riesgo).
// Se regenera solo cuando el nivel salta un múltiplo de 5 cm.
export function heatmapTexture(
  zonas: ZonaManga[],
  nivelAguaCm: number,
  nivelMaximoCm: number,
  bounds: { west: number; south: number; east: number; north: number },
  size = 96
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const image = ctx.createImageData(size, size);
  const d = image.data;
  const mDeLat = 111320;
  const cosLat = Math.cos(((bounds.north + bounds.south) / 2) * (Math.PI / 180));
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;

  // Parámetros de cada zona según su estado vivo actual; el peso mezcla el
  // riesgo dinámico con la población afectada (zonas más pobladas pesan más).
  const estados = zonas.map((z) => {
    const nivelZ = nivelDinamicoZona(z, nivelAguaCm, nivelMaximoCm);
    const riesgo = riesgoVivo(z, nivelAguaCm, nivelMaximoCm);
    const pobl = z.poblacion_afectada ?? 50;
    const sigma = Math.max(30, z.radio_influencia * 1.15);
    const peso = Math.min(2.2, (nivelZ / 100) * (0.7 + RIESGO_META[riesgo].peso * 0.35) * (1 + pobl / 900));
    return { lat: z.coordenadas[0], lng: z.coordenadas[1], sigma, peso };
  });

  const campo = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    const lat = bounds.north - ((py + 0.5) / size) * latRange;
    for (let px = 0; px < size; px++) {
      const lng = bounds.west + ((px + 0.5) / size) * lngRange;
      let acc = 0;
      for (let i = 0; i < estados.length; i++) {
        const e = estados[i];
        const dy = (lat - e.lat) * mDeLat;
        const dx = (lng - e.lng) * mDeLat * cosLat;
        const q = dx * dx + dy * dy;
        acc += e.peso * Math.exp(-q / (2 * e.sigma * e.sigma));
      }
      campo[py * size + px] = acc;
    }
  }

  // Bandas de color (lerp entre umbrales del campo) y banda numérica (contorno)
  const bands = [
    { t: 0.025, c: [0, 229, 255] },
    { t: 0.09, c: [255, 214, 0] },
    { t: 0.2, c: [255, 0, 85] },
    { t: 10, c: [176, 0, 255] },
  ];
  const colorDeCampo = (acc: number): [number, number, number, number] => {
    const a = Math.min(0.9, 0.1 + acc * 2.4);
    if (acc <= bands[0].t) return [bands[0].c[0], bands[0].c[1], bands[0].c[2], Math.min(a, 0.35)];
    for (let i = 1; i < bands.length; i++) {
      if (acc <= bands[i].t) {
        const lo = bands[i - 1].c;
        const hi = bands[i].c;
        const k = (acc - bands[i - 1].t) / (bands[i].t - bands[i - 1].t);
        return [
          Math.round(lo[0] + (hi[0] - lo[0]) * k),
          Math.round(lo[1] + (hi[1] - lo[1]) * k),
          Math.round(lo[2] + (hi[2] - lo[2]) * k),
          a,
        ];
      }
    }
    const c = bands[bands.length - 1].c;
    return [c[0], c[1], c[2], a];
  };
  const banda = (acc: number): number => {
    if (acc <= bands[0].t) return 0;
    if (acc <= bands[1].t) return 1;
    if (acc <= bands[2].t) return 2;
    return 3;
  };

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;
      const acc = campo[py * size + px];
      const [r, g, b, a] = colorDeCampo(acc);
      d[idx] = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = Math.round(a * 255);
      // Línea de contorno donde cambia la banda (vecino arriba o izquierda)
      const band = banda(acc);
      const up = py > 0 ? banda(campo[(py - 1) * size + px]) : band;
      const left = px > 0 ? banda(campo[py * size + px - 1]) : band;
      if (up !== band || left !== band) {
        d[idx] = 18;
        d[idx + 1] = 26;
        d[idx + 2] = 40;
        d[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
export function pinTexture(color: string, size = 64): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.28;
  const stemLen = size * 0.34;
  const { hex } = parseColor(color);

  // Pata del pin
  ctx.strokeStyle = `rgb(${hex})`;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.35, cy + radius * 0.7);
  ctx.lineTo(cx, cy + stemLen);
  ctx.lineTo(cx + radius * 0.35, cy + radius * 0.7);
  ctx.stroke();

  // Cabeza (círculo) con relleno y borde
  ctx.beginPath();
  ctx.arc(cx, cy - radius * 0.15, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${hex})`;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();

  // Hoyo interior blanco
  ctx.beginPath();
  ctx.arc(cx, cy - radius * 0.15, radius * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();

  return canvas;
}

// Interpreta colores en #RRGGBB o #RRGGBBAA -> { hex: "R,G,B", a }
function parseColor(color: string): { hex: string; a: number } {
  const m = color.replace("#", "");
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16);
    const g = parseInt(m[1] + m[1], 16);
    const b = parseInt(m[2] + m[2], 16);
    return { hex: `${r},${g},${b}`, a: 1 };
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return { hex: `${r},${g},${b}`, a: 1 };
  }
  if (m.length === 8) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    const a = parseInt(m.slice(6, 8), 16) / 255;
    return { hex: `${r},${g},${b}`, a };
  }
  return { hex: "255,255,255", a: 1 };
}
