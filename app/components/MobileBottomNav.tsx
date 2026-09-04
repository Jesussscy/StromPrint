"use client";

import { useState, useEffect, useCallback, type JSX } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type NavAction = "scroll" | "route" | "alerts";

export interface MobileNavItem {
  href: string; // hash (#seccion) para scroll, ruta (/ciencia) para route
  label: string;
  action: NavAction;
  icon: JSX.Element;
}

export function IconChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
  );
}
export function IconWeather() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 0 0-10 0" /><path d="M12 9V2m0 0l-3 3m3-3l3 3" /><line x1="4.22" y1="12.22" x2="5.64" y2="13.64" /><line x1="18.36" y1="13.64" x2="19.78" y2="12.22" /></svg>
  );
}
export function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
  );
}
export function IconHistory() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>
  );
}
export function IconScience() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31" /><path d="M14 9.3V2" /><path d="M8.5 2h7" /><path d="M14 9.3a6.5 6.5 0 1 1-4 0" /><path d="M5 22h14" /></svg>
  );
}
export function IconPanel() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
  );
}

export const NAV_MAIN: MobileNavItem[] = [
  { href: "#panel-vivo", label: "Panel", action: "scroll", icon: <IconPanel /> },
  { href: "#meteo", label: "Clima", action: "scroll", icon: <IconWeather /> },
  { href: "#alerts", label: "Alertas", action: "alerts", icon: <IconBell /> },
  { href: "#historial", label: "Historial", action: "scroll", icon: <IconHistory /> },
  { href: "/ciencia", label: "Ciencia", action: "route", icon: <IconScience /> },
];

interface MobileBottomNavProps {
  items?: MobileNavItem[];
}

export default function MobileBottomNav({ items = NAV_MAIN }: MobileBottomNavProps) {
  const [active, setActive] = useState(items[0]?.href ?? "");
  const pathname = usePathname();
  const router = useRouter();

  // Cuando cambia la ruta, si un item de route coincide, se marca activo.
  useEffect(() => {
    const routeItem = items.find((i) => i.action === "route" && i.href === pathname);
    if (routeItem) setActive(routeItem.href);
    else setActive(items[0]?.href ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Observa las secciones de la página para resaltar el elemento activo.
  useEffect(() => {
    const scrollIds = items.filter((i) => i.action === "scroll").map((i) => i.href.replace(/^#/, ""));
    if (scrollIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = `#${entry.target.id}`;
            if (items.some((item) => item.href === id)) setActive(id);
          }
        });
      },
      { threshold: 0.15, rootMargin: "-55% 0px -40% 0px" }
    );
    scrollIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  const scrollToSection = useCallback((href: string) => {
    const id = href.replace(/^#/, "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleClick = (item: MobileNavItem, e: React.MouseEvent) => {
    if (item.action === "alerts") {
      window.dispatchEvent(new CustomEvent("stormprint:open-alerts"));
      return;
    }
    if (item.action === "scroll") {
      e.preventDefault();
      setActive(item.href);
      // Si estamos en otra página, primero navegamos a / y luego hacemos scroll.
      if (pathname !== "/") {
        router.push(item.href);
        setTimeout(() => scrollToSection(item.href), 120);
      } else {
        scrollToSection(item.href);
      }
    }
  };

  const activeScroll = active;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] md:hidden border-t border-cyan/15 bg-[#050A0F]/95 backdrop-blur-xl safe-area-bottom"
      role="navigation"
      aria-label="Navegación móvil"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const isActive = item.action !== "alerts" && activeScroll === item.href;
          const base = "relative flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[52px] select-none touch-manipulation";

          const label = (
            <>
              <span className={`pointer-events-none flex h-7 items-center justify-center transition-transform duration-200 ${isActive ? "scale-105" : "scale-100"}`}>
                {item.icon}
              </span>
              <span
                className={`pointer-events-none font-mono text-[9.5px] uppercase tracking-wider transition-colors duration-200 ${
                  isActive ? "text-cyan" : "text-slate-500"
                }`}
              >
                {item.label}
              </span>
            </>
          );

          // Encapsulamos cada ítem en un wrapper con un hover/press sutil.
          if (item.action === "route") {
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`${base} active:scale-95 transition-transform duration-150`}
                style={{ color: isActive ? "#22d3ee" : "#64748b", WebkitTapHighlightColor: "transparent" }}
              >
                {label}
              </Link>
            );
          }

          return (
            <a
              key={item.label}
              href={item.action === "alerts" ? "#alerts" : item.href}
              onClick={(e) => handleClick(item, e)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`${base} active:scale-95 transition-transform duration-150`}
              style={{ color: isActive ? "#22d3ee" : "#64748b", WebkitTapHighlightColor: "transparent" }}
            >
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
