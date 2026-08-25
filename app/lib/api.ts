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

const API_KEY = process.env.NEXT_PUBLIC_STORMPRINT_API_KEY ?? "";

async function stormprintFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-StormPrint-Key": API_KEY,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Ocurrió un error al comunicarse con StormPrint.";
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // response body wasn't JSON — keep generic message
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
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

export function riskColor(risk: FloodRecord["risk_level"]): string {
  switch (risk) {
    case "critical":
      return "#FF0055";
    case "high":
      return "#FF7700";
    case "moderate":
      return "#F5C518";
    default:
      return "#00F3FF";
  }
}

export function riskLabel(risk: FloodRecord["risk_level"]): string {
  switch (risk) {
    case "critical":
      return "Crítico";
    case "high":
      return "Alto";
    case "moderate":
      return "Moderado";
    default:
      return "Bajo";
  }
}
