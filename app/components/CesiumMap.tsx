"use client";

import { useEffect, useRef, useState } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Zonas de inundación del barrio Manga, Cartagena
interface ZonaInundacion {
  id: string;
  nombre: string;
  coordenadas: [number, number][]; // [lat, lng]
  altura_maxima: number; // cm
  nivel_riesgo: "normal" | "alerta" | "emergencia" | "critico";
}

const ZONAS_MANGA: ZonaInundacion[] = [
  {
    id: "manga-centro",
    nombre: "Centro de Manga",
    coordenadas: [
      [10.398, -75.518],
      [10.399, -75.517],
      [10.3985, -75.516],
      [10.3975, -75.517],
    ],
    altura_maxima: 75,
    nivel_riesgo: "emergencia",
  },
  {
    id: "manga-este",
    nombre: "Manga Este",
    coordenadas: [
      [10.3995, -75.5155],
      [10.4005, -75.5145],
      [10.4, -75.5135],
      [10.399, -75.5145],
    ],
    altura_maxima: 45,
    nivel_riesgo: "alerta",
  },
  {
    id: "manga-oeste",
    nombre: "Manga Oeste",
    coordenadas: [
      [10.397, -75.519],
      [10.398, -75.518],
      [10.3975, -75.517],
      [10.3965, -75.518],
    ],
    altura_maxima: 120,
    nivel_riesgo: "critico",
  },
  {
    id: "manga-norte",
    nombre: "Manga Norte",
    coordenadas: [
      [10.4005, -75.516],
      [10.4015, -75.515],
      [10.401, -75.514],
      [10.4, -75.515],
    ],
    altura_maxima: 20,
    nivel_riesgo: "normal",
  },
];

interface CesiumMapProps {
  nivelAguaCm?: number;
  onSelectZona?: (zona: ZonaInundacion | null) => void;
}

// Rectangulo geografico del barrio Manga, Cartagena (lat/lng bounds)
// Se usa para mantener la camara centrada EXCLUSIVAMENTE en Manga.
const MANGA_BOUNDS = {
  west: -75.525,
  south: 10.393,
  east: -75.508,
  north: 10.408,
};

// Centroide de Manga
const MANGA_CENTER = { lat: (10.393 + 10.408) / 2, lng: (-75.525 + -75.508) / 2 }; // 10.4005, -75.5165

function dentroDeManga(longitudeDeg: number, latitudeDeg: number): boolean {
  return (
    longitudeDeg >= MANGA_BOUNDS.west &&
    longitudeDeg <= MANGA_BOUNDS.east &&
    latitudeDeg >= MANGA_BOUNDS.south &&
    latitudeDeg <= MANGA_BOUNDS.north
  );
}

