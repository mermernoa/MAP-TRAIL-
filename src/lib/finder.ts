import type { Course, RaceEvent } from '../data/types';
import { type Filters, normalize } from './filters';

/**
 * « Trouve ta course » : quelques questions simples (quand, combien de km,
 * quel terrain, quelles envies, où) et les courses qui y répondent, classées.
 */

export type When = 'any' | 'month' | 'next' | 'season' | 'later';
export type Distance = 'any' | 'short' | 'mid' | 'marathon' | 'long' | 'ultra';
export type Terrain = 'any' | 'flat' | 'hilly' | 'mountain';
export type Extra = 'night' | 'duo' | 'kv' | 'urban' | 'utmb' | 'cheap' | 'mythic' | 'confidential';

export interface Criteria {
  when: When;
  distance: Distance;
  terrain: Terrain;
  extras: Extra[];
  region: string;
}

export const NO_CRITERIA: Criteria = { when: 'any', distance: 'any', terrain: 'any', extras: [], region: '' };

export const WHEN_OPTIONS: { id: When; label: string; phrase: string; days?: [number, number] }[] = [
  { id: 'any', label: 'Peu importe', phrase: 'à n’importe quelle date' },
  { id: 'month', label: 'Dans le mois', phrase: 'dans le mois', days: [0, 30] },
  { id: 'next', label: 'Le mois suivant', phrase: 'le mois suivant', days: [30, 60] },
  { id: 'season', label: 'Dans 2 à 4 mois', phrase: 'd’ici 2 à 4 mois', days: [60, 120] },
  { id: 'later', label: 'Plus tard', phrase: 'plus tard dans la saison', days: [120, 400] },
];

export const DISTANCE_OPTIONS: { id: Distance; label: string; hint: string; phrase: string; km?: [number, number] }[] = [
  { id: 'any', label: 'Peu importe', hint: '', phrase: 'de toute distance' },
  { id: 'short', label: 'Découverte', hint: 'moins de 15 km', phrase: 'de moins de 15 km', km: [0, 15] },
  { id: 'mid', label: 'Court', hint: '15 à 30 km', phrase: 'de 15 à 30 km', km: [15, 30] },
  { id: 'marathon', label: 'Long', hint: '30 à 50 km', phrase: 'de 30 à 50 km', km: [30, 50] },
  { id: 'long', label: 'Très long', hint: '50 à 80 km', phrase: 'de 50 à 80 km', km: [50, 80] },
  { id: 'ultra', label: 'Ultra', hint: '80 km et plus', phrase: 'de plus de 80 km', km: [80, Infinity] },
];

/** Terrain d'après le dénivelé par kilomètre (D+ connu seulement). */
export const TERRAIN_OPTIONS: { id: Terrain; label: string; hint: string; phrase: string; slope?: [number, number] }[] = [
  { id: 'any', label: 'Peu importe', hint: '', phrase: 'sur tout terrain' },
  { id: 'flat', label: 'Roulant', hint: 'moins de 20 m de D+ par km', phrase: 'plutôt roulante', slope: [0, 20] },
  { id: 'hilly', label: 'Vallonné', hint: '20 à 45 m par km', phrase: 'vallonnée', slope: [20, 45] },
  { id: 'mountain', label: 'Montagne', hint: 'plus de 45 m par km', phrase: 'en montagne', slope: [45, Infinity] },
];

export const EXTRA_OPTIONS: { id: Extra; label: string; phrase: string }[] = [
  { id: 'night', label: 'De nuit', phrase: 'de nuit' },
  { id: 'duo', label: 'En duo ou en relais', phrase: 'à faire à deux' },
  { id: 'kv', label: 'Kilomètre vertical', phrase: 'en kilomètre vertical' },
  { id: 'urban', label: 'En ville', phrase: 'en ville' },
  { id: 'utmb', label: 'UTMB Index', phrase: 'qui rapporte des points UTMB Index' },
  { id: 'cheap', label: 'Petit prix (25 € max)', phrase: 'à petit prix' },
  { id: 'mythic', label: 'Les mythiques', phrase: 'mythique' },
  { id: 'confidential', label: 'Les pépites confidentielles', phrase: 'confidentielle' },
];

const day = (c: Course) => c.start.slice(0, 10);
const slope = (c: Course) => (c.elevationGain != null && c.distanceKm > 0 ? c.elevationGain / c.distanceKm : null);
const isNight = (e: RaceEvent, c: Course) =>
  c.type === 'Trail nocturne' || /nocturne|night|de nuit|frontale|halloween/.test(normalize(`${e.name} ${c.name}`));
const isDuo = (c: Course) => /duo|relais|equipe|team/.test(normalize(`${c.format ?? ''} ${c.name}`));

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5);
}

