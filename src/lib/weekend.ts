import type { RaceEvent } from '../data/types';
import { addDays, weekday } from './dates';

export interface Weekend {
  saturday: string;
  sunday: string;
  /** Événements dont au moins un jour tombe ce week-end. */
  events: RaceEvent[];
  /** Vrai si c'est le week-end en cours ou le prochain (pas un week-end plus lointain). */
  isThisWeekend: boolean;
}

/** Samedi et dimanche du week-end en cours (samedi ou dimanche) ou du prochain. */
export function currentWeekend(today: string): { saturday: string; sunday: string } {
  const wd = weekday(today); // 0 = dimanche, 6 = samedi
  const saturday = wd === 0 ? addDays(today, -1) : addDays(today, 6 - wd);
  return { saturday, sunday: addDays(saturday, 1) };
}

function eventsOn(events: RaceEvent[], saturday: string, sunday: string, today: string): RaceEvent[] {
  return events.filter((e) => !e.custom && e.dateStart <= sunday && e.dateEnd >= saturday && e.dateEnd >= today);
}

/**
 * Le week-end à proposer : celui-ci s'il a des courses, sinon le prochain qui
 * en a (dans les six mois), pour ne jamais ouvrir une carte vide.
 */
export function raceWeekend(events: RaceEvent[], today: string): Weekend | null {
  const first = currentWeekend(today);
  for (let week = 0; week < 26; week++) {
    const saturday = addDays(first.saturday, week * 7);
    const sunday = addDays(saturday, 1);
    const found = eventsOn(events, saturday, sunday, today);
    if (found.length) return { saturday, sunday, events: found, isThisWeekend: week === 0 };
  }
  return null;
}
