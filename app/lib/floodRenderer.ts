// ---------------------------------------------------------------------------
// StormPrint :: floodRenderer.ts
// Inundacion animada sobre el mapa 3D real de Manga:
//   1. Lamina de agua (rectangulo geografico a la altura de H(t), textura
//      procedural animada con ripples - reusa waterTexture de cesiumTextures).
//   2. Muro perimetral que da cuerpo al borde de la inundacion.
//   3. Cauce de calles (STREETS_MANGA) que se encienden con el nivel.
//   4. Gotas fluyendo por las calles: velocidad proporcional a H'(t), densidad
//      proporcional al nivel, direccion segun el drenaje natural de cada via.
//
// Todo respeta viewer.requestRenderMode: un solo requestRender() por tick.
// ---------------------------------------------------------------------------

import {
  STREETS_MANGA,
  streetPointAt,
  type StreetSegment,
} from "@/app/lib/streetNetwork";
import { waterTexture } from "@/app/lib/cesiumTextures";

export interface FloodBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface FloodRenderState {
  /** Nivel actual animado (cm). Por debajo de ~2 cm la lamina se oculta. */
  nivelCm: number;
  /** Velocidad de cambio H'(t) (cm/h): anima la velocidad del flujo. */
  velCmH?: number;
  storm?: boolean;
}

interface Droplet {
  entity: any;
  seg: StreetSegment | null;
  segId: string | null;
  offset: number;
  speed: number;
  active: boolean;
}

const AGUA_MIN_VISIBLE_CM = 2; // por debajo, el barrio esta "seco"
const MAX_POR_SEGMENTO = 4;

/**
 * MaterialProperty del agua: puente entre la API de entidades de Cesium y el
 * shader Water nativo. Las entidades exigen un objeto con getValue/getType
 * (no sirve un `Cesium.Material` crudo: `createMaterialProperty` lanzaria
 * "Unable to infer material type"). Aqui se conserva el Water animado por GPU
 * y se exponen uniforms vivos para que el animador los afine sin recrear nada.
 */
class WaterMaterialProperty {
  private _C: any;
  private _type: string;
  readonly definitionChanged: any;
  isConstant: boolean;

  baseWaterColor: any;
  blendColor: any;
  frequency: number;
  animationSpeed: number;
  amplitude: number;
  specularIntensity: number;
  fadeFactor: number;

  constructor(C: any, uniforms: Record<string, any>) {
    this._C = C;
    this._type = C.Material.WaterType;
    this.definitionChanged = new C.Event();
    this.isConstant = false;
    this.baseWaterColor = uniforms.baseWaterColor;
    this.blendColor = uniforms.blendColor;
    this.frequency = uniforms.frequency;
    this.animationSpeed = uniforms.animationSpeed;
    this.amplitude = uniforms.amplitude;
    this.specularIntensity = uniforms.specularIntensity;
    this.fadeFactor = uniforms.fadeFactor;
  }

  getType(): string {
    return this._type;
  }

  getValue(_time: number, result?: any): any {
    if (!result) result = {};
    // El updater usa el material con las texturas Water nativas de Cesium,
    // así que solo se propagan los parametros que controlan el look.
    result.baseWaterColor = this.baseWaterColor;
    result.blendColor = this.blendColor;
    result.frequency = this.frequency;
    result.animationSpeed = this.animationSpeed;
    result.amplitude = this.amplitude;
    result.specularIntensity = this.specularIntensity;
    result.fadeFactor = this.fadeFactor;
    return result;
  }

  equals(other: any): boolean {
    return this === other;
  }
}

export class FloodRenderer {
  private Cesium: any;
  private viewer: any;
  private bounds: FloodBounds;
  private calles: StreetSegment[];
  private isTouch: boolean;
  private visible = true;

  private superficie: any = null;
  private matSuperficie: any = null;
  private muro: any = null;
  private linhasCalles: any[] = [];
  private gotas: Droplet[] = [];
  private ultimoNivelMuro = -1;

  private nivelActualCm = 0;
  private velActualCmH = 0;
  private storm = false;

  constructor(
    Cesium: any,
    viewer: any,
    opts: { bounds: FloodBounds; isTouch?: boolean }
  ) {
    this.Cesium = Cesium;
    this.viewer = viewer;
    this.bounds = opts.bounds;
    this.isTouch = opts.isTouch ?? false;
    this.calles = STREETS_MANGA;
    this._crearSuperficie();
    this._crearMuro();
    this._crearCalles();
    this._crearGotas();
    this._aplicarVisibilidad(this.visible);
  }

