"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Float, Html, Sparkles, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { correrSimulacion, SIM_PARAMS_DEFAULT, type RegistroSim } from "./simuladorFisica";
import { clasificarNivel, COLOR_POR_NIVEL } from "@/app/lib/riesgo";
import { ZONAS_MANGA } from "@/app/lib/zonasManga";

const DURACION_H = 48;
const PASO_H = 1;

// Escalado de la escena: X/Y en m (1 u = 3 m), Z en cm (1 u = 55 cm) -> trayectoria compacta
const SX = 3;
const SY = 3;
const SZ = 55;
const Z_MAX = 130;

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

function Reloj3D({ t, color, show }: { t: number; color: string; show: boolean }) {
  return show ? (
    <Html position={[2.2, 3.6, 4.4]} center style={{ pointerEvents: "none" }}>
      <div style={{ color, fontFamily: "monospace", fontSize: 13, background: "rgba(2,12,24,0.8)", padding: "3px 8px", borderRadius: 6, border: `1px solid ${color}` }}>
        t = {t.toFixed(1)} h
      </div>
    </Html>
  ) : null;
}

function AutoRotar({ activo, grupo }: { activo: boolean; grupo: React.RefObject<THREE.Group> }) {
  useFrame((_, delta) => {
    if (activo && grupo.current) grupo.current.rotation.y += delta * 0.25;
  });
  return null;
}

interface Props {
  serie: RegistroSim[];
  tiempo: number;
}

