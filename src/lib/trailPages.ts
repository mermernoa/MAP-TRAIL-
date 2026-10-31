import type { Course, RaceEvent } from '../data/types';
import { collectionBySlug } from './collections';
import {
  type Departement,
  type MonthPage,
  type Noun,
  DEPARTEMENTS,
  departementOf,
  introText,
  MIN_INDEXED,
  monthPage,
  slugify,
  summarize,
} from './departements';
import type { Filters } from './filters';
import { normalize } from './filters';
import { massifByName } from './massifs';
import { type City, type PageLink, CITIES, CITY_RADIUS_KM, cityDep } from './cities';
import { haversineKm } from './metrics';

export type { PageLink } from './cities';

/**
 * Toutes les pages « Trails » (/trails/…) : régions, départements, grandes villes, formats,
 * croisements format × lieu et mois. Une seule source pour le site et pour le pré-rendu
 * (scripts/prerender.ts) : mêmes titres, mêmes textes, mêmes listes, mêmes liens.
 */

// ——— Régions ———

export interface Region {
  name: string;
  slug: string;
  /** « en Occitanie », « dans le Grand Est », « dans les Hauts-de-France ». */
  inName: string;
}

const REGION_PREP: Record<string, string> = {
  'Grand Est': 'dans le ',
  'Hauts-de-France': 'dans les ',
  'Pays de la Loire': 'dans les ',
};

export const REGIONS: Region[] = [...new Set(DEPARTEMENTS.map((d) => d.region))].map((name) => ({
  name,
  slug: slugify(name),
  inName: name === 'Outre-mer' ? 'en outre-mer' : `${REGION_PREP[name] ?? 'en '}${name}`,
}));

export const regionOf = (d: Departement): Region => REGIONS.find((r) => r.name === d.region)!;

// ——— Formats ———

export interface TrailFormat {
  slug: string;
  /** « Ultra-trails », « Trails nocturnes ». */
  label: string;
  noun: Noun;
  /** Critère, en une ligne. */
  criterion: string;
  /** Une phrase d'introduction pour la page nationale. */
  text: string;
  pick: (event: RaceEvent, course: Course) => boolean;
  /** Une collection couvre déjà ce thème : la page nationale, c'est elle. */
  collection?: string;
  /** Collection proche, proposée en lien. */
  related?: string;
}

const words = (e: RaceEvent, c: Course) => normalize(`${e.name} ${c.name}`);
const collectionPick = (slug: string) => (e: RaceEvent, c: Course) => collectionBySlug(slug)!.pick(e, c);

