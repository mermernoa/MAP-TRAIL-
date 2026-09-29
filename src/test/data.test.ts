import { describe, expect, it } from 'vitest';
import { builtinRaces } from '../data';
import { countryName } from '../lib/metrics';

describe('catalogue des courses', () => {
  it('a des identifiants uniques', () => {
    const ids = builtinRaces.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of builtinRaces) {
      const courseIds = r.courses.map((c) => c.id);
      expect(new Set(courseIds).size, r.id).toBe(courseIds.length);
    }
  });

  it('a des coordonnées et des pays valides', () => {
    for (const r of builtinRaces) {
      expect(Math.abs(r.lat), r.id).toBeLessThanOrEqual(90);
      expect(Math.abs(r.lng), r.id).toBeLessThanOrEqual(180);
      expect(countryName(r.country), `${r.id} : pays sans nom`).not.toBe(r.country);
    }
  });

  it('place chaque départ dans les dates de l’événement', () => {
    for (const r of builtinRaces) {
      expect(r.dateStart <= r.dateEnd, r.id).toBe(true);
      for (const c of r.courses) {
        const day = c.start.slice(0, 10);
        expect(day >= r.dateStart && day <= r.dateEnd, `${r.id}/${c.id} part le ${day}`).toBe(true);
        expect(c.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(c.distanceKm, `${r.id}/${c.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('ordonne les dates d’inscription', () => {
    for (const r of builtinRaces) {
      const { opens, closes, lotteryDate } = r.registration;
      if (opens && closes) expect(opens <= closes, r.id).toBe(true);
      if (closes && lotteryDate) expect(closes <= lotteryDate, r.id).toBe(true);
      if (closes) expect(closes <= r.dateStart, r.id).toBe(true);
    }
  });

  it('a des points de passage cohérents avec la distance', () => {
    for (const r of builtinRaces) {
      for (const c of r.courses) {
        if (!c.checkpoints) continue;
        const kms = c.checkpoints.map((p) => p.km);
        expect(kms[0], `${r.id}/${c.id}`).toBe(0);
        for (let i = 1; i < kms.length; i++) expect(kms[i] > kms[i - 1], `${r.id}/${c.id} au km ${kms[i]}`).toBe(true);
        expect(Math.abs(kms[kms.length - 1] - c.distanceKm) / c.distanceKm, `${r.id}/${c.id}`).toBeLessThan(0.03);
      }
    }
  });
});
