"use client";
import { RIESGO_META, type ZonaManga, type ZonaViva } from "@/app/lib/zonasManga";
interface Props {zona:ZonaManga|null;nivelAguaCm:number;nivelMaximoCm:number;zonasVivas?:Map<number,ZonaViva>;horaLocal:number;onClose:()=>void}
/** Zone summary only. The geographic model and water live in MangaMap. */
export default function ZonaFlood3D({zona,zonasVivas,onClose}:Props){
 if(!zona)return null;const live=zonasVivas?.get(zona.id);
 return <section className="glass-strong rounded-2xl p-5 flex items-start justify-between gap-4" aria-label="Detalle de zona"><div><p className="text-xs text-cyan mb-2">REFERENCIA DEL MODELO ZONAL</p><h3 className="text-lg font-semibold">{zona.nombre}</h3><p className="text-sm text-slate-300 mt-2">{live?`${live.nivel.toFixed(1)} cm · ${RIESGO_META[live.riesgo].label}`:"Sin predicción zonal disponible"}</p><p className="text-xs text-slate-400 mt-2">La selección se muestra en el mapa principal cuando la coordenada pertenece a Manga. El nivel zonal no equivale a la profundidad espacial en un edificio.</p></div><button className="min-h-[44px] min-w-[44px] text-slate-300" aria-label="Cerrar detalle de zona" onClick={onClose}>×</button></section>;
}
