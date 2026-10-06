import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RaceEvent } from '../data/types';

/** Contrôles de cohérence sur la base publiée (public/data/races.json). */
const { events } = JSON.parse(readFileSync('public/data/races.json', 'utf8')) as { events: RaceEvent[] };

describe('base publiée', () => {
  it('contient des événements', () => {
    expect(events.length).toBeGreaterThan(100);
  });

  it('a des identifiants uniques', () => {
    const ids = events.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of events) {
      const courseIds = r.courses.map((c) => c.id);
      expect(new Set(courseIds).size, r.id).toBe(courseIds.length);
    }
  });

  it('place chaque événement sur la carte', () => {
    for (const r of events) {
      expect(Math.abs(r.lat), r.id).toBeLessThanOrEqual(90);
      expect(Math.abs(r.lng), r.id).toBeLessThanOrEqual(180);
      expect(r.lat === 0 && r.lng === 0, r.id).toBe(false);
    }
  });

  it('place chaque départ dans les dates de l’événement', () => {
    for (const r of events) {
      expect(r.dateStart <= r.dateEnd, r.id).toBe(true);
      for (const c of r.courses) {
        const day = c.start.slice(0, 10);
        expect(day >= r.dateStart && day <= r.dateEnd, `${r.id}/${c.id} part le ${day}`).toBe(true);
        expect(c.distanceKm, `${r.id}/${c.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('respecte les échelles et des prix plausibles', () => {
    for (const r of events) {
      expect([1, 2, 3, 4, 5], r.id).toContain(r.popularity);
      for (const c of r.courses) {
        if (c.technicity != null) expect([1, 2, 3, 4, 5], `${r.id}/${c.id}`).toContain(c.technicity);
        if (c.priceEur != null) expect(c.priceEur, `${r.id}/${c.id} : ${c.priceEur} €`).toBeLessThan(600);
      }
    }
  });
});