export default function Simulador3D({ serie, tiempo }: Props) {
  const grupo = useRef<THREE.Group>(null);
  const [autoRotar, setAutoRotar] = useState(true);

  const colorActual = useMemo(() => {
    const r = ubicacionActual(serie, tiempo);
    return COLOR_POR_NIVEL[clasificarNivel(r.z)];
  }, [serie, tiempo]);

  const puntos = useMemo(() => serie.map(aPunto3D), [serie]);
  const actual = useMemo(() => ubicacionActual(serie, tiempo), [serie, tiempo]);

  return (
    <div className="relative h-[420px] rounded-xl overflow-hidden bg-gradient-to-b from-ocean-mid to-ocean">
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
          <Reloj3D t={tiempo} color={colorActual} show={autoRotar} />
          <MarcadorPosicion p={aPunto3D(actual)} color={colorActual} label={`X ${actual.x.toFixed(1)} · Y ${actual.y.toFixed(1)} · Z ${actual.z.toFixed(0)}cm`} />
        </group>
        <OrbitControls enableDamping dampingFactor={0.08} />
      </Canvas>

      <button
        onClick={() => setAutoRotar((v) => !v)}
        className="absolute bottom-3 right-3 z-10 rounded-lg bg-ocean/80 border border-cyan/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition"
      >
        {autoRotar ? "Pausar órbita" : "Auto-rotar"}
      </button>
    </div>
  );
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
// Panel principal: controles + HUD + tabla + CSV
// ---------------------------------------------------------------------------
export function PanelSimulador() {
  const [params, setParams] = useState({ ...SIM_PARAMS_DEFAULT });
  const [ci, setCi] = useState({ x0: 0, y0: 0, z0: 0 });
  const [velocidad, setVelocidad] = useState(1);
  const [reproducir, setReproducir] = useState(true);
  const [tiempo, setTiempo] = useState(14);
  const [auto, setAuto] = useState(true);
  const [verGrafico, setVerGrafico] = useState(false);

  // Recomputa la serie completa ante cada cambio de parámetro/condición inicial
  const serie = useMemo(() => correrSimulacion(DURACION_H, PASO_H, ci, params), [params, ci]);

  // Avance del reloj de la simulación
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

  // Zona real más cercana al nivel actual (por nivel de riesgo de cada zona)
  const zonaRef = useMemo(() => {
    const ordenadas = [...ZONAS_MANGA].sort((a, b) => b.altura_critica - a.altura_critica);
    const nivel = actual.z;
    return ordenadas.find((z) => nivel <= z.altura_critica) ?? ZONAS_MANGA[0];
  }, [actual.z]);

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

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="glass-strong rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setReproducir((v) => !v)}
              className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition flex items-center gap-2"
            >
              {reproducir ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  Pausar
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                  Reproducir
                </>
              )}
            </button>
            <button
              onClick={() => setReproducir(false)}
              className="rounded-lg border border-white/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:bg-white/5 transition"
            >
              ⏹ Reiniciar
            </button>
            <label className="flex items-center gap-2 text-[11px] text-slate-400">
              Velocidad
              <input
                type="range" min={0.2} max={3} step={0.1} value={velocidad}
                onChange={(e) => setVelocidad(parseFloat(e.target.value))}
                className="accent-cyan w-24"
              />
              <span className="font-mono text-cyan w-8">{velocidad.toFixed(1)}x</span>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-slate-400">
              Auto-órbita
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-cyan" />
            </label>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Condiciones iniciales */}
          <div className="glass rounded-xl p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-3">Posición inicial</p>
            <div className="space-y-3">
              {(
                [
                  ["X₀ (m)", "x0", 0, 60],
                  ["Y₀ (m)", "y0", 0, 60],
                  ["Z₀ (cm)", "z0", 0, 20],
                ] as const
              ).map(([label, key, min, max]) => (
                <label key={key} className="block text-[11px] text-slate-400">
                  <span className="flex justify-between"><span>{label}</span><span className="font-mono text-cyan">{ci[key]}</span></span>
                  <input
                    type="range" min={min} max={max} step={1}
                    value={ci[key]}
                    onChange={(e) => setCi((c) => ({ ...c, [key]: parseFloat(e.target.value) }))}
                    className="accent-cyan w-full mt-1"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Parámetros físicos */}
          <div className="glass rounded-xl p-4 lg:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-3">Parámetros del sistema</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Drenaje c₀", "damping", 0.1, 2, 0.01],
                  ["Rigidez k₀", "stiffness", 0.1, 2, 0.01],
                  ["Lluvia (mm/h)", "storm_intensity", 5, 80, 1],
                  ["Marea MSL (cm)", "mean_sea_level", 0, 25, 0.5],
                  ["Humedad suelo", "soil_humidity", 0, 1, 0.05],
                  ["Viento (km/h)", "wind_speed_kmh", 0, 60, 1],
                ] as const
              ).map(([label, key, min, max, step]) => (
                <label key={key} className="block text-[11px] text-slate-400">
                  <span className="flex justify-between"><span>{label}</span><span className="font-mono text-cyan">{params[key]}</span></span>
                  <input
                    type="range" min={min} max={max} step={step}
                    value={params[key]}
                    onChange={(e) => set(key, parseFloat(e.target.value))}
                    className="accent-cyan w-full mt-1"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3D + HUD */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Simulador3D serie={serie} tiempo={tiempo} />
        </div>
        <div className="glass-strong rounded-2xl p-5 flex flex-col gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">Estado actual</p>
          <div className="grid grid-cols-3 gap-3">
            <Dato label="t (h)" valor={actual.t.toFixed(1)} color="#00E5FF" />
            <Dato label="X (m)" valor={actual.x.toFixed(1)} color="#FF3370" />
            <Dato label="Y (m)" valor={actual.y.toFixed(1)} color="#00FF87" />
            <Dato label="Z (cm)" valor={actual.z.toFixed(1)} color={color} />
            <Dato label="dx (m/h)" valor={actual.dx.toFixed(2)} color="#FF3370" />
            <Dato label="dz (cm/h)" valor={actual.dz.toFixed(2)} color={color} />
          </div>
          <div className="mt-auto space-y-2">
            <div className="flex items-center justify-between glass rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Ubicación</span>
              <span className="text-[12px] font-semibold text-white text-right">{zonaRef.nombre}</span>
            </div>
            <div className="flex items-center justify-between glass rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Tendencia</span>
              <span className="font-mono text-[12px]" style={{ color }}>
                {actual.dz > 0.5 ? "↑ Subiendo" : actual.dz < -0.5 ? "↓ Bajando" : "→ Estable"}
              </span>
            </div>
            <div className="flex items-center justify-between glass rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Riesgo</span>
              <span className="font-mono text-[12px] font-bold uppercase" style={{ color }}>{nivelRiesgo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Registro de coordenadas */}
      <div className="glass-strong rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-display text-base font-bold text-white">Registro de coordenadas</h4>
            <p className="text-[11px] text-slate-500">Trayectoria <span className="font-mono text-cyan">X(t)</span>, <span className="font-mono text-cyan">Y(t)</span>, <span className="font-mono text-cyan">Z(t)</span> · {filasVisibles.length} filas hasta t={tiempo.toFixed(0)}h</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setVerGrafico((v) => !v)} className="glass-glow rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition">
              {verGrafico ? "Ocultar gráfico" : "Ver gráfico"}
            </button>
            <button onClick={exportarCSV} className="rounded-lg border border-cyan/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition">
              ⬇ Exportar CSV
            </button>
          </div>
        </div>

        {verGrafico ? (
          <GraficoSerie serie={serie} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                  <th className="py-2 pr-3 font-mono">t (h)</th>
                  <th className="py-2 pr-3 font-mono">X (m)</th>
                  <th className="py-2 pr-3 font-mono">Y (m)</th>
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
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-1.5 pr-3 font-mono text-cyan">{r.t.toFixed(0)}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-300">{r.x.toFixed(1)}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-300">{r.y.toFixed(1)}</td>
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
      <p className="font-display text-lg font-bold" style={{ color }}>{valor}</p>
    </div>
  );
}

function GraficoSerie({ serie }: { serie: RegistroSim[] }) {
  const max = Math.max(
    ...serie.map((r) => Math.max(r.x, r.y, r.z, 100)),
    1
  );
  const W = 720;
  const H = 200;
  const pointsOf = (f: (r: RegistroSim) => number, color: string) => {
    const pts = serie.map((r) => `${(r.t / DURACION_H) * W},${H - (f(r) / max) * (H - 10) - 5}`).join(" ");
    return <polyline points={pts} fill="none" stroke={color} strokeWidth={2} />;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-ocean rounded-xl border border-white/10">
      {/* Grid horizontal */}
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="#ffffff11" strokeWidth={1} />
      ))}
      {pointsOf((r) => r.x, "#FF3370")}
      {pointsOf((r) => r.y, "#00FF87")}
      {pointsOf((r) => r.z, "#00E5FF")}
      <text x={W - 90} y={12} fill="#FF3370" fontSize={11} fontFamily="monospace">X (m)</text>
      <text x={W - 90} y={26} fill="#00FF87" fontSize={11} fontFamily="monospace">Y (m)</text>
      <text x={W - 90} y={40} fill="#00E5FF" fontSize={11} fontFamily="monospace">Z (cm)</text>
      <line x1={0} y1={H - (30 / max) * (H - 10) - 5} x2={W} y2={H - (30 / max) * (H - 10) - 5} stroke="#FFD600" strokeDasharray="4 4" strokeWidth={1} />
      <text x={6} y={H - (30 / max) * (H - 10) - 5 - 4} fill="#FFD600" fontSize={9} fontFamily="monospace">Alerta 30</text>
    </svg>
  );
}
