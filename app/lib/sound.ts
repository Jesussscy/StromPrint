// ---------------------------------------------------------------------------
// StormPrint :: sound.ts
// Alertas de audio con WebAudio (sin archivos): beeps que acompanan el cruce
// de umbrales y una sirena que suena mientras dura la tormenta.
// ---------------------------------------------------------------------------

const KEY_SOUND = "stormprint:sound";

export function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY_SOUND) !== "0";
  } catch (_e) {
    return true;
  }
}

export function setSoundEnabled(v: boolean): void {
  try {
    localStorage.setItem(KEY_SOUND, v ? "1" : "0");
  } catch (_e) {
    /* noop */
  }
}

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (!soundEnabled()) return null;
  try {
    if (!ctx) {
      const AC: any =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    const ac = ctx as AudioContext;
    if (ac.state === "suspended") void ac.resume();
    return ac;
  } catch (_e) {
    return null;
  }
}

function tono(
  freq: number,
  duracionMs: number,
  tipo: OscillatorType = "sine",
  volumen = 0.12
) {
  const ac = contexto();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = tipo;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(volumen, ac.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duracionMs / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duracionMs / 1000 + 0.05);
}

/** Secuencia breve segun la gravedad del estado. */
export function playAlerta(
  cantidad: number,
  frecuencia = 660,
  operiodo = 0.16
): void {
  for (let i = 0; i < cantidad; i++) {
    setTimeout(() => tono(frecuencia, 130, "triangle"), i * operiodo * 1000);
  }
}