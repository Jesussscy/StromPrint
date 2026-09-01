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
  precipitacion_actual_mm_h: number;
  velocidad_viento_kmh: number;
  direccion_viento_deg: number;
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

export function fetchWeather(): Promise<{ weather: WeatherResponse }> {
  return stormprintFetch<{ weather: WeatherResponse }>("/api/v1/weather", {
    method: "GET",
  });
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

const API_KEY = process.env.NEXT_PUBLIC_STORMPRINT_API_KEY ?? "";

async function stormprintFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-StormPrint-Key": API_KEY } : {}),
    ...(init?.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(path, {
    ...init,
    headers,
  });

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
  return stormprintFetch<PrediccionResponse>("/api/v1/predecir", {
    method: "POST",
    body: JSON.stringify(params),
  });
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

export interface ComparacionResponse {
  horas: number[];
  numerico_cm: number[];
  analitico_cm: number[];
  error_promedio_cm: number;
  error_maximo_cm: number;
  error_rmse_cm: number;
  puntos: number;
  subtramos: number;
  parametros: Record<string, number>;
  ecuacion?: string;
}

export function compararMetodos(params: {
  duration_hours?: number;
  storm_peak_hour?: number;
  storm_intensity?: number;
  subtramos?: number;
}): Promise<ComparacionResponse> {
  return stormprintFetch<ComparacionResponse>("/api/v1/comparacion", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// --- Utilidades de UI ---

export function riskColor(estado: string): string {
  return riscoColorEstilo(estado);
}

export function riskLabel(estado: string): string {
  return etiquetaNivel(estado);
}

export function riskIcon(estado: string): string {
  switch (estado) {
    case "Critico":
      return "\u26A0";
    case "Emergencia":
      return "\uD83D\uDEA8";
    case "Alerta":
      return "\u26A0\uFE0F";
    default:
      return "\u2705";
  }
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
