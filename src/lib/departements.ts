import type { Course, RaceEvent } from '../data/types';
import { MONTH_NAMES } from './dates';
import { normalize } from './filters';

/**
 * Départements français, pour les pages « Trails en Haute-Savoie », « Trails dans le Var »…
 * La colonne « Département » de la feuille est libre (« Isère (38) », « Var () », « DOM-TOM (974) ») :
 * on reconnaît d'abord le nom, puis le numéro entre parenthèses.
 */
export interface Departement {
  code: string;
  name: string;
  slug: string;
  region: string;
  /** « en Haute-Savoie », « dans le Var », « dans les Vosges », « à La Réunion ». */
  inName: string;
}

// [code, nom, préposition, région]
const RAW: [string, string, string, string][] = [
  ['01', 'Ain', 'dans l’', 'Auvergne-Rhône-Alpes'],
  ['02', 'Aisne', 'dans l’', 'Hauts-de-France'],
  ['03', 'Allier', 'dans l’', 'Auvergne-Rhône-Alpes'],
  ['04', 'Alpes-de-Haute-Provence', 'dans les ', 'Provence-Alpes-Côte d’Azur'],
  ['05', 'Hautes-Alpes', 'dans les ', 'Provence-Alpes-Côte d’Azur'],
  ['06', 'Alpes-Maritimes', 'dans les ', 'Provence-Alpes-Côte d’Azur'],
  ['07', 'Ardèche', 'en ', 'Auvergne-Rhône-Alpes'],
  ['08', 'Ardennes', 'dans les ', 'Grand Est'],
  ['09', 'Ariège', 'en ', 'Occitanie'],
  ['10', 'Aube', 'dans l’', 'Grand Est'],
  ['11', 'Aude', 'dans l’', 'Occitanie'],
  ['12', 'Aveyron', 'en ', 'Occitanie'],
  ['13', 'Bouches-du-Rhône', 'dans les ', 'Provence-Alpes-Côte d’Azur'],
  ['14', 'Calvados', 'dans le ', 'Normandie'],
  ['15', 'Cantal', 'dans le ', 'Auvergne-Rhône-Alpes'],
  ['16', 'Charente', 'en ', 'Nouvelle-Aquitaine'],
  ['17', 'Charente-Maritime', 'en ', 'Nouvelle-Aquitaine'],
  ['18', 'Cher', 'dans le ', 'Centre-Val de Loire'],
  ['19', 'Corrèze', 'en ', 'Nouvelle-Aquitaine'],
  ['2A', 'Corse-du-Sud', 'en ', 'Corse'],
  ['2B', 'Haute-Corse', 'en ', 'Corse'],
  ['21', 'Côte-d’Or', 'en ', 'Bourgogne-Franche-Comté'],
  ['22', 'Côtes-d’Armor', 'dans les ', 'Bretagne'],
  ['23', 'Creuse', 'dans la ', 'Nouvelle-Aquitaine'],
  ['24', 'Dordogne', 'en ', 'Nouvelle-Aquitaine'],
  ['25', 'Doubs', 'dans le ', 'Bourgogne-Franche-Comté'],
  ['26', 'Drôme', 'dans la ', 'Auvergne-Rhône-Alpes'],
  ['27', 'Eure', 'dans l’', 'Normandie'],
  ['28', 'Eure-et-Loir', 'en ', 'Centre-Val de Loire'],
  ['29', 'Finistère', 'dans le ', 'Bretagne'],
  ['30', 'Gard', 'dans le ', 'Occitanie'],
  ['31', 'Haute-Garonne', 'en ', 'Occitanie'],
  ['32', 'Gers', 'dans le ', 'Occitanie'],
  ['33', 'Gironde', 'en ', 'Nouvelle-Aquitaine'],
  ['34', 'Hérault', 'dans l’', 'Occitanie'],
  ['35', 'Ille-et-Vilaine', 'en ', 'Bretagne'],
  ['36', 'Indre', 'dans l’', 'Centre-Val de Loire'],
  ['37', 'Indre-et-Loire', 'en ', 'Centre-Val de Loire'],
  ['38', 'Isère', 'en ', 'Auvergne-Rhône-Alpes'],
  ['39', 'Jura', 'dans le ', 'Bourgogne-Franche-Comté'],
  ['40', 'Landes', 'dans les ', 'Nouvelle-Aquitaine'],
  ['41', 'Loir-et-Cher', 'dans le ', 'Centre-Val de Loire'],
  ['42', 'Loire', 'dans la ', 'Auvergne-Rhône-Alpes'],
  ['43', 'Haute-Loire', 'en ', 'Auvergne-Rhône-Alpes'],
  ['44', 'Loire-Atlantique', 'en ', 'Pays de la Loire'],
  ['45', 'Loiret', 'dans le ', 'Centre-Val de Loire'],
  ['46', 'Lot', 'dans le ', 'Occitanie'],
  ['47', 'Lot-et-Garonne', 'dans le ', 'Nouvelle-Aquitaine'],
  ['48', 'Lozère', 'en ', 'Occitanie'],
  ['49', 'Maine-et-Loire', 'dans le ', 'Pays de la Loire'],
  ['50', 'Manche', 'dans la ', 'Normandie'],
  ['51', 'Marne', 'dans la ', 'Grand Est'],
  ['52', 'Haute-Marne', 'en ', 'Grand Est'],
  ['53', 'Mayenne', 'en ', 'Pays de la Loire'],
  ['54', 'Meurthe-et-Moselle', 'en ', 'Grand Est'],
  ['55', 'Meuse', 'dans la ', 'Grand Est'],
  ['56', 'Morbihan', 'dans le ', 'Bretagne'],
  ['57', 'Moselle', 'en ', 'Grand Est'],
  ['58', 'Nièvre', 'dans la ', 'Bourgogne-Franche-Comté'],
  ['59', 'Nord', 'dans le ', 'Hauts-de-France'],
  ['60', 'Oise', 'dans l’', 'Hauts-de-France'],
  ['61', 'Orne', 'dans l’', 'Normandie'],
  ['62', 'Pas-de-Calais', 'dans le ', 'Hauts-de-France'],
  ['63', 'Puy-de-Dôme', 'dans le ', 'Auvergne-Rhône-Alpes'],
  ['64', 'Pyrénées-Atlantiques', 'dans les ', 'Nouvelle-Aquitaine'],
  ['65', 'Hautes-Pyrénées', 'dans les ', 'Occitanie'],
  ['66', 'Pyrénées-Orientales', 'dans les ', 'Occitanie'],
  ['67', 'Bas-Rhin', 'dans le ', 'Grand Est'],
  ['68', 'Haut-Rhin', 'dans le ', 'Grand Est'],
  ['69', 'Rhône', 'dans le ', 'Auvergne-Rhône-Alpes'],
  ['70', 'Haute-Saône', 'en ', 'Bourgogne-Franche-Comté'],
  ['71', 'Saône-et-Loire', 'en ', 'Bourgogne-Franche-Comté'],
  ['72', 'Sarthe', 'dans la ', 'Pays de la Loire'],
  ['73', 'Savoie', 'en ', 'Auvergne-Rhône-Alpes'],
  ['74', 'Haute-Savoie', 'en ', 'Auvergne-Rhône-Alpes'],
  ['75', 'Paris', 'à ', 'Île-de-France'],
  ['76', 'Seine-Maritime', 'en ', 'Normandie'],
  ['77', 'Seine-et-Marne', 'en ', 'Île-de-France'],
  ['78', 'Yvelines', 'dans les ', 'Île-de-France'],
  ['79', 'Deux-Sèvres', 'dans les ', 'Nouvelle-Aquitaine'],
  ['80', 'Somme', 'dans la ', 'Hauts-de-France'],
  ['81', 'Tarn', 'dans le ', 'Occitanie'],
  ['82', 'Tarn-et-Garonne', 'dans le ', 'Occitanie'],
  ['83', 'Var', 'dans le ', 'Provence-Alpes-Côte d’Azur'],
  ['84', 'Vaucluse', 'dans le ', 'Provence-Alpes-Côte d’Azur'],
  ['85', 'Vendée', 'en ', 'Pays de la Loire'],
  ['86', 'Vienne', 'dans la ', 'Nouvelle-Aquitaine'],
  ['87', 'Haute-Vienne', 'en ', 'Nouvelle-Aquitaine'],
  ['88', 'Vosges', 'dans les ', 'Grand Est'],
  ['89', 'Yonne', 'dans l’', 'Bourgogne-Franche-Comté'],
  ['90', 'Territoire de Belfort', 'dans le ', 'Bourgogne-Franche-Comté'],
  ['91', 'Essonne', 'en ', 'Île-de-France'],
  ['92', 'Hauts-de-Seine', 'dans les ', 'Île-de-France'],
  ['93', 'Seine-Saint-Denis', 'en ', 'Île-de-France'],
  ['94', 'Val-de-Marne', 'dans le ', 'Île-de-France'],
  ['95', 'Val-d’Oise', 'dans le ', 'Île-de-France'],
  ['971', 'Guadeloupe', 'en ', 'Outre-mer'],
  ['972', 'Martinique', 'en ', 'Outre-mer'],
  ['973', 'Guyane', 'en ', 'Outre-mer'],
  ['974', 'La Réunion', 'à ', 'Outre-mer'],
  ['976', 'Mayotte', 'à ', 'Outre-mer'],
];

