/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          DEFAULT: "#050A0F",
          deep: "#050A0F",
          mid: "#0A1119",
          light: "#101B2E",
          surface: "#14213A",
          glow: "#00D2FF",
        },
        cyan: {
          DEFAULT: "#00D2FF",
          dim: "#00A8CC",
          bright: "#00F0FF",
          muted: "#007A99",
        },
        risk: {
          normal: "#00E5FF",
          alert: "#FFD600",
          emergency: "#FF0055",
          critical: "#B000FF",
        },
        glass: {
          bg: "rgba(255,255,255,0.03)",
          border: "rgba(0,210,255,0.15)",
          glow: "rgba(0,210,255,0.08)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        math: ["'Cambria Math'", "'Latin Modern Math'", "serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(0,210,255,0.15), 0 0 60px rgba(0,210,255,0.05)",
        "glow-strong": "0 0 30px rgba(0,210,255,0.3), 0 0 80px rgba(0,210,255,0.1)",
        "glow-red": "0 0 20px rgba(255,0,85,0.3), 0 0 60px rgba(255,0,85,0.1)",
        "neon-line": "0 0 8px rgba(0,210,255,0.6), 0 0 20px rgba(0,210,255,0.3)",
        glass: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "wave": "wave 8s ease-in-out infinite",
        "wave-slow": "wave 12s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "scan-line": "scan-line 4s linear infinite",
        "fade-in-up": "fade-in-up 0.6s ease-out",
        "glitch": "glitch 0.3s ease-in-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        wave: {
          "0%, 100%": { transform: "translateX(0) translateY(0)" },
          "25%": { transform: "translateX(-5px) translateY(2px)" },
          "50%": { transform: "translateX(0) translateY(-2px)" },
          "75%": { transform: "translateX(5px) translateY(1px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glitch: {
          "0%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 2px)" },
          "40%": { transform: "translate(-2px, -2px)" },
          "60%": { transform: "translate(2px, 2px)" },
          "80%": { transform: "translate(2px, -2px)" },
          "100%": { transform: "translate(0)" },
        },
      },
    },
  },
  plugins: [],
};
