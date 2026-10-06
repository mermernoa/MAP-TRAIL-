import type { Course, RaceEvent } from '../data/types';
import { daysBetween } from './dates';
import { itraPoints, kmEffort, runningStones } from './metrics';

export type EntryStatus = 'envie' | 'prevue' | 'inscrit' | 'termine' | 'abandon';
export type Priority = 'A' | 'B' | 'C';

export const STATUS_LABELS: Record<EntryStatus, string> = {
  envie: 'Envie',
  prevue: 'Inscription prévue',
  inscrit: 'Inscrit',
  termine: 'Terminée',
  abandon: 'Abandon / non partant',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  A: 'Objectif principal',
  B: 'Objectif secondaire',
  C: 'Préparation',
};

export interface SeasonEntry {
  /** `${eventId}/${courseId}` */
  id: string;
  eventId: string;
  courseId: string;
  status: EntryStatus;
  priority: Priority;
  notes: string;
  goal: string;
  result: string;
  addedAt: string;
}

export interface ResolvedEntry {
  entry: SeasonEntry;
  event: RaceEvent;
  course: Course;
  date: string;
}

export function entryId(eventId: string, courseId: string): string {
  return `${eventId}/${courseId}`;
}

export function resolveEntries(entries: SeasonEntry[], events: RaceEvent[]): ResolvedEntry[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const out: ResolvedEntry[] = [];
  for (const entry of entries) {
    const event = byId.get(entry.eventId);
    const course = event?.courses.find((c) => c.id === entry.courseId);
    if (!event || !course) continue;
    out.push({ entry, event, course, date: course.start.slice(0, 10) });
  }
  return out.sort((a, b) => a.course.start.localeCompare(b.course.start));
}

/**
 * Délai de récupération indicatif après une course, en jours, selon ses km-effort.
 * Un simple repère pour signaler les enchaînements serrés, pas une règle.
 */
export function recoveryDays(course: Course): number {
  const e = kmEffort(course);
  if (e >= 210) return 42;
  if (e >= 155) return 35;
  if (e >= 115) return 28;
  if (e >= 75) return 21;
  if (e >= 45) return 14;
  return 7;
}

export interface SeasonWarning {
  kind: 'overlap' | 'recovery';
  entryIds: [string, string];
  message: string;
}

export function seasonWarnings(resolved: ResolvedEntry[]): SeasonWarning[] {
  const active = resolved.filter((r) => r.entry.status !== 'abandon');
  const warnings: SeasonWarning[] = [];
  for (let i = 1; i < active.length; i++) {
    const prev = active[i - 1];
    const next = active[i];
    const gap = daysBetween(prev.date, next.date);
    const ids: [string, string] = [prev.entry.id, next.entry.id];
    if (gap <= 2) {
      warnings.push({
        kind: 'overlap',
        entryIds: ids,
        message: `${prev.event.name} et ${next.event.name} tombent le même week-end.`,
      });
      continue;
    }
    const needed = recoveryDays(prev.course);
    if (gap < needed) {
      warnings.push({
        kind: 'recovery',
        entryIds: ids,
        message: `${gap} jours seulement entre ${prev.course.name} et ${next.course.name} ; comptez plutôt ${Math.round(
          needed / 7,
        )} semaines de récupération après ${prev.course.name}.`,
      });
    }
  }
  return warnings;
}

export interface SeasonTotals {
  races: number;
  distanceKm: number;
  elevationGain: number;
  itraPoints: number;
  runningStones: number;
}

export function seasonTotals(resolved: ResolvedEntry[]): SeasonTotals {
  const counted = resolved.filter((r) => r.entry.status !== 'abandon');
  return {
    races: counted.length,
    distanceKm: Math.round(counted.reduce((s, r) => s + r.course.distanceKm, 0)),
    elevationGain: counted.reduce((s, r) => s + (r.course.elevationGain ?? 0), 0),
    itraPoints: counted.reduce((s, r) => s + (itraPoints(r.course) ?? 0), 0),
    runningStones: counted.reduce((s, r) => s + runningStones(r.event, r.course), 0),
  };
}

export interface Deadline {
  entryId: string;
  event: RaceEvent;
  kind: 'opens' | 'closes' | 'lottery';
  date: string;
  daysLeft: number;
}

/** Échéances d'inscription à venir pour les courses pas encore réglées. */
export function upcomingDeadlines(resolved: ResolvedEntry[], today: string, horizonDays = 60): Deadline[] {
  const out: Deadline[] = [];
  for (const r of resolved) {
    if (r.entry.status !== 'envie' && r.entry.status !== 'prevue') continue;
    const { opens, closes, lotteryDate } = r.event.registration;
    const candidates: [Deadline['kind'], string | undefined][] = [
      ['opens', opens],
      ['closes', closes],
      ['lottery', lotteryDate],
    ];
    for (const [kind, date] of candidates) {
      if (!date) continue;
      const daysLeft = daysBetween(today, date);
      if (daysLeft >= 0 && daysLeft <= horizonDays) {
        out.push({ entryId: r.entry.id, event: r.event, kind, date, daysLeft });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
