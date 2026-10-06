import { describe, expect, it } from 'vitest';
import { fixtureRaces as builtinRaces } from './fixtures';
import { formatRange, weekday } from '../lib/dates';
import { elevationDelta, parseGpx } from '../lib/gpx';
import { buildIcs, courseIcsItems } from '../lib/ical';
import { estimateItraPoints, kmEffort, runningStones, utmbCategory } from '../lib/metrics';
import { recoveryDays, resolveEntries, seasonTotals, seasonWarnings, upcomingDeadlines, type SeasonEntry } from '../lib/season';

const race = (id: string) => builtinRaces.find((r) => r.id === id)!;

describe('index', () => {
  it('calcule km-effort, points ITRA et catégorie UTMB', () => {
    const utmb = race('utmb-mont-blanc');
    const main = utmb.courses.find((c) => c.id === 'utmb')!;
    expect(kmEffort(main)).toBe(274);
    expect(estimateItraPoints(274)).toBe(6);
    expect(utmbCategory(kmEffort(main))).toBe('100M');
    expect(utmbCategory(92)).toBe('50K');
    expect(utmbCategory(20)).toBeNull();
  });

  it('attribue des Running Stones hors finales uniquement', () => {
    const utmb = race('utmb-mont-blanc');
    expect(runningStones(utmb, utmb.courses[0])).toBe(0);
    const lavaredo = race('lavaredo');
    expect(runningStones(lavaredo, lavaredo.courses[0])).toBe(3); // 120 km, 5 800 m : catégorie 100K
    const zegama = race('zegama');
    expect(runningStones(zegama, zegama.courses[0])).toBe(0);
  });
});

describe('dates', () => {
  it('formate les plages de dates', () => {
    expect(formatRange('2026-10-22', '2026-10-25')).toBe('22 – 25 octobre 2026');
    expect(formatRange('2027-05-30', '2027-06-02')).toBe('30 mai – 2 juin 2027');
    expect(formatRange('2027-08-07', '2027-08-07')).toBe('7 août 2027');
  });

  it('donne le jour de la semaine', () => {
    expect(weekday('2026-09-29')).toBe(2); // mardi
    expect(weekday('2027-08-27')).toBe(5); // vendredi
  });
});

describe('GPX', () => {
  const gpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="45.92" lon="6.87"><name>Départ</name></wpt>
  <trk><name>Test</name><trkseg>
    <trkpt lat="45.9200" lon="6.8700"><ele>1000</ele></trkpt>
    <trkpt lat="45.9290" lon="6.8700"><ele>1100</ele></trkpt>
    <trkpt lat="45.9380" lon="6.8700"><ele>1050</ele></trkpt>
    <trkpt lat="45.9470" lon="6.8700"><ele>1200</ele></trkpt>
  </trkseg></trk>
</gpx>`;

  it('lit la trace, la distance et le dénivelé', () => {
    const t = parseGpx(gpx);
    expect(t.name).toBe('Test');
    expect(t.points).toHaveLength(4);
    expect(t.distanceKm).toBeCloseTo(3, 1);
    expect(t.elevationGain).toBe(250);
    expect(t.elevationLoss).toBe(50);
    expect(t.maxEle).toBe(1200);
    expect(t.waypoints[0].name).toBe('Départ');
  });

  it('ignore le bruit d’altitude sous le seuil', () => {
    expect(elevationDelta([100, 102, 101, 103, 100, 110])).toEqual({ gain: 10, loss: 0 });
  });

  it('refuse un fichier sans trace', () => {
    expect(() => parseGpx('<gpx></gpx>')).toThrow(/trace/);
    expect(() => parseGpx('pas du xml')).toThrow();
  });
});

describe('saison', () => {
  const entry = (eventId: string, courseId: string, patch: Partial<SeasonEntry> = {}): SeasonEntry => ({
    id: `${eventId}/${courseId}`,
    eventId,
    courseId,
    status: 'envie',
    priority: 'B',
    notes: '',
    goal: '',
    result: '',
    addedAt: '2026-09-01',
    ...patch,
  });

  it('signale une récupération trop courte et un même week-end', () => {
    const resolved = resolveEntries(
      [
        entry('lavaredo', 'lut'),
        entry('marathon-mont-blanc', 'marathon'),
        entry('val-d-aran', 'vda'),
      ],
      builtinRaces,
    );
    expect(resolved.map((r) => r.event.id)).toEqual(['lavaredo', 'marathon-mont-blanc', 'val-d-aran']);
    const warnings = seasonWarnings(resolved);
    expect(warnings.map((w) => w.kind)).toEqual(['overlap', 'recovery']);
  });

  it('additionne distance, dénivelé et index', () => {
    const resolved = resolveEntries([entry('saintelyon', 'saintelyon'), entry('lavaredo', 'lut', { status: 'abandon' })], builtinRaces);
    expect(seasonTotals(resolved)).toMatchObject({ races: 1, distanceKm: 78, elevationGain: 2100 });
  });

  it('liste les échéances d’inscription à venir', () => {
    const resolved = resolveEntries([entry('ecotrail-paris', '80k')], builtinRaces);
    const deadlines = upcomingDeadlines(resolved, '2026-09-29');
    expect(deadlines[0]).toMatchObject({ kind: 'opens', date: '2026-10-01', daysLeft: 2 });
  });

  it('adapte la récupération à l’effort', () => {
    expect(recoveryDays({ distanceKm: 20, elevationGain: 500 } as never)).toBe(7);
    expect(recoveryDays({ distanceKm: 174, elevationGain: 10000 } as never)).toBe(42);
  });
});

describe('export agenda', () => {
  it('produit un fichier iCalendar valide', () => {
    const r = race('templiers');
    const ics = buildIcs(courseIcsItems(r, r.courses[0]), new Date('2026-09-29T10:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261025T051500');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260114');
    expect(ics).toContain('SUMMARY:Grand Trail des Templiers – Festival des Templiers');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });
});
