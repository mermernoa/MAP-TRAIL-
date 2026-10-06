import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RaceEvent } from '../data/types';
import { entryId, type SeasonEntry } from '../lib/season';

interface SeasonState {
  entries: SeasonEntry[];
  /** Courses ajoutées à la main par l'utilisateur. */
  customRaces: RaceEvent[];
  add: (eventId: string, courseId: string) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<Omit<SeasonEntry, 'id' | 'eventId' | 'courseId'>>) => void;
  has: (eventId: string, courseId: string) => boolean;
  addCustomRace: (race: RaceEvent) => void;
  removeCustomRace: (id: string) => void;
  importData: (data: { entries?: SeasonEntry[]; customRaces?: RaceEvent[] }) => void;
}

export const useSeasonStore = create<SeasonState>()(
  persist(
    (set, get) => ({
      entries: [],
      customRaces: [],
      add: (eventId, courseId) => {
        const id = entryId(eventId, courseId);
        if (get().entries.some((e) => e.id === id)) return;
        set((s) => ({
          entries: [
            ...s.entries,
            {
              id,
              eventId,
              courseId,
              status: 'envie',
              priority: 'B',
              notes: '',
              goal: '',
              result: '',
              addedAt: new Date().toISOString(),
            },
          ],
        }));
      },
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      update: (id, patch) =>
        set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      has: (eventId, courseId) => get().entries.some((e) => e.id === entryId(eventId, courseId)),
      addCustomRace: (race) =>
        set((s) => ({ customRaces: [...s.customRaces.filter((r) => r.id !== race.id), { ...race, custom: true }] })),
      removeCustomRace: (id) =>
        set((s) => ({
          customRaces: s.customRaces.filter((r) => r.id !== id),
          entries: s.entries.filter((e) => e.eventId !== id),
        })),
      importData: (data) =>
        set((s) => {
          const entries = new Map(s.entries.map((e) => [e.id, e]));
          for (const e of data.entries ?? []) entries.set(e.id, e);
          const races = new Map(s.customRaces.map((r) => [r.id, r]));
          for (const r of data.customRaces ?? []) races.set(r.id, { ...r, custom: true });
          return { entries: [...entries.values()], customRaces: [...races.values()] };
        }),
    }),
    { name: 'take-ton-trail-saison', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
