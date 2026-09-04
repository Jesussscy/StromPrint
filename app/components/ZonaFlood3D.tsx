"use client";

// ---------------------------------------------------------------------------
// StormPrint :: ZonaFlood3D.tsx
// Simulación 3D de inundación por zona de Barrio Manga.
// Cuando el usuario selecciona una ubicación en el apartado principal, se
// muestra una micro-escena urbana 3D donde el agua sube/baja en sincronía con
// la predicción global (mismo motor de lógica: nivelDinamicoZona / riesgoVivo).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Sparkles, Float } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import {
  ZONAS_MANGA,
  RIESGO_META,
  colorDeRiesgo,
  nivelDinamicoZona,
  riesgoVivo,
  type NivelRiesgo,
  type ZonaManga,
} from "@/app/lib/zonasManga";
import { colorDeNivel } from "@/app/lib/zonasManga";
import {
  CM_POR_UNIDAD,
  cmToU,
  ESCENA_TAM,
  disenarEscena,
  camaraPorTipo,
  type EscenaDiseno,
} from "@/app/lib/geoProjection";

interface ZonaFlood3DProps {
  zona: ZonaManga | null;
  nivelAguaCm: number;
  nivelMaximoCm: number;
  horaLocal: number;
  onClose: () => void;
}

const SUELO_Y = -0.05;

// Materiales reutilizables de la escena
const colSuelo = "#0b1c2b";
const colCalle = "#132636";
const colAcera = "#1a3244";
const colMalec = "#0e2536";

function colorRiesgo(nivel: NivelRiesgo): string {
  return RIESGO_META[nivel].color;
}

// ── Componentes 3D ──────────────────────────────────────────────────────────

