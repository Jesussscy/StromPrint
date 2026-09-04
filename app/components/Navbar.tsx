"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, LayoutDashboard, Brain, Siren, Phone } from "lucide-react";

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
  notificationCount = 0,
  onTabChange,
}: {
  tabs?: Tab[];
  defaultTab?: string;
  notificationCount?: number;
  onTabChange?: (id: string) => void;
} = {}) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || "");
  const [bounce, setBounce] = useState<string | null>(null);
  const [prevActive, setPrevActive] = useState(active);
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
    setBounce(tab.id);
    setPrevActive(active);
    setActive(tab.id);
    onTabChange?.(tab.id);
    setTimeout(() => setBounce(null), 150);
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
      <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", color: "var(--text-primary, #fff)" }}>
        STORMPRINT
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
            {tab.id === tabs[1]?.id && notificationCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 9,
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: "18px",
                  textAlign: "center" as const,
                  background: "var(--badge-bg, #ef4444)",
                  color: "var(--badge-text, #fff)",
                  animation: bounce === tab.id ? "badge-bounce 0.3s ease" : "badge-pop 0.3s ease",
                }}
              >
                {notificationCount}
              </span>
            )}
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

      {/* Keyframes injected once */}
      <style jsx global>{`
        @keyframes badge-pop {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes badge-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      `}</style>
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
