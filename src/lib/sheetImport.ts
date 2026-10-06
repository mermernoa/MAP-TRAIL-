/**
 * Conversion de la feuille Google « Maps Trail - Base des courses » (onglet
 * Courses) vers le format de l'application. Fonctions pures : utilisées par le
 * script `npm run import:sheet` et par les tests.
 *
 * Une ligne = un parcours. Les lignes d'un même événement partagent le préfixe
 * d'identifiant (EVT001-A, EVT001-B…).
 */
import type { Course, FullState, Popularity, RaceEvent, Technicity, UtmbCategory } from '../data/types';
import { normalize } from './filters';

/** En-têtes de l'onglet Courses, dans l'ordre de la feuille (ligne 2). */
export const SHEET_HEADERS = [
  'ID course',
  'Statut',
  'Ajouté par',
  'Dernière MAJ',
  "Nom de l'événement",
  'Édition',
  'Site officiel',
  'Pays',
  'Région',
  'Département',
  'Ville de départ',
  'Massif',
  'Latitude',
  'Longitude',
  'Date début',
  'Date fin',
  'Nom de la course',
  'Distance (km)',
  'D+ (m)',
  'D- (m)',
  'D+ / km (auto)',
  'Km-effort (auto)',
  'Catégorie UTMB',
  'Type',
  'Format',
  'Parcours',
  'Technicité (1-5)',
  'Terrain',
  'Temps limite (h)',
  'Trace GPX (lien)',
  'Points ITRA',
  'UTMB Index',
  'Running Stones',
  'UTMB World Series',
  'Qualificative pour',
  'Championnat',
  "Mode d'inscription",
  'Ouverture inscriptions',
  'Clôture / date du tirage',
  'Prix (€)',
  'Nb de places',
  "Lien d'inscription",
  'Document requis',
  'Complet ?',
  'Indice popularité (1-5)',
  'Participants dernière édition',
  'Complet en',
  'Nb ravitos',
  'Matériel obligatoire',
  'Accès / navettes',
  'Commentaire',
  'Points forts',
  'Photo (lien)',
  'Aperçu photo',
  'Crédit photo',
];

/** Statuts publiés sur le site (les autres restent en préparation dans la feuille). */
export const PUBLISHED_STATUSES = ['Validé', 'Prêt', 'En ligne'];

const COUNTRY_CODES: Record<string, string> = {
  france: 'FR',
  suisse: 'CH',
  italie: 'IT',
  espagne: 'ES',
  belgique: 'BE',
  andorre: 'AD',
  luxembourg: 'LU',
  allemagne: 'DE',
  autriche: 'AT',
  portugal: 'PT',
};

export interface ImportIssue {
  level: 'error' | 'warning';
  rowId: string;
  event: string;
  message: string;
}

export interface ImportResult {
  events: RaceEvent[];
  issues: ImportIssue[];
  stats: {
    rows: number;
    published: number;
    skippedByStatus: Record<string, number>;
    events: number;
    courses: number;
    pricesInCents: number;
  };
}

type Row = Record<string, string>;

// On garde + et - : « D+ (m) » et « D- (m) » ne doivent pas se confondre.
const key = (h: string) => normalize(h).replace(/[^a-z0-9+-]+/g, '');

/** Repère la ligne d'en-têtes (celle qui commence par « ID course ») s'il y en a une. */
function splitHeader(rows: string[][]): { headers: string[]; data: string[][] } {
  const i = rows.findIndex((r) => key(r[0] ?? '') === key('ID course'));
  if (i === -1) return { headers: SHEET_HEADERS, data: rows };
  return { headers: rows[i], data: rows.slice(i + 1) };
}

function toRow(cells: string[], headers: string[]): Row {
  const row: Row = {};
  headers.forEach((h, i) => {
    row[key(h)] = (cells[i] ?? '').trim();
  });
  return row;
}

const get = (row: Row, header: string) => row[key(header)] ?? '';

