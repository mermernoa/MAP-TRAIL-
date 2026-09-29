import type { Course, Popularity, RaceEvent, Technicity, UtmbCategory } from '../data/types';

/** Km-effort : distance + D+ / 100 (convention ITRA / UTMB). */
export function kmEffort(course: Pick<Course, 'distanceKm' | 'elevationGain'>): number {
  return course.distanceKm + course.elevationGain / 100;
}

/**
 * Points ITRA estimés à partir des km-effort (barème ITRA : 25, 45, 75, 115, 155, 210).
 * La valeur officielle est publiée par l'ITRA pour chaque édition.
 */
export function estimateItraPoints(effort: number): number {
  if (effort >= 210) return 6;
  if (effort >= 155) return 5;
  if (effort >= 115) return 4;
  if (effort >= 75) return 3;
  if (effort >= 45) return 2;
  if (effort >= 25) return 1;
  return 0;
}

/** Catégorie UTMB Index correspondant aux km-effort. */
export function utmbCategory(effort: number): UtmbCategory | null {
  if (effort >= 210) return '100M';
  if (effort >= 115) return '100K';
  if (effort >= 45) return '50K';
  if (effort >= 25) return '20K';
  return null;
}

const STONES: Record<UtmbCategory, number> = { '20K': 1, '50K': 2, '100K': 3, '100M': 4 };

export function isUtmbSeries(event: Pick<RaceEvent, 'circuits'>): boolean {
  return event.circuits.includes('UTMB World Series');
}

/** Running Stones gagnées en finissant une course UTMB World Series (hors finales). */
export function runningStones(event: RaceEvent, course: Course): number {
  if (course.runningStones != null) return course.runningStones;
  if (!isUtmbSeries(event) || event.circuits.includes('Finale UTMB World Series')) return 0;
  const cat = utmbCategory(kmEffort(course));
  return cat ? STONES[cat] : 0;
}

export function itraPoints(course: Course): number {
  return course.itraPoints ?? estimateItraPoints(kmEffort(course));
}

/** Tranches de distance utilisées pour la couleur des repères de la carte. */
export const DISTANCE_BANDS = [
  { id: 'xs', label: 'Moins de 30 km', short: '< 30 km', min: 0, max: 30 },
  { id: 's', label: '30 à 60 km', short: '30–60', min: 30, max: 60 },
  { id: 'm', label: '60 à 100 km', short: '60–100', min: 60, max: 100 },
  { id: 'l', label: '100 à 155 km', short: '100–155', min: 100, max: 155 },
  { id: 'xl', label: '100 miles et plus', short: '100 mi+', min: 155, max: Infinity },
] as const;

export type DistanceBandId = (typeof DISTANCE_BANDS)[number]['id'];

export function distanceBand(km: number): DistanceBandId {
  const band = DISTANCE_BANDS.find((b) => km >= b.min && km < b.max);
  return band ? band.id : 'xl';
}

export const TECHNICITY_LABELS: Record<Technicity, { label: string; hint: string }> = {
  1: { label: 'Roulant', hint: 'Chemins larges, peu de pierres, accessible aux coureurs sur route.' },
  2: { label: 'Peu technique', hint: 'Sentiers faciles, quelques passages caillouteux ou racineux.' },
  3: { label: 'Modérément technique', hint: 'Sentiers de montagne, descentes raides et pierriers ponctuels.' },
  4: { label: 'Technique', hint: 'Pierriers, dalles, passages équipés ; pied montagnard requis.' },
  5: { label: 'Très technique', hint: 'Hors sentier, blocs, crêtes exposées, orientation parfois nécessaire.' },
};

export const POPULARITY_LABELS: Record<Popularity, { label: string; hint: string }> = {
  1: { label: 'Confidentielle', hint: 'Quelques dizaines de coureurs, souvent sur invitation ou candidature.' },
  2: { label: 'Locale', hint: 'Connue dans sa région, ambiance village.' },
  3: { label: 'Réputée', hint: 'Attire des coureurs de tout le pays.' },
  4: { label: 'Internationale', hint: 'Plateau international, dossards très demandés.' },
  5: { label: 'Mythique', hint: 'Une course dont tout traileur a entendu parler.' },
};

const COUNTRY_NAMES: Record<string, string> = {
  FR: 'France',
  IT: 'Italie',
  CH: 'Suisse',
  ES: 'Espagne',
  PT: 'Portugal',
  AD: 'Andorre',
  AT: 'Autriche',
  DE: 'Allemagne',
  HR: 'Croatie',
  SE: 'Suède',
  GB: 'Royaume-Uni',
  TR: 'Turquie',
  MA: 'Maroc',
  US: 'États-Unis',
  CA: 'Canada',
  AU: 'Australie',
  NZ: 'Nouvelle-Zélande',
  HK: 'Hong Kong',
  JP: 'Japon',
  ZA: 'Afrique du Sud',
  CM: 'Cameroun',
  NP: 'Népal',
  BE: 'Belgique',
  LU: 'Luxembourg',
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Distance à vol d'oiseau en km (formule de haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Plus longue distance proposée par l'événement (sert à la couleur du repère). */
export function longestCourse(event: RaceEvent): Course {
  return event.courses.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
}
