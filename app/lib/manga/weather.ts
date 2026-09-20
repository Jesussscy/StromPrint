import type { PuntoPrediccion } from '../api';

export const RAIN_PRESETS = { Normal: 4, Alerta: 18, Emergencia: 45, Critico: 90 } as const;
export type RainPreset = keyof typeof RAIN_PRESETS;
export const finiteRain = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(300, n)) : 0;
export function rainLabel(rate: number): string {
  return rate <= .01 ? 'Sin lluvia' : rate < 10 ? 'Normal' : rate < 30 ? 'Alerta' : rate < 65 ? 'Emergencia' : 'Crítico';
}
/** Hourly storage estimate, replayed from t=0 for deterministic backwards scrubbing.
 * This is an uncalibrated local bucket, not a terrain elevation or flood forecast. */
export function accumulatedRain(points: Pick<PuntoPrediccion, 'tiempo_hora' | 'lluvia_mm_h'>[], hour: number, drainage: number, exposure: number) {
  let stored = 0;
  const sorted = [...points].sort((a,b) => a.tiempo_hora-b.tiempo_hora);
  for (let i=0;i<sorted.length;i++) {
    const p=sorted[i], end=Math.min(hour, sorted[i+1]?.tiempo_hora ?? p.tiempo_hora+1);
    const dt=Math.max(0,end-p.tiempo_hora);
    if (dt>0) stored=Math.max(0,stored+(finiteRain(p.lluvia_mm_h)*exposure-drainage)*dt);
  }
  return stored/1000;
}
