import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RaceEvent } from '../data/types';
import { COLLECTIONS, collectionBySlug, collectionItems } from '../lib/collections';
import { MASSIFS, massifByName, massifEvents } from '../lib/massifs';
import { createNoise2D } from '../lib/noise';
import { coverPhoto, eventPhoto } from '../lib/photos';
import { currentWeekend, raceWeekend } from '../lib/weekend';

const { events } = JSON.parse(readFileSync('public/data/races.json', 'utf8')) as { events: RaceEvent[] };
const today = '2026-10-07';

describe('portes de l’accueil', () => {
  it('trouve le week-end en cours ou le prochain', () => {
    // 7 octobre 2026 : un mercredi.
    expect(currentWeekend('2026-10-07')).toEqual({ saturday: '2026-10-10', sunday: '2026-10-11' });
    expect(currentWeekend('2026-10-10')).toEqual({ saturday: '2026-10-10', sunday: '2026-10-11' });
    expect(currentWeekend('2026-10-11')).toEqual({ saturday: '2026-10-10', sunday: '2026-10-11' });
    expect(currentWeekend('2026-10-12')).toEqual({ saturday: '2026-10-17', sunday: '2026-10-18' });
  });

  it('propose le prochain week-end avec des courses plutôt qu’une carte vide', () => {
    const weekend = raceWeekend(events, today)!;
    expect(weekend.isThisWeekend).toBe(false);
    expect(weekend.saturday).toBe('2026-10-31');
    expect(weekend.events.length).toBeGreaterThan(10);
    for (const e of weekend.events) expect(e.dateStart <= weekend.sunday && e.dateEnd >= weekend.saturday).toBe(true);
    expect(raceWeekend(events, '2026-10-31')!.isThisWeekend).toBe(true);
  });
});

describe('collections', () => {
  it('ont des adresses uniques et toutes du contenu', () => {
    expect(new Set(COLLECTIONS.map((c) => c.slug)).size).toBe(COLLECTIONS.length);
    for (const c of COLLECTIONS) {
      expect(collectionBySlug(c.slug)).toBe(c);
      expect(collectionItems(c, events, today).length, c.slug).toBeGreaterThanOrEqual(5);
    }
  });

  it('ne retiennent que des parcours à venir qui respectent la règle', () => {
    const cheap = collectionItems(collectionBySlug('moins-de-20-euros')!, events, today);
    for (const { courses } of cheap) for (const c of courses) expect(c.priceEur).toBeLessThanOrEqual(20);
    const ultras = collectionItems(collectionBySlug('premiers-ultras')!, events, today);
    for (const { courses } of ultras) {
      for (const c of courses) {
        expect(c.distanceKm).toBeGreaterThanOrEqual(55);
        expect(c.distanceKm).toBeLessThanOrEqual(100);
        expect(c.start.slice(0, 10) >= today).toBe(true);
      }
    }
    const halloween = collectionItems(collectionBySlug('nocturnes-d-halloween')!, events, today);
    expect(halloween.some((i) => /halloween/i.test(i.event.name))).toBe(true);
    for (const { courses } of halloween) for (const c of courses) expect(c.start.slice(5, 10) >= '10-24' && c.start.slice(5, 10) <= '11-09').toBe(true);
  });

  it('classent les mythiques par notoriété', () => {
    const items = collectionItems(collectionBySlug('les-mythiques')!, events, today);
    expect(items[0].event.popularity).toBe(5);
    for (let i = 1; i < items.length; i++) expect(items[i - 1].event.popularity).toBeGreaterThanOrEqual(items[i].event.popularity);
  });
});

describe('massifs', () => {
  it('couvrent toutes les valeurs de la colonne Massif', () => {
    const used = new Set(events.map((e) => e.massif).filter(Boolean));
    for (const name of used) expect(massifByName(name), name).toBeDefined();
    expect(new Set(MASSIFS.map((m) => m.slug)).size).toBe(MASSIFS.length);
  });

  it('listent les courses à venir du massif, dans l’ordre des dates', () => {
    const alps = massifEvents(MASSIFS[0], events, today);
    expect(alps.length).toBeGreaterThan(10);
    for (let i = 1; i < alps.length; i++) expect(alps[i - 1].dateStart <= alps[i].dateStart).toBe(true);
    for (const e of alps) expect(e.massif).toBe('Alpes du Nord');
  });
});

describe('photos', () => {
  it('ne montrent jamais une photo sans crédit', () => {
    for (const e of events) {
      if (e.image) expect(e.imageCredit, e.name).toBeTruthy();
      const photo = eventPhoto(e);
      if (photo) expect(photo.credit).toBe(e.imageCredit);
    }
    expect(eventPhoto({ ...events[0], image: 'https://exemple.fr/a.jpg', imageCredit: undefined })).toBeNull();
  });

  it('préfèrent une vraie photo de course à une illustration', () => {
    const withPhotos = events.filter((e) => e.image);
    const cover = coverPhoto(withPhotos)!;
    expect(cover.credit).not.toMatch(/illustration/i);
    expect(coverPhoto(withPhotos, new Set([cover.src]))!.src).not.toBe(cover.src);
  });
});

describe('bruit du décor', () => {
  it('donne le même relief à chaque visite, entre -1 et 1', () => {
    const a = createNoise2D(11);
    const b = createNoise2D(11);
    for (let i = 0; i < 200; i++) {
      const v = a(i * 0.37, i * 0.21);
      expect(v).toBe(b(i * 0.37, i * 0.21));
      expect(Math.abs(v)).toBeLessThanOrEqual(1.01);
    }
  });
});
