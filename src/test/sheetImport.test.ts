import { describe, expect, it } from 'vitest';
import {
  convertSheet,
  fixPrice,
  isTentativeDate,
  parseCsv,
  parseDate,
  parseNumber,
  SHEET_HEADERS,
  technicityFromSlope,
  tentativeDateShift,
} from '../lib/sheetImport';

/** Construit une ligne de la feuille à partir de quelques colonnes nommées. */
function row(values: Record<string, string>): string[] {
  return SHEET_HEADERS.map((h) => values[h] ?? '');
}

const base = {
  Statut: 'Validé',
  'Ajouté par': 'Claude (Miles Republic)',
  'Dernière MAJ': '30/09/2026',
  "Nom de l'événement": 'Trail des Crêtes',
  Édition: '2026',
  'Site officiel': 'https://fr.milesrepublic.com/event/trail-des-cretes',
  Pays: 'France',
  Région: 'Auvergne-Rhône-Alpes',
  Département: 'Ain (01)',
  'Ville de départ': 'Port',
  Massif: 'Jura',
  Latitude: '46,16436',
  Longitude: '5,56895',
  'Date début': '31/10/2026',
  'Mode d\'inscription': 'Premier arrivé premier servi',
  'Document requis': 'PPS ou licence FFA',
  'Indice popularité (1-5)': '2',
  Commentaire: 'Un trail dans le Bugey.',
  'Photo (lien)': 'https://example.org/photo.jpeg',
  'Crédit photo': 'Organisation',
};

describe('lecture des valeurs de la feuille', () => {
  it('lit les nombres et les dates au format français', () => {
    expect(parseNumber('77,2')).toBe(77.2);
    expect(parseNumber('1 200,00 €')).toBe(1200);
    expect(parseNumber('')).toBeUndefined();
    expect(parseDate('31/10/2026')).toBe('2026-10-31');
    expect(parseDate('1/2/2027')).toBe('2027-02-01');
    expect(parseDate('demain')).toBeUndefined();
  });

  it('corrige les prix saisis en centimes', () => {
    expect(fixPrice(1200, 10)).toEqual({ value: 12, fixed: true });
    expect(fixPrice(77, 77)).toEqual({ value: 77, fixed: false });
    expect(fixPrice(140, 110)).toEqual({ value: 140, fixed: false });
    expect(fixPrice(35, 3.8)).toEqual({ value: 35, fixed: false });
  });

  it('estime la technicité depuis le D+ par km', () => {
    expect(technicityFromSlope(10, 100)).toBe(1);
    expect(technicityFromSlope(43.4, 1371)).toBe(3);
    expect(technicityFromSlope(10, 900)).toBe(5);
  });

  it('repère les dates à confirmer', () => {
    expect(isTentativeDate('Trail au départ de Valderiès (Tarn). Date à confirmer.')).toBe(true);
    expect(isTentativeDate("Date estimée d'après l'édition précédente, à confirmer.")).toBe(true);
    expect(isTentativeDate('Inscriptions à confirmer.')).toBe(false);
  });

  it('ramène une date à confirmer au jour de la semaine de l’édition précédente', () => {
    // Dimanche 9 novembre 2025 recopié en lundi 9 novembre 2026 → dimanche 8.
    expect(tentativeDateShift('2026-11-09')).toBe(-1);
    // Samedi 8 novembre 2025 recopié en dimanche 8 novembre 2026 → samedi 7.
    expect(tentativeDateShift('2026-11-08')).toBe(-1);
    // Dimanche 9 février 2025 recopié deux ans plus tard en mardi 9 février 2027 → dimanche 7.
    expect(tentativeDateShift('2027-02-09')).toBe(-2);
    // Mercredi 11 novembre (férié) : aucune édition précédente un week-end, date gardée.
    expect(tentativeDateShift('2026-11-11')).toBe(0);
  });

  it('lit un CSV avec guillemets, virgules et retours à la ligne', () => {
    expect(parseCsv('a,"b, c","d ""e"""\n1,"deux\nlignes",3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', 'deux\nlignes', '3'],
    ]);
  });
});

