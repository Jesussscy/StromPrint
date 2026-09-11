// ---------------------------------------------------------------------------
// StormPrint :: meteoRenderer.ts
// Meteorologia visual sobre el mapa 3D real de Manga, complementaria a la
// lamina de agua de floodRenderer:
//   1. Lluvia: celulas de tormenta (elipses con brillo radial) que derivan por
//      el barrio; intensidad y tinte segun lluvia_mm_h y modo tormenta.
//   2. Viento: trazos de corriente orientados segun la direccion del viento
//      (hacia donde sopla), animados con la velocidad registrada.
//   3. Mareas: anillos de oleaje que se expanden desde la Bahia/Cienaga cuando
//      la marea sube o la tormenta empuja el agua hacia el barrio.
//
// Todo respeta viewer.requestRenderMode: un solo requestRender() por tick.
// ---------------------------------------------------------------------------

import type { FloodBounds } from "@/app/lib/floodRenderer";

export interface MeteoRenderState {
  /** Precipitacion actual (mm/h) del punto meteorologico reproduciendose. */
  lluviaMmH: number;
  /** Rapidez del viento (km/h). */
  vientoKmh: number;
  /** Direccion meteorologica del viento (grados, de donde viene). */
  vientoDeg: number;
  /** Marea sinoptica (cm) para escalar el oleaje. */
  mareaCm: number;
  storm?: boolean;
}

export interface MeteoVisibility {
  lluvia?: boolean;
  viento?: boolean;
  mareas?: boolean;
}

interface CeldaLluvia {
  entity: any;
  lng: number;
  lat: number;
  vLng: number;
  vLat: number;
  fase: number;
}

interface TrazoViento {
  entity: any;
  lng1: number;
  lat1: number;
}

interface AnilloOleaje {
  entity: any;
  activo: boolean;
  t: number;
}

const MIN_LLUVIA_MMH = 0.2; // por debajo no se dibujan celulas
const N_CELDAS = 5;
const N_TRAZOS_VIENTO = 12;
const MAX_ANILLOS = 4;
const INTERVALO_ANILLO_MS = 1700;
const LARGO_TRAZO_DEG = 0.0045;
const ANCLAS: [number, number][] = [
  [-75.5225, 10.4065], // Bahia de Cartagena (al oeste de Manga)
  [-75.5135, 10.4025], // entrada interior / Club Nautico
  [-75.5088, 10.3955], // Cienaga de las Quintas (al este)
];

export class MeteoRenderer {
  private Cesium: any;
  private viewer: any;
  private bounds: FloodBounds;
  private celdas: CeldaLluvia[] = [];
  private trazos: TrazoViento[] = [];
  private anillos: AnilloOleaje[] = [];
  private visible: Required<MeteoVisibility> = {
    lluvia: true,
    viento: true,
    mareas: true,
  };

  private lluviaMmH = 0;
  private vientoKmh = 0;
  private vientoDeg = 90;
  private mareaCm = 0;
  private storm = false;

  private reloj = 0;
  private ultimoAnillo = 0;

  constructor(
    Cesium: any,
    viewer: any,
    opts: { bounds: FloodBounds }
  ) {
    this.Cesium = Cesium;
    this.viewer = viewer;
    this.bounds = opts.bounds;
    this._crearCeldas();
    this._crearTrazos();
    this._crearAnillos();
    this._aplicarVisibilidad();
  }

  // ── Construccion de entidades ────────────────────────────────────────────

  private _celdaActiva(): boolean {
    return (
      this.visible.lluvia &&
      (this.lluviaMmH >= MIN_LLUVIA_MMH || this.storm)
    );
  }

  private _trazosActivos(): boolean {
    return this.visible.viento && this.vientoKmh >= 3;
  }

  private _anillosActivos(): boolean {
    return this.visible.mareas && (this.mareaCm >= 2 || this.storm);
  }

  private _crearCeldas() {
    const C = this.Cesium;
    const { west, south, east, north } = this.bounds;
    const centroLat = (south + north) / 2;
    const centroLng = (west + east) / 2;
    for (let i = 0; i < N_CELDAS; i++) {
      const fase = i / N_CELDAS;
      const ent = this.viewer.entities.add({
        position: C.Cartesian3.fromDegrees(centroLng, centroLat, 80),
        ellipse: {
          semiMajorAxis: 170.0,
          semiMinorAxis: 120.0,
          material: new C.ColorMaterialProperty(
            C.Color.fromCssColorString("#00B4D8").withAlpha(0.35)
          ),
          outline: true,
          outlineColor: C.Color.fromCssColorString("#7EE8FA").withAlpha(0.5),
          outlineWidth: 1,
        },
        properties: { tipo: "lluvia" },
      });
      ent.show = false;
      this.celdas.push({
        entity: ent,
        lng: centroLng + Math.sin(fase * Math.PI * 2) * 0.008,
        lat: centroLat + Math.cos(fase * Math.PI * 2) * 0.004,
        vLng: 0.0004 + Math.random() * 0.0006,
        vLat: 0.0001 + Math.random() * 0.0003,
        fase: (0.15 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1),
      });
    }
  }

