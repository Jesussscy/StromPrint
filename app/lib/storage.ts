// ---------------------------------------------------------------------------
// StormPrint :: storage.ts
// Persistencia ligera en localStorage para parametros del escenario y cachés
// pequeñas (p. ej. el ultimo estado en vivo). Todo dentro de try/catch para
// que una privacidad estricta del navegador nunca rompa la app.
// ---------------------------------------------------------------------------

const PREFIJO = "stormprint:";

export function loadJSON<T>(clave: string, porDefecto: T): T {
  if (typeof window === "undefined") return porDefecto;
  try {
    const raw = localStorage.getItem(PREFIJO + clave);
    if (raw === null) return porDefecto;
    return JSON.parse(raw) as T;
  } catch (_e) {
    return porDefecto;
  }
}

export function saveJSON<T>(clave: string, valor: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch (_e) {
    /* noop */
  }
}

export function loadNumber(clave: string, porDefecto: number): number {
  const v = loadJSON<number | string>(clave, porDefecto);
  return typeof v === "number" && Number.isFinite(v) ? v : porDefecto;
}

export function loadBoolean(clave: string, porDefecto: boolean): boolean {
  const v = loadJSON<boolean>(clave, porDefecto);
  return typeof v === "boolean" ? v : porDefecto;
}