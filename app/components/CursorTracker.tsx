"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/app/lib/accessibility";

export default function CursorTracker() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const pos = useRef({ x: -100, y: -100 });
  const target = useRef({ x: -100, y: -100 });
  const spotTarget = useRef({ x: 0, y: 0 });
  const spotPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (isMobile) return;
    // Accesibilidad: el cursor decorativo desaparece si el usuario prefiere
    // menos movimiento (el cursor nativo del sistema queda igual).
    if (prefersReducedMotion()) return;

    const handleMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
      spotTarget.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);
    };

    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("mouseenter", handleEnter);

    let animId: number;
    const animate = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.15;
      pos.current.y += (target.current.y - pos.current.y) * 0.15;
      spotPos.current.x += (spotTarget.current.x - spotPos.current.x) * 0.08;
      spotPos.current.y += (spotTarget.current.y - spotPos.current.y) * 0.08;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${pos.current.x - 15}px, ${pos.current.y - 15}px)`;
      }
      if (spotlightRef.current) {
        spotlightRef.current.style.background = `radial-gradient(600px circle at ${spotPos.current.x}px ${spotPos.current.y}px, rgba(0, 229, 255, 0.06), transparent 60%)`;
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("mouseenter", handleEnter);
      cancelAnimationFrame(animId);
    };
  }, [visible]);

  return (
    <>
      {/* Spotlight glow behind everything */}
      <div
        ref={spotlightRef}
        className="pointer-events-none fixed inset-0 z-[9998]"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
      />
      {/* Custom cursor */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] hidden lg:block"
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "1.5px solid rgba(0, 229, 255, 0.8)",
          boxShadow: "0 0 12px rgba(0, 229, 255, 0.3)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s, width 0.2s, height 0.2s, border-color 0.3s",
          mixBlendMode: "screen",
        }}
      />
    </>
  );
}