  // ── Construccion de entidades ────────────────────────────────────────────

  private _colorBaseAgua(intensidad: number): string {
    return intensidad < 0.45 ? "#0E7490" : intensidad < 0.7 ? "#0891B2" : "#06B6D4";
  }

  private _colorMezclaAgua(intensidad: number): string {
    return intensidad < 0.45 ? "#22D3EE" : intensidad < 0.7 ? "#00E5FF" : "#67E8F9";
  }

  private _crearSuperficie() {
    const C = this.Cesium;
    const { west, south, east, north } = this.bounds;
    // Empuje lateral del rectangulo: cubre mas que el bounds para que el borde
    // de la lamina no se recorte en los angulos de la camara.
    const dLng = east - west;
    const dLat = north - south;
    const canvas = waterTexture(0, 0.5, 128);
    // Material shader de agua nativo de Cesium: ondas animadas por GPU (el
    // shader desplaza las texturas con czm_frameNumber, así que los ripples
    // se mueven solos). Se envuelve en un MaterialProperty para que las
    // entidades lo acepten; si algo fallara, cae al ImageMaterialProperty.
    // Nota: el material Water ignora `material.alpha`; la "gasa" sobre la
    // imagen satelital se resuelve vía fadeFactor + color semi-transparente.
    let material: any;
    try {
      material = new WaterMaterialProperty(C, {
        baseWaterColor: C.Color.fromCssColorString("#0891B2"),
        blendColor: C.Color.fromCssColorString("#00E5FF"),
        frequency: 4200.0,
        animationSpeed: 0.04,
        amplitude: 6.0,
        specularIntensity: 0.7,
        fadeFactor: 0.9,
      });
    } catch (_e) {
      material = new C.ImageMaterialProperty({ image: canvas, alpha: 0.6 });
    }
    this.matSuperficie = material;
    this.superficie = this.viewer.entities.add({
      rectangle: {
        coordinates: C.Rectangle.fromDegrees(
          west - dLng * 0.15,
          south - dLat * 0.15,
          east + dLng * 0.15,
          north + dLat * 0.15
        ),
        height: this.nivelActualCm / 100,
        material,
        classificationType: C.ClassificationType.BOTH,
      },
      properties: { tipo: "inundacion" },
    });
  }

  private _crearMuro() {
    const C = this.Cesium;
    const { west, south, east, north } = this.bounds;
    const esquinas: [number, number][] = [
      [south - 0.002, west - 0.002],
      [south - 0.002, east + 0.002],
      [north + 0.002, east + 0.002],
      [north + 0.002, west - 0.002],
    ];
    const posiciones: any[] = [];
    for (const [lat, lng] of esquinas) {
      posiciones.push(C.Cartesian3.fromDegrees(lng, lat, 0.1));
      posiciones.push(C.Cartesian3.fromDegrees(lng, lat, 0.5));
    }
    this.muro = this.viewer.entities.add({
      wall: {
        positions: posiciones,
        material: C.Color.fromCssColorString("#00E5FF").withAlpha(0.28),
        outline: true,
        outlineColor: C.Color.fromCssColorString("#00E5FF").withAlpha(0.5),
        outlineWidth: 1,
      },
      properties: { tipo: "inundacion" },
    });
  }

  private _crearCalles() {
    const C = this.Cesium;
    for (const calle of this.calles) {
      const pos = calle.points.map(([lat, lng]) => C.Cartesian3.fromDegrees(lng, lat, 0.5));
      const ent = this.viewer.entities.add({
        polyline: {
          positions: pos,
          clampToGround: true,
          width: 2.5,
          material: new C.PolylineGlowMaterialProperty({
            color: C.Color.fromCssColorString("#4FFFF8").withAlpha(0.0),
            glowPower: 0.0,
            taperPower: 0.6,
          }),
        },
        properties: { tipo: "cauce", calleId: calle.id },
      });
      this.linhasCalles.push({ calle, ent });
    }
  }