const slugify = (s: string) =>
  normalize(s)
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const DEPARTEMENTS: Departement[] = RAW.map(([code, name, prep, region]) => ({
  code,
  name,
  slug: slugify(name),
  region,
  inName: `${prep}${name}`,
}));

const byName = new Map(DEPARTEMENTS.map((d) => [slugify(d.name), d]));
byName.set('reunion', DEPARTEMENTS.find((d) => d.code === '974')!);
const byCode = new Map(DEPARTEMENTS.map((d) => [d.code, d]));

/** Département d'une course, d'après la colonne libre de la feuille (nom d'abord, puis numéro). */
export function departementOf(e: Pick<RaceEvent, 'department'>): Departement | undefined {
  const raw = e.department?.trim();
  if (!raw) return undefined;
  const m = raw.match(/^(.*?)\s*\(([0-9AB]*)\)\s*$/i);
  const name = (m ? m[1] : raw).trim();
  const code = m?.[2]?.toUpperCase();
  return byName.get(slugify(name)) ?? (code ? byCode.get(code.length === 1 ? `0${code}` : code) : undefined);
}

export function departementBySlug(slug: string | undefined): Departement | undefined {
  return DEPARTEMENTS.find((d) => d.slug === slug);
}

/** Courses à venir d'un département, de la plus proche à la plus lointaine. */
export function departementEvents(d: Departement, events: RaceEvent[], today: string): RaceEvent[] {
  return events
    .filter((e) => !e.custom && e.dateEnd >= today && departementOf(e) === d)
    .sort((a, b) => a.dateStart.localeCompare(b.dateStart) || b.popularity - a.popularity);
}

