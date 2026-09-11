// ---------------------------------------------------------------------------
// StormPrint :: export.ts
// Exportacion del pronostico: CSV y JSON con el desglose por hora, y copia
// del resumen al portapapeles (texto plano listo para pegar en chats).
// ---------------------------------------------------------------------------

import {
  type PuntoPrediccion,
  type PrediccionResponse,
  formatHourShort,
  dayLabel,
} from "@/app/lib/api";
import { clasificarNivel } from "@/app/lib/riesgo";

function filaCSV(p: PuntoPrediccion): string[] {
  const riesgo = clasificarNivel(p.nivel_agua_cm);
  return [
    `${dayLabel(p.tiempo_hora)} ${formatHourShort(p.tiempo_hora)}`,
    p.nivel_agua_cm.toFixed(1),
    riesgo,
    p.lluvia_mm_h.toFixed(2),
    p.marea_cm.toFixed(1),
    p.viento_efecto_cm.toFixed(1),
    p.velocidad_cambio.toFixed(1),
  ];
}

function descargar(nombre: string, contenido: string, mime: string) {
  const blob = new Blob(["\uFEFF" + contenido], {
    type: mime + ";charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportPrediccionCSV(prediccion: PrediccionResponse, sufijo = "onda"): void {
  const cabeceras = [
    "fecha_hora",
    "nivel_cm",
    "riesgo",
    "lluvia_mm_h",
    "marea_cm",
    "viento_efecto_cm",
    "velocidad_cambio_cm_h",
  ];
  const lineas = [
    cabeceras.join(";"),
    ...prediccion.puntos.map((p) => filaCSV(p).join(";")),
  ];
  descargar(
    `stormprint-${sufijo}-${new Date().toISOString().slice(0, 16)}.csv`,
    lineas.join("\r\n"),
    "text/csv"
  );
}

export function exportPrediccionJSON(prediccion: PrediccionResponse, sufijo = "onda"): void {
  descargar(
    `stormprint-${sufijo}-${new Date().toISOString().slice(0, 16)}.json`,
    JSON.stringify(prediccion, null, 2),
    "application/json"
  );
}

export function resumenTexto(prediccion: PrediccionResponse): string {
  const meteo = prediccion.meteorologia_resumen;
  const picoHora = formatHourShort(prediccion.hora_pico);
  return [
    `StormPrint · ${prediccion.territorio} · ${prediccion.estado_label ?? ""}`,
    `Máximo: ${prediccion.nivel_maximo_cm.toFixed(1)} cm (hora ${picoHora}) · Tendencia: ${prediccion.tendencia}`,
    `Lluvia total: ${meteo?.lluvia_total_mm?.toFixed(1) ?? "—"} mm · Viento máx.: ${meteo?.viento_max_kmh ?? "—"} km/h`,
    `Horizonte: ${prediccion.horas_pronostico} h`,
    `Recomendación: ${prediccion.recomendacion}`,
  ].join("\n");
}

export async function copiarResumen(prediccion: PrediccionResponse): Promise<boolean> {
  const texto = resumenTexto(prediccion);
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (_e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_e2) {
      return false;
    }
  }
}