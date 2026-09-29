import { create } from 'zustand';
import { DEFAULT_FILTERS, type Filters, type SortKey } from '../lib/filters';

interface FilterState {
  filters: Filters;
  sort: SortKey;
  setFilters: (patch: Partial<Filters>) => void;
  reset: () => void;
  setSort: (sort: SortKey) => void;
}

/** Filtres partagés entre la carte et le calendrier. */
export const useFilterStore = create<FilterState>((set) => ({
  filters: DEFAULT_FILTERS,
  sort: 'date',
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  reset: () => set({ filters: DEFAULT_FILTERS }),
  setSort: (sort) => set({ sort }),
}));
