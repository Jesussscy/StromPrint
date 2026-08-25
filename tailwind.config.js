/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        abyss: "#080C14",
        "abyss-2": "#0D1420",
        "abyss-3": "#111B2C",
        cyan: {
          DEFAULT: "#00F3FF",
          dim: "#00B8C4",
          glow: "rgba(0, 243, 255, 0.35)",
        },
        warn: {
          DEFAULT: "#FF7700",
          glow: "rgba(255, 119, 0, 0.35)",
        },
        critical: {
          DEFAULT: "#FF0055",
          glow: "rgba(255, 0, 85, 0.4)",
        },
        mist: "#7C8BA1",
        fog: "#B8C4D6",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glow-cyan": "0 0 24px rgba(0, 243, 255, 0.25)",
        "glow-warn": "0 0 24px rgba(255, 119, 0, 0.25)",
        "glow-critical": "0 0 28px rgba(255, 0, 85, 0.35)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.45)",
      },
      animation: {
        "pulse-slow": "pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scan: "scan 4s linear infinite",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};
