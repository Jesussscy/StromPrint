"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
}

const DEFAULT_TABS: Tab[] = [
  { id: "inicio", label: "Inicio", href: "/", icon: <span>🏠</span> },
  { id: "panel", label: "Panel Vivo", href: "/#panel-vivo", icon: <span>📊</span> },
  { id: "ciencia", label: "Ciencia", href: "/ciencia", icon: <span>🧠</span> },
  { id: "alertas", label: "Alertas", href: "/alertas", icon: <span>🚨</span> },
  { id: "contacto", label: "Contacto", href: "/#contacto", icon: <span>📞</span> },
];

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

  const handleClick = (tab: Tab) => {
    if (tab.href) {
      window.location.hash = tab.href;
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
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 56,
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
        style={{
          position: "relative",
          display: "flex",
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
              color:
                active === tab.id
                  ? "var(--text-active, #fff)"
                  : "var(--text-inactive, rgba(255,255,255,0.45))",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: 8,
              transform:
                active === tab.id
                  ? "scale(1)"
                  : "scale(1)",
              transition: "color 0.2s, transform 0.15s",
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
      <div style={{ width: 80 }} />

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