  private _crearTrazos() {
    const C = this.Cesium;
    const { west, south, east, north } = this.bounds;
    for (let i = 0; i < N_TRAZOS_VIENTO; i++) {
      const ent = this.viewer.entities.add({
        polyline: {
          positions: [
            C.Cartesian3.fromDegrees(west, south, 1),
            C.Cartesian3.fromDegrees(east, north, 1),
          ],
          clampToGround: true,
          width: 1.6,
          material: new C.PolylineGlowMaterialProperty({
            color: C.Color.fromCssColorString("#B8F6FF").withAlpha(0.0),
            glowPower: 0.0,
            taperPower: 0.8,
          }),
        },
        properties: { tipo: "viento" },
      });
      ent.show = false;
      this.trazos.push({
        entity: ent,
        lng1: west + Math.random() * (east - west),
        lat1: south + Math.random() * (north - south),
      });
    }
  }

  private _crearAnillos() {
    const C = this.Cesium;
    for (let i = 0; i < MAX_ANILLOS; i++) {
      const [lngBase, latBase] = ANCLAS[i % ANCLAS.length];
      const ent = this.viewer.entities.add({
        position: C.Cartesian3.fromDegrees(lngBase, latBase, 15),
        ellipse: {
          semiMajorAxis: 200.0,
          semiMinorAxis: 140.0,
          material: new C.ColorMaterialProperty(
            C.Color.fromCssColorString("#67E8F9").withAlpha(0.0)
          ),
          outline: true,
          outlineColor: C.Color.fromCssColorString("#67E8F9").withAlpha(0.0),
          outlineWidth: 1.5,
        },
        properties: { tipo: "marea" },
      });
      ent.show = false;
      this.anillos.push({ entity: ent, activo: false, t: 0 });
    }
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────────

  update(state: MeteoRenderState) {
    this.lluviaMmH = Math.max(0, state.lluviaMmH);
    this.vientoKmh = Math.max(0, state.vientoKmh);
    this.vientoDeg = ((state.vientoDeg % 360) + 360) % 360;
    this.mareaCm = Math.max(0, state.mareaCm);
    this.storm = state.storm ?? false;
    this._aplicarAspecto();
    this._aplicarVisibilidad();
  }

  /** Anima celdas, trazos y anillos (llamar ~30 fps desde el RAF del visor). */
  animate(deltaSeconds: number) {
    const dt = Math.min(0.05, deltaSeconds);
    let mover = false;

    // Celdas de lluvia: derivan por el barrio y reaparecen del lado opuesto.
    if (this._celdaActiva()) {
      const { west, south, east, north } = this.bounds;
      for (const c of this.celdas) {
        c.lng += c.vLng * 60 * dt;
        c.lat += c.vLat * 60 * dt;
        if (c.lng > east + 0.01) c.lng = west - 0.01;
        if (c.lng < west - 0.01) c.lng = east + 0.01;
        if (c.lat > north + 0.006) c.lat = south - 0.006;
        if (c.lat < south - 0.006) c.lat = north + 0.006;
        const px = ((Math.sin(this.reloj * c.fase * 0.9 + c.lat * 30) + 1) / 2) * 0.0006;
        c.entity.position = this.Cesium.Cartesian3.fromDegrees(c.lng, c.lat, 90 + px * 200);
        mover = true;
      }
    }

    // Trazos de viento: se deslizan hacia donde sopla el viento.
    if (this._trazosActivos()) {
      const { west, south, east, north } = this.bounds;
      const rad = ((this.vientoDeg + 180) * Math.PI) / 180;
      const dirLng = Math.sin(rad);
      const dirLat = Math.cos(rad);
      const velLng = dirLng * 0.0006;
      const velLat = dirLat * 0.0006;
      for (const t of this.trazos) {
        t.lng1 += velLng * 60 * dt;
        t.lat1 += velLat * 60 * dt;
        if (t.lng1 > east + 0.012) t.lng1 = west - 0.012;
        if (t.lng1 < west - 0.012) t.lng1 = east + 0.012;
        if (t.lat1 > north + 0.006) t.lat1 = south - 0.006;
        if (t.lat1 < south - 0.006) t.lat1 = north + 0.006;
        t.entity.polyline.positions = [
          this.Cesium.Cartesian3.fromDegrees(t.lng1, t.lat1, 1),
          this.Cesium.Cartesian3.fromDegrees(
            t.lng1 + dirLng * LARGO_TRAZO_DEG,
            t.lat1 + dirLat * LARGO_TRAZO_DEG,
            1
          ),
        ];
        mover = true;
      }
    }

    // Anillos de oleaje: crecen y se desvanecen desde la Bahia/Cienaga.
    if (this._anillosActivos()) this._avanzarAnillos(dt);

    this.reloj += dt;
    if (mover) this.viewer.scene.requestRender();
  }

  private _avanzarAnillos(dt: number) {
    const C = this.Cesium;
    let mover = false;
    for (const a of this.anillos) {
      if (!a.activo) continue;
      a.t = Math.min(1, a.t + dt / 2.6);
      const m = a.t * a.t;
      const radio = 120 + m * (this.mareaCm > 22 ? 460 : 300);
      const alfa = (1 - m) * (0.35 + (this.storm ? 0.3 : 0));
      a.entity.ellipse.semiMajorAxis = radio;
      a.entity.ellipse.semiMinorAxis = radio * 0.7;
      a.entity.ellipse.material.color = C.Color.fromCssColorString("#67E8F9").withAlpha(Math.max(0, alfa - 0.15));
      a.entity.ellipse.outlineColor = C.Color.fromCssColorString("#7EE8FA").withAlpha(Math.max(0, alfa));
      if (a.t >= 1) {
        a.activo = false;
        a.entity.show = false;
      }
      mover = true;
    }
    // Lanzar oleaje nuevo (con espaciamiento) mientras la marea este viva.
    const ahora = this.reloj * 1000;
    if (ahora - this.ultimoAnillo >= INTERVALO_ANILLO_MS) {
      this.ultimoAnillo = ahora;
      const libre = this.anillos.find((a) => !a.activo);
      if (libre) {
        const [lngBase, latBase] = ANCLAS[Math.floor(Math.random() * ANCLAS.length)];
        libre.activo = true;
        libre.t = 0;
        libre.entity.position = C.Cartesian3.fromDegrees(
          lngBase + (Math.random() - 0.5) * 0.002,
          latBase + (Math.random() - 0.5) * 0.001,
          15
        );
        libre.entity.show = true;
        mover = true;
      }
    }
    if (mover) this.viewer.scene.requestRender();
  }

  /** Ajusta aspecto (tintes, radios, brillo) sin recrear nada. */
  private _aplicarAspecto() {
    const C = this.Cesium;
    const lluviaFuerte = this.lluviaMmH;
    const purpura = this.storm || lluviaFuerte >= 8;
    const colorNucleo = purpura ? "#B000FF" : "#00B4D8";
    const colorBorde = purpura ? "#E1A4FF" : "#7EE8FA";
    const alfa = Math.min(0.5, 0.14 + lluviaFuerte * 0.03 + (this.storm ? 0.14 : 0));

    for (const c of this.celdas) {
      const radioEsc = 1 + Math.min(0.8, lluviaFuerte * 0.06);
      c.entity.ellipse.semiMajorAxis = 170.0 * radioEsc;
      c.entity.ellipse.semiMinorAxis = 120.0 * radioEsc;
      c.entity.ellipse.material.color = C.Color.fromCssColorString(colorNucleo).withAlpha(alfa);
      c.entity.ellipse.outlineColor = C.Color.fromCssColorString(colorBorde).withAlpha(Math.min(0.6, alfa + 0.15));
    }

    const rad = ((this.vientoDeg + 180) * Math.PI) / 180;
    const dirLng = Math.sin(rad) * LARGO_TRAZO_DEG;
    const dirLat = Math.cos(rad) * LARGO_TRAZO_DEG;
    const trazaAlfa = Math.min(0.65, 0.12 + this.vientoKmh * 0.012);
    for (const t of this.trazos) {
      t.entity.polyline.positions = [
        this.Cesium.Cartesian3.fromDegrees(t.lng1, t.lat1, 1),
        this.Cesium.Cartesian3.fromDegrees(t.lng1 + dirLng, t.lat1 + dirLat, 1),
      ];
      t.entity.polyline.material.color = C.Color.fromCssColorString("#B8F6FF").withAlpha(trazaAlfa);
      t.entity.polyline.material.glowPower = 0.12 + Math.min(0.5, this.vientoKmh * 0.02);
    }
  }

  /** Muestra/oculta capas segun los toggles y los umbrales del estado. */
  private _aplicarVisibilidad() {
    const celdaActiva = this._celdaActiva();
    const trazosActivos = this._trazosActivos();
    const anillosActivos = this._anillosActivos();
    for (const c of this.celdas) c.entity.show = celdaActiva;
    for (const t of this.trazos) t.entity.show = trazosActivos;
    for (const a of this.anillos) {
      if (!anillosActivos) {
        a.activo = false;
        a.entity.show = false;
      } else if (a.activo) {
        a.entity.show = true;
      }
    }
    this.viewer.scene.requestRender();
  }

  setVisible(v: MeteoVisibility) {
    this.visible.lluvia = v.lluvia ?? this.visible.lluvia;
    this.visible.viento = v.viento ?? this.visible.viento;
    this.visible.mareas = v.mareas ?? this.visible.mareas;
    this._aplicarVisibilidad();
  }

  dispose() {
    const entities = [
      ...this.celdas.map((c) => c.entity),
      ...this.trazos.map((t) => t.entity),
      ...this.anillos.map((a) => a.entity),
    ].filter(Boolean);
    for (const e of entities) this.viewer.entities.remove(e);
    this.celdas = [];
    this.trazos = [];
    this.anillos = [];
  }
}