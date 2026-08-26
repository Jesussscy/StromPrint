"use client";

export default function AquaBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Radial gradient from top center */}
      <div className="absolute inset-0 hero-gradient" />

      {/* Animated wave layers */}
      <svg className="absolute bottom-0 left-0 w-[200%] opacity-[0.04]" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="none"
          stroke="#00D2FF"
          strokeWidth="1.5"
          className="animate-wave-slow"
          d="M0,224 C360,180 720,280 1080,224 C1260,196 1350,240 1440,224 L1440,320 L0,320 Z"
        />
      </svg>
      <svg className="absolute bottom-0 left-0 w-[200%] opacity-[0.03]" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="none"
          stroke="#00D2FF"
          strokeWidth="1"
          className="animate-wave"
          d="M0,256 C480,200 960,312 1440,256 L1440,320 L0,320 Z"
        />
      </svg>

      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,210,255,0.4) 1px, transparent 0)",
        backgroundSize: "48px 48px",
      }} />

      {/* Scan line */}
      <div className="scan-line absolute inset-0" />
    </div>
  );
}
