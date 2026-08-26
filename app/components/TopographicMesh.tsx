"use client";

import { useEffect, useRef } from "react";

export default function TopographicMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let time = 0;
    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.003;

      const lines = 14;
      const w = canvas.width;
      const h = canvas.height;

      for (let i = 0; i < lines; i++) {
        const yBase = (h / (lines + 1)) * (i + 1);
        ctx.beginPath();

        for (let x = 0; x <= w; x += 4) {
          const nx = x / w;
          const wave1 = Math.sin(nx * 4 + time + i * 0.5) * 18;
          const wave2 = Math.sin(nx * 7 - time * 0.7 + i * 0.3) * 10;
          const wave3 = Math.cos(nx * 2.5 + time * 0.5) * 8;
          const y = yBase + wave1 + wave2 + wave3;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const alpha = 0.04 + Math.sin(time + i * 0.4) * 0.015;
        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Radial glow in center
      const gradient = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, w * 0.4);
      gradient.addColorStop(0, `rgba(0, 229, 255, ${0.04 + Math.sin(time * 0.8) * 0.015})`);
      gradient.addColorStop(0.5, "rgba(0, 229, 255, 0.01)");
      gradient.addColorStop(1, "rgba(0, 229, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
    />
  );
}
