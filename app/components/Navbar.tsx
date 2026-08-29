"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#datos", label: "Datos" },
  { href: "#panel-vivo", label: "Panel en vivo" },
  { href: "/ciencia", label: "Ciencia" },
  { href: "#contacto", label: "Contacto" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-subtle border-b border-cyan/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 md:px-12">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
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
              className="font-mono text-[11px] uppercase tracking-widest text-slate-400 hover:text-cyan transition"
            >
              {link.label}
            </a>
          ))}
          <a href="#panel-vivo" className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition">
            Panel en vivo
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menú"
        >
          <span className={`h-0.5 w-5 bg-cyan transition ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`h-0.5 w-5 bg-cyan transition ${mobileOpen ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 bg-cyan transition ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-strong border-b border-cyan/10 overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-6 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="font-mono text-[11px] uppercase tracking-widest text-slate-400 hover:text-cyan transition"
                >
                  {link.label}
                </a>
              ))}
              <a href="#panel-vivo" className="glass-glow rounded-lg px-4 py-2 font-mono text-[11px] text-center uppercase tracking-wider text-cyan">
                Panel en vivo
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
