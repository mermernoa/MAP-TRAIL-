import { haversineKm } from './metrics';
import type { Checkpoint } from '../data/types';

export interface TrackPoint {
  lat: number;
  lng: number;
  /** Altitude en mètres, si le fichier en contient. */
  ele: number | null;
  /** Distance cumulée depuis le départ, en km. */
  km: number;
}

export interface ParsedTrack {
  name: string | null;
  points: TrackPoint[];
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  minEle: number | null;
  maxEle: number | null;
  /** [[ouest, sud], [est, nord]] */
  bounds: [[number, number], [number, number]];
  waypoints: { name: string; lat: number; lng: number }[];
}

/** Un point du profil altimétrique. */
export interface ProfilePoint {
  km: number;
  alt: number;
  label?: string;
}

export class GpxError extends Error {}

export function parseGpx(text: string): ParsedTrack {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new GpxError("Ce fichier n'est pas un GPX valide.");
  }
  let nodes = Array.from(doc.getElementsByTagName('trkpt'));
  if (!nodes.length) nodes = Array.from(doc.getElementsByTagName('rtept'));
  if (nodes.length < 2) {
    throw new GpxError('Le fichier ne contient pas de trace (aucun point trkpt ou rtept).');
  }

  const points: TrackPoint[] = [];
  let km = 0;
  for (const node of nodes) {
    const lat = Number(node.getAttribute('lat'));
    const lng = Number(node.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const eleText = node.getElementsByTagName('ele')[0]?.textContent;
    const ele = eleText != null && eleText.trim() !== '' ? Number(eleText) : null;
    const prev = points[points.length - 1];
    if (prev) km += haversineKm(prev.lat, prev.lng, lat, lng);
    points.push({ lat, lng, ele: ele != null && Number.isFinite(ele) ? ele : null, km });
  }
  if (points.length < 2) throw new GpxError('La trace ne contient pas de coordonnées exploitables.');

  const { gain, loss } = elevationDelta(points.map((p) => p.ele));
  const eles = points.map((p) => p.ele).filter((e): e is number => e != null);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }

  const waypoints = Array.from(doc.getElementsByTagName('wpt'))
    .map((w) => ({
      name: w.getElementsByTagName('name')[0]?.textContent?.trim() || 'Point',
      lat: Number(w.getAttribute('lat')),
      lng: Number(w.getAttribute('lon')),
    }))
    .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lng));

  const name =
    doc.querySelector('trk > name')?.textContent?.trim() ||
    doc.querySelector('metadata > name')?.textContent?.trim() ||
    null;

  return {
    name,
    points,
    distanceKm: km,
    elevationGain: gain,
    elevationLoss: loss,
    minEle: eles.length ? Math.min(...eles) : null,
    maxEle: eles.length ? Math.max(...eles) : null,
    bounds: [
      [west, south],
      [east, north],
    ],
    waypoints,
  };
}

/**
 * Dénivelés cumulés avec un seuil d'hystérésis, pour ne pas compter le bruit
 * des altitudes GPS (quelques mètres entre deux points).
 */
export function elevationDelta(eles: (number | null)[], threshold = 4): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  let ref: number | null = null;
  for (const e of eles) {
    if (e == null) continue;
    if (ref == null) {
      ref = e;
      continue;
    }
    const diff = e - ref;
    if (diff >= threshold) {
      gain += diff;
      ref = e;
    } else if (diff <= -threshold) {
      loss -= diff;
      ref = e;
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

/** Réduit une trace à `max` points au plus, en gardant le premier et le dernier. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

export function profileFromTrack(track: ParsedTrack, max = 600): ProfilePoint[] {
  const withEle = track.points.filter((p) => p.ele != null);
  return downsample(withEle, max).map((p) => ({ km: p.km, alt: p.ele as number }));
}

export function profileFromCheckpoints(checkpoints: Checkpoint[]): ProfilePoint[] {
  return checkpoints.map((c) => ({ km: c.km, alt: c.alt, label: c.name }));
}

/** Altitude interpolée à une distance donnée. */
export function altitudeAt(profile: ProfilePoint[], km: number): number {
  if (!profile.length) return 0;
  if (km <= profile[0].km) return profile[0].alt;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (km <= b.km) {
      const t = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km);
      return a.alt + t * (b.alt - a.alt);
    }
  }
  return profile[profile.length - 1].alt;
}

/** Sérialise une liste de points en GPX 1.1 (export d'une trace importée). */
export function toGpx(name: string, points: Pick<TrackPoint, 'lat' | 'lng' | 'ele'>[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${
          p.ele != null ? `<ele>${p.ele.toFixed(1)}</ele>` : ''
        }</trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Take Ton Trail" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
