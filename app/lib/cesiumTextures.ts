// ---------------------------------------------------------------------------
// StormPrint :: cesiumTextures.ts
// Genera texturas (canvas) para billboards/heatmap de Cesium sin librerías.
// ---------------------------------------------------------------------------

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

// Crea la textura de un "pin" (gotita) con color base y borde claro.
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