describe('conversion de la feuille', () => {
  const rows = [
    ['Suivi', '', '', ''],
    SHEET_HEADERS,
    row({ ...base, 'ID course': 'EVT001-A', 'Nom de la course': 'La 43 km', 'Distance (km)': '43,4', 'D+ (m)': '1371', 'D- (m)': '1290', 'Prix (€)': '4 400,00 €', 'Complet ?': 'Oui', 'UTMB Index': 'Oui', 'Catégorie UTMB': '50K', 'Running Stones': '2', 'UTMB World Series': 'by UTMB' }),
    row({ ...base, 'ID course': 'EVT001-B', 'Nom de la course': 'Relais', 'Distance (km)': '28,73', 'Ville de départ': 'Le Poizat', Latitude: '46,14707', Longitude: '5,696', Format: 'Relais' }),
    row({ ...base, 'ID course': 'EVT002-A', Statut: 'À vérifier', "Nom de l'événement": 'Brouillon', 'Distance (km)': '10' }),
    row({ ...base, 'ID course': 'EVT003-A', "Nom de l'événement": 'Sans lieu', Latitude: '', Longitude: '', 'Distance (km)': '10' }),
  ];
  const { events, issues, stats } = convertSheet(rows);

  it('regroupe les lignes par événement et ne publie que les statuts validés', () => {
    expect(events.map((e) => e.id)).toEqual(['evt001-trail-des-cretes']);
    expect(stats.skippedByStatus).toEqual({ 'À vérifier': 1 });
    expect(issues.some((i) => i.rowId === 'EVT003' && i.level === 'error')).toBe(true);
  });

  it('remplit l’événement et ses parcours', () => {
    const [e] = events;
    expect(e).toMatchObject({
      name: 'Trail des Crêtes',
      country: 'FR',
      department: 'Ain (01)',
      massif: 'Jura',
      city: 'Port',
      lat: 46.16436,
      dateStart: '2026-10-31',
      dateEnd: '2026-10-31',
      popularity: 2,
      circuits: ['UTMB World Series'],
      image: 'https://example.org/photo.jpeg',
      source: 'Miles Republic',
      registration: { mode: 'Premier arrivé premier servi' },
    });
    const [a, b] = e.courses;
    expect(a).toMatchObject({ id: 'a', distanceKm: 43.4, elevationGain: 1371, elevationLoss: 1290, technicity: 3, priceEur: 44, full: 'yes', utmbCategory: '50K', runningStones: 2 });
    expect(a.lat).toBeUndefined();
    expect(b).toMatchObject({ id: 'b', format: 'Relais', startPlace: 'Le Poizat', lat: 46.14707, lng: 5.696 });
    expect(b.elevationGain).toBeUndefined();
    expect(b.technicity).toBeUndefined();
    expect(stats.pricesInCents).toBe(1);
  });

  it('affiche les dates à confirmer au jour probable, comme prévisionnelles', () => {
    const tentative = convertSheet([
      SHEET_HEADERS,
      row({ ...base, 'ID course': 'EVT010-A', 'Date début': '09/11/2026', 'Distance (km)': '61', Commentaire: 'Trail vallonné. Date à confirmer.' }),
      row({ ...base, 'ID course': 'EVT010-B', 'Date début': '09/11/2026', 'Distance (km)': '17', Commentaire: 'Trail vallonné. Date à confirmer.' }),
    ]);
    const [e] = tentative.events;
    expect(e).toMatchObject({ dateStart: '2026-11-08', dateEnd: '2026-11-08', dateStatus: 'estimated' });
    expect(e.courses.map((c) => c.start)).toEqual(['2026-11-08', '2026-11-08']);
    expect(tentative.dateShifts).toEqual([{ code: 'EVT010', event: 'Trail des Crêtes', sheetDate: '2026-11-09', shownDate: '2026-11-08' }]);
    expect(tentative.stats.tentativeDates).toBe(1);
    expect(events[0].dateStatus).toBe('official');
  });

  it('signale les dates étalées sur des mois', () => {
    const spread = convertSheet([SHEET_HEADERS, row({ ...base, 'ID course': 'EVT011-A', 'Distance (km)': '20', 'Date fin': '31/12/2026' })]);
    expect(spread.issues.some((i) => i.rowId === 'EVT011' && /étalées sur 61 jours/.test(i.message))).toBe(true);
  });
});
