import type { RaceEvent } from '../data/types';
import type { SeasonEntry } from './season';

/** Trace d'une suppression, pour qu'un autre appareil ne fasse pas réapparaître l'élément. */
export interface Removal {
  /** Identifiant de l'entrée de saison, ou `course:<id>` pour une course hors catalogue. */
  id: string;
  at: string;
}

export interface SeasonSnapshot {
  entries: SeasonEntry[];
  customRaces: RaceEvent[];
  removed: Removal[];
}

/** On garde les suppressions des six derniers mois : au-delà, aucun appareil n'est resté hors ligne. */
const REMOVAL_TTL_MS = 183 * 24 * 3600 * 1000;

export const customRaceKey = (id: string) => `course:${id}`;

/** Date de dernière modification d'une entrée. */
export function entryStamp(entry: SeasonEntry): string {
  return entry.updatedAt ?? entry.addedAt;
}

function raceStamp(race: RaceEvent): string {
  return race.updatedAt ?? '';
}

/**
 * Fusionne la saison de cet appareil et celle du compte : pour chaque course,
 * la version modifiée le plus récemment l'emporte, et une suppression plus
 * récente qu'une modification retire la course des deux côtés.
 */
export function mergeSeasons(local: SeasonSnapshot, remote: SeasonSnapshot, now = Date.now()): SeasonSnapshot {
  const removedAt = new Map<string, string>();
  for (const r of [...local.removed, ...remote.removed]) {
    if (now - Date.parse(r.at) > REMOVAL_TTL_MS) continue;
    const prev = removedAt.get(r.id);
    if (!prev || r.at > prev) removedAt.set(r.id, r.at);
  }

  const entries = new Map<string, SeasonEntry>();
  for (const e of [...remote.entries, ...local.entries]) {
    const prev = entries.get(e.id);
    if (!prev || entryStamp(e) >= entryStamp(prev)) entries.set(e.id, e);
  }
  const races = new Map<string, RaceEvent>();
  for (const r of [...remote.customRaces, ...local.customRaces]) {
    const prev = races.get(r.id);
    if (!prev || raceStamp(r) >= raceStamp(prev)) races.set(r.id, r);
  }

  const alive = (key: string, stamp: string) => {
    const at = removedAt.get(key);
    return !at || stamp > at;
  };
  const keptRaces = [...races.values()].filter((r) => alive(customRaceKey(r.id), raceStamp(r)));
  const keptEntries = [...entries.values()].filter((e) => alive(e.id, entryStamp(e)));

  return {
    entries: keptEntries.sort((a, b) => a.addedAt.localeCompare(b.addedAt)),
    customRaces: keptRaces,
    removed: [...removedAt].map(([id, at]) => ({ id, at })).sort((a, b) => a.at.localeCompare(b.at)),
  };
}

/** Vrai si les deux saisons sont identiques (évite des envois inutiles). */
export function sameSeason(a: SeasonSnapshot, b: SeasonSnapshot): boolean {
  const key = (s: SeasonSnapshot) =>
    JSON.stringify([
      [...s.entries].sort((x, y) => x.id.localeCompare(y.id)),
      [...s.customRaces].sort((x, y) => x.id.localeCompare(y.id)),
      [...s.removed].sort((x, y) => x.id.localeCompare(y.id)),
    ]);
  return key(a) === key(b);
}
