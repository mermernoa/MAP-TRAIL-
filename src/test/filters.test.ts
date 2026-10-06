import { describe, expect, it } from 'vitest';
import { fixtureRaces as builtinRaces } from './fixtures';
import { applyFilters, countActiveFilters, DEFAULT_FILTERS, normalize, registrationState, sortMatches } from '../lib/filters';

const today = '2026-09-29';
const run = (patch: Partial<typeof DEFAULT_FILTERS>) => applyFilters(builtinRaces, { ...DEFAULT_FILTERS, ...patch }, today);

describe('filtres', () => {
  it('masque les courses passées par défaut', () => {
    const all = run({ includePast: true }).length;
    const upcoming = run({}).length;
    expect(upcoming).toBeLessThanOrEqual(all);
    for (const m of run({})) for (const c of m.courses) expect(c.start.slice(0, 10) >= today).toBe(true);
  });

  it('filtre par distance au niveau du parcours', () => {
    const matches = run({ distance: [160, Infinity] });
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) for (const c of m.courses) expect(c.distanceKm).toBeGreaterThanOrEqual(160);
    const utmb = matches.find((m) => m.event.id === 'utmb-mont-blanc');
    expect(utmb?.courses.map((c) => c.id).sort()).toEqual(['ptl', 'utmb']);
  });

  it('cherche sans tenir compte des accents ni de la casse', () => {
    expect(normalize('Échappée')).toBe('echappee');
    expect(run({ query: 'echappee' }).map((m) => m.event.id)).toContain('echappee-belle');
    expect(run({ query: 'REUNION diagonale' }).map((m) => m.event.id)).toEqual(['grand-raid-reunion']);
  });

  it('combine technicité, dénivelé et points ITRA', () => {
    const matches = run({ technicity: [5], elevation: [10000, Infinity], itraMin: 6 });
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches)
      for (const c of m.courses) {
        expect(c.technicity).toBe(5);
        expect(c.elevationGain).toBeGreaterThanOrEqual(10000);
      }
  });

  it('filtre par période', () => {
    const matches = run({ dateFrom: '2027-06-01', dateTo: '2027-06-30' });
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) for (const c of m.courses) expect(c.start.slice(0, 7)).toBe('2027-06');
  });

  it('filtre autour d’un point', () => {
    const matches = run({ near: { lat: 45.92, lng: 6.87, radiusKm: 30, label: 'Chamonix' } });
    const ids = matches.map((m) => m.event.id);
    expect(ids).toContain('utmb-mont-blanc');
    expect(ids).not.toContain('saintelyon');
  });

  it('calcule l’état des inscriptions', () => {
    const ecotrail = builtinRaces.find((r) => r.id === 'ecotrail-paris')!;
    expect(registrationState(ecotrail, '2026-09-29')).toBe('upcoming');
    expect(registrationState(ecotrail, '2026-12-01')).toBe('open');
    expect(registrationState(ecotrail, '2027-03-15')).toBe('closed');
  });

  it('trie du plus confidentiel au plus connu', () => {
    const sorted = sortMatches(run({}), 'popularity-asc');
    for (let i = 1; i < sorted.length; i++)
      expect(sorted[i].event.popularity).toBeGreaterThanOrEqual(sorted[i - 1].event.popularity);
  });

  it('compte les filtres actifs', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, technicity: [3], countries: ['FR'] })).toBe(2);
  });
});
