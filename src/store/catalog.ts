import { create } from 'zustand';
import type { RaceEvent } from '../data/types';

interface CatalogState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  events: RaceEvent[];
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
  generatedAt: null,
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading' });
    try {
      const res = await fetch(new URL('data/races.json', document.baseURI));
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { generatedAt: string; events: RaceEvent[] };
      set({ status: 'ready', events: data.events, generatedAt: data.generatedAt });
    } catch {
      set({ status: 'error' });
    }
  },
}));