export const FORMATS: TrailFormat[] = [
  {
    slug: 'trails-courts',
    label: 'Trails courts',
    noun: { one: 'trail court', many: 'trails courts' },
    criterion: 'Parcours de moins de 20 km',
    text: 'Moins de 20 km : le format pour débuter, pour courir vite ou pour enchaîner les dossards dans la saison.',
    pick: (_e, c) => c.distanceKm < 20 && c.type !== 'Kilomètre vertical',
    related: 'premier-dossard',
  },
  {
    slug: 'trails-20-a-40-km',
    label: 'Trails de 20 à 40 km',
    noun: { one: 'trail de 20 à 40 km', many: 'trails de 20 à 40 km' },
    criterion: 'Parcours de 20 à 40 km',
    text: 'Entre 20 et 40 km : la distance reine du trail, assez longue pour gérer son effort, assez courte pour courir sans assistance.',
    pick: (_e, c) => c.distanceKm >= 20 && c.distanceKm <= 40,
  },
  {
    slug: 'trails-longs',
    label: 'Trails longs',
    noun: { one: 'trail long', many: 'trails longs' },
    criterion: 'Parcours de 40 à 80 km',
    text: 'De 40 à 80 km : une journée de course, souvent plusieurs sommets, et la première vraie gestion du ravitaillement.',
    pick: (_e, c) => c.distanceKm > 40 && c.distanceKm <= 80,
    related: 'premiers-ultras',
  },
  {
    slug: 'ultra-trails',
    label: 'Ultra-trails',
    noun: { one: 'ultra-trail', many: 'ultra-trails' },
    criterion: 'Parcours de plus de 80 km',
    text: 'Plus de 80 km : la nuit, le sommeil et l’alimentation comptent autant que les jambes.',
    pick: (_e, c) => c.distanceKm > 80,
    related: 'premiers-ultras',
  },
  {
    slug: 'trails-nocturnes',
    label: 'Trails nocturnes',
    noun: { one: 'trail nocturne', many: 'trails nocturnes' },
    criterion: 'Départ de nuit, à la frontale',
    text: 'Départ à la tombée de la nuit, frontale sur le front : les sentiers qu’on croyait connaître changent complètement.',
    pick: (e, c) => c.type === 'Trail nocturne' || /nocturne|by night|\bnight\b|\bde nuit\b|frontale/.test(words(e, c)),
    related: 'nocturnes-d-halloween',
  },
  {
    slug: 'kilometres-verticaux',
    label: 'Kilomètres verticaux',
    noun: { one: 'kilomètre vertical', many: 'kilomètres verticaux' },
    criterion: 'Montées sèches, sans descente',
    text: 'Des montées sèches : environ 1 000 m de dénivelé positif sur quelques kilomètres pour un KV classique, davantage pour les doubles et les combinés.',
    pick: (_e, c) => c.type === 'Kilomètre vertical' || /\bkv\b|kilometre vertical|vertical/.test(normalize(c.name)),
  },
  {
    slug: 'trails-blancs',
    label: 'Trails blancs',
    noun: { one: 'trail blanc', many: 'trails blancs' },
    criterion: 'Sur neige, en hiver',
    text: 'Des trails sur neige, en station ou en moyenne montagne : crampons légers et vêtements chauds conseillés.',
    pick: (e, c) => /trail blanc|trails blancs|\bneige|snow|white trail|raquette/.test(words(e, c)),
    related: 'l-hiver-en-montagne',
  },
  {
    slug: 'trails-a-deux-ou-en-relais',
    label: 'Trails à deux ou en relais',
    noun: { one: 'course à deux ou en relais', many: 'courses à deux ou en relais' },
    criterion: 'Duos, relais et équipes',
    text: '',
    pick: collectionPick('a-deux-ou-en-equipe'),
    collection: 'a-deux-ou-en-equipe',
  },
  {
    slug: 'trails-pas-chers',
    label: 'Trails pas chers',
    noun: { one: 'trail à 20 € ou moins', many: 'trails à 20 € ou moins' },
    criterion: 'Dossards à 20 € ou moins',
    text: '',
    pick: collectionPick('moins-de-20-euros'),
    collection: 'moins-de-20-euros',
  },
];

/** Adresse de la page nationale d'un format (sa collection quand elle existe). */
export const formatPath = (f: TrailFormat) => (f.collection ? `collection/${f.collection}` : `trails/${f.slug}`);

// ——— Données des pages ———

export interface TrailItem {
  event: RaceEvent;
  /** Parcours retenus pour la page, du plus long au plus court. */
  courses: Course[];
  /** Distance au centre de la ville (pages « près de… »). */
  km?: number;
}

export interface LinkSection {
  title: string;
  links: PageLink[];
}

export type TrailsKind = 'index' | 'region' | 'departement' | 'ville' | 'format' | 'croisement' | 'mois';

export interface TrailsPageData {
  kind: TrailsKind;
  slug: string;
  /** « trails/isere », « trails/ » pour l'index. */
  path: string;
  h1: string;
  /** Titre de l'onglet, sans « – Take Ton Trail ». */
  title: string;
  description: string;
  /** Ligne sous le titre. */
  subtitle: string;
  intro: string;
  items: TrailItem[];
  listTitle: string;
  byMonth: boolean;
  /** Fil d'Ariane, sans la page elle-même. */
  breadcrumb: PageLink[];
  sections: LinkSection[];
  noindex: boolean;
  /** Centre du relief en tête de page (sinon un décor de crêtes). */
  center: { lat: number; lng: number } | null;
  seed: number;
  /** Bouton « Voir sur la carte ». */
  map: { label: string; filters: Partial<Filters> } | null;
}

