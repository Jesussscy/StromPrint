"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, LayoutDashboard, Brain, Siren, Phone, Menu, X, Waves, ArrowUpRight, CloudSun } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
}

const DEFAULT_TABS: Tab[] = [
  { id: "inicio", label: "Inicio", href: "/", icon: <Home size={15} /> },
  { id: "panel", label: "Monitoreo", href: "/#panel-vivo", icon: <LayoutDashboard size={15} /> },
  { id: "pronostico", label: "Pronóstico", href: "/#pronostico", icon: <LayoutDashboard size={15} /> },
  { id: "territorio", label: "Territorio", href: "/#territorio", icon: <Home size={15} /> },
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
      className="storm-navbar"
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: "calc(66px + env(safe-area-inset-top, 0px))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(14px, 2vw, 32px)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: "linear-gradient(90deg,rgba(5,31,39,.94),rgba(7,54,56,.91))",
        backdropFilter: "blur(22px)",
        borderBottom: "1px solid rgba(185,243,222,.28)",
        boxShadow: "0 9px 32px rgba(0,27,37,.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {/* Hamburguesa: abre el menú lateral en móvil */}
        <button
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú de navegación"
          className="xl:hidden"
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

        <div style={{ display:"flex",alignItems:"center",gap:10,color:"#f1fff6" }}>
          <span style={{display:"grid",placeItems:"center",width:35,height:35,borderRadius:11,background:"linear-gradient(145deg,#b8ead6,#6fbdb6)",color:"#12434a",boxShadow:"0 0 0 1px rgba(255,255,255,.36)"}}><Waves size={22}/></span>
          <span style={{display:"flex",flexDirection:"column",gap:1}}><strong style={{fontSize:15,letterSpacing:".095em",lineHeight:1}}>STORMPRINT</strong><small style={{fontSize:8,letterSpacing:".16em",color:"#9dd5ce",fontFamily:"monospace"}}>CARTAGENA · COLOMBIA</small></span>
        </div>
      </div>

      {/* Desktop tabs */}
      <div
        className="hidden xl:flex"
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
              padding: "8px 11px",
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
              background: active === tab.id ? "rgba(176,238,219,.14)" : "none",
              border: active === tab.id ? "1px solid rgba(191,248,225,.28)" : "1px solid transparent",
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

      <button type="button" className="hidden xl:flex" onClick={()=>router.push("/manga-3d")} style={{alignItems:"center",gap:8,minHeight:43,padding:"0 14px",border:"1px solid rgba(200,255,235,.6)",borderRadius:12,background:"linear-gradient(120deg,#d2f1df,#9edbcc)",color:"#17484c",fontSize:11,fontWeight:800,letterSpacing:".06em",cursor:"pointer"}}><CloudSun size={17}/> MAPA 3D <ArrowUpRight size={16}/></button>

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
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm xl:hidden"
              aria-hidden="true"
            />
            {/* Panel lateral que se desliza desde la izquierda (80% ancho) */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed left-0 top-0 bottom-0 z-[80] flex w-[80%] max-w-[320px] flex-col bg-[#072b33]/98 xl:hidden overflow-y-auto"
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
                        background: esActivo ? "rgba(177,238,214,0.16)" : "transparent",
                        color: esActivo ? "#bcebdc" : "rgba(232,251,245,.76)",
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
                      <span style={{ display: "flex", alignItems: "center", color: esActivo ? "#bcebdc" : "currentColor" }}>
                        {tab.icon}
                      </span>
                      {tab.label}
                    </button>
                  );
                })}
                <button type="button" onClick={()=>{setMenuAbierto(false);router.push("/manga-3d");}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",minHeight:48,padding:"0 14px",marginTop:16,border:"1px solid rgba(187,245,222,.45)",borderRadius:12,background:"rgba(177,238,214,.14)",color:"#dcfaeb",fontSize:13,fontWeight:800,letterSpacing:".06em",cursor:"pointer"}}><CloudSun size={20}/> EXPLORAR MAPA 3D <ArrowUpRight size={17}/></button>
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
