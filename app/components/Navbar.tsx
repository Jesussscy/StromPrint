"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, LayoutDashboard, Brain, Siren, Phone, Menu, X } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
}

const DEFAULT_TABS: Tab[] = [
  { id: "inicio", label: "Inicio", href: "/", icon: <Home size={15} /> },
  { id: "panel", label: "Panel Vivo", href: "/#panel-vivo", icon: <LayoutDashboard size={15} /> },
  { id: "ciencia", label: "Ciencia", href: "/ciencia", icon: <Brain size={15} /> },
  { id: "alertas", label: "Alertas", href: "/alertas", icon: <Siren size={15} /> },
  { id: "contacto", label: "Contacto", href: "/#contacto", icon: <Phone size={15} /> },
];

// Separa una URL "/ruta#ancla" en ruta y ancla. Devuelve { path, hash } | null.
function parseHref(href: string): { path: string; hash: string } | null {
  if (typeof window === "undefined") return null;
  const [path, hash] = href.split("#");
  return { path: path || "/", hash: hash || "" };
}

export default function Navbar({
  tabs = DEFAULT_TABS,
  defaultTab,
  onTabChange,
}: {
  tabs?: Tab[];
  defaultTab?: string;
  onTabChange?: (id: string) => void;
} = {}) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || "");
  const [prevActive, setPrevActive] = useState(active);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [fade, setFade] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const updateIndicator = useCallback(() => {
    const el = tabsRef.current.get(active);
    if (!el) return;
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  useEffect(() => {
    setFade(false);
    const t = requestAnimationFrame(() => setFade(true));
    return () => cancelAnimationFrame(t);
  }, [active]);

  // Al cambiar de ruta externamente (e.g. desde el móvil), sincronizar la pestaña activa.
  useEffect(() => {
    const matching = tabs.find((t) => t.href && t.href.split("#")[0] === pathname);
    if (matching && matching.id !== active) setActive(matching.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Menú móvil: bloquea el scroll del body mientras está abierto y cierra con Escape.
  useEffect(() => {
    if (!menuAbierto) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAbierto(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onEsc);
    };
  }, [menuAbierto]);

  const handleClick = (tab: Tab) => {
    if (tab.href) {
      const parsed = parseHref(tab.href);
      if (!parsed) return;
      const { path, hash } = parsed;

      if (hash) {
        // Navegar a la ruta y luego hacer scroll al ancla.
        if (pathname !== path) {
          router.push(`${path}#${hash}`);
          // Esperar el primer render de la nueva página antes de hacer scroll.
          setTimeout(() => {
            document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
          }, 150);
        } else {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        router.push(path || "/");
      }
    }
    setPrevActive(active);
    setActive(tab.id);
    onTabChange?.(tab.id);
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: "calc(56px + env(safe-area-inset-top, 0px))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: "var(--bg-nav, rgba(2,12,24,0.95))",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Hamburguesa: abre el menú lateral en móvil */}
        <button
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú de navegación"
          className="md:hidden"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 10,
            border: "none",
            background: "transparent",
            color: "var(--text-primary, #fff)",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <Menu size={22} />
        </button>

        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", color: "var(--text-primary, #fff)" }}>
          STORMPRINT
        </div>
      </div>

      {/* Desktop tabs */}
      <div
        className="hidden md:flex"
        style={{
          position: "relative",
          alignItems: "center",
          gap: 4,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabsRef.current.set(tab.id, el);
            }}
            onClick={() => handleClick(tab)}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              fontFamily: "monospace",
              textTransform: "uppercase" as const,
              minHeight: 44,
              minWidth: 44,
              color:
                active === tab.id
                  ? "var(--text-active, #fff)"
                  : "var(--text-inactive, rgba(255,255,255,0.45))",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: 8,
              transition: "color 0.2s, transform 0.15s",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
              userSelect: "none" as const,
            }}
            onMouseEnter={(e) => {
              if (active !== tab.id) {
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.95)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}

        {/* Sliding indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: indicator.left,
            width: indicator.width,
            height: 2,
            borderRadius: 1,
            background: "var(--indicator-color, rgba(255,255,255,0.6))",
            transition: "left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Placeholder right area */}
      <div className="hidden md:block" style={{ width: 80 }} />

      {/* ── Menú lateral móvil (hamburguesa) ─────────────────────────────── */}
      <AnimatePresence>
        {menuAbierto && (
          <>
            {/* Fondo oscuro semitransparente: al tocarlo se cierra */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuAbierto(false)}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm md:hidden"
              aria-hidden="true"
            />
            {/* Panel lateral que se desliza desde la izquierda (80% ancho) */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed left-0 top-0 bottom-0 z-[80] flex w-[80%] max-w-[320px] flex-col bg-[#04090F]/98 md:hidden overflow-y-auto"
              style={{ borderRight: "1px solid var(--border, rgba(255,255,255,0.08))", boxShadow: "8px 0 32px rgba(0,0,0,0.5)" }}
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
            >
              <div
                className="safe-area-top flex items-center justify-between px-4"
                style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: 56 }}
              >
                <p style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", color: "var(--text-primary, #fff)" }}>
                  STORMPRINT
                </p>
                <button
                  onClick={() => setMenuAbierto(false)}
                  aria-label="Cerrar menú"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-inactive, rgba(255,255,255,0.6))",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                >
                  <X size={22} />
                </button>
              </div>

              <div className="px-2 pb-8">
                {tabs.map((tab) => {
                  const esActivo = active === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        handleClick(tab);
                        setMenuAbierto(false);
                      }}
                      aria-current={esActivo ? "page" : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        minHeight: 48,
                        padding: "0 14px",
                        marginBottom: 4,
                        borderRadius: 12,
                        border: "none",
                        background: esActivo ? "rgba(34,211,238,0.12)" : "transparent",
                        color: esActivo ? "#22d3ee" : "var(--text-inactive, rgba(255,255,255,0.55))",
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: "monospace",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                        cursor: "pointer",
                        textAlign: "left" as const,
                        WebkitTapHighlightColor: "transparent",
                        touchAction: "manipulation",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", color: esActivo ? "#22d3ee" : "currentColor" }}>
                        {tab.icon}
                      </span>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}

export function NavbarSection({ active, id, children }: { active: boolean; id: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      style={{
        opacity: active ? 1 : 0,
        transform: active ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        pointerEvents: active ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}
