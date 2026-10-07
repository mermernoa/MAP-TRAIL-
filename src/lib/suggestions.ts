import type { Course, RaceEvent } from '../data/types';
import { addDays, daysBetween } from './dates';
import { haversineKm } from './metrics';
import { recoveryDays, type ResolvedEntry } from './season';

export interface Suggestion {
  event: RaceEvent;
  course: Course;
  score: number;
  /** Raisons lisibles, de la plus forte à la plus faible. */
  reasons: string[];
}

interface Options {
  limit?: number;
  /** Région de résidence déclarée dans le compte. */
  homeRegion?: string;
}

const median = (values: number[]) => {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const dplusPerKm = (c: Course) => (c.elevationGain != null && c.distanceKm > 0 ? c.elevationGain / c.distanceKm : NaN);
const isRelay = (c: Course) => /relais|relai\b/i.test(`${c.format ?? ''} ${c.name}`);
const weeks = (days: number) => Math.round(days / 7);
const fmtKm = (km: number) => `${Math.round(km)} km`;

/**
 * Courses proposées d'après celles déjà choisies : distance et dénivelé dans
 * la même veine (avec un léger cran au-dessus pour progresser), régions et
 * circuits fréquentés, et une date qui laisse récupérer entre deux courses.
 */
export function suggestRaces(chosen: ResolvedEntry[], events: RaceEvent[], today: string, options: Options = {}): Suggestion[] {
  const limit = options.limit ?? 6;
  const active = chosen.filter((r) => r.entry.status !== 'abandon');
  if (!active.length) return [];

  const distances = active.map((r) => r.course.distanceKm);
  const target = median(distances) * 1.15;
  const longest = Math.max(...distances);
  const refDplus = median(active.map((r) => dplusPerKm(r.course)).filter(Number.isFinite));
  const refTech = median(active.map((r) => r.course.technicity ?? NaN).filter(Number.isFinite));
  const massifs = new Map<string, string>();
  const regions = new Map<string, string>();
  const circuits = new Map<string, string>();
  for (const r of active) {
    if (r.event.massif && r.event.massif !== 'Plaine / campagne') massifs.set(r.event.massif, r.event.name);
    regions.set(r.event.region, r.event.name);
    for (const c of r.event.circuits) circuits.set(c, r.event.name);
  }
  const relayFan = active.some((r) => isRelay(r.course));
  const chosenEvents = new Set(chosen.map((r) => r.event.id));
  const horizon = addDays(today, 400);
  const soonest = addDays(today, 14);

  const best = new Map<string, Suggestion>();
  for (const event of events) {
    if (chosenEvents.has(event.id) || event.custom) continue;
    for (const course of event.courses) {
      const date = course.start.slice(0, 10);
      if (date < soonest || date > horizon || course.full === 'yes') continue;
      if (!relayFan && isRelay(course)) continue;

      // Calendrier : assez de récupération après chaque course choisie, et avant les objectifs.
      let fits = true;
      let after: { days: number; name: string } | null = null;
      for (const r of active) {
        const gap = daysBetween(r.date, date);
        if (gap >= 0 && gap < Math.max(7, recoveryDays(r.course))) fits = false;
        if (gap < 0 && -gap < (r.entry.priority === 'A' ? recoveryDays(course) : 6)) fits = false;
        if (gap > 0 && (!after || gap < after.days)) after = { days: gap, name: r.event.name };
      }
      if (!fits) continue;

      const parts: { score: number; reason?: string }[] = [];
      // Distance : au plus près de la cible, nulle à un facteur 2,2.
      const ratio = course.distanceKm / target;
      const dist = Math.max(0, 1 - Math.abs(Math.log(ratio)) / Math.log(2.2)) * 3;
      parts.push({
        score: dist,
        reason:
          dist < 1.5
            ? undefined
            : course.distanceKm > longest * 1.05
              ? `Un cran au-dessus de votre plus longue course (${fmtKm(longest)})`
              : `Distance dans la lignée de vos courses (${fmtKm(course.distanceKm)})`,
      });
      const dp = dplusPerKm(course);
      if (Number.isFinite(dp) && Number.isFinite(refDplus)) {
        const s = Math.max(0, 1 - Math.abs(dp - refDplus) / 40) * 2;
        parts.push({ score: s, reason: s > 1.4 ? `Dénivelé proche de vos habitudes (${Math.round(dp)} m/km)` : undefined });
      }
      if (course.technicity && Number.isFinite(refTech) && Math.abs(course.technicity - refTech) <= 1) parts.push({ score: 0.5 });

      // Géographie : plus près de vos courses (ou de chez vous), mieux c'est.
      let nearest = { km: Infinity, name: '' };
      for (const r of active) {
        const km = haversineKm(event.lat, event.lng, r.event.lat, r.event.lng);
        if (km < nearest.km) nearest = { km, name: r.event.name };
      }
      parts.push({
        score: 2 * Math.max(0, 1 - nearest.km / 400),
        reason: nearest.km < 120 ? `À ${Math.max(1, Math.round(nearest.km))} km de ${nearest.name}` : undefined,
      });
      if (event.massif && massifs.has(event.massif)) {
        parts.push({ score: 1.2, reason: `Même massif que ${massifs.get(event.massif)} (${event.massif})` });
      } else if (regions.has(event.region)) {
        parts.push({ score: 0.6 });
      }
      if (options.homeRegion && event.region === options.homeRegion) parts.push({ score: 0.8, reason: `Près de chez vous (${event.region})` });
      const sharedCircuit = event.circuits.find((c) => circuits.has(c));
      if (sharedCircuit) parts.push({ score: 1, reason: `${sharedCircuit}, comme ${circuits.get(sharedCircuit)}` });

      parts.push({ score: ((event.popularity - 1) / 4) * 1 });
      const inDays = daysBetween(today, date);
      if (inDays >= 30 && inDays <= 200) parts.push({ score: 0.4 });
      if (after && after.days <= 120) parts.push({ score: 0.3, reason: `${weeks(after.days)} semaines après ${after.name}` });

      const score = parts.reduce((s, p) => s + p.score, 0);
      const reasons = parts
        .filter((p) => p.reason)
        .sort((a, b) => b.score - a.score)
        .map((p) => p.reason as string)
        .slice(0, 3);
      const prev = best.get(event.id);
      if (!prev || score > prev.score) best.set(event.id, { event, course, score, reasons });
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score || a.course.start.localeCompare(b.course.start)).slice(0, limit);
}