/** Départements qui ont au moins une course à venir, avec leur nombre de courses. */
export function departementsWithRaces(events: RaceEvent[], today: string): { dep: Departement; count: number }[] {
  const counts = new Map<Departement, number>();
  for (const e of events) {
    if (e.custom || e.dateEnd < today) continue;
    const d = departementOf(e);
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return DEPARTEMENTS.filter((d) => counts.has(d)).map((dep) => ({ dep, count: counts.get(dep)! }));
}

/** Au-dessous de ce nombre de courses, la page existe mais n'est pas proposée à Google (contenu trop mince). */
export const MIN_INDEXED = 3;

// ——— Mois ———

export interface MonthPage {
  /** « 2026-11 » */
  key: string;
  /** « novembre-2026 » */
  slug: string;
  /** « novembre 2026 » */
  label: string;
  y: number;
  m: number;
}

const ascii = (s: string) => normalize(s);

export function monthPage(key: string): MonthPage {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const name = MONTH_NAMES[m - 1];
  return { key, slug: `${ascii(name)}-${y}`, label: `${name} ${y}`, y, m };
}

export function monthBySlug(slug: string | undefined): MonthPage | undefined {
  const match = slug?.match(/^([a-z]+)-(\d{4})$/);
  if (!match) return undefined;
  const i = MONTH_NAMES.findIndex((n) => ascii(n) === match[1]);
  if (i < 0) return undefined;
  return monthPage(`${match[2]}-${String(i + 1).padStart(2, '0')}`);
}

/** Courses d'un mois (date de départ dans le mois), sans les courses passées. */
export function monthEvents(mp: MonthPage, events: RaceEvent[], today: string): RaceEvent[] {
  return events
    .filter((e) => !e.custom && e.dateEnd >= today && e.dateStart.slice(0, 7) === mp.key)
    .sort((a, b) => a.dateStart.localeCompare(b.dateStart) || b.popularity - a.popularity);
}

/** Mois qui ont au moins une course à venir. */
export function monthsWithRaces(events: RaceEvent[], today: string): { month: MonthPage; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.custom || e.dateEnd < today) continue;
    const k = e.dateStart.slice(0, 7);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.keys()].sort().map((k) => ({ month: monthPage(k), count: counts.get(k)! }));
}

