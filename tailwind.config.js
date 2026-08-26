/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0B132B",
          light: "#1C2B4A",
          lighter: "#243B5E",
        },
        primary: "#1D3557",
        accent: "#00B4D8",
        "accent-bright": "#00F3FF",
        surface: "#F8F9FA",
        "surface-dark": "#0B132B",
        risk: {
          normal: "#2A9D8F",
          alerta: "#E9C46A",
          emergencia: "#E63946",
          critico: "#7B2CBF",
        },
        mist: "#94A3B8",
        fog: "#E2E8F0",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.12)",
        "glass-dark": "0 8px 32px rgba(0, 0, 0, 0.45)",
        glow: "0 0 40px rgba(0, 180, 216, 0.15)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
