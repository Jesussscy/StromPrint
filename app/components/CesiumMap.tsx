"use client";

import { useEffect, useRef, useState } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  ZONAS_MANGA,
  RIESGO_META,
  ORDEN_RIESGO,
  clasificarNivelCm,
  colorDeRiesgo,
  nivelDinamicoZona,
  riesgoVivo,
  type ZonaManga,
  type NivelRiesgo,
} from "@/app/lib/zonasManga";
import { riscoColorEstilo, clasificarNivel as clasificarNivelCentral } from "@/app/lib/riesgo";
import { pinTexture, radialGlowTexture } from "@/app/lib/cesiumTextures";

// Zonas territoriales (columnas de inundación base que animan con el agua).
interface ZonaTerritorio {
  id: string;
  nombre: string;
  coordenadas: [number, number][]; // [lat, lng]
  altura_maxima: number; // cm
  nivel_riesgo: "normal" | "alerta" | "emergencia" | "critico";
}

const TERRITORIO_MANGA: ZonaTerritorio[] = [
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
  nivelMaximoCm?: number;
  heatmapVisible?: boolean;
  focusZonaId?: number | null;
  onSelectZona?: (zona: ZonaManga | null) => void;
}

// Rectangulo geografico del barrio Manga, Cartagena (lat/lng bounds)
const MANGA_BOUNDS = {
  west: -75.525,
  south: 10.393,
  east: -75.508,
  north: 10.408,
};

const MANGA_CENTER = { lat: (10.393 + 10.408) / 2, lng: (-75.525 + -75.508) / 2 }; // 10.4005, -75.5165

// Margen (en grados) alrededor de Manga: el usuario puede moverse y orbitar
// dentro de esta zona sin molestias, pero si el centro de la vista sale de
// aquí, la cámara vuelve a Manga automáticamente.
const MANGA_MARGIN = 0.02;

function dentroDeMangaConMargen(longitudeDeg: number, latitudeDeg: number): boolean {
  return (
    longitudeDeg >= MANGA_BOUNDS.west - MANGA_MARGIN &&
    longitudeDeg <= MANGA_BOUNDS.east + MANGA_MARGIN &&
    latitudeDeg >= MANGA_BOUNDS.south - MANGA_MARGIN &&
    latitudeDeg <= MANGA_BOUNDS.north + MANGA_MARGIN
  );
}

// Ganancia visual: el nivel viene en cm (0-~230) y lo escalamos a metros
// visibles en 3D. Se calcula de forma ADAPTATIVA según el nivel máximo del
// escenario para que el agua siempre suba a una altura visible y dramática,
// ya sea con datos reales (máx ~30-40 cm) o ficticios (máx ~230 cm).
const PICO_ALTURA_M = 55; // altura (m) que alcanza el agua en el pico del escenario
const GANANCIA_MIN = 0.9; // factor mínimo de escala
const GANANCIA_MAX = 2.4; // factor máximo de escala
const BASE_ALTURA = 1.2; // altura mínima (m) para ver siempre las zonas en seco

