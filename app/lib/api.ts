// ---------------------------------------------------------------------------
// StormPrint :: api.ts
// Cliente HTTP tipado para la API de prediccion de inundaciones
// Barrio Manga, Cartagena de Indias
// ---------------------------------------------------------------------------

import { riscoColorEstilo, etiquetaNivel } from "@/app/lib/riesgo";

// --- Tipos legacy (backwards compatibility) ---

export interface FloodRecord {
  hour: number;
  water_level_cm: number;
  rain_intensity: number;
  tide_level: number;
  risk_level: "low" | "moderate" | "high" | "critical";
}

export interface SimulationResponse {
  territory: string;
  total_points: number;
  max_water_level_cm: number;
  peak_hour: number;
  records: FloodRecord[];
}

export interface SimulationRequestParams {
  duration_hours?: number;
  resolution_hours?: number;
  storm_peak_hour?: number;
  storm_intensity?: number;
  storm_width?: number;
  mean_sea_level?: number;
  mass?: number;
  damping?: number;
  stiffness?: number;
}

// --- Tipos nuevos ---

export type EstadoMeteo =
  | "soleado"
  | "parcialmente_nublado"
  | "nublado"
  | "lluvioso"
  | "tormenta"
  | "sin_datos";

export const ESTADO_METEO_LABEL: Record<EstadoMeteo, string> = {
  soleado: "Soleado",
  parcialmente_nublado: "Parcialmente nublado",
  nublado: "Nublado",
  lluvioso: "Lluvioso",
  tormenta: "Tormenta",
  sin_datos: "Sin datos",
};

export const ESTADO_METEO_COLOR: Record<EstadoMeteo, string> = {
  soleado: "#FFD60A",
  parcialmente_nublado: "#FFB86C",
  nublado: "#9AA5B1",
  lluvioso: "#00B4D8",
  tormenta: "#B000FF",
  sin_datos: "#6B7280",
};

export const ES_DIA_LLUVIOSO = (estado: EstadoMeteo): boolean =>
  estado === "lluvioso" || estado === "tormenta";

export interface PuntoPrediccion {
  tiempo_hora: number;
  nivel_agua_cm: number;
  estado: "Normal" | "Alerta" | "Emergencia" | "Critico";
  lluvia_mm_h: number;
  marea_cm: number;
  viento_efecto_cm: number;
  f_lluvia: number;
  f_marea: number;
  f_viento: number;
  saturacion_suelo: number;
  eficiencia_drenaje: number;
  velocidad_cambio: number;
}

export interface MeteorologiaResumen {
  lluvia_total_mm: number;
  temp_max_c: number;
  temp_min_c: number;
  humedad_promedio: number;
  viento_max_kmh: number;
  dias_lluviosos: number;
  horas_con_lluvia: number;
}

export interface PrediccionResponse {
  territorio: string;
  horas_pronostico: number;
  puntos: PuntoPrediccion[];
  meteorologia_resumen: MeteorologiaResumen;
  ecuacion: string;
  nivel_actual_cm: number;
  nivel_maximo_cm: number;
  hora_pico: number;
  tendencia: "creciente" | "decreciente" | "estable";
  narrativa: string;
  recomendacion: string;
  estado_meteorologico?: EstadoMeteo;
  estado_label?: string;
  confianza_meteo?: number;
  fuente_meteo?: string;
  es_dia_lluvioso?: boolean;
  proxima_pleamar?: string;
}

export interface DiaPronostico {
  dia: string;
  lluvia_mm: number;
  temp_max_c: number;
  prob_lluvia_pct?: number;
  estado?: EstadoMeteo;
}

