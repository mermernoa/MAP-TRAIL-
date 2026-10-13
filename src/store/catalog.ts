import { create } from 'zustand';
import type { RaceEvent } from '../data/types';

interface CatalogState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Courses affichées : la base, moins celles masquées depuis l'espace admin. */
  events: RaceEvent[];
  /** Toutes les courses de la base. */
  allEvents: RaceEvent[];
  hidden: string[];
  setHidden: (ids: string[]) => void;
  generatedAt: string | null;
  load: () => Promise<void>;
}

/**
 * Base des courses, générée depuis la feuille Google par `npm run import:sheet`
 * et servie à côté du site (public/data/races.json).
 */
export const useCatalog = create<CatalogState>((set, get) => ({
  status: 'idle',
  events: [],
  allEvents: [],
  hidden: [],
  generatedAt: null,
  setHidden: (ids) => {
    const hidden = new Set(ids);
    set({ hidden: ids, events: get().allEvents.filter((e) => !hidden.has(e.id)) });
  },
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading' });
    try {
      const res = await fetch(new URL('data/races.json', document.baseURI));
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { generatedAt: string; events: RaceEvent[] };
      const hidden = new Set(get().hidden);
      set({ status: 'ready', allEvents: data.events, events: data.events.filter((e) => !hidden.has(e.id)), generatedAt: data.generatedAt });
    } catch {
      set({ status: 'error' });
    }
  },
}));
