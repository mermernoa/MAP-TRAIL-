import type { MapLibreMap } from './maplibre';
import type { ParsedTrack, TrackPoint } from './gpx';
import { clamp } from './explore';

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Position sur la trace à `km` du départ, interpolée entre deux points. */
export function positionAtKm(points: TrackPoint[], km: number): [number, number] {
  if (!points.length) return [0, 0];
  if (km <= points[0].km) return [points[0].lng, points[0].lat];
  const last = points[points.length - 1];
  if (km >= last.km) return [last.lng, last.lat];
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].km <= km) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const t = b.km > a.km ? (km - a.km) / (b.km - a.km) : 0;
  return [a.lng + (b.lng - a.lng) * t, a.lat + (b.lat - a.lat) * t];
}

/** Cap initial (degrés, 0 = nord) pour aller de `a` vers `b`. */
export function bearingBetween([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lng2 - lng1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Écart d'angle le plus court de `from` vers `to`, entre -180 et 180. */
export function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Durée du survol complet : assez long pour lire le relief, jamais interminable. */
export function flyoverSeconds(distanceKm: number): number {
  return clamp(22 + distanceKm * 0.42, 26, 95);
}

interface FlyoverOptions {
  /** Appelé à chaque image avec la position du coureur, en km. */
  onKm?: (km: number) => void;
  /** Lecture ou pause (y compris à l'arrivée). */
  onPlayingChange?: (playing: boolean) => void;
}

/**
 * Survol d'un parcours en 3D : la caméra suit le coureur le long de la trace,
 * légèrement en retrait, le regard tourné vers la suite du chemin.
 */
export class TrackFlyover {
  private map: MapLibreMap;
  private points: TrackPoint[];
  private total: number;
  private opts: FlyoverOptions;
  private raf = 0;
  private last = 0;
  private heading = 0;
  private approaching = false;
  km = 0;
  playing = false;

  constructor(map: MapLibreMap, track: ParsedTrack, opts: FlyoverOptions = {}) {
    this.map = map;
    this.points = track.points;
    this.total = track.distanceKm || track.points[track.points.length - 1]?.km || 0;
    this.opts = opts;
  }

  get distanceKm() {
    return this.total;
  }

  /** Regard porté assez loin pour ne pas suivre chaque lacet. */
  private lookAhead() {
    return clamp(this.total * 0.012, 0.3, 1.1);
  }

  private targetHeading(km: number) {
    const here = positionAtKm(this.points, km);
    const ahead = positionAtKm(this.points, Math.min(this.total, km + this.lookAhead()));
    if (here[0] === ahead[0] && here[1] === ahead[1]) {
      const behind = positionAtKm(this.points, Math.max(0, km - this.lookAhead()));
      return bearingBetween(behind, here);
    }
    return bearingBetween(here, ahead);
  }

  private camera() {
    // Plus le parcours est court, plus on vole bas.
    const zoom = clamp(14.1 - Math.log2(Math.max(1, this.total) / 8) * 0.45, 12.6, 14.1);
    return { zoom, pitch: 66 };
  }

  play() {
    if (this.playing || !this.total) return;
    if (this.km >= this.total - 1e-6) this.km = 0;
    this.setPlaying(true);
    // On rejoint d'abord le coureur en douceur, puis la poursuite démarre.
    this.heading = this.targetHeading(this.km);
    this.approaching = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.map.flyTo({
      center: positionAtKm(this.points, this.km),
      bearing: this.heading,
      ...this.camera(),
      duration: reduce ? 0 : 1800,
      essential: true,
    });
    this.map.once('moveend', () => {
      this.approaching = false;
      if (!this.playing) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.step(t));
    });
    this.opts.onKm?.(this.km);
  }

  pause() {
    if (!this.playing) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.approaching) this.map.stop();
    this.setPlaying(false);
  }

  /** Place le coureur à `km` (curseur de lecture). */
  seek(km: number) {
    this.km = clamp(km, 0, this.total);
    if (!this.playing || this.approaching) {
      this.heading = this.targetHeading(this.km);
      this.map.jumpTo({ center: positionAtKm(this.points, this.km), bearing: this.heading, ...this.camera() });
    }
    this.opts.onKm?.(this.km);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.playing = false;
  }

  private setPlaying(v: boolean) {
    this.playing = v;
    this.opts.onPlayingChange?.(v);
  }

  private step(now: number) {
    this.raf = 0;
    if (!this.playing) return;
    const dt = Math.min(0.12, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.km = Math.min(this.total, this.km + (this.total / flyoverSeconds(this.total)) * dt);
    // Le cap suit la trace avec inertie, comme un drone qui anticipe les virages.
    this.heading += angleDelta(this.heading, this.targetHeading(this.km)) * (1 - Math.exp(-dt * 1.6));
    this.map.jumpTo({ center: positionAtKm(this.points, this.km), bearing: this.heading });
    this.opts.onKm?.(this.km);
    if (this.km >= this.total) {
      this.setPlaying(false);
      return;
    }
    this.raf = requestAnimationFrame((t) => this.step(t));
  }
}

/** Tour d'horizon : la caméra tourne lentement autour du point visé. Renvoie la fonction d'arrêt. */
export function orbit(map: MapLibreMap, degreesPerSecond = 7): () => void {
  let raf = 0;
  let last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(0.12, Math.max(0, (now - last) / 1000));
    last = now;
    map.jumpTo({ bearing: map.getBearing() + degreesPerSecond * dt });
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Altitude du GPX à `km`, interpolée, ou null si le fichier n'en contient pas. */
export function elevationAtKm(points: TrackPoint[], km: number): number | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].km <= km) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  if (a.ele == null || b.ele == null) return a.ele ?? b.ele;
  const t = b.km > a.km ? clamp((km - a.km) / (b.km - a.km), 0, 1) : 0;
  return Math.round(a.ele + (b.ele - a.ele) * t);
}
