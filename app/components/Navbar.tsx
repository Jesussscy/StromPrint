"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#dashboard", label: "Datos en vivo" },
  { href: "#tecnologia", label: "Tecnología" },
  { href: "#contacto", label: "Contacto" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 md:px-12">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="#00B4D8" strokeWidth="2" />
            <path
              d="M16 8C16 8 10 15 10 19a6 6 0 0 0 12 0c0-4-6-11-6-11z"
              fill="#00B4D8"
              opacity="0.85"
            />
            <path
              d="M8 22c2-2 4-1 6 0s4 2 6 0 4-2 6 0"
              stroke="#1D3557"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.5"
            />
          </svg>
          <span className="font-display text-lg font-bold text-navy">
            Storm<span className="text-accent">Print</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-accent transition"
            >
              {link.label}
            </a>
          ))}
          <a href="#dashboard" className="btn-primary text-sm !py-2 !px-4">
            Ver panel en vivo
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          <span className={`h-0.5 w-5 bg-navy transition ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`h-0.5 w-5 bg-navy transition ${mobileOpen ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 bg-navy transition ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-6 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-slate-600 hover:text-accent transition"
                >
                  {link.label}
                </a>
              ))}
              <a href="#dashboard" className="btn-primary text-sm !py-2 text-center">
                Ver panel en vivo
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
