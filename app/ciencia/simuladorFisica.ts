// ---------------------------------------------------------------------------
// StormPrint :: simuladorFisica.ts
// Motor de EDOs de segundo orden por eje (X, Y, Z) para el simulador 3D de
// flujo de agua en Manga. Puerto TypeScript del modelo de physics_engine.py.
//
//   Z'' + cz·Z' + kz·Z = fz_lluvia + fz_marea + fz_viento   (nivel, cm)
//   X'' + cx·X' + kx·X = gx·Z(t) + fx_viento                 (flujo E-W, m)
//   Y'' + cy·Y' + ky·Y = gy·Z(t) + fy_viento                 (flujo N-S, m)
//
// Z es la fuente (nivel de agua); X e Y son transporte horizontal arrastrado
// por el gradiente de Z (proporcional al nivel) más empuje de viento.
// ---------------------------------------------------------------------------

export interface ParametrosSim {
  mass: number;          // m — inercia de la masa hídrica
  damping: number;       // c_0 — amortiguamiento base (drenaje)
  stiffness: number;     // k_0 — rigidez base del terreno
  rain_gain: number;     // escala lluvia -> fuerza
  tide_gain: number;     // escala marea -> fuerza
  tide_period_h: number; // periodo semidiurno de marea (h)
  wind_gain: number;     // escala viento -> forzamiento
  soil_humidity: number; // 0-1
  consecutive_rainy_days: number;
  rain_duration_h: number; // sigma de la gaussiana de lluvia
  wind_direction_deg: number;
  wind_speed_kmh: number;
  mean_sea_level: number; // cm
  storm_peak_hour: number;
  storm_intensity: number; // mm/h
}

export const SIM_PARAMS_DEFAULT: ParametrosSim = {
  mass: 1.0,
  damping: 0.45,
  stiffness: 0.65,
  rain_gain: 3.2,
  tide_gain: 1.1,
  tide_period_h: 12.42,
  wind_gain: 0.8,
  soil_humidity: 0.3,
  consecutive_rainy_days: 1,
  rain_duration_h: 6.0,
  wind_direction_deg: 210,
  wind_speed_kmh: 24,
  mean_sea_level: 8.0,
  storm_peak_hour: 14.0,
  storm_intensity: 38,
};

/** Rotación geopolítica de la curva: X es m de desplazamiento, guardamos como punto 3D. */
export interface RegistroSim {
  t: number;          // hora
  x: number;          // metros
  y: number;          // metros
  z: number;          // cm (nivel de agua)
  dx: number;         // m/h
  dy: number;         // m/h
  dz: number;         // cm/h
  f_lluvia: number;
  f_marea: number;
  f_viento: number;
  riesgo: "Normal" | "Alerta" | "Emergencia" | "Critico";
}

// --- Forzamientos (portados de physics_engine.py:102-226) ------------------

function efectivaAmortiguacion(t: number, p: ParametrosSim): number {
  const d = p.consecutive_rainy_days;
  const factor = Math.max(0.2, 1.0 - d * 0.1);
  const c0 = p.damping * factor;
  const sigma = Math.max(1.0, p.rain_duration_h);
  const lluvia = p.storm_intensity * Math.exp(-((t - p.storm_peak_hour) ** 2) / (2 * sigma * sigma));
  const sat = Math.min(0.55, lluvia * 0.004);
  return c0 * (1.0 - sat);
}

function efectivaRigidez(t: number, p: ParametrosSim): number {
  const k0 = p.stiffness * (1.0 + p.soil_humidity * 0.5);
  const sigma = Math.max(1.0, p.rain_duration_h);
  const lluvia = p.storm_intensity * Math.exp(-((t - p.storm_peak_hour) ** 2) / (2 * sigma * sigma));
  const sat = Math.min(0.6, lluvia * 0.005);
  return k0 * (1.0 + sat);
}

function forzamientoLluvia(t: number, p: ParametrosSim): number {
  const sigma = p.rain_duration_h > 0 ? p.rain_duration_h : 6.0;
  const gaussiana = Math.exp(-((t - p.storm_peak_hour) ** 2) / (2 * sigma * sigma));
  return p.storm_intensity * gaussiana;
}

