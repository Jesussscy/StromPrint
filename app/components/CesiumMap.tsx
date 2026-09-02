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
import { pinTexture, waterTexture, heatmapTexture } from "@/app/lib/cesiumTextures";

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
  horaLocal?: number;
  stormMode?: boolean;
  puntoMeteo?: { lluvia_mm_h?: number; marea_cm?: number } | null;
  meteorologia?: import("@/app/lib/api").MeteorologiaResumen | null;
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

// Preferencia del usuario: si prefiere menos movimiento, los vuelos de cámara
// se hacen instantáneos (duración ~0) para respetar prefers-reduced-motion.
// Los atajos/acciones no bloqueadas (render) siguen funcionando igual.
function duracionVuelo(fly = 1): number {
  return prefiereReducirMovimiento() ? 0 : fly;
}

function prefiereReducirMovimiento(): boolean {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_e) {
    return false;
  }
}

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
  horaLocal = 12,
  stormMode = false,
  puntoMeteo = null,
  meteorologia = null,
}: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ viewer: any; destroy: () => void } | null>(null);
  const cesiumRef = useRef<any>(null);
  const screenSpaceHandlerRef = useRef<{ destroy: () => void } | null>(null);
  const hoverHandlerRef = useRef<{ destroy: () => void } | null>(null);
  const medicionHandlerRef = useRef<{ destroy: () => void } | null>(null);
  const [selectedZona, setSelectedZona] = useState<ZonaManga | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const heatmapRef = useRef<boolean>(heatmapVisible);
  const horaLocalRef = useRef<number>(horaLocal);
  const stormRef = useRef<boolean>(stormMode);
  const fpsCountRef = useRef(0);
  const [fps, setFps] = useState(0);

  useEffect(() => { heatmapRef.current = heatmapVisible; }, [heatmapVisible]);
  useEffect(() => { horaLocalRef.current = horaLocal; }, [horaLocal]);
  useEffect(() => { stormRef.current = stormMode; }, [stormMode]);

  // Control de capas y base mapas (mapa interno; el toggle "Calor" lo maneja
  // el panel padre vía prop heatmapVisible).
  const [baseMapa, setBaseMapa] = useState<"sate" | "oscuro" | "hibrido">("sate");
  const [capas, setCapas] = useState({ zonas: true, agua: true, etiquetas: true });
  const [panelCapas, setPanelCapas] = useState(false);
  const brújulaRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const selectedZonaRef = useRef<ZonaManga | null>(null);
  const onSelectZonaRef = useRef(onSelectZona);
  const nivelMaximoRef = useRef(nivelMaximoCm);
  const anilloActivoRef = useRef(false);
  const midiendoRef = useRef(false);
  const rutaRef = useRef<{ lng: number; lat: number }[]>([]);
  const rutaLineaRef = useRef<any>(null);
  const rutaPuntosRef = useRef<any>(null);
  const [midiendo, setMidiendo] = useState(false);
  const [distanciaRuta, setDistanciaRuta] = useState<number | null>(null);
  const [relojCartagena, setRelojCartagena] = useState("--:--");

  useEffect(() => { onSelectZonaRef.current = onSelectZona; }, [onSelectZona]);
  useEffect(() => { nivelMaximoRef.current = nivelMaximoCm; }, [nivelMaximoCm]);
  useEffect(() => { midiendoRef.current = midiendo; }, [midiendo]);

  // Reloj en hora local de Cartagena (UTC-5) para el HUD del visor.
  useEffect(() => {
    const t = window.setInterval(() => {
      try {
        setRelojCartagena(
          new Intl.DateTimeFormat("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "America/Bogota",
          }).format(new Date())
        );
      } catch (_e) {
        setRelojCartagena("");
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

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
          // Render bajo demanda: Cesium solo dibuja cuando algo cambia
          // (animador o interacción), no en bucle continuo. Ahorra GPU/CPU
          // cuando el visor está estático.
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        });

        // Iluminación + atmósfera para un look 3D rico
        viewer.scene.globe.enableLighting = true;
        viewer.scene.highDynamicRange = true;
        viewer.scene.globe.depthTestAgainstTerrain = false;

        // Resolución recomendada del navegador (limita el DPR efectivo en
        // móviles y displays de alta densidad sin sacrificar nitidez).
        viewer.useBrowserRecommendedResolution = true;

        // Atmósfera + niebla: profundidad visual sutil acorde al tema
        // Cyber-Hydro (espacio más oscuro, glacé terroso en el horizonte).
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.00035;
        viewer.scene.skyAtmosphere.hueShift = -0.08;
        viewer.scene.skyAtmosphere.saturationShift = -0.15;
        viewer.scene.skyAtmosphere.brightnessShift = -0.2;
        viewer.scene.globe.showGroundAtmosphere = true;

        // Brújula HUD: refleja el heading de la cámara (puntero arriba = norte).
        const actualizarBrújula = () => {
          if (brújulaRef.current) {
            const deg = Cesium.Math.toDegrees(viewer.camera.heading);
            brújulaRef.current.style.transform = `rotate(${(-deg).toFixed(0)}deg)`;
            const etiqueta = brújulaRef.current.nextElementSibling as HTMLElement | null;
            if (etiqueta) etiqueta.textContent = `${deg.toFixed(0)}°`;
          }
        };
        viewer.camera.changed.addEventListener(actualizarBrújula);

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
          duration: duracionVuelo(2),
        });

        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 250;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4500;

        // ── Recalcular el canvas cuando cambia el tamaño (movil/orientacion) ──
        handleResize = () => {
          try {
            viewer.resize();
            viewer.scene.requestRender();
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
            duration: duracionVuelo(1.2),
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
        // Las propiedades de altura/material se crean UNA vez y se mutan con
        // .setValue() en el animador para no alocar objetos en cada frame.
        const entidadesZona: Record<string, any> = {};
        const propsTerritorio: Record<string, { prop: any; mat: any; alturaMaxima: number }> = {};
        TERRITORIO_MANGA.forEach((zona) => {
          const positions = zona.coordenadas.map(([lat, lng]) =>
            Cesium.Cartesian3.fromDegrees(lng, lat, 0)
          );
          const color = cesiumRiskColor(Cesium, zona.nivel_riesgo);
          const prop = new Cesium.ConstantProperty(BASE_ALTURA);
          const mat = new Cesium.ColorMaterialProperty(color.withAlpha(0.35));
          propsTerritorio[zona.id] = { prop, mat, alturaMaxima: zona.altura_maxima };

          const entity = viewer.entities.add({
            name: zona.nombre,
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions),
              height: 0,
              extrudedHeight: prop,
              material: mat,
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
        // Material como imagen procedural: ondas/ripples que se redibujan a
        // baja cadencia; color mutado por frame (lerp hacia el color de riesgo).
        const aguaExtruded = new Cesium.ConstantProperty(0.05);
        const aguaMaterial = new Cesium.ImageMaterialProperty({
          image: waterTexture(0, 0.5),
          repeat: new Cesium.Cartesian2(3, 3),
          color: Cesium.Color.fromCssColorString("#00A8E8").withAlpha(0.8),
        });
        const superficieAgua = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(bordePositions),
            height: 0,
            extrudedHeight: aguaExtruded,
            material: aguaMaterial,
            classificationType: Cesium.ClassificationType.BOTH,
          },
        });

        // ── Texturas en caché ─────────────────────────────────────────
        // Pines por nivel de riesgo
        const pinTex: Record<NivelRiesgo, any> = {} as any;
        ORDEN_RIESGO.forEach((n) => { pinTex[n] = pinTexture(RIESGO_META[n].color, 64); });

        // ── 20 Zonas críticas: marcadores + círculo de influencia ────
        const zonasLayer: Record<string, any> = {};
        const influenciasLayer: Record<string, any> = {};
        const estadoZona: Record<number, { riesgo?: string }> = {};

        ZONAS_MANGA.forEach((zona) => {
          const [lat, lng] = zona.coordenadas;
          const nivelBase = zona.nivel_riesgo;
          const altura = 2 + (zona.altura_critica / 100) * 28;
          const pos = Cesium.Cartesian3.fromDegrees(lng, lat, altura);

          // Círculo de influencia (radio según zona)
          const influencia = viewer.entities.add({
            position: new Cesium.ConstantPositionProperty(
              Cesium.Cartesian3.fromDegrees(lng, lat, 0.5)
            ),
            ellipse: {
              semiMajorAxis: new Cesium.ConstantProperty(zona.radio_influencia),
              semiMinorAxis: new Cesium.ConstantProperty(zona.radio_influencia),
              // height explícito para desactivar el "clamping" al terreno y
              // permitir contornos (evita el warning de outlines en terreno 3D)
              height: 0,
              material: new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString(RIESGO_META[nivelBase].color).withAlpha(0.1)
              ),
              outline: true,
              outlineColor: new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString(RIESGO_META[nivelBase].color).withAlpha(0.3)
              ),
              outlineWidth: 1,
            },
            properties: { zonaCriticaId: zona.id, tipo: "influencia" },
          });

          // Marcador (pin)
          const marker = viewer.entities.add({
            position: new Cesium.ConstantPositionProperty(pos),
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
              // Declutter por cámara: los textos solo se muestran a distancia cercana para
              // no tapar el territorio cuando se aleja la vista.
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2600),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            properties: { zonaCriticaId: zona.id, tipo: "marcador" },
          });

          zonasLayer[zona.id] = marker;
          influenciasLayer[zona.id] = influencia;
        });

        // ── Capa de calor interpolada (campo de riesgo real) ─────────
        // Grilla de contribuciones gaussianas de las 20 zonas proyectada como
        // textura sobre el territorio. Reemplaza los halos individuales y se
        // re-genera solo cuando el nivel salta un múltiplo de 5 cm.
        const calorMaterial = new Cesium.ImageMaterialProperty({
          image: heatmapTexture(ZONAS_MANGA, nivelAguaCm, nivelMaximoCm, MANGA_BOUNDS, 96),
          color: Cesium.Color.WHITE.withAlpha(heatmapRef.current ? 0.95 : 0.0),
        });
        const superficieCalor = viewer.entities.add({
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
              MANGA_BOUNDS.west,
              MANGA_BOUNDS.south,
              MANGA_BOUNDS.east,
              MANGA_BOUNDS.north
            ),
            material: calorMaterial,
            height: 0.4,
          },
          properties: { tipo: "calor" },
        });

        // ── Anillo de selección activa (pulso sobre la zona elegida) ──
        const anilloSeleccion = viewer.entities.add({
          position: new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 25)
          ),
          point: {
            pixelSize: new Cesium.ConstantProperty(14),
            color: Cesium.Color.fromCssColorString("#00E5FF").withAlpha(0.9),
            outlineColor: Cesium.Color.WHITE.withAlpha(0.95),
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            show: false,
          },
        });

        // ── Manejo de clic en zonas críticas ─────────────────────────
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((movement: any) => {
          // Midiendo con la regla: el clic es para vértices, no para zonas.
          if (midiendoRef.current) return;
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
            onSelectZonaRef.current?.(pickedZona);
            const [lat, lng] = pickedZona.coordenadas;
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lng, lat, 900),
              duration: duracionVuelo(1),
            });
          } else {
            setSelectedZona(null);
            onSelectZonaRef.current?.(null);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // ── Hover: puntero + tooltip en vivo (nivel actual del animador) ──
        const hoverHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        hoverHandler.setInputAction((movement: any) => {
          if (midiendoRef.current) {
            viewer.scene.canvas.style.cursor = "crosshair";
            if (tooltipRef.current) tooltipRef.current.style.display = "none";
            return;
          }
          const picked = viewer.scene.pick(movement.endPosition);
          let zona: ZonaManga | null = null;
          if (Cesium.defined(picked) && picked.id && picked.id.properties) {
            const zid = picked.id.properties.zonaCriticaId?.getValue();
            if (zid != null) zona = ZONAS_MANGA.find((z) => z.id === zid) ?? null;
          }
          viewer.scene.canvas.style.cursor = zona ? "pointer" : "grab";
          if (tooltipRef.current) {
            if (zona) {
              const nivelZ = nivelDinamicoZona(zona, aguaActualRef.current, nivelMaximoRef.current);
              const riesgo = riesgoVivo(zona, aguaActualRef.current, nivelMaximoRef.current);
              tooltipRef.current.style.left = `${movement.endPosition.x + 14}px`;
              tooltipRef.current.style.top = `${movement.endPosition.y + 14}px`;
              tooltipRef.current.style.display = "block";
              tooltipRef.current.style.borderColor = RIESGO_META[riesgo].color;
              tooltipRef.current.innerHTML = `<span class="font-bold">${zona.nombre}</span> · <span style="color:${RIESGO_META[riesgo].color}">${nivelZ.toFixed(1)} cm</span>`;
            } else {
              tooltipRef.current.style.display = "none";
            }
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        if (cancelado) {
          viewer.destroy();
          return;
        }

        viewerRef.current = { viewer, destroy: () => viewer.destroy() };
        (viewerRef.current as any).entidadesZona = entidadesZona;
        (viewerRef.current as any).superficieAgua = superficieAgua;
        (viewerRef.current as any).zonasLayer = zonasLayer;
        (viewerRef.current as any).influenciasLayer = influenciasLayer;
        (viewerRef.current as any).pinTex = pinTex;
        (viewerRef.current as any).superficieCalor = superficieCalor;
        (viewerRef.current as any).calorMaterial = calorMaterial;
        (viewerRef.current as any).propsTerritorio = propsTerritorio;
        (viewerRef.current as any).aguaExtruded = aguaExtruded;
        (viewerRef.current as any).aguaMaterial = aguaMaterial;
        (viewerRef.current as any).estadoZona = estadoZona;
        (viewerRef.current as any).anilloSeleccion = anilloSeleccion;
        (viewerRef.current as any).volverAMangaFn = volverAManga;
        screenSpaceHandlerRef.current = handler;
        hoverHandlerRef.current = hoverHandler;
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
      if (hoverHandlerRef.current) {
        hoverHandlerRef.current.destroy();
        hoverHandlerRef.current = null;
      }
      if (medicionHandlerRef.current) {
        medicionHandlerRef.current.destroy();
        medicionHandlerRef.current = null;
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
    const pinTex = (viewerRef.current as any).pinTex;
    const superficieCalor = (viewerRef.current as any).superficieCalor;
    const calorMaterial = (viewerRef.current as any).calorMaterial;
    const anilloSeleccion = (viewerRef.current as any).anilloSeleccion;
    const propsTerritorio = (viewerRef.current as any).propsTerritorio;
    const aguaExtruded = (viewerRef.current as any).aguaExtruded;
    const aguaMaterial = (viewerRef.current as any).aguaMaterial;
    const estadoZona = (viewerRef.current as any).estadoZona;
    if (!superficieAgua || !propsTerritorio || !aguaExtruded || !estadoZona) return;

    // Reutilizados por el paso de agua: color de tinte con lerp y cadencia de
    // regeneración de los ripples (textura procedural, ~600 ms).
    const aguaScratch = Cesium.Color.fromCssColorString("#00A8E8").withAlpha(0.85);
    let tinteAgua: { r: number; g: number; b: number } | null = null;
    let faseRipple = 0;
    let ultimoRipple = 0;

    // Estado de la capa de calor: regeneración perezosa (por bucket de 5 cm)
    // y alpha según la visibilidad del toggle "Calor".
    let ultimoBucket = -1;
    let lastCalorOn = heatmapRef.current;
    let calorAlpha = heatmapRef.current ? 0.95 : 0;

    // prefers-reduced-motion: agua estática (sin ripples ni pulso del anillo).
    const rm = prefiereReducirMovimiento();

    const step = () => {
      rafRef.current = null;
      if (!viewerRef.current) return;
      // Contador de frames para el overlay de FPS (solo en desarrollo).
      if (process.env.NODE_ENV !== "production") fpsCountRef.current += 1;
      const dif = objetivoAguaRef.current - aguaActualRef.current;
      const vel = Math.abs(dif) > 0.05 ? Math.sign(dif) * Math.max(0.5, Math.abs(dif) * 0.12) : dif;
      aguaActualRef.current += vel;

      const nivel = aguaActualRef.current;
      const colorNivel = Cesium.Color.fromCssColorString(nivelColorCached(nivel));

      // Columnas territoriales: propiedades reutilizadas, sin alocar por frame.
      Object.values(propsTerritorio).forEach(({ prop, mat, alturaMaxima }: any) => {
        const inundado = alturaMaxima != null && nivel >= alturaMaxima;
        prop.setValue(Math.max(BASE_ALTURA, nivel * gananciaRef.current));
        mat.color.setValue(
          inundado
            ? Cesium.Color.clone(colorNivel).withAlpha(0.55)
            : Cesium.Color.fromCssColorString("#00E5FF").withAlpha(0.26)
        );
      });

      // Superficie global de agua: altura + lerp de tinte hacia el color de riesgo,
      // y redibujo periódico de la textura de ripples (baja cadencia).
      const aguaMetros = Math.max(0.05, nivel * gananciaRef.current);
      aguaExtruded.setValue(aguaMetros);

      const hex = nivelColorCached(nivel);
      const tr = parseInt(hex.slice(1, 3), 16);
      const tg = parseInt(hex.slice(3, 5), 16);
      const tb = parseInt(hex.slice(5, 7), 16);
      if (!tinteAgua) {
        tinteAgua = { r: tr, g: tg, b: tb };
      } else {
        tinteAgua.r += (tr - tinteAgua.r) * 0.08;
        tinteAgua.g += (tg - tinteAgua.g) * 0.08;
        tinteAgua.b += (tb - tinteAgua.b) * 0.08;
      }
      aguaScratch.red = tinteAgua.r / 255;
      aguaScratch.green = tinteAgua.g / 255;
      aguaScratch.blue = tinteAgua.b / 255;
      aguaScratch.alpha = 0.85;
      aguaMaterial.color.setValue(aguaScratch);

      const ahora = performance.now();
      // Tormenta: los ripples se regeneran más rápido (agua más brava). Con
      // prefers-reduced-motion el agua queda estática (textura única).
      const cadenciaRipple = stormRef.current ? 380 : 600;
      if (!rm && ahora - ultimoRipple > cadenciaRipple) {
        ultimoRipple = ahora;
        faseRipple += stormRef.current ? 1.6 : 0.9;
        // "Heat shimmer": la opacidad/contraste del agua sube con el nivel.
        aguaMaterial.image.setValue(waterTexture(faseRipple, Math.min(1, nivel / 100)));
      }

      // Zonas críticas en vivo: solo se retocan los billboards/círculos cuando
      // cambia el riesgo (imagen y tamaño), evitando re-subidas de textura.
      const heatOn = heatmapRef.current;
      ZONAS_MANGA.forEach((zona) => {
        const nivelZona = nivelDinamicoZona(zona, nivel, nivelMaximoCm);
        const riesgoVivoZ = riesgoVivo(zona, nivel, nivelMaximoCm);
        const meta = RIESGO_META[riesgoVivoZ];
        const marker = zonasLayer[zona.id];
        const influencia = influenciasLayer[zona.id];
        if (!marker) return;

        const ed = estadoZona[zona.id] ?? (estadoZona[zona.id] = {});
        const cambio = ed.riesgo !== riesgoVivoZ;
        ed.riesgo = riesgoVivoZ;

        const alturaZona = 2 + (nivelZona / 100) * 50;
        marker.position.setValue(
          Cesium.Cartesian3.fromDegrees(zona.coordenadas[1], zona.coordenadas[0], alturaZona)
        );

        if (cambio) {
          marker.billboard.image = pinTex[riesgoVivoZ];
          const baseSize = 50 + meta.peso * 10;
          marker.billboard.width = baseSize;
          marker.billboard.height = baseSize * 1.35;

          if (influencia) {
            influencia.ellipse.material.color.setValue(
              Cesium.Color.fromCssColorString(meta.color).withAlpha(0.22)
            );
            influencia.ellipse.outlineColor.color.setValue(
              Cesium.Color.fromCssColorString(meta.color).withAlpha(0.32)
            );
          }
        }
      });

      // Capa de calor interpolada: se regenera solo cuando el nivel salta un
      // múltiplo de 5 cm o cambia la visibilidad, nunca en cada frame.
      if (superficieCalor && calorMaterial) {
        const bucket = Math.round(nivel / 5) * 5;
        if (bucket !== ultimoBucket || lastCalorOn !== heatOn) {
          ultimoBucket = bucket;
          lastCalorOn = heatOn;
          calorMaterial.image.setValue(
            heatmapTexture(ZONAS_MANGA, nivel, nivelMaximoCm, MANGA_BOUNDS, 96)
          );
        }
        const alphaCalor = heatOn ? 0.95 : 0;
        if (calorAlpha !== alphaCalor) {
          calorAlpha = alphaCalor;
          calorMaterial.color.setValue(Cesium.Color.WHITE.withAlpha(alphaCalor));
        }
      }

      // Anillo de selección: pulso de escala y color por riesgo mientras esté activo.
      if (anilloSeleccion && anilloActivoRef.current) {
        const ries = selectedZonaRef.current
          ? riesgoVivo(selectedZonaRef.current, nivel, nivelMaximoCm)
          : "NORMAL";
        if (!rm) anilloSeleccion.point.pixelSize.setValue(14 + Math.sin(performance.now() / 380) * 5);
        anilloSeleccion.point.color.setValue(
          Cesium.Color.fromCssColorString(RIESGO_META[ries].color).withAlpha(0.9)
        );
      }

      // Con requestRenderMode, un render por tick solo si el agua se movió.
      viewer.scene.requestRender();

      const sigue =
        Math.abs(objetivoAguaRef.current - aguaActualRef.current) > 0.05 ||
        (anilloActivoRef.current && !rm);
      if (sigue) {
        // Tab oculta: el padding se vuelve inútil y quema CPU, así que se
        // samplea a 1 Hz hasta volver a la pestaña.
        rafRef.current = document.hidden
          ? window.setTimeout(step, 1000)
          : requestAnimationFrame(step);
      } else {
        aguaActualRef.current = objetivoAguaRef.current;
      }
    };

    const onVisibilidad = () => {
      if (document.hidden) return;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        window.clearTimeout(rafRef.current);
        rafRef.current = null;
      }
      if (Math.abs(objetivoAguaRef.current - aguaActualRef.current) > 0.05 || anilloActivoRef.current) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    document.addEventListener("visibilitychange", onVisibilidad);

    rafRef.current = requestAnimationFrame(step);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilidad);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        window.clearTimeout(rafRef.current);
      }
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivelAguaCm, heatmapVisible, cargando, selectedZona]);

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
      duration: duracionVuelo(1.2),
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
      duration: duracionVuelo(1.2),
    });
  }

  function volverACenital() {
    const Viewer: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!Viewer || !Cesium) return;
    Viewer.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 1700),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: duracionVuelo(1.2),
    });
  }

  // Screenshot del visor (canvas de Cesium) como PNG descargable.
  function capturarPNG() {
    const V: any = viewerRef.current;
    if (!V?.viewer) return;
    const url = V.viewer.scene.canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.download = `stormprint-manga-${new Date().toISOString().slice(0, 16).replace("T", "_")}.png`;
    a.href = url;
    a.click();
  }

  // ── Herramienta de medición (regla sobre el terreno) ────────────────────
  // Clic añade vértices; doble clic o "M" de nuevo termina y muestra la
  // distancia acumulada. Útil para estimar tramos de calle inundables.
  function distanciaEntre(lng1: number, lat1: number, lng2: number, lat2: number): number {
    const R = 6371000;
    const rad = (v: number) => (v * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function calcularDistancia(puntos: { lng: number; lat: number }[]): number {
    let total = 0;
    for (let i = 1; i < puntos.length; i++) {
      total += distanciaEntre(puntos[i - 1].lng, puntos[i - 1].lat, puntos[i].lng, puntos[i].lat);
    }
    return total;
  }

  function redibujarRuta() {
    const V: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!V?.viewer || !Cesium || rutaRef.current.length === 0) return;
    const posiciones = rutaRef.current.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, 2));
    if (rutaLineaRef.current) {
      (rutaLineaRef.current.polyline as any).positions.setValue(posiciones);
    } else {
      rutaLineaRef.current = V.viewer.entities.add({
        polyline: {
          positions: posiciones,
          width: 3,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString("#00E5FF").withAlpha(0.95)
          ),
          clampToGround: true,
        },
        properties: { tipo: "medicion" },
      });
    }
    if (rutaPuntosRef.current) {
      (rutaPuntosRef.current.billboard as any).position.setValue(posiciones[posiciones.length - 1]);
    } else {
      rutaPuntosRef.current = V.viewer.entities.add({
        position: posiciones[posiciones.length - 1],
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString("#00E5FF"),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: { tipo: "medicion" },
      });
    }
    setDistanciaRuta(calcularDistancia(rutaRef.current));
    V.viewer.scene.requestRender();
  }

  function finalizarMedicion() {
    if (medicionHandlerRef.current) {
      medicionHandlerRef.current.destroy();
      medicionHandlerRef.current = null;
    }
    const V: any = viewerRef.current;
    if (rutaLineaRef.current && V?.viewer) {
      V.viewer.entities.remove(rutaLineaRef.current);
      rutaLineaRef.current = null;
    }
    if (rutaPuntosRef.current && V?.viewer) {
      V.viewer.entities.remove(rutaPuntosRef.current);
      rutaPuntosRef.current = null;
    }
    if (rutaRef.current.length >= 2) {
      setDistanciaRuta(calcularDistancia(rutaRef.current));
    } else if (rutaRef.current.length === 0) {
      setDistanciaRuta(null);
    }
    rutaRef.current = [];
    setMidiendo(false);
  }

  function toggleMedicion() {
    const V: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!V?.viewer || !Cesium) return;
    if (midiendoRef.current) {
      finalizarMedicion();
      return;
    }
    setDistanciaRuta(null);
    rutaRef.current = [];
    const handler = new Cesium.ScreenSpaceEventHandler(V.viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const cart = V.viewer.camera.pickEllipsoid(movement.position);
      if (!Cesium.defined(cart)) return;
      const carto = Cesium.Cartographic.fromCartesian(cart);
      rutaRef.current.push({
        lng: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude),
      });
      redibujarRuta();
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction(() => finalizarMedicion(), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    medicionHandlerRef.current?.destroy();
    medicionHandlerRef.current = handler;
    setMidiendo(true);
  }

  // Tour cinematográfico de bienvenida: órbita alta → cenital → vista en picada
  // sobre el barrio. Encadenado con promesas y respetando reduced-motion.
  function tourCine() {
    const V: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!V?.viewer || !Cesium) return;
    tourActivoRef.current = true;
    const cancelar = () => {
      tourActivoRef.current = false;
      V.viewer.camera.cancelFlight?.();
    };
    const onInteraccion = () => cancelar();
    const canvas = V.viewer.scene.canvas as HTMLElement;
    for (const ev of ["pointerdown", "wheel", "touchstart"] as const) {
      canvas.addEventListener(ev, onInteraccion, { once: true, passive: true });
    }
    (async () => {
      const frames = [
        { destino: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 38000), h: 0.8, p: -72, dur: 3.2 },
        { destino: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng + 0.06, MANGA_CENTER.lat - 0.03, 5200), h: 0.6, p: -60, dur: 2.4 },
        { destino: Cesium.Cartesian3.fromDegrees(MANGA_CENTER.lng, MANGA_CENTER.lat, 1000), h: 0.35, p: -62, dur: 2.2 },
      ];
      for (const f of frames) {
        if (!tourActivoRef.current || !viewerRef.current) break;
        V.viewer.camera.flyTo({
          destination: f.destino,
          orientation: { heading: f.h, pitch: Cesium.Math.toRadians(f.p), roll: 0 },
          duration: duracionVuelo(f.dur),
        });
        await new Promise((r) => setTimeout(r, (duracionVuelo(f.dur) + 0.8) * 1000));
      }
      if (tourActivoRef.current) volverACenital();
      tourActivoRef.current = false;
      for (const ev of ["pointerdown", "wheel", "touchstart"] as const) {
        canvas.removeEventListener(ev, onInteraccion);
      }
    })();
  }

  // ── Luz solar real (hora de Cartagena, UTC-5): el sol ilumina el terreno
  // según la hora del escenario. Toggle en el panel de capas ("Sol").
  const [luzSolar, setLuzSolar] = useState(true);
  const luzSolarRef = useRef(true);
  useEffect(() => { luzSolarRef.current = luzSolar; }, [luzSolar]);

  useEffect(() => {
    const V: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!V?.viewer || !Cesium) return;
    if (!luzSolarRef.current) {
      V.viewer.scene.globe.enableLighting = false;
      V.viewer.scene.requestRender();
      return;
    }
    // Fecha sintética: hoy real, pero con la hora del simulado (Manga está en
    // UTC-5, así que sumar la zona horaria para que el sol caiga bien).
    const hora = Math.max(0, Math.min(23, Math.floor(horaLocalRef.current)));
    const base = new Date();
    const fecha = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      (hora + 5) % 24,
      base.getMinutes(),
      base.getSeconds()
    );
    V.viewer.clock.currentTime = Cesium.JulianDate.fromDate(fecha);
    V.viewer.clock.shouldAnimate = false;
    V.viewer.scene.globe.enableLighting = true;
    V.viewer.scene.requestRender();
    // Cielo un poco más denso de noche: el alumbrado no es plano, sino ambiente.
    V.viewer.scene.skyAtmosphere.brightnessShift = hora < 7 || hora > 18 ? -0.15 : 0;
  }, [cargando, luzSolar, horaLocal]);

  // ── Tormenta: oscurecer escenario + niebla densa mientras esté activa ──
  useEffect(() => {
    const V: any = viewerRef.current;
    if (!V?.viewer) return;
    V.viewer.scene.skyAtmosphere.brightnessShift = stormRef.current ? -0.32 : 0;
    V.viewer.scene.fog.density = stormRef.current ? 0.0009 : 0.00016;
    V.viewer.scene.requestRender();
  }, [cargando, stormMode]);

  // ── Overlay FPS (solo desarrollo, para auditar el rendimiento) ─────────
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const t = window.setInterval(() => {
      setFps(fpsCountRef.current);
      fpsCountRef.current = 0;
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // Tour de bienvenida: una sola vez al cargar el visor (no si hay
  // reduced-motion, donde los vuelos duran 0 ms y el tour sería invisible).
  // Se cancela si el usuario interactúa con el canvas.
  const tourLanzadoRef = useRef(false);
  const tourActivoRef = useRef(false);
  useEffect(() => {
    if (cargando || error || tourLanzadoRef.current || duracionVuelo(1) === 0) return;
    tourLanzadoRef.current = true;
    const t = window.setTimeout(() => tourCine(), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, error]);

  // Selección vía teclado (mismas consecuencias que el clic sobre un pin).
  function seleccionarZonaConTeclado(zona: ZonaManga) {
    setSelectedZona(zona);
    onSelectZonaRef.current?.(zona);
    const V: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!V || !Cesium) return;
    const [lat, lng] = zona.coordenadas;
    V.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, 950),
      duration: duracionVuelo(1.2),
    });
  }

  // ── Anillo de selección: sigue a la zona elegida y pulsa ────────────────
  useEffect(() => {
    selectedZonaRef.current = selectedZona;
    const V: any = viewerRef.current;
    const Cesium: any = cesiumRef.current;
    if (!V || !Cesium) {
      anilloActivoRef.current = false;
      return;
    }
    const anillo = V.anilloSeleccion;
    if (!anillo) return;
    if (!selectedZona) {
      anillo.show = false;
      anilloActivoRef.current = false;
      return;
    }
    const [lat, lng] = selectedZona.coordenadas;
    anillo.position.setValue(Cesium.Cartesian3.fromDegrees(lng, lat, 25));
    anillo.show = true;
    anilloActivoRef.current = true;
  }, [selectedZona]);

  // ── Capas base: satelital / oscuro / híbrido con fallback automático ──
  // Se prueban en orden y se queda con la primera que responde; si ninguna
  // entra, cae a OpenStreetMap para no dejar el visor sin imagery.
  async function cambiarBase(base: "sate" | "oscuro" | "hibrido") {
    const Cesium: any = cesiumRef.current;
    const Viewer: any = viewerRef.current;
    if (!Cesium || !Viewer) return;
    const viewer = Viewer.viewer;

    const intentar = async (factory: () => Promise<unknown>) => {
      try {
        return await factory();
      } catch (_e) {
        return null;
      }
    };

    const capasNuevas: any[] = [];
    if (base === "sate" || base === "hibrido") {
      const sate = await intentar(() =>
        Cesium.ImageryLayer.fromProviderAsync(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            maximumLevel: 19,
          })
        )
      );
      if (sate) capasNuevas.push(sate);
    }
    if (base === "oscuro" || base === "hibrido") {
      const osc = await intentar(() =>
        Cesium.ImageryLayer.fromProviderAsync(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            maximumLevel: 19,
          })
        )
      ) as any;
      if (osc) {
        if (base === "hibrido") osc.alpha = 0.55;
        capasNuevas.push(osc);
      }
    }
    if (capasNuevas.length === 0) {
      const osm = await intentar(() =>
        Cesium.ImageryLayer.fromProviderAsync(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            maximumLevel: 19,
          })
        )
      );
      if (osm) capasNuevas.push(osm);
    }

    const layers = viewer.imageryLayers;
    layers.removeAll();
    capasNuevas.forEach((l) => layers.add(l));
    viewer.scene.requestRender();
  }

  // Aplica la base elegida apenas el visor está listo y cuando cambia.
  useEffect(() => {
    if (!viewerRef.current || !cesiumRef.current || cargando) return;
    cambiarBase(baseMapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMapa, cargando]);

  // ── Toggles internos de capas (zonas / agua / etiquetas) ───────────────
  useEffect(() => {
    const V: any = viewerRef.current;
    if (!V) return;
    Object.values(V.zonasLayer ?? {}).forEach((e: any) => {
      e.show = capas.zonas;
      if (e.label) e.label.show = capas.zonas && capas.etiquetas;
      if (e.billboard) e.billboard.show = capas.zonas;
    });
    Object.values(V.influenciasLayer ?? {}).forEach((e: any) => {
      e.show = capas.zonas;
    });
    if (V.superficieAgua) V.superficieAgua.show = capas.agua;
  }, [capas.zonas, capas.agua, capas.etiquetas, cargando]);

  // ── Atajos de teclado (solo cuando el foco no está en un input) ────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "r") recentrar();
      else if (k === "2") volverACenital();
      else if (k === "3") recentrar();
      else if (k === "c") setPanelCapas((p) => !p);
      else if (k === "z") setCapas((c) => ({ ...c, zonas: !c.zonas }));
      else if (k === "a") setCapas((c) => ({ ...c, agua: !c.agua }));
      else if (k === "l") setCapas((c) => ({ ...c, etiquetas: !c.etiquetas }));
      else if (k === "m") toggleMedicion();
      else if (k === "escape") {
        if (midiendoRef.current) {
          finalizarMedicion();
        } else {
          setSelectedZona(null);
          onSelectZonaRef.current?.(null);
        }
      } else if (k === "arrowdown" || k === "arrowup") {
        const baseId = selectedZonaRef.current?.id ?? 0;
        const idx = ZONAS_MANGA.findIndex((z) => z.id === baseId);
        const delta = k === "arrowdown" ? 1 : -1;
        const next = ZONAS_MANGA[(idx + delta + ZONAS_MANGA.length) % ZONAS_MANGA.length];
        seleccionarZonaConTeclado(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Métricas derivadas para el HUD (calibrador de umbrales y alertas).
  const escalaGauge = Math.max(nivelMaximoCm, 120);
  const pctGauge = Math.min(100, Math.max(0, (nivelAguaCm / escalaGauge) * 100));
  const marcasGauge = [30, 60, 100].map((t) => ({ t, x: Math.min(100, (t / escalaGauge) * 100) }));
  const zonasAlerta = ZONAS_MANGA.filter(
    (z) => riesgoVivo(z, nivelAguaCm, nivelMaximoCm) !== "NORMAL"
  ).length;

  return (
    <div
      className="relative w-full h-full min-h-[380px] sm:min-h-[560px]"
      role="region"
      aria-label={`Mapa 3D de Manga, Cartagena. Nivel ${nivelAguaCm.toFixed(1)} cm · ${clasificarNivel(nivelAguaCm)} · ${zonasAlerta} zonas en alerta. Atajos: R re-centrar, C capas, flechas recorren zonas.`}
      tabIndex={0}
    >
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />

      {/* Tooltip de hover (en vivo, sigue el cursor) */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-30 hidden rounded-md glass px-2.5 py-1.5 font-mono text-[10px] text-white"
        style={{ border: "1px solid #00E5FF" }}
        aria-hidden="true"
      />

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

      {/* FPS (solo dev) */}
      {process.env.NODE_ENV !== "production" && !cargando && !error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 glass rounded-md px-2 py-1 font-mono text-[9px] text-slate-400">
          {fps} fps
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

      {/* Botón de capas (abre el panel de control del mapa) */}
      {!cargando && !error && (
        <button
          onClick={() => setPanelCapas((p) => !p)}
          aria-pressed={panelCapas}
          className="absolute top-14 right-3 z-10 glass rounded-lg px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 transition flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg>
          Capas
        </button>
      )}

      {/* Panel de capas: base mapas, capas internas y vistas */}
      {panelCapas && !cargando && !error && (
        <div className="absolute top-28 right-3 z-20 glass rounded-xl p-3 text-xs text-white w-48">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display font-bold text-cyan">Capas</p>
            <button
              onClick={() => setPanelCapas(false)}
              aria-label="Cerrar panel de capas"
              className="text-slate-500 hover:text-white transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Base</p>
          {(
            [
              ["sate", "Satelital"],
              ["oscuro", "Oscuro"],
              ["hibrido", "Híbrido"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setBaseMapa(val)}
              aria-pressed={baseMapa === val}
              className={`w-full text-left px-2 py-1 mb-1 rounded transition flex items-center justify-between ${
                baseMapa === val ? "bg-cyan/15 text-cyan" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <span>{label}</span>
              <span className="font-tabular text-[9px] text-slate-500">{val}</span>
            </button>
          ))}

          <div className="border-t border-cyan/10 my-2" />

          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Capas</p>
          {(
            [
              ["zonas", "Zonas"],
              ["agua", "Agua"],
              ["etiquetas", "Etiquetas"],
              ["sol", "Sol (hora real)"],
            ] as const
          ).map(([val, label]) => (
            <label key={val} className="flex items-center justify-between px-1 py-1 cursor-pointer">
              <span className="text-slate-300">{label}</span>
              <input
                type="checkbox"
                checked={val === "sol" ? luzSolar : capas[val]}
                onChange={() =>
                  val === "sol" ? setLuzSolar((s) => !s) : setCapas((c) => ({ ...c, [val]: !c[val] }))
                }
                className="accent-cyan"
              />
            </label>
          ))}

          <div className="border-t border-cyan/10 my-2" />

          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Vista</p>
          <div className="flex gap-1">
            <button
              onClick={recentrar}
              title="Oblicua (3)"
              className="flex-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 transition"
            >
              Oblicua
            </button>
            <button
              onClick={volverACenital}
              title="Cenital (2)"
              className="flex-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 transition"
            >
              Cenital
            </button>
            <button
              onClick={tourCine}
              title="Tour de bienvenida"
              className="flex-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 transition"
            >
              Tour
            </button>
          </div>

          <button
            onClick={toggleMedicion}
            aria-pressed={midiendo}
            title="Regla de medición (M)"
            className={`mt-2 w-full rounded-lg px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
              midiendo ? "bg-cyan/15 text-cyan border border-cyan/30" : "bg-white/5 text-cyan hover:bg-cyan/10"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20 8 8" /><path d="m19 14 5 5" /><path d="m14 19 5 5" /><path d="M3 3l4.5 4.5 2.25-2.25L9.5 9.5" /></svg>
            {midiendo ? "Terminar medición" : "Medir distancias"}
          </button>

          <button
            onClick={capturarPNG}
            className="mt-2 w-full rounded-lg bg-white/5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan hover:bg-cyan/10 transition flex items-center justify-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            Capturar PNG
          </button>

          <p className="mt-2 text-[9px] text-slate-500">Atajos: <kbd>Z</kbd> <kbd>A</kbd> <kbd>L</kbd> <kbd>C</kbd> <kbd>R</kbd> <kbd>2</kbd> <kbd>3</kbd></p>
        </div>
      )}

      {/* HUD — Nivel actual */}
      <div className="absolute top-3 left-3 z-10 glass rounded-xl px-4 py-3 text-white max-w-[240px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
              Barrio Manga · Cartagena
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold leading-none">
                {nivelAguaCm.toFixed(1)}
              </span>
              <span className="text-xs text-slate-300">cm</span>
            </div>
            <p className="mt-0.5 font-tabular text-[10px] text-slate-500">
              ≈ {(nivelAguaCm / 100).toFixed(2)} m de columna de agua
            </p>
            <p
              className="mt-1 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: nivelColorCached(nivelAguaCm) }}
            >
              {clasificarNivel(nivelAguaCm)}
            </p>
          </div>

          {/* Brújula + resumen de alertas */}
          <div className="flex flex-col items-center shrink-0">
            <span
              ref={brújulaRef}
              className="text-cyan/90 text-base leading-none transition-transform duration-150"
              aria-hidden="true"
            >
              ▲
            </span>
            <span className="mt-1 font-tabular text-[9px] text-slate-400">heading</span>
            <span
              className={`mt-2 font-tabular text-[10px] ${zonasAlerta > 0 ? "text-risk-emergency" : "text-slate-500"}`}
            >
              {zonasAlerta > 0 ? `${zonasAlerta} en alerta` : "Tranquilo"}
            </span>
          </div>
        </div>

        {/* Calibrador de umbrales 30 / 60 / 100 cm */}
        <div className="mt-3">
          <div className="relative h-2 rounded-full bg-black/50">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pctGauge}%`,
                background: `linear-gradient(to right, #00E5FF, #FFD600, #FF0055, #B000FF)`,
              }}
            />
            {marcasGauge.map((m) => (
              <span
                key={m.t}
                className="absolute top-[-3px] bottom-[-3px] w-px bg-white/40"
                style={{ left: `${m.x}%` }}
              />
            ))}
            <span
              className="absolute top-[-4px] bottom-[-4px] w-[3px] rounded-full bg-white shadow-[0_0_6px_#fff]"
              style={{ left: `calc(${pctGauge}% - 1px)` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-tabular text-[9px] text-slate-500">
            <span>0</span>
            {marcasGauge.map((m) => (
              <span key={m.t}>{m.t}</span>
            ))}
            <span>{escalaGauge.toFixed(0)}</span>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-slate-500">
          Arrastrá · scroll · <kbd className="text-slate-400">R</kbd> re-centrar ·{" "}
          <kbd className="text-slate-400">C</kbd> capas · <kbd className="text-slate-400">M</kbd> medir
        </p>

        {/* Hora de Cartagena + datos meteorológicos en vivo */}
        <div className="mt-2 pt-2 border-t border-cyan/10 grid grid-cols-5 gap-1.5">
          <ChipMeteo
            label="Hora"
            valor={relojCartagena}
            color="#00E5FF"
            title="Hora local de Cartagena (UTC-5)"
          />
          <ChipMeteo
            label="Marea"
            valor={puntoMeteo?.marea_cm != null ? `${puntoMeteo.marea_cm.toFixed(0)} cm` : "—"}
            color="#6366F1"
            title="Marea en el punto activo del escenario"
          />
          <ChipMeteo
            label="Lluvia"
            valor={puntoMeteo?.lluvia_mm_h != null ? `${puntoMeteo.lluvia_mm_h.toFixed(1)} mm/h` : "—"}
            color="#00F3FF"
            title="Lluvia en el punto activo del escenario"
          />
          <ChipMeteo
            label="Viento"
            valor={meteorologia?.viento_max_kmh != null ? `${meteorologia.viento_max_kmh.toFixed(0)} km/h` : "—"}
            color="#94A3B8"
            title="Máximo de viento (resumen meteorológico)"
          />
          <ChipMeteo
            label="Temp"
            valor={meteorologia ? `${meteorologia.temp_min_c.toFixed(0)}-${meteorologia.temp_max_c.toFixed(0)}°` : "—"}
            color="#FFD600"
            title="Rango de temperatura (resumen meteorológico)"
          />
        </div>

        <p className="mt-2 font-tabular text-[9px] text-slate-500">
          Escenario · hora {String(horaLocal).padStart(2, "0")}:00
        </p>
      </div>

      {/* Estado de la herramienta de medición */}
      {midiendo && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 glass rounded-md px-3 py-1.5 font-mono text-[10px] text-cyan whitespace-nowrap">
          Medición · clic para punto · doble clic o <kbd className="text-slate-400">M</kbd> para terminar
        </div>
      )}
      {!midiendo && distanciaRuta != null && rutaRef.current.length === 0 && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 glass rounded-md px-3 py-1.5 font-mono text-[10px] text-white whitespace-nowrap">
          Distancia ·{" "}
          <span className="font-bold text-cyan">
            {distanciaRuta >= 1000 ? `${(distanciaRuta / 1000).toFixed(2)} km` : `${distanciaRuta.toFixed(0)} m`}
          </span>
        </div>
      )}

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
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              zonasAlerta > 0
                ? "bg-risk-emergency shadow-[0_0_6px_#FF0055] animate-pulse-slow"
                : "bg-cyan shadow-[0_0_6px_#00E5FF]"
            }`}
          />
          <span className="text-slate-400">
            {zonasAlerta > 0 ? `${zonasAlerta} zonas en alerta` : "Sin zonas en alerta"} · 20 críticas
          </span>
        </div>
      </div>

      {/* Info de zona seleccionada */}
      {selectedZona && (
        <div
          className="absolute bottom-2 left-2 right-2 z-10 glass rounded-xl p-4 max-h-[45%] overflow-y-auto sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-xs"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-display font-bold text-sm text-white">{selectedZona.nombre}</p>
            <button
              onClick={() => {
                setSelectedZona(null);
                onSelectZonaRef.current?.(null);
              }}
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

// Chip compacto para el HUD meteorológico del visor.
function ChipMeteo({ label, valor, color, title }: { label: string; valor: string; color: string; title: string }) {
  return (
    <div className="min-w-0" title={title}>
      <p className="font-mono text-[8px] uppercase tracking-widest" style={{ color }}>
        {label}
      </p>
      <p className="font-tabular text-[10px] text-slate-200 truncate">{valor}</p>
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

// Caché nivel(cm) → hex. El nivel cambia suavemente frame a frame (interpola a
// ~12%/frame) y la clasificación + lookup de color son deterministas, así que
// cacheamos por décima de cm para no recalcular en cada rAF.
const nivelColorCache = new Map<number, string>();

function nivelColorCached(nivelCm: number): string {
  const key = Math.round(nivelCm * 10) / 10;
  const cached = nivelColorCache.get(key);
  if (cached) return cached;
  const hex = riesgoColorHex(clasificarNivel(nivelCm));
  nivelColorCache.set(key, hex);
  return hex;
}
