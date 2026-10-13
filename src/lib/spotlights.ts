import type { Course, RaceEvent } from '../data/types';
import { normalize } from './filters';

/**
 * Coups de projecteur de la page « À la une » : une course remarquable par
 * thème, choisie dans la base et renouvelée au fil des jours.
 */

const day = (c: Course) => c.start.slice(0, 10);
const slope = (c: Course) => (c.elevationGain != null && c.distanceKm > 0 ? c.elevationGain / c.distanceKm : null);
const isNight = (e: RaceEvent, c: Course) =>
  c.type === 'Trail nocturne' || /nocturne|night|de nuit|frontale|halloween/.test(normalize(`${e.name} ${c.name}`));
const isDuo = (c: Course) => /duo|relais|equipe|team/.test(normalize(`${c.format ?? ''} ${c.name}`));

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5);
}

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
