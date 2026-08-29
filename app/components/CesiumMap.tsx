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

// Puntos de mayor riesgo de inundación dentro de Manga
const PUNTOS_RIESGO: { lat: number; lng: number; nombre: string; alturaRefer: number }[] = [
  { lat: 10.3999, lng: -75.5159, nombre: "Callejón del Muelle", alturaRefer: 15 },
  { lat: 10.4003, lng: -75.5152, nombre: "Av. Santander", alturaRefer: 18 },
  { lat: 10.3988, lng: -75.5172, nombre: "Plaza Principal", alturaRefer: 25 },
  { lat: 10.3991, lng: -75.5161, nombre: "Malecón", alturaRefer: 30 },
  { lat: 10.3979, lng: -75.5183, nombre: "Costanera Oeste", alturaRefer: 12 },
  { lat: 10.3971, lng: -75.5186, nombre: "Bocana Sur", alturaRefer: 22 },
];

interface CesiumMapProps {
  nivelAguaCm?: number;
  onSelectZona?: (zona: ZonaInundacion | null) => void;
}

// Rectangulo geografico del barrio Manga, Cartagena (lat/lng bounds)
const MANGA_BOUNDS = {
  west: -75.525,
  south: 10.393,
  east: -75.508,
  north: 10.408,
};

const MANGA_CENTER = { lat: (10.393 + 10.408) / 2, lng: (-75.525 + -75.508) / 2 }; // 10.4005, -75.5165

// Ganancia visual: el nivel viene en cm (0-~130) y lo escalamos a metros
// visibles en 3D para que la subida del agua se aprecie claramente.
const VISUAL_GAIN = 0.6; // 100 cm -> 60 m; 30 cm -> 18 m
const BASE_ALTURA = 0.8; // altura mínima para ver siempre las zonas en seco

