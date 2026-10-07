import { describe, expect, it } from 'vitest';
import { destination, headingLabel, metersPerPixel } from '../lib/explore';
import { exaggerationForZoom } from '../lib/terrain3d';
import { angleDelta, bearingBetween, elevationAtKm, flyoverSeconds, positionAtKm } from '../lib/flyover';

describe('relief 3D', () => {
  it('accentue le relief de loin et revient presque au réel de près', () => {
    expect(exaggerationForZoom(4)).toBe(3);
    expect(exaggerationForZoom(8)).toBeCloseTo(2.41, 2);
    expect(exaggerationForZoom(11.5)).toBe(1.25);
    expect(exaggerationForZoom(16)).toBe(1.25);
  });

  it('ne fait jamais décroître l’exagération quand on s’éloigne', () => {
    let previous = 0;
    for (let zoom = 18; zoom >= 2; zoom -= 0.25) {
      const value = exaggerationForZoom(zoom);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('exploration 3D', () => {
  it('avance dans la direction du cap', () => {
    const [lng, lat] = destination([6.87, 45.92], 0, 1000);
    expect(lng).toBeCloseTo(6.87, 6);
    expect((lat - 45.92) * 111195).toBeCloseTo(1000, 0);

    const [east] = destination([6.87, 45.92], 90, 1000);
    expect(east).toBeGreaterThan(6.87);
    const [west] = destination([6.87, 45.92], 270, 1000);
    expect(west).toBeLessThan(6.87);
  });

  it('reste dans les longitudes valides en passant l’antiméridien', () => {
    const [lng] = destination([179.999, 0], 90, 1000);
    expect(lng).toBeLessThan(-179.9);
  });

  it('calcule l’échelle de la carte', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(78271.5, 0);
    expect(metersPerPixel(60, 10)).toBeCloseTo(metersPerPixel(0, 10) / 2, 6);
  });

  it('affiche un cap lisible', () => {
    expect(headingLabel(0)).toBe('0° N');
    expect(headingLabel(44.6)).toBe('45° NE');
    expect(headingLabel(-90)).toBe('270° O');
    expect(headingLabel(317)).toBe('317° NO');
    expect(headingLabel(359.6)).toBe('0° N');
  });
});

describe('survol du parcours', () => {
  const points = [
    { lat: 45.9, lng: 6.8, ele: 1000, km: 0 },
    { lat: 45.91, lng: 6.8, ele: 1200, km: 1.112 },
    { lat: 45.91, lng: 6.81, ele: null, km: 1.886 },
  ];

  it('interpole la position et l’altitude le long de la trace', () => {
    const [lng, lat] = positionAtKm(points, 0.556);
    expect(lng).toBeCloseTo(6.8, 6);
    expect(lat).toBeCloseTo(45.905, 6);
    expect(positionAtKm(points, -1)).toEqual([6.8, 45.9]);
    expect(positionAtKm(points, 99)).toEqual([6.81, 45.91]);
    expect(elevationAtKm(points, 0.556)).toBe(1100);
    expect(elevationAtKm(points, 1.5)).toBe(1200);
  });

  it('oriente la caméra vers la suite du chemin', () => {
    expect(bearingBetween([6.8, 45.9], [6.8, 45.91])).toBeCloseTo(0, 3);
    expect(bearingBetween([6.8, 45.91], [6.81, 45.91])).toBeCloseTo(90, 0);
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
    expect(angleDelta(0, 180)).toBe(-180);
  });

  it('dure assez pour lire le relief, sans jamais s’éterniser', () => {
    expect(flyoverSeconds(5)).toBe(26);
    expect(flyoverSeconds(42)).toBeCloseTo(39.64, 2);
    expect(flyoverSeconds(170)).toBeCloseTo(93.4, 6);
    expect(flyoverSeconds(400)).toBe(95);
  });
});
