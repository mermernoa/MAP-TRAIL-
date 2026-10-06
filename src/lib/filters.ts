import type { Course, Popularity, RaceEvent, Technicity, UtmbCategory } from '../data/types';
import { countryName, courseUtmbCategory, haversineKm, itraPoints } from './metrics';

/** Crans des curseurs (non linéaires : plus fins sur les petites distances). */
export const DISTANCE_STOPS = [0, 10, 20, 30, 42, 50, 60, 80, 100, 130, 160, 200, 300, Infinity];
export const ELEVATION_STOPS = [0, 500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 15000, Infinity];

export interface NearFilter {
  lat: number;
  lng: number;
  radiusKm: number;
  label: string;
}

export interface Filters {
  query: string;
  distance: [number, number];
  elevation: [number, number];
  technicity: Technicity[];
  itraMin: number;
  utmbCategories: UtmbCategory[];
  circuits: string[];
  countries: string[];
  regions: string[];
  massifs: string[];
  /** Type de course (Trail court, Trail long, Ultra-trail, Trail nocturne…). */
  types: string[];
  /** Solo, Duo, Relais… */
  formats: string[];
  /** Prix maximal en euros (null : pas de limite). */
  priceMax: number | null;
  /** Masquer les courses complètes. */
  hideFull: boolean;
  near: NearFilter | null;
  dateFrom: string | null;
  dateTo: string | null;
  popularity: Popularity[];
  registrationOpen: boolean;
  includePast: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  distance: [0, Infinity],
  elevation: [0, Infinity],
  technicity: [],
  itraMin: 0,
  utmbCategories: [],
  circuits: [],
  countries: [],
  regions: [],
  massifs: [],
  types: [],
  formats: [],
  priceMax: null,
  hideFull: false,
  near: null,
  dateFrom: null,
  dateTo: null,
  popularity: [],
  registrationOpen: false,
  includePast: false,
};

export type SortKey =
  | 'date'
  | 'popularity-desc'
  | 'popularity-asc'
  | 'distance-desc'
  | 'distance-asc'
  | 'elevation-desc'
  | 'name';

export const SORT_LABELS: Record<SortKey, string> = {
  date: 'Date',
  'popularity-desc': 'Les plus connues',
  'popularity-asc': 'Les plus confidentielles',
  'distance-desc': 'Les plus longues',
  'distance-asc': 'Les plus courtes',
  'elevation-desc': 'Le plus de dénivelé',
  name: 'Nom',
};

export interface Match {
  event: RaceEvent;
  /** Parcours de l'événement qui satisfont les filtres. */
  courses: Course[];
  /** Date (YYYY-MM-DD) du premier parcours retenu. */
  firstDate: string;
}

