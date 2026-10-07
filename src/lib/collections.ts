import type { Course, RaceEvent } from '../data/types';
import { normalize } from './filters';

/** Une sélection éditoriale : un titre, un texte court et une règle de choix des courses. */
export interface Collection {
  slug: string;
  title: string;
  /** Une phrase pour les vignettes. */
  tagline: string;
  /** Texte d'introduction de la page. */
  text: string;
  /** Le parcours retenu pour cette collection (le plus adapté de l'événement). */
  pick: (event: RaceEvent, course: Course) => boolean;
  /** Tri des résultats : par date (défaut) ou par notoriété. */
  order?: 'date' | 'fame';
  /** Note affichée sous la liste (précision sur les données). */
  note?: string;
}

export interface CollectionItem {
  event: RaceEvent;
  /** Parcours de l'événement qui entrent dans la collection, du plus long au plus court. */
  courses: Course[];
}

const day = (c: Course) => c.start.slice(0, 10);
const mmdd = (c: Course) => day(c).slice(5);
const dplusPerKm = (c: Course) => (c.elevationGain != null && c.distanceKm > 0 ? c.elevationGain / c.distanceKm : null);
const isRelay = (c: Course) => /relais|duo|equipe|team/.test(normalize(`${c.format ?? ''} ${c.name}`));
const words = (e: RaceEvent, c: Course) => normalize(`${e.name} ${c.name}`);
const MOUNTAINS = ['Alpes du Nord', 'Alpes du Sud', 'Pyrénées', 'Jura', 'Vosges', 'Massif central', 'Corse'];

export const COLLECTIONS: Collection[] = [
  {
    slug: 'les-mythiques',
    title: 'Les mythiques',
    tagline: 'Les courses dont on parle toute l’année.',
    text: 'Celles qui remplissent les forums, affichent complet et qu’on raconte longtemps après la ligne. Les plus connues de la saison, en France et outre-mer.',
    pick: (e) => e.popularity >= 4,
    order: 'fame',
  },
  {
    slug: 'premiers-ultras',
    title: 'Premiers ultras',
    tagline: 'Passer la barre des 50 km sans viser la haute montagne.',
    text: 'De 55 à 100 km, un dénivelé raisonnable (moins de 45 m par kilomètre) et un terrain qui pardonne : de quoi découvrir l’ultra en gérant son effort plutôt qu’en survivant.',
    pick: (_e, c) => {
      const slope = dplusPerKm(c);
      return c.distanceKm >= 55 && c.distanceKm <= 100 && (c.technicity ?? 3) <= 3 && (slope == null || slope <= 45) && !isRelay(c);
    },
  },
  {
    slug: 'nocturnes-d-halloween',
    title: 'Nocturnes d’Halloween',
    tagline: 'Frontale sur le front, citrouilles au ravito.',
    text: 'Les trails de nuit et les courses déguisées autour d’Halloween, de la fin octobre aux premiers jours de novembre. Prévoyez une lampe frontale, et un costume si le cœur vous en dit.',
    pick: (e, c) =>
      mmdd(c) >= '10-24' &&
      mmdd(c) <= '11-09' &&
      (c.type === 'Trail nocturne' || /nocturne|night|nuit|halloween|sorciere|citrouille|frontale|lune|etoile|loween/.test(words(e, c))),
  },
  {
    slug: 'moins-de-20-euros',
    title: 'Moins de 20 €',
    tagline: 'Des dossards à petit prix, partout en France.',
    text: 'Des parcours à 20 € ou moins. Le prix indiqué est le tarif de base publié par l’organisation : il peut augmenter à l’approche de la course ou baisser avec une licence.',
    pick: (_e, c) => c.priceEur != null && c.priceEur <= 20,
    note: 'Seules les courses dont le prix est connu apparaissent ici.',
  },
  {
    slug: 'premier-dossard',
    title: 'Premier dossard',
    tagline: 'Moins de 15 km, peu de dénivelé, beaucoup de plaisir.',
    text: 'Des parcours de 15 km au plus, avec moins de 300 m de dénivelé et un terrain facile : de quoi accrocher un premier dossard de trail sans y laisser les genoux.',
    pick: (_e, c) =>
      c.distanceKm >= 5 && c.distanceKm <= 15 && c.elevationGain != null && c.elevationGain <= 300 && (c.technicity ?? 2) <= 2 && !isRelay(c),
  },
  {
    slug: 'trails-de-fin-d-annee',
    title: 'Trails de fin d’année',
    tagline: 'Bonnet de Noël et vin chaud à l’arrivée.',
    text: 'Les courses de la mi-décembre au premier week-end de janvier, de Noël à la Saint-Sylvestre. Souvent courtes, souvent déguisées, toujours festives.',
    pick: (_e, c) => mmdd(c) >= '12-12' || mmdd(c) <= '01-04',
  },
  {
    slug: 'l-hiver-en-montagne',
    title: 'L’hiver en montagne',
    tagline: 'Crêtes enneigées et sentiers gelés.',
    text: 'Les trails de décembre à mars dans les massifs de montagne : Alpes, Pyrénées, Jura, Vosges, Massif central et Corse. Le parcours peut changer avec l’enneigement : suivez les consignes de l’organisation.',
    pick: (e, c) => MOUNTAINS.includes(e.massif ?? '') && (mmdd(c) >= '12-01' || mmdd(c) <= '03-31') && (dplusPerKm(c) ?? 0) >= 25,
  },
  {
    slug: 'au-soleil-l-hiver',
    title: 'Au soleil l’hiver',
    tagline: 'Courir en t-shirt quand la métropole grelotte.',
    text: 'La Réunion, les Antilles, Mayotte et les autres territoires d’outre-mer : des trails tropicaux, de décembre à mars.',
    pick: (e, c) => e.massif === 'Outre-mer' && (mmdd(c) >= '12-01' || mmdd(c) <= '03-31'),
  },
  {
    slug: 'a-deux-ou-en-equipe',
    title: 'À deux ou en équipe',
    tagline: 'Duos, relais et courses en équipe.',
    text: 'Pour partager l’effort : des parcours en duo, en relais ou par équipe, du trail découverte à l’ultra.',
    pick: (_e, c) => isRelay(c),
  },
];

export function collectionBySlug(slug: string | undefined): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

/** Courses à venir d'une collection, une ligne par événement. */
export function collectionItems(collection: Collection, events: RaceEvent[], today: string): CollectionItem[] {
  const items: CollectionItem[] = [];
  for (const event of events) {
    if (event.custom) continue;
    const courses = event.courses
      .filter((c) => day(c) >= today && collection.pick(event, c))
      .sort((a, b) => b.distanceKm - a.distanceKm);
    if (courses.length) items.push({ event, courses });
  }
  const first = (i: CollectionItem) => i.courses.map(day).sort()[0];
  return items.sort((a, b) =>
    collection.order === 'fame'
      ? b.event.popularity - a.event.popularity || first(a).localeCompare(first(b))
      : first(a).localeCompare(first(b)) || b.event.popularity - a.event.popularity,
  );
}
