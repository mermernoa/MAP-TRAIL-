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

describe('formulaires sans Supabase', () => {
  it('préparent un e-mail vers l’adresse de contact, avec l’adresse de réponse', async () => {
    const { CONTACT_EMAIL, mailtoUrl, messagesEnabled } = await import('../lib/messages');
    expect(CONTACT_EMAIL).toBe('taketontrail@gmail.com');
    expect(messagesEnabled).toBe(true);
    const url = mailtoUrl({ kind: 'erreur', subject: 'Prix – SaintéLyon', body: 'Le prix a changé.', email: 'coureur@example.fr' });
    expect(url.startsWith('mailto:taketontrail@gmail.com?subject=')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('subject')).toBe('[Take Ton Trail] Prix – SaintéLyon');
    expect(params.get('body')).toBe('Le prix a changé.\n\nRépondre à : coureur@example.fr');
  });
});

describe('relief de l’accueil', () => {
  it('monte du départ, dans la vallée, jusqu’au sommet le plus haut', async () => {
    const { buildTerrain, buildTrail, heightAt } = await import('../lib/topo');
    const terrain = buildTerrain(90);
    expect(Math.max(...terrain.heights)).toBeCloseTo(1, 5);
    expect(Math.min(...terrain.heights)).toBeGreaterThanOrEqual(0);
    const trail = buildTrail(terrain);
    const start = trail[0];
    const end = trail[trail.length - 1];
    expect(end).toEqual(terrain.summit);
    expect(heightAt(terrain, start.x, start.z)).toBeLessThan(0.4);
    // Le sentier reste sur le massif, loin des bords fondus.
    for (const p of trail) expect(Math.hypot(p.x, p.z)).toBeLessThan(0.8);
  });

  it('place les repères à l’écran avec la caméra', async () => {
    const { lookAt, multiply, perspective, project } = await import('../lib/topo');
    const mvp = multiply(perspective(0.6, 16 / 9, 0.1, 20), lookAt([0, 1, 3], [0, 0, 0]));
    const center = project(mvp, [0, 0, 0], 1600, 900)!;
    expect(center.x).toBeCloseTo(800, 0);
    expect(project(mvp, [0, 0, 6], 1600, 900)).toBeNull();
  });
});

describe('réglages de l’espace admin', () => {
  it('ignorent les valeurs mal formées sans casser le site', async () => {
    const { parseSettings } = await import('../store/siteSettings');
    const s = parseSettings([
      { key: 'banner', value: { text: 'Inscriptions ouvertes', link: '/course/x', active: true } },
      { key: 'featured', value: ['evt1', 3, null, 'evt2'] },
      { key: 'hidden', value: 'pas une liste' },
      { key: 'massif_photos', value: { corse: { src: 'https://exemple.fr/a.jpg', credit: 'Auteur, CC BY' }, jura: { src: 'http://x', credit: 'A' }, vosges: { src: 'https://x', credit: '' } } },
      { key: 'inconnu', value: 1 },
    ]);
    expect(s.banner).toEqual({ text: 'Inscriptions ouvertes', link: '/course/x', active: true });
    expect(s.featured).toEqual(['evt1', 'evt2']);
    expect(s.hidden).toEqual([]);
    // Jamais de photo sans crédit ni en http.
    expect(Object.keys(s.massif_photos)).toEqual(['corse']);
  });

  it('lisent le jeton des e-mails dans l’adresse en #/compte', async () => {
    const { emailLinkToken } = await import('../lib/supabase');
    expect(emailLinkToken('#/compte?token_hash=abc123&type=recovery')).toEqual({ tokenHash: 'abc123', type: 'recovery' });
    expect(emailLinkToken('#/compte')).toBeNull();
    expect(emailLinkToken('#/compte?type=email')).toBeNull();
  });

  it('préfèrent la photo de massif choisie, puis celle du site, à une photo de course', async () => {
    const { massifCover } = await import('../lib/photos');
    const list = events.filter((e) => e.massif === 'Corse');
    const chosen = massifCover('corse', list, { corse: { src: 'https://exemple.fr/corse.jpg', credit: 'Auteur, CC BY-SA' } })!;
    expect(chosen.src).toBe('https://exemple.fr/corse.jpg');
    expect(chosen.chosen).toBe(true);
    // Sans choix dans l'admin : la photo de paysage fournie avec le site.
    const own = massifCover('corse', list, {})!;
    expect(own.src).toBe('massifs/corse.webp');
    expect(own.credit).toBeTruthy();
    // Massif inconnu : retour à la meilleure photo de course.
    expect(massifCover('inconnu', list, {})?.chosen).toBeUndefined();
  });
});

describe('trouve ta course', () => {
  it('ne garde que les parcours qui cochent tous les critères', async () => {
    const { findRaces, NO_CRITERIA } = await import('../lib/finder');
    const res = findRaces(events, { ...NO_CRITERIA, distance: 'mid', terrain: 'mountain', when: 'season' }, today);
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      for (const c of r.courses) {
        expect(c.distanceKm >= 15 && c.distanceKm < 30).toBe(true);
        expect(c.elevationGain! / c.distanceKm).toBeGreaterThanOrEqual(45);
        expect(c.start.slice(0, 10) >= '2026-12-06' && c.start.slice(0, 10) < '2027-02-04').toBe(true);
      }
    }
    // Les plus connues d'abord.
    expect(res[0].event.popularity).toBeGreaterThanOrEqual(res[res.length - 1].event.popularity);
  });

  it('garde ses critères dans une adresse partageable', async () => {
    const { criteriaFromParams, criteriaToParams } = await import('../lib/finder');
    const k = { when: 'month', distance: 'ultra', terrain: 'any', extras: ['night', 'cheap'], region: 'Bretagne' } as const;
    const back = criteriaFromParams(criteriaToParams({ ...k, extras: [...k.extras] }));
    expect(back).toEqual({ ...k, extras: ['night', 'cheap'] });
    expect(criteriaFromParams(new URLSearchParams('km=n-importe-quoi&envies=night,xx')).distance).toBe('any');
  });

  it('met en avant une course différente par thème', async () => {
    const { spotlights } = await import('../lib/finder');
    const spots = spotlights(events, today);
    expect(spots.length).toBeGreaterThanOrEqual(6);
    expect(new Set(spots.map((s) => s.event.id)).size).toBe(spots.length);
    for (const s of spots) expect(s.course.start.slice(0, 10) >= today).toBe(true);
  });
});