export default function CesiumMap({
  nivelAguaCm = 0,
  nivelMaximoCm = 100,
  heatmapVisible = true,
  focusZonaId = null,
  onSelectZona,
}: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ viewer: any; destroy: () => void } | null>(null);
  const cesiumRef = useRef<any>(null);
  const screenSpaceHandlerRef = useRef<{ destroy: () => void } | null>(null);
  const [selectedZona, setSelectedZona] = useState<ZonaManga | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const heatmapRef = useRef<boolean>(heatmapVisible);

  useEffect(() => { heatmapRef.current = heatmapVisible; }, [heatmapVisible]);

  useEffect(() => {
    let cancelado = false;
    let handleResize: (() => void) | null = null;

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
              // Imagen satelital de alta resolución para mejor definición y
              // contraste con las zonas de riesgo (ArcGIS World Imagery).
              url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
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
        try {
          const provider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
            "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
          );
          viewer.terrainProvider = provider;
        } catch (e) {
          console.warn("Terreno 3D no disponible, usando elipsoide.", e);
        }

        // Cámara oblicua cercana que muestra el 3D y las zonas con claridad.
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 1250),
          orientation: {
            heading: Cesium.Math.toRadians(-30),
            pitch: Cesium.Math.toRadians(-48),
            roll: 0,
          },
          duration: 2,
        });

        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 250;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4500;

        // ── Recalcular el canvas cuando cambia el tamaño (movil/orientacion) ──
        handleResize = () => {
          try {
            viewer.resize();
          } catch (_e) {
            /* noop */
          }
        };
        window.addEventListener("resize", handleResize);
        handleResize();

        // ── Lock de cámara: devolver a Manga si el centro de la vista sale ──
        let lockManga = false;
        setTimeout(() => { lockManga = true; }, 2600);

        const volverAManga = () => {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 1250),
            orientation: {
              heading: Cesium.Math.toRadians(-30),
              pitch: Cesium.Math.toRadians(-48),
              roll: 0,
            },
            duration: 1.2,
          });
        };

        viewer.camera.moveEnd.addEventListener(() => {
          if (!lockManga) return;
          const centro = centroDeVista(Cesium, viewer);
          if (!centro) return;
          if (!dentroDeMangaConMargen(centro.lng, centro.lat)) {
            volverAManga();
          }
        });

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
            outlineColor: Cesium.Color.fromCssColorString("#00E5FF").withAlpha(0.55),
            outlineWidth: 2,
          },
        });

        // ── Polígonos territoriales (columnas de inundación base) ─────
        const entidadesZona: Record<string, any> = {};
        TERRITORIO_MANGA.forEach((zona) => {
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
              material: color.withAlpha(0.35),
              outline: true,
              outlineColor: color.withAlpha(0.7),
              outlineWidth: 2,
            },
            properties: {
              zonaId: zona.id,
              nombre: zona.nombre,
              alturaMaxima: zona.altura_maxima,
              nivelRiesgo: zona.nivel_riesgo,
              tipo: "territorio",
            },
          });
          entidadesZona[zona.id] = entity;
        });

        // ── Superficie global de agua (sube/baja con el nivel) ───────
        const superficieAgua = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(bordePositions),
            height: 0,
            extrudedHeight: 0.05,
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.fromCssColorString("#00A8E8").withAlpha(0.2)
            ),
            classificationType: Cesium.ClassificationType.BOTH,
          },
        });

        // ── Texturas en caché ─────────────────────────────────────────
        // Pines por nivel de riesgo
        const pinTex: Record<NivelRiesgo, any> = {} as any;
        ORDEN_RIESGO.forEach((n) => { pinTex[n] = pinTexture(RIESGO_META[n].color, 64); });
        // Glow por nivel (para la capa de calor y marcadores destacados)
        const heatTex: Record<NivelRiesgo, any> = {} as any;
        ORDEN_RIESGO.forEach((n) => { heatTex[n] = radialGlowTexture(RIESGO_META[n].color, 256, 0.5, 0.3); });

        // ── 20 Zonas críticas: marcadores + círculo de influencia + heat ──
        const zonasLayer: Record<string, any> = {};
        const influenciasLayer: Record<string, any> = {};
        const heatLayer: Record<string, any> = {};

        ZONAS_MANGA.forEach((zona) => {
          const [lat, lng] = zona.coordenadas;
          const nivelBase = zona.nivel_riesgo;
          const altura = 2 + (zona.altura_critica / 100) * 28;
          const pos = Cesium.Cartesian3.fromDegrees(lng, lat, altura);

          // Círculo de influencia (radio según zona)
          const influencia = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0.5),
            ellipse: {
              semiMajorAxis: zona.radio_influencia,
              semiMinorAxis: zona.radio_influencia,
              // height explícito para desactivar el "clamping" al terreno y
              // permitir contornos (evita el warning de outlines en terreno 3D)
              height: 0,
              material: Cesium.Color.fromCssColorString(RIESGO_META[nivelBase].color).withAlpha(0.1),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString(RIESGO_META[nivelBase].color).withAlpha(0.3),
              outlineWidth: 1,
            },
            properties: { zonaCriticaId: zona.id, tipo: "influencia" },
          });

          // Marcador (pin)
          const marker = viewer.entities.add({
            position: pos,
            billboard: {
              image: pinTex[nivelBase],
              width: 54,
              height: 70,
              color: Cesium.Color.WHITE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              heightReference: Cesium.HeightReference.NONE,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: `${zona.id}. ${zona.nombre}`,
              font: "Bold 13px Exo, sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 4,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, 12),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 4200),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            properties: { zonaCriticaId: zona.id, tipo: "marcador" },
          });

          // Capa de calor (billboard con glow radial) — apagada por defecto
          // para no saturar el mapa con halos de color; se enciende suave
          // solo cuando el usuario activa el toggle "Calor".
          const heat = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0.8),
            billboard: {
              image: heatTex[nivelBase],
              width: zona.radio_influencia * (8 + RIESGO_META[nivelBase].peso * 2.5),
              height: zona.radio_influencia * (8 + RIESGO_META[nivelBase].peso * 2.5),
              color: Cesium.Color.WHITE.withAlpha(heatmapRef.current ? 0.2 : 0.0),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            properties: { zonaCriticaId: zona.id, tipo: "heat" },
          });

          zonasLayer[zona.id] = marker;
          influenciasLayer[zona.id] = influencia;
          heatLayer[zona.id] = heat;
        });

        // ── Manejo de clic en zonas críticas ─────────────────────────
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((movement: any) => {
          const picked = viewer.scene.pick(movement.position);
          let pickedZona: ZonaManga | null = null;
          if (Cesium.defined(picked) && picked.id && picked.id.properties) {
            const zid = picked.id.properties.zonaCriticaId?.getValue();
            if (zid != null) {
              pickedZona = ZONAS_MANGA.find((z) => z.id === zid) ?? null;
            }
          }
          if (pickedZona) {
            setSelectedZona(pickedZona);
            if (onSelectZona) onSelectZona(pickedZona);
            const [lat, lng] = pickedZona.coordenadas;
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lng, lat, 900),
              duration: 1,
            });
          } else {
            setSelectedZona(null);
            if (onSelectZona) onSelectZona(null);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        if (cancelado) {
          viewer.destroy();
          return;
        }

        viewerRef.current = { viewer, destroy: () => viewer.destroy() };
        (viewerRef.current as any).entidadesZona = entidadesZona;
        (viewerRef.current as any).superficieAgua = superficieAgua;
        (viewerRef.current as any).zonasLayer = zonasLayer;
        (viewerRef.current as any).influenciasLayer = influenciasLayer;
        (viewerRef.current as any).heatLayer = heatLayer;
        (viewerRef.current as any).pinTex = pinTex;
        (viewerRef.current as any).heatTex = heatTex;
        (viewerRef.current as any).volverAMangaFn = volverAManga;
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
      if (handleResize) window.removeEventListener("resize", handleResize);
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

  // ── Animador: agua + zonas críticas en vivo ────────────────────────────
  const objetivoAguaRef = useRef(nivelAguaCm);
  const aguaActualRef = useRef(nivelAguaCm);
  const rafRef = useRef<number | null>(null);

  // Ganancia adaptativa: el pico del escenario (nivelMaximoCm) siempre se
  // representa con ~PICO_ALTURA_M metros de columna de agua, para que la
  // inundación se aprecie con claridad sin importar la magnitud real.
  const gananciaRef = useRef<number>(1);

  useEffect(() => {
    const max = Math.max(nivelMaximoCm, 4);
    const ganancia = Math.min(GANANCIA_MAX, Math.max(GANANCIA_MIN, PICO_ALTURA_M / max));
    gananciaRef.current = ganancia;
  }, [nivelMaximoCm]);

  useEffect(() => {
    objetivoAguaRef.current = nivelAguaCm;
    if (!viewerRef.current || !cesiumRef.current) return;
    if (rafRef.current) return;

    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current.viewer;
    const superficieAgua = (viewerRef.current as any).superficieAgua;
    const zonasLayer = (viewerRef.current as any).zonasLayer;
    const influenciasLayer = (viewerRef.current as any).influenciasLayer;
    const heatLayer = (viewerRef.current as any).heatLayer;
    const pinTex = (viewerRef.current as any).pinTex;
    const heatTex = (viewerRef.current as any).heatTex;
    if (!superficieAgua) return;

    const step = () => {
      rafRef.current = null;
      if (!viewerRef.current) return;
      const dif = objetivoAguaRef.current - aguaActualRef.current;
      const vel = Math.abs(dif) > 0.05 ? Math.sign(dif) * Math.max(0.5, Math.abs(dif) * 0.12) : dif;
      aguaActualRef.current += vel;

      const nivel = aguaActualRef.current;
      const colorNivel = Cesium.Color.fromCssColorString(riesgoColorHex(clasificarNivel(nivel)));

      // Columnas territoriales de inundación
      viewer.entities.values.forEach((entity: any) => {
        if (!entity.polygon || !entity.properties) return;
        if (entity.properties.tipo?.getValue?.() !== "territorio") return;
        const alturaMax = entity.properties.alturaMaxima?.getValue?.();
        const inundado = alturaMax != null && nivel >= alturaMax;
        const alturaMetros = Math.max(BASE_ALTURA, nivel * gananciaRef.current);
        entity.polygon.extrudedHeight = new Cesium.ConstantProperty(alturaMetros);
        entity.polygon.material = new Cesium.ColorMaterialProperty(
          inundado
            ? Cesium.Color.clone(colorNivel).withAlpha(0.55)
            : Cesium.Color.fromCssColorString("#00E5FF").withAlpha(0.26)
        );
      });

      // Superficie global de agua
      const aguaMetros = Math.max(0.05, nivel * gananciaRef.current);
      superficieAgua.polygon.extrudedHeight = new Cesium.ConstantProperty(aguaMetros);
      superficieAgua.polygon.material = new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString("#00A8E8").withAlpha(nivel > 0.5 ? 0.26 : 0.08)
      );

      // Zonas críticas en vivo: color/tamaño/altura según la predicción
      ZONAS_MANGA.forEach((zona) => {
        const nivelZona = nivelDinamicoZona(zona, nivel, nivelMaximoCm);
        const riesgoVivoZ = riesgoVivo(zona, nivel, nivelMaximoCm);
        const meta = RIESGO_META[riesgoVivoZ];
        const marker = zonasLayer[zona.id];
        const influencia = influenciasLayer[zona.id];
        const heat = heatLayer[zona.id];
        if (!marker) return;

        const alturaZona = 2 + (nivelZona / 100) * 50;
        marker.position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(zona.coordenadas[1], zona.coordenadas[0], alturaZona)
        );
        marker.billboard.image = pinTex[riesgoVivoZ];
        // Tamaño según jerarquía visual (crítico más grande)
        const baseSize = 50 + meta.peso * 10;
        marker.billboard.width = baseSize;
        marker.billboard.height = baseSize * 1.35;

        if (influencia) {
          influencia.ellipse.material = new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString(meta.color).withAlpha(0.22)
          );
          influencia.ellipse.outlineColor = new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString(meta.color).withAlpha(0.32)
          );
          influencia.ellipse.semiMajorAxis = new Cesium.ConstantProperty(zona.radio_influencia);
          influencia.ellipse.semiMinorAxis = new Cesium.ConstantProperty(zona.radio_influencia);
        }

        if (heat) {
          heat.billboard.image = heatTex[riesgoVivoZ];
          const heatSize = zona.radio_influencia * (8 + meta.peso * 2.5);
          heat.billboard.width = heatSize;
          heat.billboard.height = heatSize;
          heat.billboard.color = Cesium.Color.WHITE.withAlpha(heatmapRef.current ? 0.18 + meta.peso * 0.03 : 0);
        }
      });

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

  // ── Volar a una zona seleccionada desde el panel ───────────────────────
  useEffect(() => {
    if (!viewerRef.current || !cesiumRef.current || focusZonaId == null) return;
    const zona = ZONAS_MANGA.find((z) => z.id === focusZonaId);
    if (!zona) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current.viewer;
    const [lat, lng] = zona.coordenadas;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, 950),
      duration: 1.2,
    });
    setSelectedZona(zona);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusZonaId]);

  function recentrar() {
    const Viewer: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!Viewer || !Cesium) return;
    Viewer.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 1250),
      orientation: {
        heading: Cesium.Math.toRadians(-30),
        pitch: Cesium.Math.toRadians(-48),
        roll: 0,
      },
      duration: 1.2,
    });
  }

  return (
    <div className="relative w-full h-full min-h-[380px] sm:min-h-[560px]">
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

      {/* HUD — Nivel actual */}
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
        <div className="mt-2 pt-1 border-t border-cyan/10 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-risk-emergency shadow-[0_0_6px_#FF0055] animate-pulse-slow" />
          <span className="text-slate-400">20 zonas críticas</span>
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
              <span className="text-slate-500">Nivel actual: </span>
              <span
                className="font-bold font-tabular"
                style={{ color: colorDeRiesgo(riesgoVivo(selectedZona, nivelAguaCm, nivelMaximoCm)) }}
              >
                {nivelDinamicoZona(selectedZona, nivelAguaCm, nivelMaximoCm).toFixed(1)} cm
              </span>
            </p>
            <p>
              <span className="text-slate-500">Riesgo: </span>
              <span className="font-bold uppercase" style={{ color: colorDeRiesgo(riesgoVivo(selectedZona, nivelAguaCm, nivelMaximoCm)) }}>
                {riesgoVivo(selectedZona, nivelAguaCm, nivelMaximoCm)}
              </span>
            </p>
            <p>
              <span className="text-slate-500">Amenaza: </span>
              <span className="font-bold">{selectedZona.tipo_amenaza}</span>
            </p>
            <p>
              <span className="text-slate-500">Población afectada: </span>
              <span className="font-bold font-tabular">{selectedZona.poblacion_afectada ?? "—"}</span>
            </p>
            <p>
              <span className="text-slate-500">Drenaje / radio: </span>
              <span className="font-bold font-tabular">{selectedZona.radio_influencia} m</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Devuelve las coordenadas lat/lng del punto del terreno sobre el que apunta
// el centro de la pantalla (lo que el usuario está mirando).
function centroDeVista(Cesium: any, viewer: any) {
  const canvas = viewer.scene.canvas;
  if (!canvas) return null;
  const ray = viewer.camera.getPickRay(
    new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
  );
  if (!Cesium.defined(ray)) return null;
  const pick = viewer.scene.globe.pick(ray, viewer.scene);
  if (!Cesium.defined(pick)) return null;
  const carto = Cesium.Cartographic.fromCartesian(pick);
  if (!carto) return null;
  return {
    lat: Cesium.Math.toDegrees(carto.latitude),
    lng: Cesium.Math.toDegrees(carto.longitude),
  };
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
  return riscoColorEstilo(nivel);
}

function clasificarNivel(nivelCm: number): string {
  return clasificarNivelCentral(nivelCm);
}
