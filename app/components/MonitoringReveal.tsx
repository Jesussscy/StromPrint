"use client";

import { useEffect, useState } from "react";
import MapCurtain from "./MapCurtain";

export default function MonitoringReveal() {
  const [show,setShow]=useState(false);
  useEffect(()=>{
    const section=document.getElementById("panel-vivo");
    if(!section)return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const observer=new IntersectionObserver(([entry])=>{
      if(!entry.isIntersecting)return;
      observer.disconnect();
      if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
      setShow(true);
      timer=setTimeout(()=>setShow(false),1550);
    },{threshold:.08});
    observer.observe(section);
    return ()=>{observer.disconnect();if(timer)clearTimeout(timer);};
  },[]);
  return show?<MapCurtain direction="open" embedded title="SIETE DÍAS, UNA HISTORIA" subtitle="PRONÓSTICO · EVOLUCIÓN · MONITOREO"/>:null;
}