const clip = (s: string, n = 158) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/[\s,;:·–-]+\S*$/, '')}…`);
const coursesWord = (n: number) => `${n} ${n > 1 ? 'courses' : 'course'}`;
const HOME: PageLink = { label: 'Accueil', path: '' };
const INDEX: PageLink = { label: 'Trails', path: 'trails/' };
const seedOf = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);

const byDate = (a: TrailItem, b: TrailItem) => firstDay(a).localeCompare(firstDay(b)) || b.event.popularity - a.event.popularity;
const firstDay = (i: TrailItem) => i.courses.map((c) => c.start.slice(0, 10)).sort()[0] ?? i.event.dateStart;
const centerOf = (items: TrailItem[]) =>
  items.length ? { lat: items.reduce((s, i) => s + i.event.lat, 0) / items.length, lng: items.reduce((s, i) => s + i.event.lng, 0) / items.length } : null;
const sameSet = (a: TrailItem[], b: TrailItem[]) => a.length === b.length && a.every((x, i) => x.event === b[i].event);
/** Part de courses communes à deux listes (1 : mêmes courses). */
function overlap(a: TrailItem[], b: TrailItem[]): number {
  const set = new Set(a.map((i) => i.event));
  const common = b.filter((i) => set.has(i.event)).length;
  return common / (a.length + b.length - common || 1);
}

/**
 * Un croisement format × lieu n'est publié que s'il apporte une liste vraiment différente :
 * au moins 3 courses, pas presque toute la page du lieu, ni presque la même liste qu'un autre
 * format du même lieu (sinon ce sont les mêmes pages sous deux titres).
 */
export const CROSS_MAX_SHARE = 0.75;
const CROSS_MAX_OVERLAP = 0.8;
/** Au-delà, une page « près de… » répète celle du département ou de la région : noindex. */
const CITY_MAX_OVERLAP = 0.85;

interface Place {
  kind: 'region' | 'departement';
  slug: string;
  name: string;
  inName: string;
  region: Region;
  dep?: Departement;
  items: TrailItem[];
}

interface Cross {
  format: TrailFormat;
  place: Place;
  slug: string;
  items: TrailItem[];
}

export interface TrailsSite {
  pages: TrailsPageData[];
  page: (slug: string | undefined) => TrailsPageData | undefined;
  /** Départements avec des courses, du plus fourni au moins fourni. */
  topDepartements: { dep: Departement; count: number }[];
  months: { month: MonthPage; count: number }[];
}

const cache = new WeakMap<RaceEvent[], Map<string, TrailsSite>>();

/** Toutes les pages Trails pour cette base et ce jour (mémorisé). */
export function trailsSite(events: RaceEvent[], today: string): TrailsSite {
  let byDay = cache.get(events);
  if (!byDay) cache.set(events, (byDay = new Map()));
  let site = byDay.get(today);
  if (!site) byDay.set(today, (site = buildSite(events, today)));
  return site;
}

function buildSite(events: RaceEvent[], today: string): TrailsSite {
  const upcoming = events.filter((e) => !e.custom && e.dateEnd >= today);
  const future = (e: RaceEvent) => e.courses.filter((c) => c.start.slice(0, 10) >= today).sort((a, b) => b.distanceKm - a.distanceKm);
  const allItems: TrailItem[] = upcoming.map((event) => ({ event, courses: future(event) })).filter((i) => i.courses.length).sort(byDate);
  const depOf = new Map(allItems.map((i) => [i.event, departementOf(i.event)]));

  // Lieux
  const depPlaces = new Map<Departement, Place>();
  for (const dep of DEPARTEMENTS) {
    const items = allItems.filter((i) => depOf.get(i.event) === dep);
    if (items.length) depPlaces.set(dep, { kind: 'departement', slug: dep.slug, name: dep.name, inName: dep.inName, region: regionOf(dep), dep, items });
  }
  const regionPlaces = new Map<Region, Place>();
  for (const region of REGIONS) {
    const items = allItems.filter((i) => depOf.get(i.event)?.region === region.name);
    if (items.length) regionPlaces.set(region, { kind: 'region', slug: region.slug, name: region.name, inName: region.inName, region, items });
  }
  const cityItems = new Map<City, TrailItem[]>();
  for (const city of CITIES) {
    const items: TrailItem[] = [];
    for (const i of allItems) {
      // Pré-filtre grossier (un degré de latitude ≈ 111 km) avant le calcul exact.
      if (Math.abs(i.event.lat - city.lat) > 0.5 || Math.abs(i.event.lng - city.lng) > 0.8) continue;
      const km = haversineKm(city.lat, city.lng, i.event.lat, i.event.lng);
      if (km <= CITY_RADIUS_KM) items.push({ ...i, km });
    }
    cityItems.set(city, items);
  }
  // Ville presque identique à une ville plus grande déjà publiée (deux centres très proches) : noindex.
  const cityTwin = new Map<City, City>();
  CITIES.forEach((city, i) => {
    const mine = new Set(cityItems.get(city)!.map((x) => x.event));
    if (mine.size < MIN_INDEXED) return;
    for (const bigger of CITIES.slice(0, i)) {
      if (cityTwin.has(bigger)) continue;
      const theirs = cityItems.get(bigger)!.map((x) => x.event);
      const common = theirs.filter((e) => mine.has(e)).length;
      if (common / Math.max(mine.size, theirs.length) >= 0.8) {
        cityTwin.set(city, bigger);
        return;
      }
    }
  });

  // Formats de chaque parcours, calculés une seule fois (les règles passent par des recherches de mots).
  const formatsOf = new Map<Course, Set<TrailFormat>>();
  for (const i of allItems) for (const c of i.courses) formatsOf.set(c, new Set(FORMATS.filter((f) => f.pick(i.event, c))));
  const formatItems = (f: TrailFormat, items: TrailItem[]) =>
    items.map((i) => ({ ...i, courses: i.courses.filter((c) => formatsOf.get(c)!.has(f)) })).filter((i) => i.courses.length);
  const nationalFormat = new Map(FORMATS.map((f) => [f, formatItems(f, allItems)]));

  // Croisements format × région puis format × département.
  const crosses: Cross[] = [];
  const crossOf = new Map<string, Cross>();
  for (const f of FORMATS) {
    for (const place of [...regionPlaces.values(), ...depPlaces.values()]) {
      const items = formatItems(f, place.items);
      if (items.length < MIN_INDEXED || items.length > place.items.length * CROSS_MAX_SHARE) continue;
      if (place.kind === 'departement') {
        const parent = crossOf.get(`${f.slug}|${place.region.slug}`);
        if (parent && sameSet(parent.items, items)) continue; // même liste que la région
      }
      if (crosses.some((x) => x.place === place && overlap(x.items, items) >= CROSS_MAX_OVERLAP)) continue;
      const cross = { format: f, place, slug: `${f.slug}-${place.slug}`, items };
      crosses.push(cross);
      crossOf.set(`${f.slug}|${place.slug}`, cross);
    }
  }

  const months = new Map<string, TrailItem[]>();
  for (const i of allItems) {
    const k = i.event.dateStart.slice(0, 7);
    months.set(k, [...(months.get(k) ?? []), i]);
  }
  const monthList = [...months.keys()].sort().map((k) => ({ month: monthPage(k), count: months.get(k)!.length }));

  // ——— Liens ———
  const depLink = (p: Place): PageLink => ({ label: p.name, path: `trails/${p.slug}`, count: p.items.length });
  const cityLink = (c: City): PageLink => ({ label: `Près ${c.nearName.slice(5)}`, path: `trails/${c.slug}`, count: cityItems.get(c)!.length });
  const crossLink = (x: Cross, label: string): PageLink => ({ label, path: `trails/${x.slug}`, count: x.items.length });
  const formatLink = (f: TrailFormat): PageLink => ({ label: f.label, path: formatPath(f), count: nationalFormat.get(f)!.length });
  const monthLinks = (items: TrailItem[]): PageLink[] => {
    const keys = [...new Set(items.map((i) => i.event.dateStart.slice(0, 7)))].sort();
    return keys.map((k) => ({ label: monthPage(k).label, path: `trails/${monthPage(k).slug}`, count: items.filter((i) => i.event.dateStart.startsWith(k)).length }));
  };
  const placePath = (p: Place) => `trails/${p.slug}`;
  const regionCrumb = (r: Region): PageLink => ({ label: r.name, path: `trails/${r.slug}` });
  const placeCrumbs = (p: Place): PageLink[] => (p.kind === 'region' ? [HOME, INDEX] : [HOME, INDEX, regionCrumb(p.region)]);
  const citiesOfDep = (d: Departement) => CITIES.filter((c) => c.dep === d.code && cityItems.get(c)!.length > 0);
  const placeTwin = (c: City) => [...depPlaces.values(), ...regionPlaces.values()].some((p) => overlap(p.items, cityItems.get(c)!) >= CITY_MAX_OVERLAP);
  const cityPublished = (c: City) => cityItems.get(c)!.length >= MIN_INDEXED && !cityTwin.has(c) && !placeTwin(c);
  const nonEmpty = (sections: LinkSection[]) => sections.filter((s) => s.links.length);

  const pages: TrailsPageData[] = [];
  const base = {
    byMonth: true,
    noindex: false,
    map: null,
  };

  // ——— Régions ———
  for (const place of regionPlaces.values()) {
    const r = place.region;
    const deps = [...depPlaces.values()].filter((d) => d.region === r);
    const s = summarize(
      place.items.map((i) => i.event),
      today,
    );
    const intro = introText(r.inName, s, {
      extra: deps.length > 1 ? `Elles se répartissent sur ${deps.length} départements : ${deps.map((d) => `${d.name} (${d.items.length})`).join(', ')}.` : '',
    });
    // Une région dont toutes les courses sont dans un seul département ferait doublon avec lui.
    const twin = deps.length === 1;
    pages.push({
      ...base,
      kind: 'region',
      slug: r.slug,
      path: placePath(place),
      h1: `Trails ${r.inName}`,
      title: `Trails ${r.inName} : ${coursesWord(place.items.length)} à venir`,
      description: clip(`${intro} Calendrier, distances et inscriptions.`),
      subtitle: `${deps.length} ${deps.length > 1 ? 'départements' : 'département'} · ${coursesWord(place.items.length)}`,
      intro,
      items: place.items,
      listTitle: `Le calendrier des trails ${r.inName}`,
      breadcrumb: [HOME, INDEX],
      sections: nonEmpty([
        { title: 'Les départements', links: deps.map(depLink) },
        { title: 'Près des grandes villes', links: CITIES.filter((c) => cityDep(c).region === r.name && cityItems.get(c)!.length).map(cityLink) },
        { title: `Par format ${r.inName}`, links: crosses.filter((x) => x.place === place).map((x) => crossLink(x, x.format.label)) },
        { title: 'Par mois', links: monthLinks(place.items) },
        { title: 'Les autres régions', links: [...regionPlaces.values()].filter((p) => p !== place).map(depLink) },
      ]),
      noindex: place.items.length < MIN_INDEXED || twin,
      center: r.name === 'Outre-mer' ? null : centerOf(place.items),
      seed: seedOf(r.slug),
    });
  }

  // ——— Départements ———
  for (const place of depPlaces.values()) {
    const dep = place.dep!;
    const s = summarize(
      place.items.map((i) => i.event),
      today,
    );
    const intro = introText(dep.inName, s, { extra: 'Dates, distances, dénivelé, prix et ouverture des inscriptions : tout est sur chaque fiche.' });
    const massifs = [...new Set(place.items.map((i) => i.event.massif).filter(Boolean))].map((n) => massifByName(n)).filter((m) => !!m);
    const others = [...depPlaces.values()].filter((d) => d.region === place.region && d !== place);
    pages.push({
      ...base,
      kind: 'departement',
      slug: dep.slug,
      path: placePath(place),
      h1: `Trails ${dep.inName}`,
      title: `Trails ${dep.inName} (${dep.code}) : ${coursesWord(place.items.length)} à venir`,
      description: clip(`${intro.replace(/ Dates, distances.*$/, '')} Calendrier, distances, dénivelé et inscriptions.`),
      subtitle: `${dep.name} (${dep.code}) · ${dep.region}`,
      intro,
      items: place.items,
      listTitle: `Le calendrier des trails ${dep.inName}`,
      breadcrumb: placeCrumbs(place),
      sections: nonEmpty([
        { title: 'Près des grandes villes', links: citiesOfDep(dep).map(cityLink) },
        { title: `Par format ${dep.inName}`, links: crosses.filter((x) => x.place === place).map((x) => crossLink(x, x.format.label)) },
        { title: 'Les massifs', links: massifs.map((m) => ({ label: m.title, path: `massif/${m.slug}` })) },
        { title: 'Par mois', links: monthLinks(place.items) },
        {
          title: `Ailleurs ${place.region.inName}`,
          links: [...others.map(depLink), { label: `Toute la région ${place.region.name}`, path: `trails/${place.region.slug}` }],
        },
      ]),
      noindex: place.items.length < MIN_INDEXED,
      center: centerOf(place.items),
      seed: dep.code.charCodeAt(0) + dep.code.length * 7,
    });
  }

  // ——— Grandes villes ———
  for (const city of CITIES) {
    const items = cityItems.get(city)!;
    const dep = cityDep(city);
    const depPlace = depPlaces.get(dep);
    const region = regionOf(dep);
    const s = summarize(
      items.map((i) => i.event),
      today,
    );
    const intro = introText(city.nearName, s, {
      extra: items.length ? `Toutes à moins de ${CITY_RADIUS_KM} km à vol d’oiseau du centre ${city.nearName.replace(/^près /, '').replace(/ \(La Réunion\)$/, '')}.` : '',
    });
    const neighbours = CITIES.filter((c) => c !== city && cityItems.get(c)!.length && haversineKm(c.lat, c.lng, city.lat, city.lng) <= 150);
    pages.push({
      ...base,
      kind: 'ville',
      slug: city.slug,
      path: `trails/${city.slug}`,
      h1: `Trails ${city.nearName}`,
      title: `Trails ${city.nearName} : ${coursesWord(items.length)} à moins de ${CITY_RADIUS_KM} km`,
      description: clip(`${intro} Dates, distances et inscriptions.`),
      subtitle: `Dans un rayon de ${CITY_RADIUS_KM} km · ${dep.name}`,
      intro,
      items: [...items].sort(byDate),
      listTitle: `Les trails ${city.nearName}`,
      breadcrumb: [HOME, INDEX, ...(depPlace ? [{ label: dep.name, path: placePath(depPlace) }] : [])],
      sections: nonEmpty([
        {
          title: 'Dans le département et la région',
          links: [
            ...(depPlace ? [{ label: `Trails ${dep.inName}`, path: placePath(depPlace), count: depPlace.items.length }] : []),
            ...(regionPlaces.get(region) ? [{ label: `Trails ${region.inName}`, path: `trails/${region.slug}`, count: regionPlaces.get(region)!.items.length }] : []),
          ],
        },
        { title: `Par format ${dep.inName}`, links: depPlace ? crosses.filter((x) => x.place === depPlace).map((x) => crossLink(x, x.format.label)) : [] },
        { title: 'Par mois', links: monthLinks(items) },
        { title: 'Les grandes villes voisines', links: neighbours.map(cityLink) },
      ]),
      noindex: !cityPublished(city),
      center: { lat: city.lat, lng: city.lng },
      seed: seedOf(city.slug),
      map: items.length
        ? { label: `Voir les courses ${city.nearName} sur la carte`, filters: { near: { lat: city.lat, lng: city.lng, radiusKm: CITY_RADIUS_KM, label: `Près ${city.nearName.slice(5)}` } } }
        : null,
    });
  }

  // ——— Formats (pages nationales ; celles qui ont une collection renvoient vers elle) ———
  for (const f of FORMATS) {
    if (f.collection) continue;
    const items = nationalFormat.get(f)!;
    const chosen = new Map(items.map((i) => [i.event, i.courses]));
    const pick = (e: RaceEvent) => chosen.get(e) ?? [];
    const s = summarize(
      items.map((i) => i.event),
      today,
      pick,
    );
    const intro = introText('en France', s, { noun: f.noun, extra: f.text });
    const related = f.related ? collectionBySlug(f.related) : undefined;
    pages.push({
      ...base,
      kind: 'format',
      slug: f.slug,
      path: `trails/${f.slug}`,
      h1: `${f.label} en France`,
      title: `${f.label} en France : ${coursesWord(items.length)} à venir`,
      description: clip(`${intro.replace(` ${f.text}`, '')} ${f.criterion}.`),
      subtitle: f.criterion,
      intro,
      items,
      listTitle: `Le calendrier des ${f.label.toLowerCase()}`,
      breadcrumb: [HOME, INDEX],
      sections: nonEmpty([
        { title: 'Par région', links: crosses.filter((x) => x.format === f && x.place.kind === 'region').map((x) => crossLink(x, x.place.name)) },
        { title: 'Par département', links: crosses.filter((x) => x.format === f && x.place.kind === 'departement').map((x) => crossLink(x, x.place.name)) },
        { title: 'Les autres formats', links: FORMATS.filter((o) => o !== f).map(formatLink) },
        { title: 'À voir aussi', links: related ? [{ label: related.title, path: `collection/${related.slug}` }] : [] },
      ]),
      noindex: items.length < MIN_INDEXED,
      center: null,
      seed: seedOf(f.slug),
    });
  }

  // ——— Croisements format × lieu ———
  for (const x of crosses) {
    const { format: f, place } = x;
    const chosen = new Map(x.items.map((i) => [i.event, i.courses]));
    const pick = (e: RaceEvent) => chosen.get(e) ?? [];
    const s = summarize(
      x.items.map((i) => i.event),
      today,
      pick,
    );
    const intro = introText(place.inName, s, { noun: f.noun, extra: `${f.criterion}.` });
    const sameLevel = crosses.filter(
      (o) => o.format === f && o !== x && o.place.kind === place.kind && (place.kind === 'region' || o.place.region === place.region),
    );
    const regionCross = place.kind === 'departement' ? crossOf.get(`${f.slug}|${place.region.slug}`) : undefined;
    pages.push({
      ...base,
      kind: 'croisement',
      slug: x.slug,
      path: `trails/${x.slug}`,
      h1: `${f.label} ${place.inName}`,
      title: `${f.label} ${place.inName} : ${coursesWord(x.items.length)} à venir`,
      description: clip(`${intro} Dates et inscriptions.`),
      subtitle: `${f.criterion} · ${place.name}`,
      intro,
      items: x.items,
      listTitle: `Le calendrier des ${f.label.toLowerCase()} ${place.inName}`,
      breadcrumb: [...placeCrumbs(place), { label: place.name, path: placePath(place) }],
      sections: nonEmpty([
        {
          title: 'Pour aller plus loin',
          links: [
            { label: `Tous les trails ${place.inName}`, path: placePath(place), count: place.items.length },
            { label: f.collection ? collectionBySlug(f.collection)!.title : `${f.label} en France`, path: formatPath(f), count: nationalFormat.get(f)!.length },
            ...(regionCross ? [crossLink(regionCross, `${f.label} ${place.region.inName}`)] : []),
          ],
        },
        { title: `Autres formats ${place.inName}`, links: crosses.filter((o) => o.place === place && o !== x).map((o) => crossLink(o, o.format.label)) },
        {
          title: place.kind === 'region' ? `${f.label} dans les autres régions` : `${f.label} ailleurs ${place.region.inName}`,
          links: sameLevel.map((o) => crossLink(o, o.place.name)),
        },
      ]),
      center: place.region.name === 'Outre-mer' && place.kind === 'region' ? null : centerOf(x.items),
      seed: seedOf(x.slug),
    });
  }

  // ——— Mois ———
  for (const { month } of monthList) {
    const items = months.get(month.key)!;
    const s = summarize(
      items.map((i) => i.event),
      today,
    );
    const intro = introText(`en ${month.label}`, s);
    const counts = new Map<Place, number>();
    for (const i of items) {
      const p = depPlaces.get(depOf.get(i.event)!);
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const last = new Date(month.y, month.m, 0).getDate();
    pages.push({
      ...base,
      kind: 'mois',
      slug: month.slug,
      path: `trails/${month.slug}`,
      h1: `Trails en ${month.label}`,
      title: `Trails en ${month.label} : ${coursesWord(items.length)} en France`,
      description: clip(`${intro} Dates, lieux, distances et inscriptions.`),
      subtitle: `${coursesWord(items.length)} en France et outre-mer`,
      intro,
      items,
      listTitle: `Toutes les courses de ${month.label}`,
      byMonth: false,
      breadcrumb: [HOME, INDEX],
      sections: nonEmpty([
        {
          title: `Où courir en ${month.label}`,
          links: [...counts]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([p, count]) => ({ label: p.name, path: placePath(p), count })),
        },
        { title: 'Les autres mois', links: monthList.filter((m) => m.month.key !== month.key).map(({ month: m, count }) => ({ label: m.label, path: `trails/${m.slug}`, count })) },
      ]),
      noindex: items.length < MIN_INDEXED,
      center: null,
      seed: month.m * 3 + month.y,
      map: items.length
        ? {
            label: `Voir les courses de ${month.label} sur la carte`,
            filters: { dateFrom: `${month.key}-01`, dateTo: `${month.key}-${String(last).padStart(2, '0')}` },
          }
        : null,
    });
  }

  // ——— Index ———
  const regionsSorted = [...regionPlaces.values()].sort((a, b) =>
    a.name === 'Outre-mer' ? 1 : b.name === 'Outre-mer' ? -1 : a.name.localeCompare(b.name, 'fr'),
  );
  pages.unshift({
    ...base,
    kind: 'index',
    slug: '',
    path: 'trails/',
    h1: 'Trails par région, ville, format et mois',
    title: 'Trails en France par région, département, ville, format et mois',
    description: `Les ${allItems.length} courses de trail à venir en France, classées par région, département, grande ville, format et mois : trouve les trails près de chez toi.`,
    subtitle: '',
    intro: 'Les courses de trail à venir près de chez toi : par région et par département, autour des grandes villes, par format (du trail court à l’ultra) et mois par mois pour construire ta saison.',
    items: [],
    listTitle: '',
    breadcrumb: [HOME],
    sections: nonEmpty([
      { title: 'Par région', links: regionsSorted.map(depLink) },
      { title: 'Près des grandes villes', links: CITIES.filter((c) => cityItems.get(c)!.length).map(cityLink) },
      { title: 'Par format', links: FORMATS.map(formatLink) },
      { title: 'Par mois', links: monthList.map(({ month, count }) => ({ label: month.label, path: `trails/${month.slug}`, count })) },
      ...regionsSorted.map((r) => ({ title: `Départements ${r.region.inName}`, links: [...depPlaces.values()].filter((d) => d.region === r.region).map(depLink) })),
    ]),
    center: null,
    seed: 11,
  });

  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const topDepartements = [...depPlaces.values()]
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'fr'))
    .map((p) => ({ dep: p.dep!, count: p.items.length }));

  return {
    pages,
    page: (slug) => bySlug.get(slug ?? ''),
    topDepartements,
    months: monthList,
  };
}