/** « 77,2 », « 1 200,00 € », « 2362 » → nombre. */
export function parseNumber(value: string): number | undefined {
  const cleaned = value.replace(/[\s  €]/g, '').replace(',', '.');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** « 31/10/2026 » → « 2026-10-31 ». Accepte aussi le format ISO. */
export function parseDate(value: string): string | undefined {
  const v = value.trim();
  const fr = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return undefined;
}

export function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Échelle du guide : D+ par km < 15 → 1, 15–30 → 2, 30–50 → 3, 50–75 → 4, > 75 → 5. */
export function technicityFromSlope(distanceKm: number, elevationGain: number): Technicity {
  const perKm = elevationGain / distanceKm;
  if (perKm < 15) return 1;
  if (perKm < 30) return 2;
  if (perKm < 50) return 3;
  if (perKm < 75) return 4;
  return 5;
}

/**
 * Prix importés de Miles Republic : la valeur est en centimes (12,00 € saisi
 * 1 200,00 €). On les reconnaît à un prix/km aberrant.
 */
export function fixPrice(price: number, distanceKm: number): { value: number; fixed: boolean } {
  if (price >= 150 && price / Math.max(distanceKm, 10) > 10) return { value: price / 100, fixed: true };
  return { value: price, fixed: false };
}

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function isImageUrl(value: string): boolean {
  if (!isUrl(value)) return false;
  if (/encrypted-tbn\d*\.gstatic\.com/.test(value)) return false; // vignettes de recherche Google
  const path = value.split('?')[0].toLowerCase();
  return (
    /\.(jpe?g|png|webp|avif|gif)$/.test(path) ||
    /\/(image|images|img|photos?|assets)\//.test(path) ||
    /cloudinary|blob\.vercel-storage/.test(value)
  );
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = '';
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
}

function clampInt<T extends number>(value: number | undefined, min: number, max: number): T | undefined {
  if (value == null) return undefined;
  const r = Math.round(value);
  return r >= min && r <= max ? (r as T) : undefined;
}

function fullState(value: string): FullState | undefined {
  const v = normalize(value);
  if (!v) return undefined;
  if (v.startsWith('oui')) return 'yes';
  if (v.startsWith('non')) return 'no';
  if (v.includes('attente')) return 'waitlist';
  return undefined;
}

function circuitsOf(rows: Row[]): string[] {
  const out = new Set<string>();
  for (const row of rows) {
    const ws = normalize(get(row, 'UTMB World Series'));
    if (ws && ws !== 'non') out.add('UTMB World Series');
    if (ws === 'major') out.add('UTMB World Series Major');
    if (ws === 'finale') out.add('Finale UTMB World Series');
    const champ = get(row, 'Championnat');
    if (champ && normalize(champ) !== 'aucun') out.add(`Championnat ${champ === 'France' ? 'de France' : champ === 'Europe' ? "d'Europe" : champ === 'Monde' ? 'du monde' : champ.toLowerCase()}`);
  }
  return [...out].sort();
}

function sourceLabel(addedBy: string): string | undefined {
  const m = addedBy.match(/\(([^)]+)\)/);
  if (!m) return undefined;
  return m[1] === 'web' ? 'Site officiel' : m[1];
}

