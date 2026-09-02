"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyMountProps {
  children: ReactNode;
  placeholder?: ReactNode;
  rootMargin?: string;
  fallbackMs?: number;
}

/**
 * LazyMount
 * Monta `children` cuando el contenedor se acerca al viewport
 * (IntersectionObserver). Sirve para diferir el render y el bundle de
 * componentes pesados (p. ej. el visor 3D de Cesium).
 *
 * Fiabilidad: el nodo observado es un div con caja real (`relative h-full`),
 * así el observador siempre recibe un rect con área > 0. Además hay un fallback
 * temporal (fallbackMs) que monta `children` aunque el observador no dispare,
 * evitando que el visor quede "hueco" en navegadores/móviles con soporte
 * parcial de IntersectionObserver.
 */
export default function LazyMount({
  children,
  placeholder = null,
  rootMargin = "800px",
  fallbackMs = 8000,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio > 0)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );
    obs.observe(node);

    // Red de seguridad: aunque el observador nunca reporte intersección, el
    // contenido se monta igualmente después del tiempo de espera.
    const fallback = window.setTimeout(() => {
      setVisible(true);
      obs.disconnect();
    }, fallbackMs);

    return () => {
      obs.disconnect();
      window.clearTimeout(fallback);
    };
  }, [rootMargin, fallbackMs]);

  return <div ref={ref} className="relative h-full">{visible ? children : placeholder}</div>;
}