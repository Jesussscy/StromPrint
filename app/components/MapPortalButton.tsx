"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CloudRain, MapPinned } from "lucide-react";
import MapCurtain from "./MapCurtain";
import "./MapPortalButton.css";

export default function MapPortalButton() {
  const router=useRouter();
  const [entering,setEntering]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const open=()=>{
    if(entering)return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){router.push("/manga-3d");return;}
    setEntering(true);
    timer.current=setTimeout(()=>router.push("/manga-3d"),760);
  };
  return <>
    <div className="map-portal">
      <div className="map-portal__mark" aria-hidden="true"><MapPinned size={27}/><span/></div>
      <div className="map-portal__copy"><span>EXPERIENCIA INTERACTIVA · MANGA</span><strong>Entra al territorio.</strong><p>Recorre la isla, observa la costa y simula lluvia sobre sus calles.</p></div>
      <button type="button" onClick={open} aria-label="Entrar al mapa 3D de Manga"><CloudRain size={22}/><span>Entrar al mapa 3D</span><ArrowUpRight size={19}/></button>
    </div>
    {entering&&<MapCurtain direction="close"/>}
  </>;
}
