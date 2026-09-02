"use client";

import { useState, useEffect, useCallback } from "react";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#datos", label: "Datos" },
  { href: "#panel-vivo", label: "Panel en vivo" },
  { href: "/ciencia", label: "Ciencia" },
  { href: "/alertas", label: "Alertas" },
  { href: "#contacto", label: "Contacto" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleNavClick = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <nav aria-label="Navegación principal" className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "glass-strong shadow-lg shadow-black/30" : "glass-subtle"
    } border-b border-cyan/10`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 md:px-12">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 min-w-0">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="shrink-0">
            <circle cx="16" cy="16" r="15" stroke="#00F3FF" strokeWidth="1.5" opacity="0.6" />
            <path d="M16 8C16 8 10 15 10 19a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill="#00F3FF" opacity="0.8" />
          </svg>
          <span className="font-display text-sm font-bold tracking-wider text-white">
            STORM<span className="neon-text">{"//"}</span>PRINT
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono text-[11px] uppercase tracking-widest text-slate-400 hover:text-cyan transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
          <a href="#panel-vivo" className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition-colors duration-200">
            Panel en vivo
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden relative z-50 flex flex-col justify-center items-center w-10 h-10 -mr-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileOpen}
        >
          <span className={`block w-5 h-0.5 bg-cyan transition-all duration-300 ease-in-out ${
            mobileOpen ? "rotate-45 translate-y-[3px]" : ""
          }`} />
          <span className={`block w-5 h-0.5 bg-cyan transition-all duration-300 ease-in-out mt-1.5 ${
            mobileOpen ? "opacity-0 scale-0" : ""
          }`} />
          <span className={`block w-5 h-0.5 bg-cyan transition-all duration-300 ease-in-out mt-1.5 ${
            mobileOpen ? "-rotate-45 -translate-y-[3px]" : ""
          }`} />
        </button>
      </div>

      {/* Mobile menu overlay */}
      <div
        className={`md:hidden fixed inset-0 top-[53px] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleNavClick}
        aria-hidden="true"
      />

      {/* Mobile menu panel */}
      <div
        className={`md:hidden fixed top-[53px] left-0 right-0 glass-strong border-b border-cyan/10 transition-all duration-300 ease-in-out ${
          mobileOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
        role="menu"
      >
        <div className="flex flex-col px-4 py-4 gap-1">
          {NAV_LINKS.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              onClick={handleNavClick}
              className="font-mono text-[12px] uppercase tracking-widest text-slate-300 hover:text-cyan active:text-cyan py-3 px-3 rounded-xl hover:bg-white/5 active:bg-white/5 transition-colors duration-150"
              role="menuitem"
              style={{ transitionDelay: mobileOpen ? `${i * 40}ms` : "0ms" }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#panel-vivo"
            onClick={handleNavClick}
            className="glass-glow rounded-xl px-4 py-3 font-mono text-[12px] text-center uppercase tracking-wider text-cyan mt-2 active:bg-cyan/15 transition-colors duration-150"
            role="menuitem"
          >
            Panel en vivo
          </a>
        </div>
      </div>

      {/* Scroll progress indicator */}
      <div className="absolute bottom-0 left-0 h-[2px] w-full bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-cyan via-cyan-bright to-cyan transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%`, boxShadow: "0 0 8px rgba(0,229,255,0.6)" }}
        />
      </div>
    </nav>
  );
}
