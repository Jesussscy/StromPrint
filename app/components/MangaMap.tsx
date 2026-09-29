"use client";
import MangaRender from "./MangaRender";
import type { ZonaManga, ZonaViva } from "@/app/lib/zonasManga";
import type { MeteorologiaResumen, PuntoPrediccion, WaterStateResponse, SpatialForcing } from "@/app/lib/api";
export interface MangaMapProps {
  nivelAguaCm?: number; nivelMaximoCm?: number; zonasVivas?: Map<number,ZonaViva>;
  focusZonaId?: number|null; onSelectZona?: (zona:ZonaManga|null)=>void; horaLocal?: number;
  puntoMeteo?: {lluvia_mm_h?:number;marea_cm?:number;estado?:PuntoPrediccion['estado'];nivel_agua_cm?:number}|null;
  meteorologia?: MeteorologiaResumen|null; liveWater?: WaterStateResponse|null; liveLatenciaMs?:number|null;
  forecastPoints?: PuntoPrediccion[]; currentHour?:number; sourceLabel?:string;
  spatialForcing?: SpatialForcing|null; isPlaying?:boolean;
  standalone?:boolean; onReady?:()=>void;
}
export default function MangaMap(props: MangaMapProps) { return <MangaRender {...props} />; }
