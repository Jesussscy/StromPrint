"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import "./StormStory.css";

const StormStoryScene = dynamic(() => import("./StormStoryScene"), { ssr: false });

const chapters = [
  { number: "01 / 04", eyebrow: "CARTAGENA DE INDIAS · BARRIO MANGA", title: <>El agua cuenta<br /><em>otra historia.</em></>, description: "Un recorrido vivo por las calles, la costa y los datos que permiten anticipar una inundación.", label: "VISIÓN DEL TERRITORIO", href: "#panel-vivo", action: "Entrar al monitoreo" },
  { number: "02 / 04", eyebrow: "EL TERRITORIO", title: <>Una isla.<br /><em>Muchas señales.</em></>, description: "Manga está rodeada por la bahía. Lluvia, marea y relieve se encuentran en cada calle.", label: "COSTA + TOPOGRAFÍA", href: "#territorio", action: "Conocer Manga" },
  { number: "03 / 04", eyebrow: "LA LECTURA", title: <>De la lluvia<br /><em>a la calle.</em></>, description: "La línea temporal conecta siete días de pronóstico con zonas, niveles y evolución del agua.", label: "168 HORAS DE PROYECCIÓN", href: "#pronostico", action: "Ver los siete días" },
  { number: "04 / 04", eyebrow: "LA ACCIÓN", title: <>Ver antes.<br /><em>Actuar mejor.</em></>, description: "Explora el modelo, compara escenarios y revisa el riesgo en el centro de monitoreo.", label: "PANEL INTERACTIVO 3D", href: "#panel-vivo", action: "Abrir el panel" },
];
const shots = ["manga-wide", "manga-coast", "manga-streets", "manga-port"];

function Intro({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onFinish(); return; }
    const first = window.setTimeout(() => setPhase(1), 650);
    const second = window.setTimeout(() => setPhase(2), 1650);
    const done = window.setTimeout(onFinish, 2500);
    return () => { window.clearTimeout(first); window.clearTimeout(second); window.clearTimeout(done); };
  }, [onFinish]);
  return (
    <div className={`story-intro story-intro-phase-${phase}`} role="status" aria-label="Preparando recorrido de Manga">
      <div className="story-intro-lines" aria-hidden="true" />
      <div className="story-intro-center">
        <span className="story-intro-coordinate">10°24′ N / 75°32′ O</span>
        <div className="story-intro-mark"><span className="story-intro-ring" /><span>S</span></div>
        <span className="story-intro-word">STORMPRINT</span>
        <span className="story-intro-subtitle">MANGA, CARTAGENA · SISTEMA DE ALERTA</span>
      </div>
      <div className="story-intro-bottom"><span>PREPARANDO EL TERRITORIO</span><span className="story-intro-progress"><i /></span><span>07 DÍAS / 168 H</span></div>
      <button className="story-intro-skip" onClick={onFinish}>Saltar introducción ↗</button>
    </div>
  );
}

export default function StormStory() {
  const root = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const [intro, setIntro] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const updateMotion = () => setReducedMotion(media.matches);
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "150px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const element = root.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const length = Math.max(1, rect.height - window.innerHeight);
        const value = Math.max(0, Math.min(1, -rect.top / length));
        progress.current = value;
        setActive(Math.min(3, Math.floor(value * 4)));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  return (
    <>
      <AnimatePresence>{intro && <Intro onFinish={() => setIntro(false)} />}</AnimatePresence>
      <section ref={root} className="story" id="historia" aria-label="Recorrido por Manga">
        <div className="story-visual">
          {visible && <StormStoryScene progress={progress} reducedMotion={reducedMotion} />}
          <div className="story-visual-grade" aria-hidden="true" />
          <div className="story-scan" aria-hidden="true" />
          <div className="story-visual-caption"><span>MODELO 3D · MANGA V6.1</span><span>DESPLAZA PARA EXPLORAR ↡</span></div>
          <div className="story-progress" aria-label={`Escena ${active + 1} de 4`}><span style={{ width: `${(active + 1) * 25}%` }} /></div>
        </div>
        <div className="story-chapters">
          {chapters.map((chapter, index) => (
            <div className={`story-chapter story-chapter-${index} ${active === index ? "is-active" : ""}`} key={chapter.number}>
              <div className="story-copy">
                <div className="story-meta"><span>{chapter.eyebrow}</span><span>{chapter.number}</span></div>
                <motion.h1 initial={false} animate={{ opacity: active === index ? 1 : .55, y: active === index ? 0 : 28 }} transition={{ duration: .7 }} className="story-title">{chapter.title}</motion.h1>
                <p className="story-description">{chapter.description}</p>
                <a className="story-action" href={chapter.href}>{chapter.action}<span>↗</span></a>
              </div>
              <div className="story-frame" aria-label={`Vista del modelo de Manga: ${chapter.label.toLowerCase()}`}>
                <Image src={`/story/${shots[index]}.webp`} alt={`Modelo 3D de Manga: ${chapter.label.toLowerCase()}`} fill sizes="(max-width: 700px) 100vw, 43vw" priority={index === 0} />
                <div className="story-frame-head"><span>STORMPRINT / MANGA</span><span>{chapter.number}</span></div>
                <div className="story-frame-foot"><span>10°24′ N · 75°32′ O</span><span>MODELO CARTOGRÁFICO</span></div>
              </div>
              <div className="story-scene-index"><span>ESCENA {chapter.number.slice(0, 2)}</span><strong>{chapter.label}</strong><i /></div>
            </div>
          ))}
        </div>
      </section>
      <div className="story-marquee" aria-hidden="true"><div>{Array.from({ length: 4 }, (_, i) => <span key={i}>MANGA <b>✳</b> LLUVIA <b>✳</b> MAREA <b>✳</b> PRONÓSTICO <b>✳</b> TERRITORIO <b>✳</b> </span>)}</div></div>
    </>
  );
}