/** Minuscules sans accents, pour une recherche tolérante. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export type RegistrationState = 'open' | 'upcoming' | 'closed' | 'unknown';

export function registrationState(event: RaceEvent, today: string): RegistrationState {
  const { opens, closes } = event.registration;
  if (!opens && !closes) return 'unknown';
  if (opens && today < opens) return 'upcoming';
  if (closes && today > closes) return 'closed';
  if (!closes && today > event.dateStart) return 'closed';
  return 'open';
}

function inRange(value: number, [min, max]: [number, number]): boolean {
  return value >= min && value <= max;
}

export function courseMatches(course: Course, f: Filters, today: string): boolean {
  if (!inRange(course.distanceKm, f.distance)) return false;
  // Un critère de D+, de technicité ou d'index écarte les parcours dont la valeur n'est pas connue.
  if (f.elevation[0] > 0 || f.elevation[1] !== Infinity) {
    if (course.elevationGain == null || !inRange(course.elevationGain, f.elevation)) return false;
  }
  if (f.technicity.length && (course.technicity == null || !f.technicity.includes(course.technicity))) return false;
  if (f.itraMin > 0 && (itraPoints(course) ?? -1) < f.itraMin) return false;
  if (f.utmbCategories.length) {
    const cat = courseUtmbCategory(course);
    if (!cat || !f.utmbCategories.includes(cat)) return false;
  }
  if (f.types.length && (!course.type || !f.types.includes(course.type))) return false;
  if (f.formats.length && (!course.format || !f.formats.includes(course.format))) return false;
  if (f.priceMax != null && (course.priceEur == null || course.priceEur > f.priceMax)) return false;
  if (f.hideFull && course.full === 'yes') return false;
  const day = course.start.slice(0, 10);
  if (!f.includePast && day < today) return false;
  if (f.dateFrom && day < f.dateFrom) return false;
  if (f.dateTo && day > f.dateTo) return false;
  return true;
}

export function eventMatches(event: RaceEvent, f: Filters, today: string): boolean {
  if (f.query.trim()) {
    const haystack = normalize(
      [
        event.name,
        event.city,
        event.region,
        event.department ?? '',
        event.massif ?? '',
        countryName(event.country),
        ...event.courses.map((c) => `${c.name} ${c.startPlace ?? ''}`),
      ].join(' '),
    );
    const words = normalize(f.query).split(/\s+/).filter(Boolean);
    if (!words.every((w) => haystack.includes(w))) return false;
  }
  if (f.countries.length && !f.countries.includes(event.country)) return false;
  if (f.regions.length && !f.regions.includes(event.region)) return false;
  if (f.massifs.length && (!event.massif || !f.massifs.includes(event.massif))) return false;
  if (f.circuits.length && !f.circuits.some((c) => event.circuits.includes(c))) return false;
  if (f.popularity.length && !f.popularity.includes(event.popularity)) return false;
  if (f.near && haversineKm(f.near.lat, f.near.lng, event.lat, event.lng) > f.near.radiusKm) return false;
  if (f.registrationOpen && registrationState(event, today) !== 'open') return false;
  return true;
}

export function applyFilters(events: RaceEvent[], f: Filters, today: string): Match[] {
  const out: Match[] = [];
  for (const event of events) {
    if (!eventMatches(event, f, today)) continue;
    const courses = event.courses
      .filter((c) => courseMatches(c, f, today))
      .sort((a, b) => b.distanceKm - a.distanceKm);
    if (!courses.length) continue;
    const firstDate = courses.map((c) => c.start.slice(0, 10)).sort()[0];
    out.push({ event, courses, firstDate });
  }
  return out;
}

export function sortMatches(matches: Match[], key: SortKey): Match[] {
  const maxDist = (m: Match) => Math.max(...m.courses.map((c) => c.distanceKm));
  const minDist = (m: Match) => Math.min(...m.courses.map((c) => c.distanceKm));
  const maxElev = (m: Match) => Math.max(...m.courses.map((c) => c.elevationGain ?? -1));
  const byDate = (a: Match, b: Match) => a.firstDate.localeCompare(b.firstDate);
  const sorted = [...matches];
  switch (key) {
    case 'date':
      return sorted.sort(byDate);
    case 'popularity-desc':
      return sorted.sort((a, b) => b.event.popularity - a.event.popularity || byDate(a, b));
    case 'popularity-asc':
      return sorted.sort((a, b) => a.event.popularity - b.event.popularity || byDate(a, b));
    case 'distance-desc':
      return sorted.sort((a, b) => maxDist(b) - maxDist(a));
    case 'distance-asc':
      return sorted.sort((a, b) => minDist(a) - minDist(b));
    case 'elevation-desc':
      return sorted.sort((a, b) => maxElev(b) - maxElev(a));
    case 'name':
      return sorted.sort((a, b) => a.event.name.localeCompare(b.event.name, 'fr'));
  }
}

/** Nombre de critères actifs (pour le badge du bouton Filtres). */
export function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.distance[0] > 0 || f.distance[1] !== Infinity) n++;
  if (f.elevation[0] > 0 || f.elevation[1] !== Infinity) n++;
  if (f.technicity.length) n++;
  if (f.itraMin > 0) n++;
  if (f.utmbCategories.length) n++;
  if (f.circuits.length) n++;
  if (f.countries.length) n++;
  if (f.regions.length) n++;
  if (f.massifs.length) n++;
  if (f.types.length) n++;
  if (f.formats.length) n++;
  if (f.priceMax != null) n++;
  if (f.hideFull) n++;
  if (f.near) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.popularity.length) n++;
  if (f.registrationOpen) n++;
  if (f.includePast) n++;
  return n;
}
