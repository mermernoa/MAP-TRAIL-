import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Course, RaceEvent } from '../data/types';
import { CITIES, courseNearbyLinks, nearestCity } from '../lib/cities';
import { REGIONS, trailsSite } from '../lib/trailPages';

const TODAY = '2026-11-01';

function course(id: string, distanceKm: number, extra: Partial<Course> = {}): Course {
  return { id, name: `Trail ${distanceKm} km`, distanceKm, elevationGain: distanceKm * 40, start: '2026-12-06', ...extra };
}

function race(id: string, department: string, lat: number, lng: number, courses: Course[], extra: Partial<RaceEvent> = {}): RaceEvent {
  return {
    id,
    name: `Trail ${id}`,
    country: 'FR',
    region: '',
    department,
    city: id,
    lat,
    lng,
    dateStart: courses[0].start.slice(0, 10),
    dateEnd: courses[0].start.slice(0, 10),
    dateStatus: 'official',
    popularity: 2,
    circuits: [],
    description: '',
    links: [],
    registration: {},
    courses,
    ...extra,
  };
}

describe('pages Trails', () => {
  it('écrit les lieux en bon français', () => {
    expect(REGIONS.find((r) => r.name === 'Grand Est')?.inName).toBe('dans le Grand Est');
    expect(REGIONS.find((r) => r.name === 'Hauts-de-France')?.inName).toBe('dans les Hauts-de-France');
    expect(REGIONS.find((r) => r.name === 'Occitanie')?.inName).toBe('en Occitanie');
    const havre = CITIES.find((c) => c.name === 'Le Havre')!;
    expect(havre.nearName).toBe('près du Havre');
    expect(havre.slug).toBe('pres-du-havre');
    expect(CITIES.find((c) => c.dep === '974')?.slug).toBe('pres-de-saint-denis-la-reunion');
  });

  it('trouve la grande ville la plus proche dans un rayon de 50 km', () => {
    expect(nearestCity(45.3, 5.75)?.city.name).toBe('Grenoble');
    expect(nearestCity(44.5, 3.5)).toBeNull(); // Lozère, loin de tout
  });

  it('ne publie un croisement format × lieu qu’avec au moins 3 courses et une liste différente du lieu', () => {
    const isere = (id: string, km: number) => race(id, 'Isère (38)', 45.2, 5.7, [course(`${id}-c`, km)]);
    // 3 ultras sur 10 courses en Isère : publié ; 2 ultras en Savoie : pas de page.
    const events = [
      ...[1, 2, 3].map((i) => isere(`u${i}`, 100)),
      ...[4, 5, 6, 7, 8, 9, 10].map((i) => isere(`c${i}`, 12)),
      race('s1', 'Savoie (73)', 45.5, 6.4, [course('s1-c', 120)]),
      race('s2', 'Savoie (73)', 45.5, 6.4, [course('s2-c', 110)]),
    ];
    const site = trailsSite(events, TODAY);
    const ultra = site.page('ultra-trails-isere');
    expect(ultra?.h1).toBe('Ultra-trails en Isère');
    expect(ultra?.items).toHaveLength(3);
    expect(site.page('ultra-trails-savoie')).toBeUndefined();
    // 7 courses courtes sur 10 : presque toute la page de l'Isère, pas de doublon.
    expect(site.page('trails-courts-isere')).toBeUndefined();
    // Moins de 3 courses : la page existe mais n'est pas proposée à Google.
    expect(site.page('savoie')?.noindex).toBe(true);
    expect(site.page('isere')?.noindex).toBe(false);
  });

  it('donne la distance à la ville et un bouton vers la carte filtrée', () => {
    const events = [1, 2, 3].map((i) => race(`l${i}`, 'Rhône (69)', 45.76 + i * 0.05, 4.84, [course(`l${i}-c`, 20)]));
    const lyon = trailsSite(events, TODAY).page('pres-de-lyon')!;
    expect(lyon.title).toBe('Trails près de Lyon : 3 courses à moins de 50 km');
    expect(lyon.items[0].km).toBeGreaterThan(5);
    expect(lyon.map?.filters.near).toMatchObject({ radiusKm: 50, label: 'Près de Lyon' });
    expect(courseNearbyLinks(events[0], events, TODAY).map((l) => l.path)).toEqual(['trails/pres-de-lyon', 'trails/rhone']);
  });

  it('donne des adresses, des titres et des descriptions uniques sur la vraie base', () => {
    const { events } = JSON.parse(readFileSync('public/data/races.json', 'utf8')) as { events: RaceEvent[] };
    const pages = trailsSite(events, TODAY).pages;
    for (const key of ['path', 'title', 'description'] as const) {
      expect(new Set(pages.map((p) => p[key])).size).toBe(pages.length);
    }
  });
});
