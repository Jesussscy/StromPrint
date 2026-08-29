"use client";

const ITEMS = [
  { href: "#panel-vivo", label: "Panel" },
  { href: "#meteo", label: "Clima" },
  { href: "#notificaciones", label: "Alertas" },
  { href: "#historial", label: "Historial" },
  { href: "#datos", label: "Datos" },
];

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
  );
}
function IconWeather() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 18a5 5 0 0 0-10 0" /><path d="M12 9V2m0 0l-3 3m3-3l3 3" /><line x1="4.22" y1="12.22" x2="5.64" y2="13.64" /><line x1="18.36" y1="13.64" x2="19.78" y2="12.22" /></svg>
  );
}
function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
  );
}
function IconHistory() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>
  );
}
function IconSat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" /></svg>
  );
}

const ICONS = [IconChart, IconWeather, IconBell, IconHistory, IconSat];

export default function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1900] border-t border-cyan/15 bg-ocean-deep/90 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map((item, i) => {
          const Icon = ICONS[i];
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-2.5 text-slate-500 hover:text-cyan transition-colors"
            >
              <span className="text-cyan/80"><Icon /></span>
              <span className="font-mono text-[9px] uppercase tracking-wider">{item.label}</span>
            </a>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