export function convertSheet(input: string[][], publishedStatuses: string[] = PUBLISHED_STATUSES): ImportResult {
  const { headers, data } = splitHeader(input);
  const issues: ImportIssue[] = [];
  const skippedByStatus: Record<string, number> = {};
  let pricesInCents = 0;
  const published = new Set(publishedStatuses.map(normalize));
  const groups = new Map<string, Row[]>();
  let rowCount = 0;

  for (const cells of data) {
    const row = toRow(cells, headers);
    const id = get(row, 'ID course');
    if (!id) continue;
    rowCount++;
    const status = get(row, 'Statut') || '(vide)';
    if (!published.has(normalize(status))) {
      skippedByStatus[status] = (skippedByStatus[status] ?? 0) + 1;
      continue;
    }
    const code = id.split('-')[0];
    groups.set(code, [...(groups.get(code) ?? []), row]);
  }

  const events: RaceEvent[] = [];
  for (const [code, rows] of groups) {
    rows.sort((a, b) => get(a, 'ID course').localeCompare(get(b, 'ID course')));
    const name = mostCommon(rows.map((r) => get(r, "Nom de l'événement")));
    const warn = (rowId: string, message: string, level: ImportIssue['level'] = 'warning') =>
      issues.push({ level, rowId, event: name, message });

    const courses: Course[] = [];
    let eventLat: number | undefined;
    let eventLng: number | undefined;
    const days: string[] = [];
    const opens: string[] = [];
    const closes: string[] = [];
    let lottery = false;

    for (const row of rows) {
      const rowId = get(row, 'ID course');
      const day = parseDate(get(row, 'Date début'));
      const distanceKm = parseNumber(get(row, 'Distance (km)'));
      if (!day) {
        warn(rowId, 'Date de début manquante ou illisible : ligne ignorée.', 'error');
        continue;
      }
      if (!distanceKm || distanceKm <= 0) {
        warn(rowId, 'Distance manquante : ligne ignorée.', 'error');
        continue;
      }
      const lat = parseNumber(get(row, 'Latitude'));
      const lng = parseNumber(get(row, 'Longitude'));
      const hasCoords = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
      if (hasCoords && eventLat == null) {
        eventLat = lat;
        eventLng = lng;
      }
      if (!hasCoords) warn(rowId, 'Latitude ou longitude manquante.');

      const elevationGain = parseNumber(get(row, 'D+ (m)'));
      const sheetTech = clampInt<Technicity>(parseNumber(get(row, 'Technicité (1-5)')), 1, 5);
      const technicity = sheetTech ?? (elevationGain != null ? technicityFromSlope(distanceKm, elevationGain) : undefined);

      let priceEur = parseNumber(get(row, 'Prix (€)'));
      if (priceEur != null) {
        const fixed = fixPrice(priceEur, distanceKm);
        if (fixed.fixed) pricesInCents++;
        priceEur = fixed.value;
      }

      const utmbIndex = normalize(get(row, 'UTMB Index')) === 'oui';
      const cat = get(row, 'Catégorie UTMB').toUpperCase();
      const utmbCategory = (['20K', '50K', '100K', '100M'] as UtmbCategory[]).find((c) => c === cat);
      const mode = get(row, "Mode d'inscription");
      const o = parseDate(get(row, 'Ouverture inscriptions'));
      const c = parseDate(get(row, 'Clôture / date du tirage'));
      if (o) opens.push(o);
      if (c) closes.push(c);
      if (normalize(mode).includes('tirage')) lottery = true;

      const dayEnd = parseDate(get(row, 'Date fin'));
      days.push(day);
      if (dayEnd) {
        if (dayEnd < day) warn(rowId, 'Date de fin antérieure à la date de début.');
        else days.push(dayEnd);
      }

      const doc = get(row, 'Document requis');
      const gpx = get(row, 'Trace GPX (lien)');
      const courseId = (rowId.split('-')[1] ?? String(courses.length + 1)).toLowerCase();
      courses.push({
        id: courseId,
        name: get(row, 'Nom de la course') || `${distanceKm} km`,
        distanceKm,
        elevationGain,
        elevationLoss: parseNumber(get(row, 'D- (m)')),
        start: day,
        timeLimitH: parseNumber(get(row, 'Temps limite (h)')),
        technicity,
        type: get(row, 'Type') || undefined,
        format: get(row, 'Format') || undefined,
        courseShape: get(row, 'Parcours') || undefined,
        terrain: get(row, 'Terrain') || undefined,
        itraPoints: clampInt(parseNumber(get(row, 'Points ITRA')), 0, 6),
        utmbIndex: utmbIndex || undefined,
        utmbCategory,
        runningStones: utmbIndex ? clampInt(parseNumber(get(row, 'Running Stones')), 0, 8) : undefined,
        qualifierFor: get(row, 'Qualificative pour') || undefined,
        startPlace: get(row, 'Ville de départ') || undefined,
        lat: hasCoords ? lat : undefined,
        lng: hasCoords ? lng : undefined,
        maxRunners: parseNumber(get(row, 'Nb de places')),
        priceEur,
        registrationUrl: isUrl(get(row, "Lien d'inscription")) ? get(row, "Lien d'inscription") : undefined,
        requiredDocument: doc && normalize(doc) !== 'aucun' ? doc : undefined,
        full: fullState(get(row, 'Complet ?')),
        popularity: clampInt<Popularity>(parseNumber(get(row, 'Indice popularité (1-5)')), 1, 5),
        participantsLastEdition: parseNumber(get(row, 'Participants dernière édition')),
        aidStations: parseNumber(get(row, 'Nb ravitos')),
        mandatoryGear: get(row, 'Matériel obligatoire') || undefined,
        gpxUrl: isUrl(gpx) ? gpx : undefined,
      });
    }

    if (!courses.length) continue;
    if (eventLat == null || eventLng == null) {
      warn(code, 'Aucune coordonnée pour cet événement : il n’apparaît pas sur le site.', 'error');
      continue;
    }

    // Le départ principal porte les coordonnées de l'événement : on ne les répète pas.
    for (const course of courses) {
      if (course.lat === eventLat && course.lng === eventLng) {
        delete course.lat;
        delete course.lng;
      }
    }

    days.sort();
    const pick = (header: string) => mostCommon(rows.map((r) => get(r, header)));
    const country = COUNTRY_CODES[normalize(pick('Pays'))] ?? 'FR';
    const website = pick('Site officiel');
    const photo = pick('Photo (lien)');
    const credit = pick('Crédit photo');
    if (photo && !isImageUrl(photo)) {
      warn(
        code,
        /gstatic|googleusercontent/.test(photo)
          ? 'Photo : vignette de recherche Google, à remplacer par le lien de l’image d’origine (photo ignorée).'
          : 'Photo : le lien ouvre une page web, pas une image (photo ignorée).',
      );
    }
    const popularity = (Math.max(...courses.map((c) => c.popularity ?? 2)) || 2) as Popularity;
    const mode = pick("Mode d'inscription");
    const sortedOpens = opens.sort();
    const sortedCloses = closes.sort();
    const lastClose = sortedCloses[sortedCloses.length - 1];
    const updated = rows.map((r) => parseDate(get(r, 'Dernière MAJ'))).filter(Boolean).sort() as string[];

    events.push({
      id: `${code.toLowerCase()}-${slugify(name)}`,
      name,
      country,
      region: pick('Région') || pick('Département') || 'France',
      department: pick('Département') || undefined,
      massif: pick('Massif') || undefined,
      city: courses[0].startPlace ?? pick('Ville de départ'),
      lat: eventLat,
      lng: eventLng,
      dateStart: days[0],
      dateEnd: days[days.length - 1],
      dateStatus: 'official',
      edition: pick('Édition') || undefined,
      popularity,
      circuits: circuitsOf(rows),
      description: pick('Commentaire'),
      highlights: pick('Points forts') || undefined,
      access: pick('Accès / navettes') || undefined,
      website: isUrl(website) ? website : undefined,
      links: [],
      registration: {
        opens: sortedOpens[0],
        closes: lottery ? undefined : lastClose,
        lottery: lottery || undefined,
        lotteryDate: lottery ? lastClose : undefined,
        mode: mode || undefined,
      },
      image: isImageUrl(photo) ? photo : undefined,
      imageCredit: isImageUrl(photo) && credit ? credit : undefined,
      source: sourceLabel(pick('Ajouté par')),
      updatedAt: updated[updated.length - 1],
      courses,
    });
  }

  events.sort((a, b) => a.dateStart.localeCompare(b.dateStart) || a.name.localeCompare(b.name, 'fr'));
  return {
    events,
    issues,
    stats: {
      rows: rowCount,
      published: [...groups.values()].reduce((n, g) => n + g.length, 0),
      skippedByStatus,
      events: events.length,
      courses: events.reduce((n, e) => n + e.courses.length, 0),
      pricesInCents,
    },
  };
}

/** Lecteur CSV (RFC 4180) : guillemets, virgules et retours à la ligne dans les cellules. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