// ——— Texte d'introduction, propre à chaque page ———

export interface PageSummary {
  count: number;
  longestKm: number;
  maxGain: number;
  shortestKm: number;
  /** Les courses les plus connues de la page (notoriété 4 ou 5), trois au plus. */
  famous: RaceEvent[];
}

export function summarize(list: RaceEvent[], today: string, coursesOf?: (e: RaceEvent) => Course[]): PageSummary {
  const courses = list.flatMap((e) => (coursesOf ? coursesOf(e) : e.courses.filter((c) => c.start.slice(0, 10) >= today)));
  return {
    count: list.length,
    longestKm: courses.reduce((m, c) => Math.max(m, c.distanceKm), 0),
    shortestKm: courses.reduce((m, c) => Math.min(m, c.distanceKm), Infinity),
    maxGain: courses.reduce((m, c) => Math.max(m, c.elevationGain ?? 0), 0),
    famous: [...list]
      .filter((e) => e.popularity >= 4)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 3),
  };
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const listFr = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`);

/** « 17 courses de trail à venir en Haute-Savoie, de 5 à 170 km, jusqu'à 10 000 m D+. … » */
export function introText(where: string, s: PageSummary, extra = ''): string {
  if (!s.count) return `Aucune course de trail à venir ${where} pour l’instant.`;
  const parts = [`${s.count} ${s.count > 1 ? 'courses de trail à venir' : 'course de trail à venir'} ${where}`];
  if (s.longestKm > 0 && Number.isFinite(s.shortestKm)) {
    parts[0] += s.shortestKm === s.longestKm ? `, sur ${nf.format(s.longestKm)} km` : `, de ${nf.format(s.shortestKm)} à ${nf.format(s.longestKm)} km`;
    if (s.maxGain > 0) parts[0] += ` et jusqu’à ${nf.format(s.maxGain)} m de dénivelé positif`;
  }
  parts[0] += '.';
  if (s.famous.length) parts.push(`Parmi elles : ${listFr(s.famous.map((e) => e.name))}.`);
  if (extra) parts.push(extra);
  return parts.join(' ');
}
