import { useMemo } from 'react';
import type { RaceEvent } from '../data/types';
import { useCatalog } from './catalog';
import { useSeasonStore } from './season';

/** Toutes les courses : base publiée + courses ajoutées par l'utilisateur. */
export function useAllRaces(): RaceEvent[] {
  const events = useCatalog((s) => s.events);
  const custom = useSeasonStore((s) => s.customRaces);
  return useMemo(() => [...events, ...custom], [events, custom]);
}

/**
 * Retrouve une course par son identifiant. Les identifiants commencent par le
 * code de la feuille (evt001-…) : un lien reste valide si le nom change.
 */
export function useRace(id: string | undefined): RaceEvent | undefined {
  const all = useAllRaces();
  return useMemo(() => {
    if (!id) return undefined;
    const exact = all.find((r) => r.id === id);
    if (exact) return exact;
    const code = id.split('-')[0];
    return /^evt\d+$/.test(code) ? all.find((r) => r.id.split('-')[0] === code) : undefined;
  }, [all, id]);
}