export interface WeatherResponse {
  source: string;
  fuente: string;
  confianza: number;
  timestamp: string;
  lat: number;
  lon: number;
  temperatura: number;
  humedad: number;
  nubosidad_pct: number;
  estado: EstadoMeteo;
  estado_label: string;
  weather_code?: number | null;
  precipitacion_actual_mm_h: number;
  velocidad_viento_kmh: number;
  direccion_viento_deg: number;
  rafagas_kmh?: number;
  presion_msl_hpa?: number;
  punto_rocio_c?: number;
  sensacion_termica_c?: number;
  dias_lluviosos_consecutivos: number;
  humedad_suelo_pct: number;
  lluvia_total_mm: number;
  temp_max_c: number;
  temp_min_c: number;
  viento_max_kmh: number;
  lluvia_manana_mm: number;
  marea_actual_cm: number;
  proxima_pleamar: string;
  pronostico: DiaPronostico[];
  parametros_simulacion?: Record<string, unknown>;
}

export function fetchWeather(force = false): Promise<{ weather: WeatherResponse }> {
  return stormprintFetch<{ weather: WeatherResponse }>(
    `/api/v1/weather${force ? "?force_refresh=true" : ""}`,
    { method: "GET" }
  );
}

export interface PrediccionGuardada {
  id: number;
  timestamp: string;
  horas_pronostico: number;
  puntos: PuntoPrediccion[];
  meteorologia_resumen: MeteorologiaResumen;
  max_water_level_cm: number;
  peak_hour: number;
  risk_level: string;
  ecuacion: string;
  data_source?: "real" | "simulado" | string;
}

// --- Fetch helpers ---

// SECURITY NOTE: The API key is shipped to the browser for endpoints that require
// it (weather, predict, history). In production, set NEXT_PUBLIC_STORMPRINT_API_KEY
// to a unique key. The default dev key is blocked in production by the backend.
// Public endpoints (health, predecir, predicciones) do NOT require auth.
const API_KEY = process.env.NEXT_PUBLIC_STORMPRINT_API_KEY ?? "";

// Dedup de peticiones en vuelo: si dos llamadas piden exactamente lo mismo al
// mismo tiempo (p. ej. en el montaje de la página y del panel en vivo), se
// reutiliza la misma promesa en vez de duplicar el request al backend.
const inflightCache = new Map<string, Promise<unknown>>();

function dedupeFetch<T>(key: string, make: () => Promise<T>): Promise<T> {
  const existing = inflightCache.get(key);
  if (existing) return existing as Promise<T>;
  const promise = make().finally(() => inflightCache.delete(key));
  inflightCache.set(key, promise);
  return promise;
}

