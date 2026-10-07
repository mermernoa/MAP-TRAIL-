import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RaceEvent } from '../data/types';
import { resolveEntries, type SeasonEntry } from '../lib/season';
import { mergeSeasons, sameSeason, type SeasonSnapshot } from '../lib/seasonSync';
import { suggestRaces } from '../lib/suggestions';

const entry = (id: string, patch: Partial<SeasonEntry> = {}): SeasonEntry => {
  const [eventId, courseId] = id.split('/');
  return { id, eventId, courseId, status: 'envie', priority: 'B', notes: '', goal: '', result: '', addedAt: '2026-10-01T10:00:00Z', ...patch };
};
const snap = (s: Partial<SeasonSnapshot>): SeasonSnapshot => ({ entries: [], customRaces: [], removed: [], ...s });
const NOW = Date.parse('2026-10-07T12:00:00Z');

describe('synchronisation de la saison', () => {
  it('réunit les courses des deux appareils', () => {
    const merged = mergeSeasons(snap({ entries: [entry('a/1')] }), snap({ entries: [entry('b/1')] }), NOW);
    expect(merged.entries.map((e) => e.id).sort()).toEqual(['a/1', 'b/1']);
  });

  it('garde la modification la plus récente', () => {
    const local = snap({ entries: [entry('a/1', { status: 'inscrit', updatedAt: '2026-10-05T08:00:00Z' })] });
    const remote = snap({ entries: [entry('a/1', { status: 'termine', updatedAt: '2026-10-06T08:00:00Z' })] });
    expect(mergeSeasons(local, remote, NOW).entries[0].status).toBe('termine');
    expect(mergeSeasons(remote, local, NOW).entries[0].status).toBe('termine');
  });

  it('ne fait pas réapparaître une course supprimée ailleurs', () => {
    const local = snap({ entries: [entry('a/1', { updatedAt: '2026-10-02T08:00:00Z' })] });
    const remote = snap({ removed: [{ id: 'a/1', at: '2026-10-03T08:00:00Z' }] });
    const merged = mergeSeasons(local, remote, NOW);
    expect(merged.entries).toEqual([]);
    expect(merged.removed.map((r) => r.id)).toEqual(['a/1']);
  });

  it('garde une course rajoutée après sa suppression', () => {
    const local = snap({ entries: [entry('a/1', { updatedAt: '2026-10-04T08:00:00Z' })] });
    const remote = snap({ removed: [{ id: 'a/1', at: '2026-10-03T08:00:00Z' }] });
    expect(mergeSeasons(local, remote, NOW).entries.map((e) => e.id)).toEqual(['a/1']);
  });

  it('oublie les suppressions de plus de six mois', () => {
    const merged = mergeSeasons(snap({ removed: [{ id: 'a/1', at: '2026-01-01T00:00:00Z' }] }), snap({}), NOW);
    expect(merged.removed).toEqual([]);
  });

  it('reconnaît deux saisons identiques quel que soit l’ordre', () => {
    const a = snap({ entries: [entry('a/1'), entry('b/1')] });
    const b = snap({ entries: [entry('b/1'), entry('a/1')] });
    expect(sameSeason(a, b)).toBe(true);
    expect(sameSeason(a, snap({ entries: [entry('a/1')] }))).toBe(false);
  });
});

describe('courses proposées', () => {
  const { events } = JSON.parse(readFileSync('public/data/races.json', 'utf8')) as { events: RaceEvent[] };
  const today = '2026-10-07';
  const pick = (name: RegExp, km: number) => {
    const event = events.find((e) => name.test(e.name))!;
    const course = event.courses.reduce((a, b) => (Math.abs(b.distanceKm - km) < Math.abs(a.distanceKm - km) ? b : a));
    return entry(`${event.id}/${course.id}`, { priority: 'A' });
  };

  it('ne propose rien tant que la saison est vide', () => {
    expect(suggestRaces([], events, today)).toEqual([]);
  });

  it('propose des courses proches du profil, sans doublon ni course déjà choisie', () => {
    const chosen = resolveEntries([pick(/Marathon du Mont-Blanc/, 42), pick(/^SaintéLyon$/, 45)], events);
    const list = suggestRaces(chosen, events, today, { limit: 8 });
    expect(list.length).toBe(8);
    const ids = list.map((s) => s.event.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of list) {
      expect(chosen.some((c) => c.event.id === s.event.id)).toBe(false);
      expect(s.course.start.slice(0, 10) >= '2026-10-21').toBe(true);
      // Profil voisin : ni un 10 km, ni un 100 miles.
      expect(s.course.distanceKm).toBeGreaterThan(18);
      expect(s.course.distanceKm).toBeLessThan(110);
      expect(s.reasons.length).toBeGreaterThan(0);
    }
  });

  it('laisse le temps de récupérer autour des courses choisies', () => {
    const chosen = resolveEntries([pick(/Marathon du Mont-Blanc/, 42)], events);
    const objective = chosen[0].date;
    for (const s of suggestRaces(chosen, events, today, { limit: 20 })) {
      const date = s.course.start.slice(0, 10);
      const gap = (Date.parse(date) - Date.parse(objective)) / 86400000;
      expect(gap >= 14 || gap <= -7, `${s.event.name} ${date}`).toBe(true);
    }
  });
});
