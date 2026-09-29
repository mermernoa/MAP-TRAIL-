import { useMemo } from 'react';
import { builtinRaces } from '../data';
import type { RaceEvent } from '../data/types';
import { useSeasonStore } from './season';

/** Toutes les courses : catalogue intégré + courses ajoutées par l'utilisateur. */
export function useAllRaces(): RaceEvent[] {
  const custom = useSeasonStore((s) => s.customRaces);
  return useMemo(() => [...builtinRaces, ...custom], [custom]);
}

export function useRace(id: string | undefined): RaceEvent | undefined {
  const all = useAllRaces();
  return useMemo(() => all.find((r) => r.id === id), [all, id]);
}
