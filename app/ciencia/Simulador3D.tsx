"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Float, Html, Sparkles, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  Activity,
  Download,
  Droplets,
  MapPin,
  Minus,
  Pause,
  Play,
  RotateCcw,
  Timer,
  TrendingDown,
  TrendingUp,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { correrSimulacion, SIM_PARAMS_DEFAULT, type RegistroSim } from "./simuladorFisica";
import { clasificarNivel, COLOR_POR_NIVEL, type NivelRiesgoES } from "@/app/lib/riesgo";
import { ZONAS_MANGA } from "@/app/lib/zonasManga";

const DURACION_H = 48;
const PASO_H = 1;

const SX = 3;
const SY = 3;
const SZ = 55;
const Z_MAX = 130;

const NIVELES: { nombre: NivelRiesgoES; rango: string; color: string }[] = [
  { nombre: "Normal", rango: "< 30 cm", color: COLOR_POR_NIVEL.Normal },
  { nombre: "Alerta", rango: "30 – 59 cm", color: COLOR_POR_NIVEL.Alerta },
  { nombre: "Emergencia", rango: "60 – 99 cm", color: COLOR_POR_NIVEL.Emergencia },
  { nombre: "Critico", rango: "≥ 100 cm", color: COLOR_POR_NIVEL.Critico },
];

function aPunto3D(r: RegistroSim): [number, number, number] {
  return [r.x / SX, Math.min(r.z / SZ, Z_MAX / SZ), r.y / SY];
}

// Partícula que viaja por la curva dejando un halo
function Corriente({ puntos, color }: { puntos: [number, number, number][]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const idx = useRef(0);
  useFrame((_, delta) => {
    if (puntos.length < 2) return;
    idx.current = (idx.current + 6.5 * delta) % (puntos.length - 1);
    const i = Math.floor(idx.current);
    const frac = idx.current - i;
    const a = puntos[i];
    const b = puntos[Math.min(i + 1, puntos.length - 1)];
    ref.current?.position.set(
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac
    );
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}

// Ejes XYZ con etiquetas
function Ejes({ showLabels }: { showLabels: boolean }) {
  const label = (pos: [number, number, number], text: string, color: string) => (
    <Html position={pos} center style={{ pointerEvents: "none" }}>
      <div style={{ color, fontFamily: "monospace", fontSize: 12, background: "rgba(2,12,24,0.6)", padding: "1px 5px", borderRadius: 4 }}>{text}</div>
    </Html>
  );
  return (
    <group>
      <Line points={[[0, 0, 0], [5.5, 0, 0]]} color="#FF3370" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 3.2, 0]]} color="#00E5FF" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, 5.5]]} color="#00FF87" lineWidth={2} />
      {showLabels && (
        <>
          {label([5.9, 0, 0], "X · Este (m)", "#FF3370")}
          {label([0, 3.5, 0], "Z · Nivel (cm)", "#00E5FF")}
          {label([0, 0, 5.9], "Y · Norte (m)", "#00FF87")}
        </>
      )}
    </group>
  );
}

function Rejilla() {
  return <gridHelper args={[14, 14, "#1a3a4a", "#0f1a24"]} position={[0, -0.05, 0]} />;
}

function Reloj3D({ t, color }: { t: number; color: string }) {
  return (
    <Html position={[2.2, 3.6, 4.4]} center style={{ pointerEvents: "none" }}>
      <div style={{ color, fontFamily: "monospace", fontSize: 13, background: "rgba(2,12,24,0.8)", padding: "3px 8px", borderRadius: 6, border: `1px solid ${color}` }}>
        t = {t.toFixed(1)} h
      </div>
    </Html>
  );
}

function AutoRotar({ activo, grupo }: { activo: boolean; grupo: React.RefObject<THREE.Group> }) {
  useFrame((_, delta) => {
    if (activo && grupo.current) grupo.current.rotation.y += delta * 0.25;
  });
  return null;
}