/** Le parcours répond-il aux critères ? */
export function courseFits(e: RaceEvent, c: Course, k: Criteria, today: string): boolean {
  const d = day(c);
  if (d < today) return false;
  const when = WHEN_OPTIONS.find((o) => o.id === k.when)?.days;
  if (when) {
    const n = daysBetween(today, d);
    if (n < when[0] || n >= when[1]) return false;
  }
  const km = DISTANCE_OPTIONS.find((o) => o.id === k.distance)?.km;
  if (km && (c.distanceKm < km[0] || c.distanceKm >= km[1])) return false;
  const range = TERRAIN_OPTIONS.find((o) => o.id === k.terrain)?.slope;
  if (range) {
    const s = slope(c);
    if (s == null || s < range[0] || s >= range[1]) return false;
  }
  for (const x of k.extras) {
    if (x === 'night' && !isNight(e, c)) return false;
    if (x === 'duo' && !isDuo(c)) return false;
    if (x === 'kv' && c.type !== 'Kilomètre vertical') return false;
    if (x === 'urban' && c.type !== 'Trail urbain') return false;
    if (x === 'utmb' && !c.utmbIndex) return false;
    if (x === 'cheap' && (c.priceEur == null || c.priceEur > 25)) return false;
    if (x === 'mythic' && e.popularity < 4) return false;
    if (x === 'confidential' && e.popularity > 2) return false;
  }
  return true;
}

export interface FinderResult {
  event: RaceEvent;
  courses: Course[];
  score: number;
}

/**
 * Courses qui répondent aux critères, classées : les plus connues et les mieux
 * renseignées d'abord (photo, prix, D+), à notoriété égale la plus proche.
 */
export function findRaces(events: RaceEvent[], k: Criteria, today: string): FinderResult[] {
  const out: FinderResult[] = [];
  for (const e of events) {
    if (e.custom || e.dateEnd < today) continue;
    if (k.region && e.region !== k.region) continue;
    const courses = e.courses.filter((c) => courseFits(e, c, k, today));
    if (!courses.length) continue;
    const first = courses.map(day).sort()[0];
    const soon = Math.max(0, 1 - daysBetween(today, first) / 365);
    const complete = (e.image && e.imageCredit ? 1 : 0) + (courses.some((c) => c.priceEur != null) ? 0.5 : 0) + (courses.some((c) => c.elevationGain != null) ? 0.5 : 0);
    out.push({ event: e, courses, score: e.popularity * 2 + complete + soon * 1.5 + (e.dateStatus === 'official' ? 0.5 : 0) });
  }
  return out.sort((a, b) => b.score - a.score || a.event.dateStart.localeCompare(b.event.dateStart));
}

export function hasCriteria(k: Criteria): boolean {
  return k.when !== 'any' || k.distance !== 'any' || k.terrain !== 'any' || k.extras.length > 0 || !!k.region;
}

