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