function MarcadorPosicion({ p, color, label }: { p: [number, number, number]; color: string; label: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + 0.3 * Math.sin(clock.elapsedTime * 4));
  });
  return (
    <group position={p}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Html center position={[0, 0.55, 0]} style={{ pointerEvents: "none" }}>
        <div className="pointer-events-none whitespace-nowrap rounded-md bg-ocean/90 border px-2 py-1 font-mono text-[9px]" style={{ color, borderColor: color, boxShadow: `0 0 10px ${color}66` }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function ubicacionActual(serie: RegistroSim[], t: number): RegistroSim {
  if (!serie.length) return { t: 0, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, f_lluvia: 0, f_marea: 0, f_viento: 0, riesgo: "Normal" };
  let i = 0;
  for (let k = 0; k < serie.length; k++) {
    if (serie[k].t <= t) i = k;
  }
  return serie[i];
}

// ---------------------------------------------------------------------------
// Escena 3D: ejes + trayectoria + HUD superpuesto
// ---------------------------------------------------------------------------
export default function Simulador3D({ serie, tiempo }: { serie: RegistroSim[]; tiempo: number }) {
  const grupo = useRef<THREE.Group>(null);
  const [autoRotar, setAutoRotar] = useState(true);

  const colorActual = useMemo(() => {
    const r = ubicacionActual(serie, tiempo);
    return COLOR_POR_NIVEL[clasificarNivel(r.z)];
  }, [serie, tiempo]);

  const puntos = useMemo(() => serie.map(aPunto3D), [serie]);
  const actual = useMemo(() => ubicacionActual(serie, tiempo), [serie, tiempo]);

  const ejesLegend = [
    { nombre: "X · Este (m)", color: "#FF3370" },
    { nombre: "Y · Norte (m)", color: "#00FF87" },
    { nombre: "Z · Nivel (cm)", color: "#00E5FF" },
  ];

  return (
    <div
      className="relative h-[420px] md:h-[480px] rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-ocean-mid to-ocean transition-shadow duration-500"
      style={{ boxShadow: `0 0 46px ${colorActual}26, inset 0 1px 0 rgba(255,255,255,0.05)` }}
    >
      <Canvas camera={{ position: [7, 5, 8], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} />
        <group ref={grupo}>
          <AutoRotar activo={autoRotar} grupo={grupo} />
          <Rejilla />
          <Ejes showLabels />
          <Float speed={2} rotationIntensity={0.06} floatIntensity={0.2}>
            <Line points={puntos} color={colorActual} lineWidth={3} />
            <Line points={puntos} color="#ffffff" lineWidth={0.8} transparent opacity={0.35} />
            <Corriente puntos={puntos} color="#00FF87" />
          </Float>
          <Sparkles count={90} scale={[13, 6, 9]} size={1.6} speed={0.6} color="#00E5FF" opacity={0.35} />
          <Reloj3D t={tiempo} color={colorActual} />
          <MarcadorPosicion p={aPunto3D(actual)} color={colorActual} label={`X ${actual.x.toFixed(1)} · Y ${actual.y.toFixed(1)} · Z ${actual.z.toFixed(0)}cm`} />
        </group>
        <OrbitControls enableDamping dampingFactor={0.08} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 hud-scanlines opacity-60" />

      <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
        {ejesLegend.map((e) => (
          <span key={e.nombre} className="flex items-center gap-1.5 rounded-md bg-ocean/70 border border-white/10 px-2 py-1 font-mono text-[9px] backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color, boxShadow: `0 0 6px ${e.color}` }} />
            <span className="text-slate-300">{e.nombre}</span>
          </span>
        ))}
      </div>

      <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-md bg-ocean/70 border border-white/10 px-2 py-1 font-mono text-[9px] backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-risk-emergency" style={{ boxShadow: "0 0 8px #FF0055" }} />
          <span className="text-risk-emergency">LIVE</span>
        </span>
        <span className="rounded-md bg-ocean/70 border px-2 py-1 font-mono text-[10px] backdrop-blur-sm" style={{ color: colorActual, borderColor: `${colorActual}55` }}>
          {tiempo.toFixed(1)} / {DURACION_H} h
        </span>
      </div>

      <button
        onClick={() => setAutoRotar((v) => !v)}
        className="absolute bottom-3 right-3 z-10 rounded-lg bg-ocean/80 border border-cyan/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition"
      >
        {autoRotar ? "Pausar órbita" : "Auto-rotar"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel principal: cabecera + playback + controles + HUD + tabla + CSV
// ---------------------------------------------------------------------------
export function PanelSimulador() {
  const [params, setParams] = useState({ ...SIM_PARAMS_DEFAULT });
  const [ci, setCi] = useState({ x0: 0, y0: 0, z0: 0 });
  const [velocidad, setVelocidad] = useState(1);
  const [reproducir, setReproducir] = useState(true);
  const [tiempo, setTiempo] = useState(14);
  const [auto, setAuto] = useState(true);
  const [verGrafico, setVerGrafico] = useState(false);

  const serie = useMemo(() => correrSimulacion(DURACION_H, PASO_H, ci, params), [params, ci]);

  useEffect(() => {
    if (!reproducir) return;
    const id = window.setInterval(() => {
      setTiempo((prev) => {
        const next = prev + 0.12 * velocidad;
        return next > DURACION_H ? 0 : next;
      });
    }, 80);
    return () => window.clearInterval(id);
  }, [reproducir, velocidad]);

  const actual = ubicacionActual(serie, tiempo);
  const nivelRiesgo = clasificarNivel(actual.z);
  const color = COLOR_POR_NIVEL[nivelRiesgo];
  const progreso = Math.min(1, tiempo / DURACION_H);

  const zonaRef = useMemo(() => {
    const ordenadas = [...ZONAS_MANGA].sort((a, b) => b.altura_critica - a.altura_critica);
    const nivel = actual.z;
    return ordenadas.find((z) => nivel <= z.altura_critica) ?? ZONAS_MANGA[0];
  }, [actual.z]);

  const maxs = useMemo(
    () => ({
      lluvia: Math.max(...serie.map((r) => Math.abs(r.f_lluvia)), 1),
      marea: Math.max(...serie.map((r) => Math.abs(r.f_marea)), 1),
      viento: Math.max(...serie.map((r) => Math.abs(r.f_viento)), 1),
    }),
    [serie]
  );

  const set = (k: keyof typeof params, v: number) => setParams((p) => ({ ...p, [k]: v }));

  function exportarCSV() {
    const cab = "t_h;x_m;y_m;z_cm;dx_mh;dy_mh;dz_cmh;f_lluvia;f_marea;f_viento;riesgo;ubicacion";
    const filas = serie
      .map((r) => {
        const z = ZONAS_MANGA.filter((zz) => r.z <= zz.altura_critica)[0];
        const ubi = z ? z.nombre : zonaRef.nombre;
        return [r.t, r.x, r.y, r.z, r.dx, r.dy, r.dz, r.f_lluvia, r.f_marea, r.f_viento, r.riesgo, ubi].join(";");
      })
      .join("\n");
    const csv = `${cab}\n${filas}`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulador-3d-manga.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filasVisibles = useMemo(() => serie.filter((r) => r.t <= tiempo), [serie, tiempo]);

  const tendenciaIcono = actual.dz > 0.5 ? <TrendingUp size={13} /> : actual.dz < -0.5 ? <TrendingDown size={13} /> : <Minus size={13} />;

  return (
    <div className="space-y-5">
      {/* ── Cabecera del simulador ─────────────────────────────────────────── */}
      <div className="glass-strong rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl glass-glow">
              <Activity size={16} className="text-cyan" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Simulador 3D · Flujo en XYZ</h3>
              <p className="text-[11px] text-slate-500">
                {DURACION_H} h · paso {PASO_H} h · RK4 en <span className="font-mono text-cyan">X</span>/<span className="font-mono text-[#00FF87]">Y</span>/<span className="font-mono text-[#00E5FF]">Z</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                reproducir ? "border-risk-emergency/40 bg-risk-emergency/10 text-risk-emergency" : "border-white/10 bg-white/5 text-slate-500"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${reproducir ? "animate-pulse bg-risk-emergency" : "bg-slate-600"}`} />
              {reproducir ? "Simulando" : "En pausa"}
            </span>
            <span
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
              style={{ color, borderColor: `${color}66`, background: `${color}14`, boxShadow: `0 0 16px ${color}22` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
              {nivelRiesgo} · {actual.z.toFixed(0)} cm
            </span>
          </div>
        </div>

        {/* ── Barra de reproducción ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReproducir((v) => !v)}
              className="glass-glow inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition"
            >
              {reproducir ? <Pause size={13} /> : <Play size={13} />}
              {reproducir ? "Pausar" : "Reproducir"}
            </button>
            <button
              onClick={() => {
                setReproducir(false);
                setTiempo(0);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:bg-white/5 hover:text-white transition"
            >
              <RotateCcw size={13} />
              Reiniciar
            </button>
          </div>

          <div className="flex min-w-[200px] flex-1 items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              <Timer size={12} className="text-cyan" />
              Línea de tiempo
            </span>
            <input
              type="range"
              min={0}
              max={DURACION_H}
              step={0.1}
              value={tiempo}
              onChange={(e) => setTiempo(parseFloat(e.target.value))}
              className="slider-cyber w-full"
              style={{
                background: `linear-gradient(to right, ${color} 0%, ${color} ${progreso * 100}%, rgba(255,255,255,0.08) ${progreso * 100}%)`,
              }}
            />
            <span className="w-16 text-right font-mono text-[12px] text-cyan font-tabular">{tiempo.toFixed(1)} h</span>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-slate-400">
            Velocidad
            <input
              type="range" min={0.2} max={3} step={0.1} value={velocidad}
              onChange={(e) => setVelocidad(parseFloat(e.target.value))}
              className="slider-cyber w-20"
            />
            <span className="font-mono text-cyan w-9 font-tabular">{velocidad.toFixed(1)}x</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Auto-órbita</span>
            <button
              role="switch"
              aria-checked={auto}
              onClick={() => setAuto((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${auto ? "bg-cyan/70" : "bg-white/10"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  auto ? "left-[18px] shadow-[0_0_10px_#00E5FF]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Condiciones iniciales + parámetros ─────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="glass-strong rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF3370]" />
            Posición inicial
          </p>
          <div className="space-y-3.5">
            <SliderCiber label="X₀ (m)" valor={ci.x0} min={0} max={60} step={1} onChange={(v) => setCi((c) => ({ ...c, x0: v }))} />
            <SliderCiber label="Y₀ (m)" valor={ci.y0} min={0} max={60} step={1} onChange={(v) => setCi((c) => ({ ...c, y0: v }))} />
            <SliderCiber label="Z₀ (cm)" valor={ci.z0} min={0} max={20} step={1} onChange={(v) => setCi((c) => ({ ...c, z0: v }))} />
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-5 lg:col-span-2">
          <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
            Parámetros del sistema
          </p>
          <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
            <SliderCiber label="Drenaje c₀" valor={params.damping} min={0.1} max={2} step={0.01} decimals={2} onChange={(v) => set("damping", v)} />
            <SliderCiber label="Rigidez k₀" valor={params.stiffness} min={0.1} max={2} step={0.01} decimals={2} onChange={(v) => set("stiffness", v)} />
            <SliderCiber label="Lluvia" valor={params.storm_intensity} unidad=" mm/h" min={5} max={80} step={1} onChange={(v) => set("storm_intensity", v)} />
            <SliderCiber label="Marea MSL" valor={params.mean_sea_level} unidad=" cm" min={0} max={25} step={0.5} decimals={1} onChange={(v) => set("mean_sea_level", v)} />
            <SliderCiber label="Humedad suelo" valor={params.soil_humidity} min={0} max={1} step={0.05} decimals={2} onChange={(v) => set("soil_humidity", v)} />
            <SliderCiber label="Viento" valor={params.wind_speed_kmh} unidad=" km/h" min={0} max={60} step={1} onChange={(v) => set("wind_speed_kmh", v)} />
          </div>
        </div>
      </div>

      {/* ── 3D + HUD ───────────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Simulador3D serie={serie} tiempo={tiempo} />
        </div>

        <div className="glass-strong rounded-2xl p-5 flex flex-col gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">Estado actual</p>

          <div
            className="rounded-xl p-3.5 transition-colors duration-300"
            style={{ background: `${color}12`, border: `1px solid ${color}45`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: `${color}BB` }}>
                  Nivel de riesgo
                </p>
                <p className="font-display text-2xl font-bold uppercase leading-tight" style={{ color, textShadow: `0 0 20px ${color}66` }}>
                  {nivelRiesgo}
                </p>
              </div>
              <Activity size={22} style={{ color }} />
            </div>
            <div className="mt-2.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (actual.z / 130) * 100)}%`, background: color, boxShadow: `0 0 8px ${color}` }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-500">
              <span>0</span>
              <span>30</span>
              <span>60</span>
              <span>100</span>
              <span>130 cm</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Progreso</span>
              <span className="font-mono text-cyan font-tabular">
                {tiempo.toFixed(1)} / {DURACION_H} h
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan via-[#00FF87] to-risk-alert transition-all duration-200"
                style={{ width: `${progreso * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Dato label="t (h)" valor={actual.t.toFixed(1)} color="#00E5FF" />
            <Dato label="X (m)" valor={actual.x.toFixed(1)} color="#FF3370" />
            <Dato label="Y (m)" valor={actual.y.toFixed(1)} color="#00FF87" />
            <Dato label="Z (cm)" valor={actual.z.toFixed(1)} color={color} />
            <Dato label="dx (m/h)" valor={actual.dx.toFixed(2)} color="#FF3370" />
            <Dato label="dz (cm/h)" valor={actual.dz.toFixed(2)} color={color} />
          </div>

          <div className="space-y-2 glass rounded-xl p-3">
            <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Fuerzas actuantes</p>
            <BarraFuerza label="Lluvia" icon={Droplets} valor={actual.f_lluvia} max={maxs.lluvia} color="#00D2FF" />
            <BarraFuerza label="Marea" icon={Waves} valor={actual.f_marea} max={maxs.marea} color="#00FF87" />
            <BarraFuerza label="Viento" icon={Wind} valor={actual.f_viento} max={maxs.viento} color="#B000FF" />
          </div>

          <div className="mt-auto space-y-2">
            <div className="flex items-center justify-between glass rounded-xl p-3">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <MapPin size={12} className="text-cyan" />
                Ubicación
              </span>
              <span className="text-[12px] font-semibold text-white text-right">{zonaRef.nombre}</span>
            </div>
            <div className="flex items-center justify-between glass rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Tendencia</span>
              <span className="inline-flex items-center gap-1 font-mono text-[12px]" style={{ color }}>
                {tendenciaIcono}
                {actual.dz > 0.5 ? "Subiendo" : actual.dz < -0.5 ? "Bajando" : "Estable"}
              </span>
            </div>
            <div className="flex items-center justify-between glass rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Riesgo</span>
              <span className="font-mono text-[12px] font-bold uppercase" style={{ color }}>{nivelRiesgo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Leyenda de riesgo ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {NIVELES.map((n) => (
          <div key={n.nombre} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: n.color, boxShadow: `0 0 8px ${n.color}` }} />
            <span className="font-mono text-[10px] uppercase text-slate-400">{n.nombre}</span>
            <span className="font-mono text-[10px] text-slate-600">{n.rango}</span>
          </div>
        ))}
      </div>

      {/* ── Registro de coordenadas ────────────────────────────────────────── */}
      <div className="glass-strong rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-display text-base font-bold text-white">Registro de coordenadas</h4>
            <p className="text-[11px] text-slate-500">
              Trayectoria <span className="font-mono text-cyan">X(t)</span>, <span className="font-mono text-cyan">Y(t)</span>,{" "}
              <span className="font-mono text-cyan">Z(t)</span> · {filasVisibles.length} filas hasta t={tiempo.toFixed(0)}h
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVerGrafico((v) => !v)}
              className="glass-glow rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition"
            >
              {verGrafico ? "Ocultar gráfico" : "Ver gráfico"}
            </button>
            <button onClick={exportarCSV} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition">
              <Download size={12} /> Exportar CSV
            </button>
          </div>
        </div>

        {verGrafico ? (
          <GraficoSerie serie={serie} tiempo={tiempo} />
        ) : (
          <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10" style={{ background: "#0b1622" }}>
                  <th className="py-2 pr-3 font-mono">t (h)</th>
                  <th className="py-2 pr-3 font-mono hidden md:table-cell">X (m)</th>
                  <th className="py-2 pr-3 font-mono hidden md:table-cell">Y (m)</th>
                  <th className="py-2 pr-3 font-mono">Z (cm)</th>
                  <th className="py-2 pr-3 font-mono">Fuerzas (fL·fM·fV)</th>
                  <th className="py-2 pr-3 font-mono">Riesgo</th>
                  <th className="py-2 font-mono">Ubicación</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {filasVisibles.map((r, i) => {
                  const rc = COLOR_POR_NIVEL[clasificarNivel(r.z)];
                  const ubi = ZONAS_MANGA.filter((zz) => r.z <= zz.altura_critica)[0];
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]" style={{ borderInlineStart: `2px solid ${rc}33` }}>
                      <td className="py-1.5 pl-2.5 pr-3 font-mono text-cyan">{r.t.toFixed(0)}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-300 hidden md:table-cell">{r.x.toFixed(1)}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-300 hidden md:table-cell">{r.y.toFixed(1)}</td>
                      <td className="py-1.5 pr-3 font-mono text-white">{r.z.toFixed(1)}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-500">{r.f_lluvia.toFixed(0)}·{r.f_marea.toFixed(0)}·{r.f_viento.toFixed(0)}</td>
                      <td className="py-1.5 pr-3 font-mono uppercase" style={{ color: rc }}>{r.riesgo}</td>
                      <td className="py-1.5 font-mono text-slate-400">{ubi ? ubi.nombre : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-display text-lg font-bold font-tabular" style={{ color, textShadow: `0 0 14px ${color}55` }}>{valor}</p>
    </div>
  );
}

function SliderCiber({
  label,
  valor,
  unidad = "",
  min,
  max,
  step,
  decimals,
  onChange,
}: {
  label: string;
  valor: number;
  unidad?: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  const mostrar = decimals !== undefined ? valor.toFixed(decimals) : step < 0.05 ? valor.toFixed(2) : step < 1 ? valor.toFixed(1) : valor.toFixed(0);
  return (
    <label className="block">
      <span className="flex justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-cyan font-tabular">
          {mostrar}
          {unidad}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valor}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="slider-cyber w-full mt-1"
      />
    </label>
  );
}

function BarraFuerza({
  label,
  icon: Icon,
  valor,
  max,
  color,
}: {
  label: string;
  icon: LucideIcon;
  valor: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, (Math.abs(valor) / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1.5 text-slate-400">
          <Icon size={11} style={{ color }} />
          {label}
        </span>
        <span className="font-mono text-slate-300 font-tabular">{Math.abs(valor).toFixed(1)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

function GraficoSerie({ serie, tiempo }: { serie: RegistroSim[]; tiempo: number }) {
  const max = Math.max(...serie.map((r) => Math.max(r.x, r.y, r.z, 100)), 1);
  const W = 720;
  const H = 200;
  const pointsOf = (f: (r: RegistroSim) => number, color: string) => {
    const pts = serie.map((r) => `${(r.t / DURACION_H) * W},${H - (f(r) / max) * (H - 10) - 5}`).join(" ");
    return <polyline points={pts} fill="none" stroke={color} strokeWidth={2} />;
  };
  const xT = Math.min((tiempo / DURACION_H) * W, W);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-ocean rounded-xl border border-white/10">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="#ffffff11" strokeWidth={1} />
      ))}
      {pointsOf((r) => r.x, "#FF3370")}
      {pointsOf((r) => r.y, "#00FF87")}
      {pointsOf((r) => r.z, "#00E5FF")}
      <line x1={xT} y1={0} x2={xT} y2={H} stroke="#ffffff55" strokeDasharray="3 3" strokeWidth={1} />
      <text x={W - 90} y={12} fill="#FF3370" fontSize={11} fontFamily="monospace">X (m)</text>
      <text x={W - 90} y={26} fill="#00FF87" fontSize={11} fontFamily="monospace">Y (m)</text>
      <text x={W - 90} y={40} fill="#00E5FF" fontSize={11} fontFamily="monospace">Z (cm)</text>
      <line x1={0} y1={H - (30 / max) * (H - 10) - 5} x2={W} y2={H - (30 / max) * (H - 10) - 5} stroke="#FFD600" strokeDasharray="4 4" strokeWidth={1} />
      <text x={6} y={H - (30 / max) * (H - 10) - 5 - 4} fill="#FFD600" fontSize={9} fontFamily="monospace">Alerta 30</text>
    </svg>
  );
}