/** Les mêmes critères en filtres de la carte (le terrain n'a pas d'équivalent exact). */
export function criteriaToFilters(k: Criteria, today: string): Partial<Filters> {
  const f: Partial<Filters> = {};
  const when = WHEN_OPTIONS.find((o) => o.id === k.when)?.days;
  if (when) {
    const at = (n: number) => new Date(Date.parse(`${today}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
    f.dateFrom = at(when[0]);
    f.dateTo = at(when[1] - 1);
  }
  const km = DISTANCE_OPTIONS.find((o) => o.id === k.distance)?.km;
  if (km) f.distance = [km[0], km[1]];
  if (k.region) f.regions = [k.region];
  const types: string[] = [];
  if (k.extras.includes('night')) types.push('Trail nocturne');
  if (k.extras.includes('kv')) types.push('Kilomètre vertical');
  if (k.extras.includes('urban')) types.push('Trail urbain');
  if (types.length) f.types = types;
  if (k.extras.includes('duo')) f.formats = ['Duo', 'Relais'];
  if (k.extras.includes('cheap')) f.priceMax = 25;
  if (k.extras.includes('mythic')) f.popularity = [4, 5];
  else if (k.extras.includes('confidential')) f.popularity = [1, 2];
  return f;
}

// ---------- Adresse partageable (#/trouver?quand=…&km=…)

export function criteriaFromParams(p: URLSearchParams): Criteria {
  const pick = <T extends string>(value: string | null, options: { id: T }[], fallback: T) =>
    options.some((o) => o.id === value) ? (value as T) : fallback;
  return {
    when: pick(p.get('quand'), WHEN_OPTIONS, 'any'),
    distance: pick(p.get('km'), DISTANCE_OPTIONS, 'any'),
    terrain: pick(p.get('terrain'), TERRAIN_OPTIONS, 'any'),
    extras: (p.get('envies') ?? '').split(',').filter((x): x is Extra => EXTRA_OPTIONS.some((o) => o.id === x)),
    region: p.get('region') ?? '',
  };
}

export function criteriaToParams(k: Criteria): URLSearchParams {
  const p = new URLSearchParams();
  if (k.when !== 'any') p.set('quand', k.when);
  if (k.distance !== 'any') p.set('km', k.distance);
  if (k.terrain !== 'any') p.set('terrain', k.terrain);
  if (k.extras.length) p.set('envies', k.extras.join(','));
  if (k.region) p.set('region', k.region);
  return p;
}

// ---------- Coups de projecteur : une course mise en avant par critère

export interface Spotlight {
  id: string;
  title: string;
  /** Pourquoi elle est là, en une phrase courte. */
  reason: string;
  event: RaceEvent;
  course: Course;
}

type Candidate = { e: RaceEvent; c: Course };

function best(list: Candidate[], score: (x: Candidate) => number): Candidate | null {
  let top: Candidate | null = null;
  let topScore = -Infinity;
  for (const x of list) {
    const s = score(x);
    if (s > topScore) {
      top = x;
      topScore = s;
    }
  }
  return top;
}

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

/** Une course remarquable par critère, chaque course une seule fois. */
export function spotlights(events: RaceEvent[], today: string): Spotlight[] {
  const all: Candidate[] = events
    .filter((e) => !e.custom && e.dateEnd >= today)
    .flatMap((e) => e.courses.filter((c) => day(c) >= today).map((c) => ({ e, c })));
  const within = (n: number) => all.filter((x) => daysBetween(today, day(x.c)) < n);
  const used = new Set<string>();
  const free = (list: Candidate[]) => list.filter((x) => !used.has(x.e.id));
  const out: Spotlight[] = [];
  const add = (id: string, title: string, pick: Candidate | null, reason: (x: Candidate) => string) => {
    if (!pick) return;
    used.add(pick.e.id);
    out.push({ id, title, reason: reason(pick), event: pick.e, course: pick.c });
  };
  const photo = (x: Candidate) => (x.e.image && x.e.imageCredit ? 1 : 0);

  add('defi', 'Le défi du mois', best(free(within(31).filter((x) => x.c.elevationGain != null)), (x) => x.c.elevationGain!), (x) =>
    `${fmt(x.c.elevationGain!)} m de dénivelé sur ${fmt(x.c.distanceKm)} km, la plus grosse ascension des 30 prochains jours.`,
  );
  add('mythique', 'La prochaine mythique', best(free(all.filter((x) => x.e.popularity >= 5)), (x) => -daysBetween(today, day(x.c))), () =>
    `Une course de légende, et la prochaine au calendrier.`,
  );
  add(
    'pepite',
    'La pépite confidentielle',
    best(free(within(90).filter((x) => x.e.popularity <= 2 && (slope(x.c) ?? 0) >= 35 && x.c.distanceKm >= 15)), (x) => (slope(x.c) ?? 0) + photo(x) * 30 + x.c.distanceKm / 4),
    (x) => `Peu connue, mais ${fmt(slope(x.c)!)} m de D+ par km sur ${fmt(x.c.distanceKm)} km : un vrai terrain de jeu.`,
  );
  add(
    'prix',
    'Le meilleur rapport km / prix',
    best(free(within(90).filter((x) => x.c.priceEur != null && x.c.priceEur >= 8 && x.c.distanceKm >= 15)), (x) => x.c.distanceKm / x.c.priceEur!),
    (x) => `${fmt(x.c.distanceKm)} km pour ${fmt(x.c.priceEur!)} €, soit ${(x.c.distanceKm / x.c.priceEur!).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km par euro.`,
  );
  add('nuit', 'La prochaine nocturne', best(free(all.filter((x) => isNight(x.e, x.c))), (x) => -daysBetween(today, day(x.c)) * 10 + x.e.popularity), () =>
    'Frontale obligatoire : la prochaine course de nuit.',
  );
  add('ultra', 'L’ultra à préparer', best(free(within(150).filter((x) => x.c.distanceKm >= 80 && daysBetween(today, day(x.c)) >= 45)), (x) => x.e.popularity * 10 + photo(x) * 5), (x) =>
    `${fmt(x.c.distanceKm)} km dans ${Math.round(daysBetween(today, day(x.c)) / 7)} semaines : le temps de bien s’entraîner.`,
  );
  add('kv', 'Le kilomètre vertical', best(free(all.filter((x) => x.c.type === 'Kilomètre vertical')), (x) => -daysBetween(today, day(x.c))), (x) =>
    x.c.elevationGain ? `${fmt(x.c.elevationGain)} m d’ascension en ${fmt(x.c.distanceKm)} km, tout droit vers le sommet.` : 'Tout droit vers le sommet, le prochain au calendrier.',
  );
  add('duo', 'À faire à deux', best(free(within(90).filter((x) => isDuo(x.c))), (x) => x.e.popularity * 10 - daysBetween(today, day(x.c)) / 10), () =>
    'Un parcours en duo ou en relais, pour partager l’effort.',
  );
  return out;
}
