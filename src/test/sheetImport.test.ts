import { describe, expect, it } from 'vitest';
import { convertSheet, fixPrice, parseCsv, parseDate, parseNumber, SHEET_HEADERS, technicityFromSlope } from '../lib/sheetImport';

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
});