export default function CesiumMap({ nivelAguaCm = 0, onSelectZona }: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ viewer: any; destroy: () => void } | null>(null);
  const cesiumRef = useRef<any>(null);
  const screenSpaceHandlerRef = useRef<{ destroy: () => void } | null>(null);
  const [selectedZona, setSelectedZona] = useState<ZonaInundacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function init() {
      if (!containerRef.current || viewerRef.current) return;

      (globalThis as any).CESIUM_BASE_URL = "/cesium";
      const Cesium: any = await import("cesium");
      if (cancelado) return;
      cesiumRef.current = Cesium;

      try {
        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            new Cesium.UrlTemplateImageryProvider({
              url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
              subdomains: ["a", "b", "c"],
              maximumLevel: 19,
            })
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

        // Iluminación + atmósfera para un look 3D rico
        viewer.scene.globe.enableLighting = true;
        viewer.scene.highDynamicRange = true;
        viewer.scene.globe.depthTestAgainstTerrain = false;

        // Terreno 3D real (ArcGIS World Elevation, sin token de Ion).
        // Si falla, seguimos con el elipsoide por defecto (no rompe el mapa).
        try {
          const provider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
            "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
          );
          viewer.terrainProvider = provider;
        } catch (e) {
          console.warn("Terreno 3D no disponible, usando elipsoide.", e);
        }

        // Cámara oblicua que muestra el 3D
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 1400),
          orientation: {
            heading: Cesium.Math.toRadians(-20),
            pitch: Cesium.Math.toRadians(-32),
            roll: 0,
          },
        });

        // Permitir órbita/zoom/pan libre (controles por defecto de Cesium) —
        // ya no se "bloquea" la cámara, el usuario puede moverse por Manga.
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 250;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4000;

        // ── Borde / delimitación de Manga ─────────────────────────────
        const bordePositions = [
          Cesium.Cartesian3.fromDegrees(MANGA_BOUNDS.west, MANGA_BOUNDS.south, 0),
          Cesium.Cartesian3.fromDegrees(MANGA_BOUNDS.east, MANGA_BOUNDS.south, 0),
          Cesium.Cartesian3.fromDegrees(MANGA_BOUNDS.east, MANGA_BOUNDS.north, 0),
          Cesium.Cartesian3.fromDegrees(MANGA_BOUNDS.west, MANGA_BOUNDS.north, 0),
        ];
        viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(bordePositions),
            height: 0,
            extrudedHeight: 0.12,
            material: Cesium.Color.fromCssColorString("#00E5FF").withAlpha(0.05),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#00E5FF").withAlpha(0.9),
            outlineWidth: 3,
          },
        });

        // ── Polígonos extrúidos por zona (columnas de inundación) ────
        const entidadesZona: Record<string, any> = {};
        ZONAS_MANGA.forEach((zona) => {
          const positions = zona.coordenadas.map(([lat, lng]) =>
            Cesium.Cartesian3.fromDegrees(lng, lat, 0)
          );
          const color = cesiumRiskColor(Cesium, zona.nivel_riesgo);

          const entity = viewer.entities.add({
            name: zona.nombre,
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions),
              height: 0,
              extrudedHeight: BASE_ALTURA,
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

          const centro = calcularCentro(zona.coordenadas);
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(centro[1], centro[0], BASE_ALTURA + 2),
            label: {
              text: `${zona.nombre}`,
              font: "13px Exo, sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -8),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 4000),
            },
          });
        });

        // ── Superficie global de agua (sube/baja con el nivel) ───────
        const superficieAgua = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(bordePositions),
            height: 0,
            extrudedHeight: 0.05,
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.fromCssColorString("#00A8E8").withAlpha(0.35)
            ),
            classificationType: Cesium.ClassificationType.BOTH,
          },
        });

        // ── Puntos con mayor riesgo de inundación ─────────────────────
        PUNTOS_RIESGO.forEach((p) => {
          const alturaPunto = Math.max(2, (p.alturaRefer / 100) * 60);
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, alturaPunto),
            point: {
              pixelSize: 9,
              color: Cesium.Color.fromCssColorString("#FF0055"),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.NONE,
            },
            label: {
              text: p.nombre,
              font: "11px Exo, sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -14),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(50, 4000),
            },
          });
        });

        // ── Manejo de clic en las zonas ───────────────────────────────
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
              destination: Cesium.Cartesian3.fromDegrees(centro[1], centro[0], 900),
              duration: 1,
            });
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        if (cancelado) {
          viewer.destroy();
          return;
        }

        viewerRef.current = { viewer, destroy: () => viewer.destroy() };
        // Guardar referencias para el animador de nivel de agua
        (viewerRef.current as any).entidadesZona = entidadesZona;
        (viewerRef.current as any).superficieAgua = superficieAgua;
        screenSpaceHandlerRef.current = handler;
        setCargando(false);
      } catch (err) {
        if (!cancelado) {
          setCargando(false);
          setError(err instanceof Error ? err.message : String(err));
          console.error("CesiumMap init error:", err);
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

  // ── Animador suave del nivel de agua (sube/baja con transición) ─────
  // Objetivo + valor interpolado para que el cambio se note con fluidez.
  const objetivoAguaRef = useRef(nivelAguaCm);
  const aguaActualRef = useRef(nivelAguaCm);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    objetivoAguaRef.current = nivelAguaCm;
    // El visor aún no está listo; el raf arranca cuando cargue.
    if (!viewerRef.current || !cesiumRef.current) return;
    // Si ya hay un bucle corriendo, sólo actualizamos el objetivo.
    if (rafRef.current) return;

    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current.viewer;
    const superficieAgua = (viewerRef.current as any).superficieAgua;
    if (!superficieAgua) return;

    const step = () => {
      rafRef.current = null;
      if (!viewerRef.current) return;
      const dif = objetivoAguaRef.current - aguaActualRef.current;
      const vel = Math.abs(dif) > 0.05 ? Math.sign(dif) * Math.max(0.5, Math.abs(dif) * 0.12) : dif;
      aguaActualRef.current += vel;

      const nivel = aguaActualRef.current;
      const colorNivel = Cesium.Color.fromCssColorString(riesgoColorHex(clasificarNivel(nivel)));

      viewer.entities.values.forEach((entity: any) => {
        if (!entity.polygon || !entity.properties) return;
        const alturaMax = entity.properties.alturaMaxima?.getValue?.();
        const inundado = alturaMax != null && nivel >= alturaMax;
        const alturaMetros = Math.max(BASE_ALTURA, nivel * VISUAL_GAIN);
        entity.polygon.extrudedHeight = new Cesium.ConstantProperty(alturaMetros);
        entity.polygon.material = new Cesium.ColorMaterialProperty(
          inundado
            ? Cesium.Color.clone(colorNivel).withAlpha(0.75)
            : Cesium.Color.fromCssColorString("#00E5FF").withAlpha(0.5)
        );
      });

      const aguaMetros = Math.max(0.05, nivel * VISUAL_GAIN);
      superficieAgua.polygon.extrudedHeight = new Cesium.ConstantProperty(aguaMetros);
      superficieAgua.polygon.material = new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString("#00A8E8").withAlpha(nivel > 0.5 ? 0.4 : 0.1)
      );

      if (Math.abs(objetivoAguaRef.current - aguaActualRef.current) > 0.05) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        aguaActualRef.current = objetivoAguaRef.current;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivelAguaCm, cargando]);

  // Re-centrar la cámara en Manga (botón manual, el usuario puede moverse libre)
  function recentrar() {
    const Viewer: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!Viewer || !Cesium) return;
    Viewer.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 1400),
      orientation: {
        heading: Cesium.Math.toRadians(-20),
        pitch: Cesium.Math.toRadians(-32),
        roll: 0,
      },
      duration: 1.2,
    });
  }

  return (
    <div className="relative w-full h-full min-h-[520px]">
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />

      {/* Cargando */}
      {cargando && !error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ocean-deep">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan">Cargando modelo 3D…</p>
          </div>
        </div>
      )}

      {/* Error del mapa */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-ocean-deep px-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-risk-emergency mb-2">No se pudo cargar el mapa 3D</p>
          <p className="max-w-md text-xs text-slate-400">{error}</p>
        </div>
      )}

      {/* Botón re-centrar en Manga */}
      {!cargando && !error && (
        <button
          onClick={recentrar}
          className="absolute top-3 right-3 z-10 glass rounded-lg px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 transition flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          Manga
        </button>
      )}

      {/* HUD — Nivel actual de lluvia/inundación en Manga */}
      <div className="absolute top-3 left-3 z-10 glass rounded-xl px-4 py-3 text-white">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          Barrio Manga · Cartagena
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold leading-none">
            {nivelAguaCm.toFixed(1)}
          </span>
          <span className="text-xs text-slate-300">cm</span>
        </div>
        <p
          className="mt-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ color: riesgoColorHex(clasificarNivel(nivelAguaCm)) }}
        >
          {clasificarNivel(nivelAguaCm)}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">Arrastrá para girar · scroll para acercar</p>
      </div>

      {/* Leyenda */}
      <div className="absolute bottom-4 right-4 z-10 glass rounded-xl p-4 text-xs text-white">
        <p className="font-display font-bold text-cyan mb-2">Nivel de Riesgo</p>
        {[
          { c: "#B000FF", l: "Crítico (≥100 cm)" },
          { c: "#FF0055", l: "Emergencia (60-99 cm)" },
          { c: "#FFD600", l: "Alerta (30-59 cm)" },
          { c: "#00E5FF", l: "Normal (<30 cm)" },
        ].map((r) => (
          <div key={r.l} className="flex items-center gap-2 mb-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: r.c }} />
            <span className="text-slate-300">{r.l}</span>
          </div>
        ))}
        <div className="mt-1 pt-1 border-t border-cyan/10 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#FF0055" }} />
          <span className="text-slate-400">Punto de inundación</span>
        </div>
      </div>

      {/* Info de zona seleccionada */}
      {selectedZona && (
        <div className="absolute bottom-4 left-4 z-10 glass rounded-xl p-4 max-w-xs">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display font-bold text-sm text-white">{selectedZona.nombre}</p>
            <button
              onClick={() => { setSelectedZona(null); if (onSelectZona) onSelectZona(null); }}
              aria-label="Cerrar detalle"
              className="text-slate-500 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className="mt-2 space-y-1.5 text-xs text-slate-300">
            <p>
              <span className="text-slate-500">Altura umbral: </span>
              <span className="font-bold font-tabular">{selectedZona.altura_maxima} cm</span>
            </p>
            <p>
              <span className="text-slate-500">Riesgo: </span>
              <span className="font-bold uppercase" style={{ color: riesgoColorHex(selectedZona.nivel_riesgo) }}>
                {selectedZona.nivel_riesgo}
              </span>
            </p>
            <p>
              <span className="text-slate-500">Viviendas afectadas: </span>
              <span className="font-bold font-tabular">
                {viviendasAfectadas(selectedZona.nivel_riesgo)}
              </span>
            </p>
            <p>
              <span className="text-slate-500">Evacuación recomendada: </span>
              <span
                className="font-bold"
                style={{ color: requiereEvacuacion(selectedZona.nivel_riesgo) ? "#FF0055" : "#00E5FF" }}
              >
                {requiereEvacuacion(selectedZona.nivel_riesgo) ? (
                  <><svg className="inline-block mr-1 -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>SÍ</>
                ) : (
                  <><svg className="inline-block mr-1 -mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF0055" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>No</>
                )}
              </span>
            </p>
          </div>
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
      return Cesium.Color.fromCssColorString("#B000FF");
    case "emergencia":
      return Cesium.Color.fromCssColorString("#FF0055");
    case "alerta":
      return Cesium.Color.fromCssColorString("#FFD600");
    default:
      return Cesium.Color.fromCssColorString("#00E5FF");
  }
}

function riesgoColorHex(nivel: string) {
  switch (nivel.toLowerCase()) {
    case "critico":
    case "critical":
      return "#B000FF";
    case "emergencia":
    case "high":
      return "#FF0055";
    case "alerta":
    case "moderate":
      return "#FFD600";
    default:
      return "#00E5FF";
  }
}

function clasificarNivel(nivelCm: number): string {
  if (nivelCm >= 100) return "Critico";
  if (nivelCm >= 60) return "Emergencia";
  if (nivelCm >= 30) return "Alerta";
  return "Normal";
}

function viviendasAfectadas(nivel: string): number {
  switch (nivel) {
    case "critico": return 320;
    case "emergencia": return 145;
    case "alerta": return 62;
    default: return 12;
  }
}

function requiereEvacuacion(nivel: string): boolean {
  return nivel === "critico" || nivel === "emergencia";
}
