"use client";

import { useMemo, useState } from "react";
import {
  ZONAS_MANGA,
  RIESGO_META,
  ORDEN_RIESGO,
  colorDeRiesgo,
  nivelDinamicoZona,
  riesgoVivo,
  type NivelRiesgo,
  type ZonaManga,
} from "@/app/lib/zonasManga";

interface ZonasMangaPanelProps {
  nivelAguaCm: number;
  nivelMaximoCm: number;
  selectedId?: number | null;
  onSelect: (zona: ZonaManga | null) => void;
}

export default function ZonasMangaPanel({
  nivelAguaCm,
  nivelMaximoCm,
  selectedId = null,
  onSelect,
}: ZonasMangaPanelProps) {
  const [filtro, setFiltro] = useState<NivelRiesgo | "TODOS">("TODOS");
  const [busqueda, setBusqueda] = useState("");

  // Estado vivo de cada zona según la predicción
  const enVivo = useMemo(() => {
    return ZONAS_MANGA.map((z) => {
      const nivel = nivelDinamicoZona(z, nivelAguaCm, nivelMaximoCm);
      return { zona: z, nivel, riesgo: riesgoVivo(z, nivelAguaCm, nivelMaximoCm) };
    });
  }, [nivelAguaCm, nivelMaximoCm]);

  // Resumen por nivel
  const resumen = useMemo<Record<NivelRiesgo, number> & { activas: number }>(() => {
    const counts: Record<NivelRiesgo, number> = { CRITICO: 0, EMERGENCIA: 0, ALERTA: 0, NORMAL: 0 };
    enVivo.forEach((e) => { counts[e.riesgo] = (counts[e.riesgo] || 0) + 1; });
    const activas = enVivo.filter((e) => e.riesgo !== "NORMAL").length;
    return { ...counts, activas };
  }, [enVivo]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enVivo.filter((e) => {
      if (filtro !== "TODOS" && e.riesgo !== filtro) return false;
      if (q) {
        const hay = `${e.zona.id} ${e.zona.nombre} ${e.zona.ubicacion} ${e.zona.tipo_amenaza}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enVivo, filtro, busqueda]);

  function exportarCSV() {
    const header = "id,nombre,ubicacion,lat,lng,nivel_actual_cm,riesgo,amenaza,radio_m,poblacion";
    const lines = enVivo.map((e) =>
      [
        e.zona.id, `"${e.zona.nombre}"`, `"${e.zona.ubicacion}"`,
        e.zona.coordenadas[0], e.zona.coordenadas[1],
        e.nivel, e.riesgo, `"${e.zona.tipo_amenaza}"`, e.zona.radio_influencia,
        e.zona.poblacion_afectada ?? "",
      ].join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zonas_manga_riesgo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="glass-strong rounded-2xl overflow-hidden flex flex-col h-full max-h-[640px]">
      {/* Encabezado */}
      <div className="px-4 pt-4 pb-3 border-b border-cyan/10">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">Zonas de riesgo</p>
          <span className="font-display text-xs font-bold text-slate-400">{ZONAS_MANGA.length}</span>
        </div>
        <p className="font-display text-sm font-bold text-white mt-1">Zonas Críticas · Manga</p>

        {/* Buscar + Exportar */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar zona…"
              className="w-full rounded-lg bg-ocean/60 border border-cyan/15 pl-8 pr-3 py-1.5 text-[11px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan/40"
            />
          </div>
          <button
            onClick={exportarCSV}
            title="Exportar CSV"
            className="shrink-0 rounded-lg border border-cyan/20 px-2.5 hover:bg-cyan/10 transition text-cyan"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </button>
        </div>

        {/* Filtros por nivel */}
        <div className="flex gap-1.5 mt-3">
          <button
            onClick={() => setFiltro("TODOS")}
            className={`rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition ${filtro === "TODOS" ? "bg-cyan/20 text-cyan" : "text-slate-400 hover:text-cyan"}`}
          >
            Todos
          </button>
          {ORDEN_RIESGO.map((n) => (
            <button
              key={n}
              onClick={() => setFiltro(filtro === n ? "TODOS" : n)}
              className={`relative rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition ${filtro === n ? "bg-white/5" : "text-slate-400 hover:text-white"}`}
              style={filtro === n ? { color: RIESGO_META[n].color } : undefined}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: RIESGO_META[n].color }} />
              {RIESGO_META[n].label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="px-4 py-2.5 border-b border-cyan/10 grid grid-cols-5 gap-1 text-center">
        {ORDEN_RIESGO.map((n) => (
          <div key={n}>
            <p className="font-display text-sm font-bold" style={{ color: RIESGO_META[n].color }}>
              {resumen[n]}
            </p>
            <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500">{RIESGO_META[n].label}</p>
          </div>
        ))}
        <div>
          <p className="font-display text-sm font-bold text-cyan">{resumen.activas}</p>
          <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500">Activas</p>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filtradas.length === 0 && (
          <p className="text-center text-[11px] text-slate-500 py-6">No hay zonas con ese filtro.</p>
        )}
        {filtradas.map(({ zona, nivel, riesgo }) => {
          const seleccionada = selectedId === zona.id;
          return (
            <button
              key={zona.id}
              onClick={() => onSelect(seleccionada ? null : zona)}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition ${
                seleccionada ? "bg-cyan/10 ring-1 ring-cyan/40" : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: colorDeRiesgo(riesgo), boxShadow: riesgo === "CRITICO" ? "0 0 8px #B000FF" : undefined }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-500">{String(zona.id).padStart(2, "0")}.</span>
                    {zona.nombre}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {zona.ubicacion} · {zona.tipo_amenaza}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold font-tabular" style={{ color: colorDeRiesgo(riesgo) }}>
                    {nivel.toFixed(1)} cm
                  </p>
                  <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: colorDeRiesgo(riesgo) }}>
                    {RIESGO_META[riesgo].label}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
