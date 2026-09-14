"use client";

import { useEffect, useState } from "react";

/** Hook responsive SSR-safe: devuelve true cuando el viewport cumple `query`.
 *  En servidor/primer render devuelve `defaultValue` (false) para no divergir
 *  en la hidratación; tras montar lo calcula con matchMedia y se mantiene en
 *  vivo escuchando cambios de tamaño/orientación. */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
    } else {
      (mq as MediaQueryList & { addListener: (l: (e: MediaQueryListEvent) => void) => void }).addListener(onChange);
    }
    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", onChange);
      } else {
        (mq as MediaQueryList & { removeListener: (l: (e: MediaQueryListEvent) => void) => void }).removeListener(onChange);
      }
    };
  }, [query]);

  return matches;
}

/** Conveniencia: viewport móvil (<768px, igual que el breakpoint `md` de Tailwind). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}