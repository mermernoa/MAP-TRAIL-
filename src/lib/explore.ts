import type { MapLibreMap } from './maplibre';

/**
 * Exploration de la carte en 3D, façon Street View : on regarde autour de soi
 * en glissant, on avance, on tourne et on prend de l'altitude au clavier, au
 * trackpad, au joystick à l'écran ou à la manette. Toutes les entrées
 * alimentent les mêmes commandes, lissées image par image.
 */

/** Commandes normalisées entre -1 et 1. */
export interface ExploreInput {
  /** Avancer (+) ou reculer (-). */
  forward: number;
  /** Pas de côté vers la droite (+) ou la gauche (-). */
  strafe: number;
  /** Tourner vers la droite (+) ou la gauche (-). */
  turn: number;
  /** Lever (+) ou baisser (-) le regard. */
  tilt: number;
  /** Prendre (+) ou perdre (-) de l'altitude (zoom). */
  climb: number;
}

export const NO_INPUT: ExploreInput = { forward: 0, strafe: 0, turn: 0, tilt: 0, climb: 0 };

const EARTH_RADIUS = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Point atteint en partant de `from` dans la direction `bearing` (degrés) sur `meters`. */
export function destination([lng, lat]: [number, number], bearing: number, meters: number): [number, number] {
  const d = meters / EARTH_RADIUS;
  const b = toRad(bearing);
  const p1 = toRad(lat);
  const l1 = toRad(lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((toDeg(l2) + 540) % 360) - 180, toDeg(p2)];
}

/** Mètres par pixel à l'écran au centre de la carte (tuiles de 512 px). */
export function metersPerPixel(lat: number, zoom: number): number {
  return (40075016.686 * Math.cos(toRad(lat))) / (512 * 2 ** zoom);
}