export default function CesiumMap({ nivelAguaCm = 0, onSelectZona }: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ viewer: any; destroy: () => void } | null>(null);
  const cesiumRef = useRef<any>(null);
  const screenSpaceHandlerRef = useRef<{ destroy: () => void } | null>(null);
  const [selectedZona, setSelectedZona] = useState<ZonaInundacion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function init() {
      if (!containerRef.current || viewerRef.current) return;

      // Import dinámico (solo cliente) para no romper el build de Next/SSR.
      // Se tipa como any: la API pública de Cesium (fromProviderAsync/fromUrl)
      // avanza más rápido que sus tipos de TypeScript.
      // CESIUM_BASE_URL global apunta a /cesium (assets copiados en public/cesium)
      // para que Cesium resuelva Workers/Assets/Widgets sin depender de Ion.
      (globalThis as any).CESIUM_BASE_URL = "/cesium";
      const Cesium: any = await import("cesium");
      if (cancelado) return;
      cesiumRef.current = Cesium;

      try {
        const viewer = new Cesium.Viewer(containerRef.current, {
          // Sin token de Ion: elipsoide + imágenes de OpenStreetMap
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            Cesium.UrlTemplateImageryProvider.fromUrl(
              "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
              { subdomains: ["a", "b", "c"], maximumLevel: 19 }
            )
          ),
          baseLayerPicker: false,
          timeline: false,
          animation: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: document.createElement("div"),
        });

        viewer.scene.globe.enableLighting = false;

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 900),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
        });

        // Mantener la camara dentro de Manga (no permitir alejarse a otra parte de Cartagena)
        let clampManga = false;
        const cameraChanged = () => {
          if (!clampManga) return;
          const carto = viewer.camera.positionCartographic;
          if (!Cesium.defined(carto)) return;
          if (!dentroDeManga(Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude))) {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 900),
              orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0,
              },
            });
          }
        };
        viewer.camera.changed.addEventListener(cameraChanged);
        setTimeout(() => {
          clampManga = true;
        }, 3000);

        // Polígonos extrúidos por zona
        const entidadesZona: Record<string, any> = {};
        ZONAS_MANGA.forEach((zona) => {
          const positions = zona.coordenadas.map(([lat, lng]) =>
            Cesium.Cartesian3.fromDegrees(lng, lat, 0)
          );
          const color = cesiumRiskColor(Cesium, zona.nivel_riesgo);
          const alturaMetros = Math.max(2, zona.altura_maxima / 100);

          const entity = viewer.entities.add({
            name: zona.nombre,
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions),
              height: 0,
              extrudedHeight: alturaMetros,
              material: color.withAlpha(0.55),
              outline: true,
              outlineColor: color,
              outlineWidth: 2,
            },
            properties: {
              zonaId: zona.id,
              nombre: zona.nombre,
              alturaMaxima: zona.altura_maxima,
              nivelRiesgo: zona.nivel_riesgo,
            },
          });
          entidadesZona[zona.id] = entity;

          // Etiqueta centrada
          const centro = calcularCentro(zona.coordenadas);
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(centro[1], centro[0], alturaMetros + 2),
            label: {
              text: `${zona.nombre}\n${zona.altura_maxima} cm`,
              font: "14px sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -10),
            },
          });
        });

        // Manejo de clic correcto (ScreenSpaceEventHandler + pick)
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((movement: any) => {
          const picked = viewer.scene.pick(movement.position);
          let zonaSel: ZonaInundacion | null = null;
          if (Cesium.defined(picked) && picked.id && picked.id.properties) {
            const zonaId = picked.id.properties.zonaId?.getValue();
            zonaSel = ZONAS_MANGA.find((z) => z.id === zonaId) ?? null;
          }
          setSelectedZona(zonaSel);
          if (onSelectZona) onSelectZona(zonaSel);
          if (zonaSel) {
            const centro = calcularCentro(zonaSel.coordenadas);
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(centro[1], centro[0], 600),
              duration: 1,
            });
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        if (cancelado) {
          viewer.destroy();
          return;
        }

        viewerRef.current = { viewer, destroy: () => viewer.destroy() };
        screenSpaceHandlerRef.current = handler;
        setCargando(false);
      } catch (err) {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    init();

    return () => {
      cancelado = true;
      if (screenSpaceHandlerRef.current) {
        screenSpaceHandlerRef.current.destroy();
        screenSpaceHandlerRef.current = null;
      }
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflejar el nivel de agua actual en los polígonos
  useEffect(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current.viewer;
    viewer.entities.values.forEach((entity: any) => {
      if (entity.polygon && entity.properties && entity.properties.alturaMaxima) {
        const alturaMax = entity.properties.alturaMaxima.getValue();
        const inundado = nivelAguaCm >= alturaMax;
        entity.polygon.material = inundado
          ? Cesium.Color.RED.withAlpha(0.7)
          : Cesium.Color.GREEN.withAlpha(0.35);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivelAguaCm]);

  return (
    <div className="relative w-full h-full min-h-[520px]">
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />

      {/* HUD — Nivel actual de lluvia/inundación en Manga */}
      <div className="absolute top-3 left-3 z-10 glass rounded-xl px-4 py-3 text-white">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          Barrio Manga · Cartagena
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold leading-none">
            {nivelAguaCm.toFixed(1)}
          </span>
          <span className="text-xs text-slate-300">cm nivel actual</span>
        </div>
        <p
          className="mt-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ color: riesgoColorHex(clasificarNivel(nivelAguaCm)) }}
        >
          {clasificarNivel(nivelAguaCm)}
        </p>
      </div>

      {/* Leyenda */}
      <div className="absolute bottom-4 right-4 z-10 glass rounded-xl p-4 text-xs text-white">
        <p className="font-display font-bold text-cyan mb-2">Nivel de Riesgo</p>
        {[
          { c: "#FF0055", l: "Crítico (≥100 cm)" },
          { c: "#FF7700", l: "Emergencia (60-99 cm)" },
          { c: "#F3F300", l: "Alerta (30-59 cm)" },
          { c: "#00FF55", l: "Normal (<30 cm)" },
        ].map((r) => (
          <div key={r.l} className="flex items-center gap-2 mb-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: r.c }} />
            <span className="text-slate-300">{r.l}</span>
          </div>
        ))}
      </div>

      {/* Info de zona seleccionada */}
      {selectedZona && (
        <div className="absolute bottom-4 left-4 z-10 glass rounded-xl p-4 max-w-xs">
          <p className="font-display font-bold text-sm text-white">{selectedZona.nombre}</p>
          <p className="text-xs text-slate-300 mt-1">
            Altura riesgo: {selectedZona.altura_maxima} cm
          </p>
          <p
            className="text-xs font-bold mt-1"
            style={{ color: riesgoColorHex(selectedZona.nivel_riesgo) }}
          >
            {selectedZona.nivel_riesgo.toUpperCase()}
          </p>
        </div>
      )}

      {cargando && (
        <div className="absolute inset-0 z-10 flex items-center justify-center glass bg-ocean/40">
          <span className="font-mono text-xs text-cyan">Cargando visor Cesium…</span>
        </div>
      )}
    </div>
  );
}

function calcularCentro(coords: [number, number][]) {
  const lat = coords.reduce((s, [la]) => s + la, 0) / coords.length;
  const lng = coords.reduce((s, [, lo]) => s + lo, 0) / coords.length;
  return [lat, lng];
}

function cesiumRiskColor(Cesium: any, nivel: string) {
  switch (nivel) {
    case "critico":
      return Cesium.Color.RED;
    case "emergencia":
      return Cesium.Color.ORANGE;
    case "alerta":
      return Cesium.Color.YELLOW;
    default:
      return Cesium.Color.GREEN;
  }
}

function riesgoColorHex(nivel: string) {
  switch (nivel) {
    case "critico":
      return "#FF0055";
    case "emergencia":
      return "#FF7700";
    case "alerta":
      return "#F3F300";
    default:
      return "#00FF55";
  }
}

function clasificarNivel(nivelCm: number): string {
  if (nivelCm >= 100) return "Critico";
  if (nivelCm >= 60) return "Emergencia";
  if (nivelCm >= 30) return "Alerta";
  return "Normal";
}