  private _crearGotas() {
    const C = this.Cesium;
    const max = this.isTouch ? 36 : 60;
    for (let i = 0; i < max; i++) {
      const ent = this.viewer.entities.add({
        position: C.Cartesian3.fromDegrees(this.bounds.east, this.bounds.south, 1.2),
        point: {
          pixelSize: 3.5,
          color: C.Color.fromCssColorString("#98FFF9"),
          outlineColor: C.Color.fromCssColorString("#00E5FF").withAlpha(0.9),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: { tipo: "flujo" },
      });
      ent.show = false;
      this.gotas.push({
        entity: ent,
        seg: null,
        segId: null,
        offset: Math.random(),
        speed: 0.06 + Math.random() * 0.05,
        active: false,
      });
    }
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────────

  update(state: FloodRenderState) {
    this.nivelActualCm = Math.max(0, state.nivelCm);
    this.velActualCmH = state.velCmH ?? 0;
    this.storm = state.storm ?? false;

    const C = this.Cesium;
    const met = this.nivelActualCm / 100;

    // 1. Lamina de agua
    const seca = this.nivelActualCm < AGUA_MIN_VISIBLE_CM;
    this.superficie.show = this.visible && !seca;
    if (!seca) {
      this.superficie.rectangle.height.setValue(Math.max(0.01, met));
      // Aspecto vivo: el Water ya ondula solo (reloj GPU); aquí se afinan
      // palette, amplitud de olas y velocidad de ondulación según H(t).
      this._actualizarAspectoAgua();
    }

    // 2. Muro perimetral: solo se reconstruye cuando el nivel sube/baja lo
    //    suficiente (evita re-sincronizar WallGeometry en cada frame).
    const bucket = Math.floor(met * 20) / 20; // 5 cm por escalon
    if (bucket >= 0.02 && Math.abs(bucket - this.ultimoNivelMuro) >= 1e-9) {
      this._actualizarMuro(met);
      this.ultimoNivelMuro = bucket;
    }

    // 3. Cauce de calles: se encienden con el nivel y pul san con el viento.
    const glow = this.nivelActualCm < AGUA_MIN_VISIBLE_CM
      ? 0
      : 0.18 + Math.min(0.6, this.nivelActualCm / 90) + (this.storm ? 0.25 : 0);
    const flujoAlpha = Math.min(1, this.nivelActualCm / 22);
    for (const { ent } of this.linhasCalles) {
      ent.show = this.visible && this.nivelActualCm >= AGUA_MIN_VISIBLE_CM;
      ent.polyline.material.color = C.Color.fromCssColorString("#4FFFF8").withAlpha(0.15 + flujoAlpha * 0.45);
      ent.polyline.material.glowPower = glow;
    }

    // 4. Gotas: repartidas por las calles (densidad colega con el nivel).
    this._repartirGotas();

    this.viewer.scene.requestRender();
  }

  /** Afina el material de agua (palette, olas, ondulacion) sin recrearlo. */
  private _actualizarAspectoAgua() {
    const m = this.matSuperficie;
    if (!m) return;
    const intensidad = Math.min(1, 0.35 + this.nivelActualCm / 160 + (this.storm ? 0.25 : 0));
    const base = this.Cesium.Color.fromCssColorString(this._colorBaseAgua(intensidad));
    const mezcla = this.Cesium.Color.fromCssColorString(this._colorMezclaAgua(intensidad));
    if (typeof m.baseWaterColor?.setRgb === "function") {
      m.baseWaterColor.setRgb(base.red, base.green, base.blue);
      m.blendColor.setRgb(mezcla.red, mezcla.green, mezcla.blue);
      m.amplitude = this.storm ? 10.0 + intensidad * 4 : 5.0 + intensidad * 5;
      m.animationSpeed =
        (this.storm ? 0.14 : 0.02) + Math.min(0.1, Math.abs(this.velActualCmH) * 0.004) + intensidad * 0.02;
    } else if (typeof m.alpha === "number") {
      // Fallback ImageMaterialProperty: la gasa se expresa con alfa.
      m.alpha = Math.min(1, 0.45 + intensidad * 0.25);
    }
  }

  private _actualizarMuro(altura: number) {
    const C = this.Cesium;
    const { west, south, east, north } = this.bounds;
    const esquinas: [number, number][] = [
      [south - 0.002, west - 0.002],
      [south - 0.002, east + 0.002],
      [north + 0.002, east + 0.002],
      [north + 0.002, west - 0.002],
    ];
    const posiciones: any[] = [];
    for (const [lat, lng] of esquinas) {
      posiciones.push(C.Cartesian3.fromDegrees(lng, lat, 0.05));
      posiciones.push(C.Cartesian3.fromDegrees(lng, lat, altura));
    }
    this.muro.wall.positions = posiciones;
  }

  private _repartirGotas() {
    if (this.nivelActualCm < AGUA_MIN_VISIBLE_CM) {
      for (const g of this.gotas) {
        g.active = false;
        g.entity.show = false;
      }
      return;
    }
    const nivel = this.nivelActualCm;
    const factor = Math.min(2, nivel / 25); // a 50 cm ya hay flujo completo
    const porSeg = Math.max(
      1,
      Math.round(this.isTouch ? MAX_POR_SEGMENTO * 0.5 : MAX_POR_SEGMENTO)
    );

    let idx = 0;
    for (const calle of this.calles) {
      const cantidad = Math.max(
        0,
        Math.min(porSeg, Math.round(calle.peso * factor * 0.9))
      );
      for (let j = 0; j < cantidad && idx < this.gotas.length; j++) {
        const g = this.gotas[idx++];
        if (g.segId !== calle.id) {
          g.seg = calle;
          g.segId = calle.id;
          g.offset = Math.random();
          const presu = Math.min(1, Math.max(0.02, metodoPeso(calle)));
          g.speed = 0.05 + presu * 0.12 + Math.random() * 0.04;
        }
        g.active = true;
        g.entity.show = this.visible;
        this._posicionarGota(g);
      }
    }
    // Las que quedaron sin asignar se ocultan.
    for (; idx < this.gotas.length; idx++) {
      const g = this.gotas[idx];
      g.active = false;
      g.entity.show = false;
    }
  }

  private _posicionarGota(g: Droplet) {
    if (!g.seg) return;
    const s = g.seg.sentido > 0 ? g.offset : 1 - g.offset;
    const p = streetPointAt(g.seg.points, s);
    g.entity.position = this.Cesium.Cartesian3.fromDegrees(p.lng, p.lat, 0.9);
  }

  /** Avanza las gotas por las calles (llamar ~30 fps desde el RAF del visor). */
  animate(deltaSeconds: number) {
    if (!this.visible || this.nivelActualCm < AGUA_MIN_VISIBLE_CM) return;
    const velBoost = this.storm ? 1.6 : 1 + Math.min(1.4, Math.abs(this.velActualCmH) * 0.05);
    const dt = Math.min(0.05, deltaSeconds) * velBoost;
    let mover = false;
    for (const g of this.gotas) {
      if (!g.active || !g.seg) continue;
      g.offset += g.speed * dt;
      if (g.offset >= 1) g.offset -= 1;
      const s = g.seg.sentido > 0 ? g.offset : 1 - g.offset;
      const p = streetPointAt(g.seg.points, s);
      g.entity.position = this.Cesium.Cartesian3.fromDegrees(p.lng, p.lat, 0.9);
      mover = true;
    }
    // La ondulacion de la lamina la anima el propio shader Water (czm_frameNumber)
    // cada vez que la escena se redibuja; aquí solo pedimos redibujo si es preciso.
    if (mover) this.viewer.scene.requestRender();
  }

  setVisible(v: boolean) {
    if (this.visible === v) return;
    this.visible = v;
    this._aplicarVisibilidad(v);
    this.viewer.scene.requestRender();
  }

  private _aplicarVisibilidad(v: boolean) {
    if (this.superficie) this.superficie.show = v && this.nivelActualCm >= AGUA_MIN_VISIBLE_CM;
    if (this.muro) this.muro.show = v;
    for (const { ent } of this.linhasCalles) ent.show = v;
    for (const g of this.gotas) g.entity.show = v && g.active;
  }

  dispose() {
    const entities = [
      this.superficie,
      this.muro,
      ...this.linhasCalles.map((l) => l.ent),
      ...this.gotas.map((g) => g.entity),
    ].filter(Boolean);
    for (const e of entities) this.viewer.entities.remove(e);
    this.superficie = null;
    this.matSuperficie = null;
    this.muro = null;
    this.linhasCalles = [];
    this.gotas = [];
  }
}

/** Cuanto "fluye" una calle segun su peso: las avenidas corren mas. */
function metodoPeso(calle: StreetSegment): number {
  return calle.peso / 4;
}