import type { Course, Popularity, RaceEvent, Technicity, UtmbCategory } from '../data/types';

/** Km-effort : distance + D+ / 100 (convention ITRA / UTMB). */
export function kmEffort(course: Pick<Course, 'distanceKm' | 'elevationGain'>): number {
  return course.distanceKm + (course.elevationGain ?? 0) / 100;
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

/** Catégorie publiée dans la base, sinon calculée depuis les km-effort (D+ connu). */
export function courseUtmbCategory(course: Course): UtmbCategory | null {
  if (course.utmbCategory) return course.utmbCategory;
  if (course.elevationGain == null) return null;
  return utmbCategory(kmEffort(course));
}

/** Running Stones gagnées en finissant une course UTMB World Series (hors finales). */
export function runningStones(event: RaceEvent, course: Course): number {
  if (course.runningStones != null) return course.runningStones;
  if (!isUtmbSeries(event) || event.circuits.includes('Finale UTMB World Series')) return 0;
  const cat = courseUtmbCategory(course);
  return cat ? STONES[cat] : 0;
}

/** Points ITRA publiés, sinon estimés ; inconnus si le D+ n'est pas communiqué. */
export function itraPoints(course: Course): number | null {
  if (course.itraPoints != null) return course.itraPoints;
  if (course.elevationGain == null) return null;
  return estimateItraPoints(kmEffort(course));
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
  1: { label: 'Roulant', hint: 'Chemins larges et roulants, accessible à un débutant.' },
  2: { label: 'Facile', hint: 'Sentiers faciles, quelques passages caillouteux.' },
  3: { label: 'Montagne', hint: 'Sentiers de montagne, racines et cailloux, descentes soutenues.' },
  4: { label: 'Technique', hint: 'Passages très techniques : pierriers, dalles, mains parfois nécessaires.' },
  5: { label: 'Alpin', hint: 'Terrain alpin : crêtes aériennes, passages équipés, hors sentier.' },
};

export const POPULARITY_LABELS: Record<Popularity, { label: string; hint: string }> = {
  1: { label: 'Confidentielle', hint: 'Course locale confidentielle, moins de 200 coureurs.' },
  2: { label: 'Régionale', hint: 'Course régionale connue, jamais complète.' },
  3: { label: 'Réputée', hint: 'Belle réputation, complète quelques semaines avant.' },
  4: { label: 'Très demandée', hint: 'Complète en quelques jours ou tirage au sort.' },
  5: { label: 'Mythique', hint: 'Référence nationale ou internationale.' },
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