async function stormprintFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-StormPrint-Key": API_KEY } : {}),
    ...(init?.headers as Record<string, string> ?? {}),
  };

  // Timeout por request: evita que la UI quede colgada si el backend
  // (serverless) tarda mas de lo razonable. 25s por defecto, configurable.
  const timeoutMs = init?.signal ? Infinity : 25_000;
  const controller = new AbortController();
  const timer = timeoutMs !== Infinity ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new Error(
      aborted
        ? "StormPrint tardó demasiado en responder. Intentá de nuevo."
        : "No se pudo conectar con StormPrint. Revisá tu conexión."
    );
  }
  if (timer) clearTimeout(timer);

  if (!response.ok) {
    let message = "Ocurrio un error al comunicarse con StormPrint.";
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // response body wasn't JSON
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// --- Funciones publicas ---

export function predecir(params: {
  horas_pronostico?: number;
  intensidad_lluvia_mm_h?: number;
  nivel_marea_cm?: number;
  eficiencia_drenaje?: number;
  usar_datos_meteo?: boolean;
}): Promise<PrediccionResponse> {
  const key = `POST /api/v1/predecir ${JSON.stringify(params)}`;
  return dedupeFetch(key, () =>
    stormprintFetch<PrediccionResponse>("/api/v1/predecir", {
      method: "POST",
      body: JSON.stringify(params),
    })
  );
}

export function runPrediction(params: SimulationRequestParams): Promise<SimulationResponse> {
  return stormprintFetch<SimulationResponse>("/api/v1/predict", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function fetchHistory(limit = 168): Promise<FloodRecord[]> {
  return stormprintFetch<FloodRecord[]>(`/api/v1/history?limit=${limit}`, {
    method: "GET",
  });
}

export function fetchPredicciones(limit = 10): Promise<{ predicciones: PrediccionGuardada[] }> {
  return stormprintFetch(`/api/v1/predicciones?limit=${limit}`, {
    method: "GET",
  });
}

export interface HealthResponse {
  status: "operational" | "degraded";
  timestamp: string;
  uptime_seconds: number;
  database: string;
  fuentes: Record<string, number | null>;
  suscripciones: number;
}

export function fetchHealth(): Promise<HealthResponse> {
  return stormprintFetch<HealthResponse>("/api/v1/health", { method: "GET" });
}

// --- Utilidades de UI ---

export function riskColor(estado: string): string {
  return riscoColorEstilo(estado);
}

export function riskLabel(estado: string): string {
  return etiquetaNivel(estado);
}

export function fuenteLabel(fuente?: string): string {
  switch (fuente) {
    case "open-meteo":
      return "Open-Meteo en vivo";
    case "historico":
      return "Historico mensual";
    case "simulado":
      return "Promedio estimado";
    default:
      return fuente ?? "Open-Meteo en vivo";
  }
}

export function formatConfianza(confianza?: number): string {
  if (confianza === undefined || confianza === null) return "--";
  return `${Math.round(confianza * 100)}%`;
}

export function formatHour(hora: number): string {
  const day = Math.floor(hora / 24);
  const h = Math.floor(hora % 24);
  if (day === 0) return `Hoy ${String(h).padStart(2, "0")}:00`;
  return `Dia ${day + 1}, ${String(h).padStart(2, "0")}:00`;
}

export function formatHourShort(hora: number): string {
  const h = Math.floor(hora % 24);
  return `${String(h).padStart(2, "0")}:00`;
}

export function dayLabel(hora: number): string {
  const day = Math.floor(hora / 24);
  if (day === 0) return "Hoy";
  if (day === 1) return "Manana";
  return `Dia ${day + 1}`;
}

export interface DaySummary {
  dayIndex: number;
  dayLabel: string;
  lluviaTotal: number;
  nivelMaximo: number;
  horaPico: number;
  estadoDominante: string;
  horasConLluvia: number;
  horasTotales: number;
}

export function computeDaySummaries(puntos: PuntoPrediccion[]): DaySummary[] {
  const daysMap = new Map<number, PuntoPrediccion[]>();

  for (const p of puntos) {
    const dayIdx = Math.floor(p.tiempo_hora / 24);
    if (!daysMap.has(dayIdx)) daysMap.set(dayIdx, []);
    daysMap.get(dayIdx)!.push(p);
  }

  const summaries: DaySummary[] = [];
  for (const [dayIdx, dayPoints] of daysMap) {
    const lluviaTotal = dayPoints.reduce((sum, p) => sum + p.lluvia_mm_h, 0);
    const nivelMaximo = Math.max(...dayPoints.map((p) => p.nivel_agua_cm));
    const horasConLluvia = dayPoints.filter((p) => p.lluvia_mm_h > 0.1).length;

    const maxPoint = dayPoints.reduce((max, p) =>
      p.nivel_agua_cm > max.nivel_agua_cm ? p : max
    );

    // Estado dominante (mayoritario)
    const stateCounts = new Map<string, number>();
    for (const p of dayPoints) {
      stateCounts.set(p.estado, (stateCounts.get(p.estado) || 0) + 1);
    }
    const estadoDominante = [...stateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Normal";

    summaries.push({
      dayIndex: dayIdx,
      dayLabel: dayLabel(dayIdx * 24),
      lluviaTotal: Math.round(lluviaTotal * 10) / 10,
      nivelMaximo: Math.round(nivelMaximo * 10) / 10,
      horaPico: maxPoint.tiempo_hora,
      estadoDominante,
      horasConLluvia,
      horasTotales: dayPoints.length,
    });
  }

  return summaries.sort((a, b) => a.dayIndex - b.dayIndex);
}