function forzamientoMarea(t: number, p: ParametrosSim): number {
  const semi = Math.sin((2 * Math.PI * t) / p.tide_period_h);
  const envolvente = 1.0 + 0.25 * Math.sin((2 * Math.PI * t) / (24 * 14.77));
  return p.tide_gain * p.mean_sea_level * semi * envolvente;
}

function factorEmpuje(direccion: number): number {
  const d = direccion;
  if (d >= 135 && d <= 270) return 1.0;
  if (d >= 90 && d < 135) return ((d - 90) / 45.0) * 0.6;
  if (d > 270 && d <= 315) return ((315 - d) / 45.0) * 0.6;
  return 0.0;
}

function forzamientoViento(t: number, p: ParametrosSim): number {
  if (p.wind_speed_kmh <= 0) return 0.0;
  const push = factorEmpuje(p.wind_direction_deg);
  const osc = Math.sin((2 * Math.PI * t) / p.tide_period_h);
  return p.wind_gain * p.wind_speed_kmh * push * osc;
}

/** Suma total de forzamiento sobre el eje vertical Z. */
function totalForzamientoZ(t: number, p: ParametrosSim): number {
  return forzamientoLluvia(t, p) * p.rain_gain + forzamientoMarea(t, p) + forzamientoViento(t, p);
}

function clasificar(cm: number): RegistroSim["riesgo"] {
  if (cm >= 100) return "Critico";
  if (cm >= 60) return "Emergencia";
  if (cm >= 30) return "Alerta";
  return "Normal";
}

/**
 * Resuelve el sistema de 3 EDO (Z, X, Y) con RK4 de paso fijo.
 * devuelve serie horaria de 0..duracion.
 */
export function correrSimulacion(
  duracionHoras: number,
  pasoHoras: number,
  ci: { x0: number; y0: number; z0: number },
  params: ParametrosSim = SIM_PARAMS_DEFAULT
): RegistroSim[] {
  const m = params.mass;
  // Acoplamiento horizontal (gradiente de Z arrastra el flujo X/Y)
  const gx = 0.24;
  const gy = 0.24;

  // Estado vectorial: [Z, Z', X, X', Y, Y']
  let s = [ci.z0, 0, ci.x0, 0, ci.y0, 0];
  const registros: RegistroSim[] = [];

  const deriv = (st: number[], tt: number): number[] => {
    const [z, dz, x, dx, y, dy] = st;
    const cz = efectivaAmortiguacion(tt, params);
    const kz = efectivaRigidez(tt, params);
    const Fz = totalForzamientoZ(tt, params);
    const d2z = (Fz - cz * dz - kz * z) / m;
    // X/Y amortiguados y rígidos, arrastrados por el nivel + viento
    const d2x = (gx * z + forzamientoViento(tt, params) * 0.15 - cz * dx - kz * x) / m;
    const d2y = (gy * z + forzamientoViento(tt, params) * 0.1 - cz * dy - kz * y) / m;
    return [dz, d2z, dx, d2x, dy, d2y];
  };

  const pasos = Math.max(1, Math.ceil(duracionHoras / pasoHoras));
  for (let i = 0; i <= pasos; i++) {
    const t = Math.min(i * pasoHoras, duracionHoras);
    registros.push({
      t: round(t, 3),
      x: round(Math.max(s[2], 0), 3),
      y: round(Math.max(s[4], 0), 3),
      z: round(Math.max(s[0], 0), 3),
      dx: round(s[3], 3),
      dy: round(s[5], 3),
      dz: round(s[1], 3),
      f_lluvia: round(Math.max(0, forzamientoLluvia(t, params) * params.rain_gain), 3),
      f_marea: round(forzamientoMarea(t, params), 3),
      f_viento: round(forzamientoViento(t, params), 3),
      riesgo: clasificar(s[0]),
    });
    if (i === pasos) break;
    // RK4
    const k1 = deriv(s, t);
    const k2 = deriv(s.map((v, j) => v + 0.5 * pasoHoras * k1[j]), t + 0.5 * pasoHoras);
    const k3 = deriv(s.map((v, j) => v + 0.5 * pasoHoras * k2[j]), t + 0.5 * pasoHoras);
    const k4 = deriv(s.map((v, j) => v + pasoHoras * k3[j]), t + pasoHoras);
    s = s.map((v, j) => v + (pasoHoras / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  }
  return registros;
}

function round(n: number, dec: number): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}
