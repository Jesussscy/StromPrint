"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ZONAS_MANGA,
  RIESGO_META,
  riesgoVivo,
  nivelDinamicoZona,
  type ZonaManga,
} from "@/app/lib/zonasManga";

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface HeatmapViewProps {
  bounds: Bounds;
  zonas?: ZonaManga[];
  nivelAguaCm?: number;
  nivelMaximoCm?: number;
  velocidad?: number;
  visible: boolean;
  onSelectZona?: (zona: ZonaManga | null) => void;
}

// Resolución de la grilla interior (producto calidad/rendimiento en móvil).
const GRID = 128;
// Radio de influencia en píxeles por metro (con zoom base de ~460 m de ancho).
const PX_PER_M = 1.35;

// Paleta de calor "turbo" alineada a los umbrales sísmicos 30/60/100 cm.
// Cada entrada es [posicion 0..1, [r,g,b]].
const PALETA: [number, [number, number, number]][] = [
  [0.0, [0, 229, 255]],
  [0.3, [40, 235, 120]],
  [0.5, [255, 214, 0]],
  [0.68, [255, 120, 0]],
  [0.85, [255, 0, 85]],
  [1.0, [176, 0, 255]],
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function colorEn(t: number): [number, number, number] {
  t = clamp01(t);
  for (let i = 1; i < PALETA.length; i++) {
    if (t <= PALETA[i][0]) {
      const [t0, c0] = PALETA[i - 1];
      const [t1, c1] = PALETA[i];
      const k = (t - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ];
    }
  }
  return PALETA[PALETA.length - 1][1];
}

// Proyección equirectangular lat/lng -> pixel dentro del viewport proyectado.
function latLngToPixel(
  lat: number,
  lng: number,
  width: number,
  height: number,
  bounds: Bounds
): { x: number; y: number } {
  const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * width;
  const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height;
  return { x, y };
}

// Vector de "ola de inundación": desde la bahía (suroeste/borde costero)
// propagándose al interior.
export default function HeatmapView({
  bounds,
  zonas = ZONAS_MANGA,
  nivelAguaCm = 0,
  nivelMaximoCm = 100,
  velocidad = 1,
  visible,
  onSelectZona,
}: HeatmapViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastNivelRef = useRef<number>(-1);
  const estadoRef = useRef({ nivelAguaCm, nivelMaximoCm, velocidad });
  estadoRef.current = { nivelAguaCm, nivelMaximoCm, velocidad };
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const zonasRef = useRef(zonas);
  zonasRef.current = zonas;
  const onSelectRef = useRef(onSelectZona);
  onSelectRef.current = onSelectZona;

  // Estado de cámara (zoom/pan) y capas animadas.
  const [camera, setCamera] = useState({ scale: 1, tx: 0, ty: 0 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const [capas, setCapas] = useState({ isopleth: true, agua: true, lluvia: true });
  const capasRef = useRef(capas);
  capasRef.current = capas;
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [vel, setVel] = useState(velocidad > 0 ? velocidad : 1);
  const velRef = useRef(vel);
  velRef.current = vel;
  const campoRef = useRef<Float32Array | null>(null);
  const [hover, setHover] = useState<ZonaManga | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  // Tamaño responsive + detección de movimiento reducido.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      const rect = es[0].contentRect;
      setDims({ w: Math.round(rect.width), h: Math.round(rect.height) });
    });
    ro.observe(el);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => {
      ro.disconnect();
      mq.removeEventListener?.("change", onChange);
    };
  }, []);

  // Crear/re-dimensionar canvas offscreen.
  useEffect(() => {
    if (dims.w === 0 || dims.h === 0) return;
    const off = document.createElement("canvas");
    off.width = dims.w;
    off.height = dims.h;
    offRef.current = off;
    const cv = canvasRef.current;
    if (cv) {
      cv.width = dims.w;
      cv.height = dims.h;
    }
    return () => {
      offRef.current = null;
    };
  }, [dims]);

  // Genera la grilla de intensidad interpolada por zona.
  const generarCampo = useCallback(
    (nivel: number, nivelMax: number): Float32Array => {
      const campo = new Float32Array(GRID * GRID);
      const b = boundsRef.current;
      const mDeLat = 111320;
      const cosLat = Math.cos(((b.north + b.south) / 2) * (Math.PI / 180));
      const latRange = b.north - b.south;
      const lngRange = b.east - b.west;
      const rW = dims.w > 0 ? dims.w : 600;
      const rH = dims.h > 0 ? dims.h : 600;

      const estados = zonasRef.current.map((z) => {
        const nivelZ = nivelDinamicoZona(z, nivel, nivelMax);
        if (nivelZ <= 0) return null;
        const riesgo = riesgoVivo(z, nivel, nivelMax);
        const pobl = z.poblacion_afectada ?? 50;
        const radioPx = Math.max(14, z.radio_influencia * PX_PER_M * (rW / 600));
        // sigma en grados (aprox) a partir de píxeles.
        const sigmaDeg = (radioPx / rW) * lngRange;
        const peso =
          (nivelZ / Math.max(nivelMax, 1)) *
          (0.55 + RIESGO_META[riesgo].peso * 0.32) *
          (1 + pobl / 2600);
        return {
          lat: z.coordenadas[0],
          lng: z.coordenadas[1],
          sigma: Math.max(0.00035, sigmaDeg * 1.15),
          peso,
        };
      }).filter(Boolean) as {
        lat: number;
        lng: number;
        sigma: number;
        peso: number;
      }[];

      if (estados.length === 0) return campo;

      for (let py = 0; py < GRID; py++) {
        const lat = b.north - ((py + 0.5) / GRID) * latRange;
        for (let px = 0; px < GRID; px++) {
          const lng = b.west + ((px + 0.5) / GRID) * lngRange;
          let acc = 0;
          for (let i = 0; i < estados.length; i++) {
            const e = estados[i];
            const dy = (lat - e.lat) * mDeLat;
            const dx = (lng - e.lng) * mDeLat * cosLat;
            const q = dx * dx + dy * dy;
            acc += e.peso * Math.exp(-q / (2 * e.sigma * e.sigma));
          }
          campo[py * GRID + px] = acc;
        }
      }
      return campo;
    },
    [dims.w, dims.h]
  );

  // Dibuja una capa de lluvia animada sobre zonas de tipo "Lluvias Intensas".
  const dibujarLluvia = useCallback(
    (ctx: CanvasRenderingContext2D, t: number, nivel: number) => {
      if (nivel <= 0) return;
      const b = boundsRef.current;
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      const intensidad = clamp01(nivel / Math.max(100, nivelMaximoCm));
      const nGotas = Math.round(16 + intensidad * 40);
      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < nGotas; i++) {
        const z = zonasRef.current[i % zonasRef.current.length];
        if (z.tipo_amenaza !== "Lluvias Intensas" && z.tipo_amenaza !== "Mixto") continue;
        const base = latLngToPixel(z.coordenadas[0], z.coordenadas[1], W, H, b);
        const seed = i * 137.5;
        const x = base.x + Math.sin(t * 0.001 * velRef.current * 0.2 + seed) * 46;
        const y = base.y + ((t * 0.16 * velRef.current + seed) % 60);
        const alpha = 0.25 + 0.3 * Math.abs(Math.sin(t * 0.01 + seed));
        ctx.strokeStyle = `rgba(180,235,255,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 9);
        ctx.stroke();
      }
      ctx.restore();
    },
    [nivelMaximoCm]
  );

  // Dibuja la superficie de agua con ripples (base oscura bajo el calor).
  const dibujarAgua = useCallback(
    (ctx: CanvasRenderingContext2D, t: number, nivel: number) => {
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      const intensidad = clamp01(nivel / Math.max(100, nivelMaximoCm));
      if (intensidad <= 0.01) return;
      const phase = t * 0.0004;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      for (let y = 0; y < H; y += 8) {
        for (let x = 0; x < W; x += 8) {
          const nx = x / W;
          const ny = y / H;
          const w1 = Math.sin(nx * Math.PI * 6 + phase);
          const w2 = Math.sin(ny * Math.PI * 6 + phase * 0.7);
          const w3 = Math.sin(Math.hypot(nx - 0.5, ny - 0.5) * Math.PI * 12 + phase * 1.3);
          const v = (w1 * 0.5 + w2 * 0.3 + w3 * 0.2 + 1) * 0.5;
          const a = (14 + v * 50) * intensidad;
          ctx.fillStyle = `rgba(30,120,190,${clamp01(a / 255)})`;
          ctx.fillRect(x, y, 8, 8);
        }
      }
      ctx.restore();
    },
    [nivelMaximoCm]
  );

  // Bucle de animación: redibuja continuamente sobre el canvas visible.
  useEffect(() => {
    if (!visible) return;
    const cv = canvasRef.current;
    const off = offRef.current;
    if (!cv || !off) return;
    const ctx = cv.getContext("2d");
    const octx = off.getContext("2d");
    if (!ctx || !octx) return;

    const W = () => cv.width;
    const H = () => cv.height;
    const start = performance.now();

    const dibujar = () => {
      const tk = performance.now() - start;
      const { nivelAguaCm: nivel, nivelMaximoCm: nivelMax } = estadoRef.current;
      const vel = velRef.current;
      const b = boundsRef.current;
      const cam = cameraRef.current;
      const cap = capasRef.current;

      octx.clearRect(0, 0, W(), H());
      octx.fillStyle = "rgba(4,18,40,1)";
      octx.fillRect(0, 0, W(), H());

      // Capa base de agua (ripples) solo cuando hay inundación.
      if (cap.agua) dibujarAgua(octx, tk, nivel);

      // Regenerar el campo solo cuando el nivel salta >=5 cm (throttle) o fuerza.
      const dNivel = Math.abs(nivel - lastNivelRef.current);
      if (dNivel >= 5 || lastNivelRef.current < 0) {
        const campo = generarCampo(nivel, nivelMax);
        lastNivelRef.current = Math.round(nivel);
        campoRef.current = campo;
      }
      const campo = campoRef.current;
      if (!campo) return;

      // Aplicamos transformación de cámara (zoom/pan) en todo el dibujo.
      octx.save();
      octx.translate(cam.tx * W(), cam.ty * H());
      octx.scale(cam.scale, cam.scale);

      const cellW = W() / GRID;
      const cellH = H() / GRID;
      let maxExp = 1;
      for (let py = 0; py < GRID; py++) {
        const row = py * GRID;
        for (let px = 0; px < GRID; px++) {
          if (campo[row + px] > maxExp) maxExp = campo[row + px];
        }
      }
      if (maxExp <= 0) maxExp = 1;
      const inv = 1 / maxExp;

      // Amplitud de pulso global (latido) que crece con el nivel de riesgo.
      const pulso = reducedMotion ? 1 : 0.88 + 0.12 * Math.sin(tk * 0.003 * vel);

      // Precalcular "pulsadores" por zona (constantes por frame): solo se
      // re-evalúa el kernel de distancia por celda, ahorrando senos y riesgo.
      const pulsadores: { x: number; y: number; R: number; peso: number }[] = [];
      if (!reducedMotion) {
        for (const z of zonasRef.current) {
          const nivelZ = nivelDinamicoZona(z, nivel, nivelMax);
          if (nivelZ <= 0) continue;
          const pz = latLngToPixel(z.coordenadas[0], z.coordenadas[1], W(), H(), b);
          const R = Math.max(10, z.radio_influencia * PX_PER_M * (W() / 600));
          const fase = Math.sin(tk * 0.005 * vel + z.id * 2.1);
          const peso =
            (nivelZ / Math.max(nivelMax, 1)) *
            (1 + 0.18 * fase * (RIESGO_META[riesgoVivo(z, nivel, nivelMax)].peso / 4));
          pulsadores.push({ x: pz.x, y: pz.y, R, peso });
        }
      }
      const hayPulsadores = pulsadores.length > 0;

      for (let py = 0; py < GRID; py++) {
        const y0 = py * cellH;
        for (let px = 0; px < GRID; px++) {
          const x0 = px * cellW;

          let acc = campo[py * GRID + px] * inv;

          // Onda viajera: desplazamiento y pulsación por posición (flujo de marea).
          if (!reducedMotion) {
            const origen = { x: 0.1, y: 0.85 };
            const dist = Math.hypot(px / GRID - origen.x, py / GRID - origen.y);
            const onda = 0.8 + 0.2 * Math.sin(tk * 0.0022 * vel - dist * 14);
            acc *= onda;
          }

          acc *= pulso;

          // Pulso por zona (núcleo de influencia), usa pulsadores pre-calculados.
          if (hayPulsadores) {
            let acc2 = 0;
            for (let i = 0; i < pulsadores.length; i++) {
              const pu = pulsadores[i];
              const kernel = Math.max(0, 1 - Math.hypot(px * cellW - pu.x, py * cellH - pu.y) / pu.R);
              if (kernel <= 0) continue;
              acc2 += pu.peso * kernel;
            }
            acc += acc2 * 0.35;
          }

          acc = clamp01(acc);

          const [r, g, bl] = colorEn(acc);
          let alpha = 0.18 + acc * 0.62;
          octx.fillStyle = `rgba(${r},${g},${bl},${clamp01(alpha)})`;
          octx.fillRect(x0, y0, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);

          // Contornos isopleth en cambios de banda del campo normalizado.
          if (cap.isopleth && px > 0 && py > 0) {
            const banda = (v: number) => (v <= 0.3 ? 0 : v <= 0.5 ? 1 : v <= 0.7 ? 2 : 3);
            const c = campo[py * GRID + px] * inv;
            const izq = campo[py * GRID + px - 1] * inv;
            const arr = campo[(py - 1) * GRID + px] * inv;
            if (banda(c) !== banda(izq) || banda(c) !== banda(arr)) {
              octx.fillStyle = "rgba(255,255,255,0.35)";
              octx.fillRect(x0, y0, 1, Math.ceil(cellH));
            }
          }
        }
      }

      // Resplandor pulsante en zonas críticas.
      if (!reducedMotion) {
        for (const z of zonasRef.current) {
          const riesgo = riesgoVivo(z, nivel, nivelMax);
          if (riesgo !== "CRITICO" && riesgo !== "EMERGENCIA") continue;
          const p = latLngToPixel(z.coordenadas[0], z.coordenadas[1], W(), H(), b);
          const R = Math.max(10, z.radio_influencia * PX_PER_M * (W() / 600));
          const pulsoG = 0.5 + 0.5 * Math.sin(tk * 0.007 * vel + z.id);
          const grad = octx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
          const color = RIESGO_META[riesgo].color;
          grad.addColorStop(0, `${color.slice(0, 7)}${Math.round((0.5 * pulsoG * 255)).toString(16).padStart(2, "0")}`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          octx.fillStyle = grad;
          octx.beginPath();
          octx.arc(p.x, p.y, R, 0, Math.PI * 2);
          octx.fill();
        }
      }

      octx.restore();

      // Gotas de lluvia sobre zonas de lluvia intensa (capa superior).
      if (cap.lluvia && !reducedMotion) dibujarLluvia(octx, tk, nivel);

      // Blit del offscreen al canvas visible.
      ctx.clearRect(0, 0, W(), H());
      ctx.drawImage(off, 0, 0);

      rafRef.current = requestAnimationFrame(dibujar);
    };

    rafRef.current = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, dims, generarCampo, dibujarAgua, dibujarLluvia, reducedMotion]);

  const zonaActiva = hover;
  const dragRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const movedRef = useRef(false);

  const aplicarZoom = useCallback((factor: number, cx?: number, cy?: number) => {
    const c = cameraRef.current;
    const nuevo = Math.max(1, Math.min(8, c.scale * factor));
    if (cx !== undefined && cy !== undefined) {
      const relX = cx / (dims.w || 1);
      const relY = cy / (dims.h || 1);
      const k = nuevo / c.scale;
      setCamera({
        scale: nuevo,
        tx: relX - (relX - c.tx) * k,
        ty: relY - (relY - c.ty) * k,
      });
    } else {
      setCamera({ ...c, scale: nuevo });
    }
  }, [dims]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      aplicarZoom(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top);
    },
    [aplicarZoom]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { x: e.clientX, y: e.clientY, active: true };
      movedRef.current = false;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;

      // Hover: tooltip con zona si estamos sobre una, sincronizado con selección.
      if (!dragRef.current.active) {
        const b = boundsRef.current;
        let mejor: ZonaManga | null = null;
        let mejorD = Infinity;
        for (const z of zonasRef.current) {
          const p = latLngToPixel(z.coordenadas[0], z.coordenadas[1], dims.w || 1, dims.h || 1, b);
          const R = Math.max(10, z.radio_influencia * PX_PER_M * ((dims.w || 600) / 600));
          const d = Math.hypot(px - p.x, py - p.y);
          if (d < R && d < mejorD) {
            mejor = z;
            mejorD = d;
          }
        }
        hoverRef.current = mejor;
        setHover(mejor);
        onSelectRef.current?.(mejor);
        return;
      }

      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      if (Math.hypot(dx, dy) > 6) movedRef.current = true;
      dragRef.current = { x: e.clientX, y: e.clientY, active: true };
      setCamera((c) => ({
        ...c,
        tx: c.tx + dx / (c.scale * (dims.w || 1)),
        ty: c.ty + dy / (c.scale * (dims.h || 1)),
      }));
    },
    [dims]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
    movedRef.current = true;
  }, []);

  // Hover: ref compartida para el tooltip (sincronizada con el estado).
  const hoverRef = useRef<ZonaManga | null>(null);

  const onPointerMoveHover = useCallback(
    (e: React.PointerEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
    },
    []
  );

  // Clic/tap: selecciona la zona bajo el puntero (ignora si hubo arrastre).
  const onMapClick = useCallback(
    (e: React.MouseEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const b = boundsRef.current;
      let mejor: ZonaManga | null = null;
      let mejorD = Infinity;
      for (const z of zonasRef.current) {
        const p = latLngToPixel(z.coordenadas[0], z.coordenadas[1], dims.w || 1, dims.h || 1, b);
        const R = Math.max(10, z.radio_influencia * PX_PER_M * ((dims.w || 600) / 600));
        const d = Math.hypot(px - p.x, py - p.y);
        if (d < R && d < mejorD) {
          mejor = z;
          mejorD = d;
        }
      }
      setHover(mejor);
      onSelectRef.current?.(mejor);
    },
    [dims]
  );

  const resetCam = useCallback(() => setCamera({ scale: 1, tx: 0, ty: 0 }), []);

  const exportPng = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = "stormprint-heatmap.png";
    a.click();
  }, []);

  // Teclado: R re-centrar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") resetCam();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetCam]);

  const escalaGauge = 140;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden rounded-2xl bg-[#041228]"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMoveHover}
      onPointerMoveCapture={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onMapClick}
      style={{ touchAction: "none", cursor: "crosshair" }}
      role="application"
      aria-label="Mapa de calor 2D de Manga. Zoom con rueda, arrastre para panear, clic sobre una zona para seleccionar."
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Tooltip por hover */}
      {zonaActiva && mouse && (
        <div
          className="pointer-events-none absolute z-20 glass rounded-lg p-2 text-[10px] leading-tight"
          style={{
            left: Math.min(mouse.x + 14, (dims.w || 600) - 180),
            top: Math.max(mouse.y - 10, 8),
            maxWidth: 180,
          }}
        >
          <div className="font-mono font-bold text-white">{zonaActiva.nombre}</div>
          <div className="text-slate-300">{zonaActiva.ubicacion}</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: RIESGO_META[riesgoVivo(zonaActiva, nivelAguaCm, nivelMaximoCm)].color }}
            />
            <span className="font-tabular text-cyan">
              {nivelDinamicoZona(zonaActiva, nivelAguaCm, nivelMaximoCm).toFixed(1)} cm
            </span>
            <span className="capitalize text-slate-300">
              {RIESGO_META[riesgoVivo(zonaActiva, nivelAguaCm, nivelMaximoCm)].label}
            </span>
          </div>
          <div className="text-slate-400">Población: {zonaActiva.poblacion_afectada ?? "—"}</div>
        </div>
      )}

      {/* Controles: zoom / reset / velocidad / capas / export */}
      <div
        className="absolute bottom-3 left-3 z-20 flex flex-col gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => aplicarZoom(1.25)}
          className="glass rounded-md px-2.5 py-1 text-xs text-cyan hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          aria-label="Acercar"
          title="Acercar"
        >
          +
        </button>
        <button
          onClick={() => aplicarZoom(0.8)}
          className="glass rounded-md px-2.5 py-1 text-xs text-cyan hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          aria-label="Alejar"
          title="Alejar"
        >
          −
        </button>
        <button
          onClick={resetCam}
          className="glass rounded-md px-2.5 py-1 text-[10px] font-mono text-cyan hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          aria-label="Re-centrar (R)"
          title="Re-centrar (R)"
        >
          R
        </button>
      </div>

      {/* Slider de velocidad de animación */}
      <div
        className="absolute bottom-3 right-3 z-20 flex items-center gap-2 glass rounded-lg px-2 py-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Vel</span>
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.1}
          value={vel}
          onChange={(e) => setVel(Number(e.target.value))}
          aria-label="Velocidad de animación"
          className="h-1 w-20 accent-cyan"
        />
      </div>

      {/* Leyenda / toggles de capas & export */}
      <div
        className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 glass rounded-lg px-3 py-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <div
            className="h-2 w-28 rounded-full"
            style={{
              background: "linear-gradient(to right, #00E5FF, #28EB78, #FFD600, #FF7800, #FF0055, #B000FF)",
            }}
          />
          <div className="relative mt-0.5 h-3 font-tabular text-[8px] text-slate-400 select-none">
            <span className="absolute" style={{ left: `${(30 / escalaGauge) * 100}%` }}>30</span>
            <span className="absolute" style={{ left: `${(60 / escalaGauge) * 100}%` }}>60</span>
            <span className="absolute" style={{ left: `${(100 / escalaGauge) * 100}%` }}>100</span>
          </div>
        </div>
        <div className="flex gap-1">
          {(
            [
              ["isopleth", "Líneas"],
              ["agua", "Agua"],
              ["lluvia", "Lluvia"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCapas((c) => ({ ...c, [key]: !c[key] }))}
              aria-pressed={capas[key]}
              className={`rounded px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wide transition ${
                capas[key] ? "bg-cyan/20 text-cyan" : "text-slate-500 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={exportPng}
          className="rounded bg-cyan/20 px-2 py-0.5 text-[8px] font-mono uppercase tracking-wide text-cyan hover:bg-cyan/30"
          aria-label="Exportar imagen PNG"
          title="Exportar PNG"
        >
          PNG
        </button>
      </div>
    </div>
  );
}
