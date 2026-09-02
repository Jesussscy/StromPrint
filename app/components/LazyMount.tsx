"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyMountProps {
  children: ReactNode;
  placeholder?: ReactNode;
  rootMargin?: string;
}

/**
 * LazyMount
 * Monta `children` recién cuando el contenedor se acerca al viewport
 * (IntersectionObserver). Sirve para diferir el render y el bundle de
 * componentes pesados (p. ej. el visor 3D de Cesium) sin perder el espacio
 * reservado: mientras no se ve, se muestra `placeholder`.
 */
export default function LazyMount({
  children,
  placeholder = null,
  rootMargin = "800px",
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
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [rootMargin]);

  return <div ref={ref} className="contents">{visible ? children : placeholder}</div>;
}