/** Cap lisible : « 45° NE ». */
export function headingLabel(bearing: number): string {
  const deg = ((Math.round(bearing) % 360) + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return `${deg}° ${names[Math.round(deg / 45) % 8]}`;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const MAX_PITCH = 85;
/** Vitesse de déplacement à plein régime, en pixels d'écran par seconde. */
const MOVE_PX_PER_S = 340;
const TURN_DEG_PER_S = 80;
const TILT_DEG_PER_S = 45;
const CLIMB_ZOOM_PER_S = 1.2;

const KEYS: Record<string, [keyof ExploreInput, number]> = {
  ArrowUp: ['forward', 1],
  KeyW: ['forward', 1], // Z sur un clavier AZERTY
  ArrowDown: ['forward', -1],
  KeyS: ['forward', -1],
  ArrowLeft: ['turn', -1],
  KeyA: ['turn', -1], // Q en AZERTY
  ArrowRight: ['turn', 1],
  KeyD: ['turn', 1],
  KeyQ: ['strafe', -1], // A en AZERTY
  KeyE: ['strafe', 1],
  KeyR: ['tilt', 1],
  PageUp: ['tilt', 1],
  KeyF: ['tilt', -1],
  PageDown: ['tilt', -1],
  Equal: ['climb', -1],
  NumpadAdd: ['climb', -1],
  Minus: ['climb', 1],
  NumpadSubtract: ['climb', 1],
};

export interface ExploreStatus {
  bearing: number;
  pitch: number;
  zoom: number;
}

interface Options {
  onChange?: (status: ExploreStatus) => void;
  /** Double-clic : aller au point visé (comme les flèches au sol de Street View). */
  doubleClickTravel?: boolean;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

export class MapExplorer {
  private map: MapLibreMap;
  private options: Options;
  private active = false;
  private keys = new Map<string, [keyof ExploreInput, number]>();
  private pad: ExploreInput = { ...NO_INPUT };
  private velocity: ExploreInput = { ...NO_INPUT };
  private raf = 0;
  private last = 0;
  private boost = false;
  private drag: { id: number; x: number; y: number; moved: boolean } | null = null;
  private pointers = new Set<number>();
  private gestureRotation = 0;
  private gestureScale = 1;
  private cleanup: (() => void)[] = [];

  constructor(map: MapLibreMap, options: Options = {}) {
    this.map = map;
    this.options = options;
  }

  get isActive() {
    return this.active;
  }

  enable() {
    if (this.active) return;
    this.active = true;
    const map = this.map;
    // On reprend la main sur les gestes qui, en 2D, déplacent ou zooment la carte.
    map.dragPan.disable();
    map.dragRotate.disable();
    map.scrollZoom.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    const container = map.getCanvasContainer();
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };
    on(container, 'wheel', (e) => this.onWheel(e), { passive: false });
    on(container, 'pointerdown', (e) => this.onPointerDown(e));
    on(window, 'pointermove', (e) => this.onPointerMove(e));
    on(window, 'pointerup', (e) => this.onPointerUp(e));
    on(window, 'pointercancel', (e) => this.onPointerUp(e));
    on(window, 'keydown', (e) => this.onKey(e, true));
    on(window, 'keyup', (e) => this.onKey(e, false));
    on(window, 'blur', () => this.keys.clear());
    // Safari (macOS) : rotation à deux doigts sur le trackpad.
    on(container, 'gesturestart' as keyof HTMLElementEventMap, (e) => this.onGesture(e as unknown as GestureLike, true), { passive: false });
    on(container, 'gesturechange' as keyof HTMLElementEventMap, (e) => this.onGesture(e as unknown as GestureLike, false), { passive: false });
    on(window, 'gamepadconnected' as keyof HTMLElementEventMap, () => this.wake());
    if (this.options.doubleClickTravel !== false) {
      const onDbl = (e: { lngLat: { lng: number; lat: number }; originalEvent?: Event }) => {
        e.originalEvent?.preventDefault();
        map.easeTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom: Math.min(map.getZoom() + 0.7, 16.5), duration: 1100 });
      };
      map.on('dblclick', onDbl);
      this.cleanup.push(() => map.off('dblclick', onDbl));
    }
    this.wake();
  }

  disable() {
    if (!this.active) return;
    this.active = false;
    for (const fn of this.cleanup.splice(0)) fn();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.keys.clear();
    this.pad = { ...NO_INPUT };
    this.velocity = { ...NO_INPUT };
    this.drag = null;
    this.pointers.clear();
    const map = this.map;
    map.dragPan.enable();
    map.dragRotate.enable();
    map.scrollZoom.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
  }

  destroy() {
    this.disable();
  }

  /** Commandes du joystick à l'écran (remplacent les précédentes). */
  setPad(input: Partial<ExploreInput>) {
    this.pad = { ...NO_INPUT, ...input };
    this.wake();
  }

  /** Remet le nord en haut. */
  faceNorth() {
    this.map.easeTo({ bearing: 0, duration: 700 });
  }

  // ---------- Entrées

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.key === 'Shift') this.boost = down;
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    // Le clavier pilote la carte quand elle a le focus (ou personne) : pas pendant qu'on parcourt la liste.
    const focused = document.activeElement;
    if (down && focused && focused !== document.body && !this.map.getContainer().contains(focused)) return;
    const binding = KEYS[e.code];
    if (!binding) return;
    e.preventDefault();
    if (down) this.keys.set(e.code, binding);
    else this.keys.delete(e.code);
    this.boost = e.shiftKey;
    this.wake();
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();
    const map = this.map;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    if (e.ctrlKey) {
      // Pincer sur le trackpad (ou Ctrl + molette) : altitude.
      map.jumpTo({ zoom: clamp(map.getZoom() - dy * 0.012, 3, 17.5) });
    } else if (e.shiftKey && !dx) {
      map.jumpTo({ pitch: clamp(map.getPitch() - dy * 0.12, 0, MAX_PITCH) });
    } else {
      // Glisser à deux doigts : horizontal = tourner, vertical = avancer ou reculer.
      const c = map.getCenter();
      const meters = dy * 1.4 * metersPerPixel(c.lat, map.getZoom());
      const bearing = map.getBearing();
      map.jumpTo({ center: meters ? destination([c.lng, c.lat], bearing, meters) : c, bearing: bearing + dx * 0.22 });
    }
    this.emit();
  }

  private onGesture(e: GestureLike, start: boolean) {
    e.preventDefault();
    if (start) {
      this.gestureRotation = 0;
      this.gestureScale = 1;
      return;
    }
    const map = this.map;
    const rot = e.rotation - this.gestureRotation;
    const scale = e.scale / this.gestureScale;
    this.gestureRotation = e.rotation;
    this.gestureScale = e.scale;
    map.jumpTo({ bearing: map.getBearing() - rot, zoom: clamp(map.getZoom() + Math.log2(scale), 3, 17.5) });
    this.emit();
  }

  private onPointerDown(e: PointerEvent) {
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1) {
      // Deux doigts : on laisse MapLibre pincer et pivoter.
      this.drag = null;
      return;
    }
    if (e.button !== 0) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  }

  private onPointerMove(e: PointerEvent) {
    const drag = this.drag;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    const map = this.map;
    // On « tire » le paysage, comme dans Street View.
    map.jumpTo({ bearing: map.getBearing() - dx * 0.28, pitch: clamp(map.getPitch() + dy * 0.22, 0, MAX_PITCH) });
    map.getCanvas().style.cursor = 'grabbing';
    this.emit();
  }

  private onPointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.drag?.id === e.pointerId) {
      this.drag = null;
      this.map.getCanvas().style.cursor = '';
    }
  }

  // ---------- Boucle

  private target(): ExploreInput {
    const t: ExploreInput = { ...this.pad };
    for (const [axis, sign] of this.keys.values()) t[axis] = clamp(t[axis] + sign, -1, 1);
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((g) => g && g.connected);
    if (gp) {
      const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
      t.forward = clamp(t.forward - dz(gp.axes[1] ?? 0), -1, 1);
      t.strafe = clamp(t.strafe + dz(gp.axes[0] ?? 0), -1, 1);
      t.turn = clamp(t.turn + dz(gp.axes[2] ?? 0), -1, 1);
      t.tilt = clamp(t.tilt - dz(gp.axes[3] ?? 0), -1, 1);
      const lt = gp.buttons[6]?.value ?? 0;
      const rt = gp.buttons[7]?.value ?? 0;
      t.climb = clamp(t.climb + lt - rt, -1, 1);
      if (gp.buttons[3]?.pressed) this.faceNorth();
    }
    return t;
  }

  private wake() {
    if (!this.active || this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.step(t));
  }

  private step(now: number) {
    this.raf = 0;
    if (!this.active) return;
    // Plafond large : même à faible cadence (machine modeste), le déplacement suit le temps réel.
    const dt = Math.min(0.12, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const target = this.target();
    // Accélération et freinage doux.
    const k = 1 - Math.exp(-dt * 7);
    let moving = false;
    for (const axis of Object.keys(target) as (keyof ExploreInput)[]) {
      this.velocity[axis] += (target[axis] - this.velocity[axis]) * k;
      if (Math.abs(this.velocity[axis]) < 0.002 && target[axis] === 0) this.velocity[axis] = 0;
      if (this.velocity[axis] !== 0) moving = true;
    }
    if (moving) {
      const map = this.map;
      const v = this.velocity;
      const boost = this.boost ? 2.5 : 1;
      const c = map.getCenter();
      const zoom = map.getZoom();
      const step = MOVE_PX_PER_S * metersPerPixel(c.lat, zoom) * dt * boost;
      let bearing = map.getBearing() + v.turn * TURN_DEG_PER_S * dt;
      let center: [number, number] = [c.lng, c.lat];
      if (v.forward) center = destination(center, bearing, v.forward * step);
      if (v.strafe) center = destination(center, bearing + 90, v.strafe * step);
      bearing = ((bearing + 540) % 360) - 180;
      map.jumpTo({
        center,
        bearing,
        pitch: clamp(map.getPitch() + v.tilt * TILT_DEG_PER_S * dt, 0, MAX_PITCH),
        zoom: clamp(zoom - v.climb * CLIMB_ZOOM_PER_S * dt, 3, 17.5),
      });
      this.emit();
    }
    const gamepad = typeof navigator !== 'undefined' && navigator.getGamepads && [...navigator.getGamepads()].some((g) => g && g.connected);
    if (moving || this.keys.size || gamepad || Object.values(this.pad).some(Boolean)) {
      this.raf = requestAnimationFrame((t) => this.step(t));
    }
  }

  private emit() {
    const map = this.map;
    this.options.onChange?.({ bearing: map.getBearing(), pitch: map.getPitch(), zoom: map.getZoom() });
  }
}

interface GestureLike {
  rotation: number;
  scale: number;
  preventDefault(): void;
}
