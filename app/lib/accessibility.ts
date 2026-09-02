// ---------------------------------------------------------------------------
// StormPrint :: accessibility.ts
// Helpers de accesibilidad compartidos (prefers-reduced-motion, etc.)
// ---------------------------------------------------------------------------

/** true si el sistema pide reducir el movimiento (oriente a desactivar
 *  animaciones decorativas de canvas y de Framer Motion en runtime). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Seguimiento de la preferencia en vivo (subscribe pattern util para hooks). */
export function watchReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", handler);
  } else if (typeof mq.addListener === "function") {
    (mq as MediaQueryList & { addListener: (l: (e: MediaQueryListEvent) => void) => void }).addListener(handler);
  }
  return () => {
    if (typeof mq.removeEventListener === "function") {
      mq.removeEventListener("change", handler);
    } else if (typeof mq.removeListener === "function") {
      (mq as MediaQueryList & { removeListener: (l: (e: MediaQueryListEvent) => void) => void }).removeListener(handler);
    }
  };
}