/** Suelo base de la escena (plataforma de la micro-zona). */
function Suelo({ diseno }: { diseno: EscenaDiseno }) {
  return (
    <group>
      {/* plataforma base */}
      <mesh position={[0, SUELO_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ESCENA_TAM, ESCENA_TAM]} />
        <meshStandardMaterial color={colSuelo} roughness={1} metalness={0} />
      </mesh>
      {/* calles */}
      {diseno.calles.map((c, i) => (
        <mesh key={`c-${i}`} position={[c.x, SUELO_Y + 0.001, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[c.w, c.d]} />
          <meshStandardMaterial color={colCalle} roughness={0.9} />
        </mesh>
      ))}
      {/* aceras */}
      {diseno.aceras.map((a, i) => (
        <mesh key={`a-${i}`} position={[a.x, SUELO_Y + 0.002, a.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[a.w, a.d]} />
          <meshStandardMaterial color={colAcera} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Un edificio/casa que puede ser parcialmente sumergido por el agua. */
function Casa({
  pos,
  w,
  d,
  h,
  color,
  riesgo,
}: {
  pos: [number, number, number];
  w: number;
  d: number;
  h: number;
  color: string;
  riesgo: NivelRiesgo;
}) {
  const techoColor = colorRiesgo(riesgo);
  return (
    <group position={pos}>
      {/* base (cuerpo) */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} />
      </mesh>
      {/* techo */}
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w * 0.8, 0.3, d * 0.8]} />
        <meshStandardMaterial color={techoColor} roughness={0.5} emissive={techoColor} emissiveIntensity={0.25} />
      </mesh>
      {/* ventana frontal (marca de ocupación) */}
      <mesh position={[0, h * 0.55, d / 2 + 0.01]}>
        <planeGeometry args={[w * 0.4, h * 0.3]} />
        <meshStandardMaterial color="#ffdd88" emissive="#ffcc66" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

/** Poste de alumbrado / árbol que emerge del agua. */
function Poste({ pos, alto, tipo }: { pos: [number, number, number]; alto: number; tipo: "poste" | "arbol" }) {
  return (
    <group position={pos}>
      <mesh position={[0, alto / 2, 0]}>
        <cylinderGeometry args={[tipo === "poste" ? 0.06 : 0.09, tipo === "poste" ? 0.07 : 0.14, alto, 8]} />
        <meshStandardMaterial color={tipo === "poste" ? "#9fb3c8" : "#3d5a3d"} roughness={0.8} />
      </mesh>
      {tipo === "arbol" ? (
        <mesh position={[0, alto + 0.25, 0]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color="#2e6b34" roughness={1} />
        </mesh>
      ) : (
        <mesh position={[0, alto, 0]}>
          <sphereGeometry args={[0.12, 6, 6]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#ffdd88" emissiveIntensity={1.5} />
        </mesh>
      )}
    </group>
  );
}

/** Los edificios, postes y árboles de la manzana. */
function Urbanizacion({ diseno, riesgo, horaLocal }: { diseno: EscenaDiseno; riesgo: NivelRiesgo; horaLocal: number }) {
  const casas = useMemo(() => {
    const list: { pos: [number, number, number]; w: number; d: number; h: number }[] = [];
    const paleta = ["#2b4a63", "#34495e", "#24435c", "#395b73"];
    diseno.manzanas.forEach((m) => {
      const margenX = m.w * 0.22;
      const margenZ = m.d * 0.22;
      for (let i = 0; i < m.nCasas; i++) {
        const col = i % 2;
        const fila = Math.floor(i / 2);
        const nx = 2;
        const nz = Math.ceil(m.nCasas / 2);
        const xOff = (col - (nx - 1) / 2) * ((m.w - margenX * 2) / nx);
        const zOff = (fila - (nz - 1) / 2) * ((m.d - margenZ * 2) / nz);
        const h = m.casaMaxH * (0.6 + ((i * 37) % 5) / 10);
        list.push({
          pos: [m.x + xOff, 0, m.z + zOff],
          w: 0.55,
          d: 0.55,
          h,
        });
      }
    });
    return list;
  }, [diseno]);

  const postes: { pos: [number, number]; tipo: "poste" | "arbol" }[] = [
    { pos: [-3.6, -3.6], tipo: "poste" },
    { pos: [3.6, -3.6], tipo: "arbol" },
    { pos: [-3.6, 3.6], tipo: "arbol" },
    { pos: [3.6, 3.6], tipo: "poste" },
  ];

  return (
    <group>
      {casas.map((c, i) => (
        <Casa
          key={`h-${i}`}
          pos={c.pos}
          w={c.w}
          d={c.d}
          h={c.h}
          color={["#2b4a63", "#34495e", "#24435c", "#395b73"][i % 4]}
          riesgo={riesgo}
        />
      ))}
      {postes.map((p, i) => (
        <Poste key={`p-${i}`} pos={[p.pos[0], 0, p.pos[1]]} alto={1.3} tipo={p.tipo} />
      ))}
      <pointLight position={[0, 1.6, 0]} intensity={horaLocal >= 19 || horaLocal <= 5 ? 0.35 : 0} color="#ffe9a8" />
    </group>
  );
}

/** Superficie de agua animada: sube/baja según el nivel y ondula sutilmente. */
function Agua({
  nivelU,
  color,
  esMarea,
}: {
  nivelU: number;
  color: string;
  esMarea: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const baseY = useRef(0);

  useEffect(() => {
    if (mesh.current) baseY.current = mesh.current.position.y;
  }, []);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    const onda = Math.sin(t * 1.4) * 0.06 + Math.sin(t * 0.7 + 1.3) * 0.03;
    mesh.current.position.y = nivelU + onda;
    // leve rotación oscilante del régimen de ondas
    mesh.current.rotation.z = Math.sin(t * 0.4) * 0.01;
    const mat = mesh.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.min(0.72, Math.max(0.35, nivelU / 2.5 + 0.35));
  });

  if (nivelU <= 0.001) return null;

  return (
    <group>
      <mesh ref={mesh} position={[0, nivelU, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ESCENA_TAM, ESCENA_TAM, 24, 24]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.5}
          roughness={0.25}
          metalness={0.4}
          emissive={color}
          emissiveIntensity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* pared de agua lateral (bahía/ciénaga) para sensación de cuerpo */}
      {esMarea && (
        <mesh position={[0, nivelU / 2, -ESCENA_TAM / 2 + 0.05]} rotation={[0, 0, 0]}>
          <planeGeometry args={[ESCENA_TAM, nivelU]} />
          <meshStandardMaterial color={color} transparent opacity={0.4} roughness={0.3} metalness={0.4} />
        </mesh>
      )}
    </group>
  );
}

/** Medidor vivo de altura (regla) junto a la escena. */
function ReglaNivel({ nivelU, riesgo }: { nivelU: number; riesgo: NivelRiesgo }) {
  const col = colorRiesgo(riesgo);
  return (
    <group position={[ESCENA_TAM / 2 + 0.45, 0, -ESCENA_TAM / 2 + 0.4]}>
      {/* poste de medición */}
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[0.09, 6.5, 0.09]} />
        <meshStandardMaterial color="#223444" roughness={0.8} />
      </mesh>
      {/* marcas de nivel */}
      {[0, 20, 40, 60, 80, 100, 120].map((cm) => {
        const y = cmToU(cm);
        if (y > 6.2) return null;
        return (
          <mesh key={cm} position={[0, y, 0]}>
            <boxGeometry args={[0.28, 0.03, 0.03]} />
            <meshStandardMaterial color={cm <= nivelU * CM_POR_UNIDAD ? col : "#33465a"} />
          </mesh>
        );
      })}
      {/* marcador actual */}
      <mesh position={[0.35, nivelU, 0]}>
        <boxGeometry args={[0.5, 0.08, 0.08]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.8} />
      </mesh>
      <Html position={[0.7, Math.min(nivelU + 0.4, 5.8), 0]} center style={{ pointerEvents: "none" }}>
        <div
          className="whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[10px] border"
          style={{ color: col, borderColor: col, background: "rgba(2,12,24,0.85)", boxShadow: `0 0 12px ${col}66` }}
        >
          {(nivelU * CM_POR_UNIDAD).toFixed(0)} cm
        </div>
      </Html>
    </group>
  );
}

/** Escena principal 3D de la zona. */
function EscenaZona({ zona, nivelU, riesgo }: { zona: ZonaManga; nivelU: number; riesgo: NivelRiesgo }) {
  const diseno = useMemo(() => disenarEscena(zona.tipo_amenaza), [zona.tipo_amenaza]);
  const cam = camaraPorTipo(zona.tipo_amenaza);
  const col = colorRiesgo(riesgo);
  const esMarea = diseno.esMarea || zona.tipo_amenaza === "Marea Alta";

  return (
    <Canvas camera={{ position: cam.pos, fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} />
      <directionalLight position={[-8, 4, -6]} intensity={0.4} color="#86d0ff" />

      <group position={[0, 0, 0]}>
        <Suelo diseno={diseno} />
        <Urbanizacion diseno={diseno} riesgo={riesgo} horaLocal={zona.id} />
        <Agua nivelU={nivelU} color={col} esMarea={esMarea} />
        <ReglaNivel nivelU={nivelU} riesgo={riesgo} />
        <Sparkles count={40} scale={[8, 4, 8]} size={1.8} speed={0.5} color="#00E5FF" opacity={0.28} />
      </group>

      <OrbitControls enableDamping dampingFactor={0.08} minDistance={4} maxDistance={20} maxPolarAngle={Math.PI / 2.2} />
    </Canvas>
  );
}

// ── Contenedor / HUD ────────────────────────────────────────────────────────

export default function ZonaFlood3D({ zona, nivelAguaCm, nivelMaximoCm, horaLocal, onClose }: ZonaFlood3DProps) {
  const [idxLocal, setIdxLocal] = useState<number>(zona ? ZONAS_MANGA.findIndex((z) => z.id === zona.id) : 0);

  const zonaActual = zona ?? ZONAS_MANGA[idxLocal];

  const { nivelU, nivelCm, riesgo } = useMemo(() => {
    const nivel = nivelDinamicoZona(zonaActual, nivelAguaCm, nivelMaximoCm);
    const r = riesgoVivo(zonaActual, nivelAguaCm, nivelMaximoCm);
    return { nivelU: cmToU(nivel), nivelCm: nivel, riesgo: r };
  }, [zonaActual, nivelAguaCm, nivelMaximoCm]);

  const colorAct = colorDeRiesgo(riesgo);
  const pctCritico = Math.min(100, (nivelCm / Math.max(zonaActual.altura_critica, 1)) * 100);

  function navegar(dir: 1 | -1) {
    const n = ZONAS_MANGA.length;
    setIdxLocal((prev) => (prev + dir + n) % n);
  }

  const pctRelleno = (nivelCm / Math.max(nivelMaximoCm, 1)) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, y: -10 }}
        animate={{ opacity: 1, height: "auto", y: 0 }}
        exit={{ opacity: 0, height: 0, y: -10 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden"
      >
        <div className="glass-strong rounded-2xl p-1 relative overflow-hidden">
          {/* overlay decorativo */}
          <div className="absolute inset-0 pointer-events-none z-[1] hud-scanlines opacity-40" />

          {/* encabezado */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-cyan/10 relative z-[2]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navegar(-1)}
                aria-label="Zona anterior"
                className="rounded-lg border border-cyan/20 px-2.5 py-2 text-cyan hover:bg-cyan/10 transition min-w-[44px] min-h-[44px]"
              >
                ‹
              </button>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
                  Simulación 3D · Inundación
                </p>
                <h4 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: colorAct, boxShadow: `0 0 10px ${colorAct}` }}
                  />
                  {zonaActual.nombre}
                  <span className="font-mono text-[10px] text-slate-500">{String(zonaActual.id).padStart(2, "0")}</span>
                </h4>
              </div>
              <button
                onClick={() => navegar(1)}
                aria-label="Zona siguiente"
                className="rounded-lg border border-cyan/20 px-2.5 py-2 text-cyan hover:bg-cyan/10 transition min-w-[44px] min-h-[44px]"
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-wider border" style={{ color: colorAct, borderColor: `${colorAct}55`, background: `${colorAct}14` }}>
                {zonaActual.tipo_amenaza}
              </span>
              <button
                onClick={onClose}
                aria-label="Cerrar simulación 3D"
                className="rounded-lg border border-white/10 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 transition min-w-[44px] min-h-[44px]"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* cuerpo: escena + HUD */}
          <div className="grid gap-4 p-3 md:grid-cols-3 relative z-[2]">
            {/* escena */}
            <div className="md:col-span-2 h-[340px] md:h-[380px] rounded-xl overflow-hidden bg-gradient-to-b from-ocean-mid to-ocean">
              <EscenaZona zona={zonaActual} nivelU={nivelU} riesgo={riesgo} />
            </div>

            {/* HUD lateral */}
            <div className="flex flex-col gap-3">
              <div className="glass rounded-xl p-4">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Nivel actual de la zona</p>
                <div className="flex items-end justify-between">
                  <span className="font-display text-3xl font-bold font-tabular" style={{ color: colorAct }}>
                    {nivelCm.toFixed(1)}
                    <span className="text-sm text-slate-500 ml-1">cm</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase" style={{ color: colorAct }}>
                    {RIESGO_META[riesgo].label}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, pctCritico)}%`, backgroundColor: colorAct, boxShadow: `0 0 10px ${colorAct}` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500 font-mono">
                  Umbral crítico: <span className="text-white">{zonaActual.altura_critica} cm</span> · Pico global ≈ {nivelMaximoCm} cm
                </p>
              </div>

              <div className="glass rounded-xl p-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Amenaza</p>
                  <p className="text-sm font-semibold text-white">{zonaActual.tipo_amenaza}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Población</p>
                  <p className="text-sm font-semibold text-white">{zonaActual.poblacion_afectada ?? "—"} pers.</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Radio</p>
                  <p className="text-sm font-semibold text-white">{zonaActual.radio_influencia} m</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Nivel global</p>
                    <p className="text-sm font-semibold font-tabular" style={{ color: colorDeNivel(nivelAguaCm) }}>
                      {nivelAguaCm.toFixed(1)} cm
                    </p>
                </div>
              </div>

              <div className="glass rounded-xl p-4 flex-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Carga de la zona</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-black/30 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, pctRelleno)}%`, background: `linear-gradient(90deg,#00E5FF,${colorAct})` }} />
                  </div>
                  <span className="font-mono text-[11px] font-bold" style={{ color: colorAct }}>{Math.round(pctRelleno)}%</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">{zonaActual.descripcion}</p>
                <p className="mt-2 text-[9px] text-slate-600 font-mono">Arrastrá para orbitar · scroll para zoom</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
