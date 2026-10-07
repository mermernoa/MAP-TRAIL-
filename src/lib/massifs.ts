import type { RaceEvent } from '../data/types';
import { normalize } from './filters';

/** Forme du relief, pour la silhouette stylisée du massif. */
export type ReliefKind =
  | 'aiguilles'
  | 'hautes'
  | 'calcaire'
  | 'puys'
  | 'ballons'
  | 'plis'
  | 'collines'
  | 'ile'
  | 'volcan'
  | 'cote'
  | 'plaine';

export interface Massif {
  /** Valeur exacte de la colonne « Massif » de la feuille. */
  name: string;
  slug: string;
  /** Nom affiché. */
  title: string;
  /** Texte court de présentation. */
  text: string;
  relief: ReliefKind;
  /** Point de vue du relief 3D en tête de page. */
  view: { lat: number; lng: number; place: string };
}

export const MASSIFS: Massif[] = [
  {
    name: 'Alpes du Nord',
    slug: 'alpes-du-nord',
    title: 'Alpes du Nord',
    text: 'Mont-Blanc, Beaufortain, Vanoise, Chartreuse, Vercors : les plus hauts sommets de France et leurs massifs voisins. En hiver, beaucoup de courses se jouent sur neige, en station ou en fond de vallée.',
    relief: 'aiguilles',
    view: { lat: 45.86, lng: 6.87, place: 'le massif du Mont-Blanc' },
  },
  {
    name: 'Alpes du Sud',
    slug: 'alpes-du-sud',
    title: 'Alpes du Sud',
    text: 'Des Écrins au Mercantour, en passant par l’Ubaye et la Haute-Provence : des sommets plus secs, des sentiers caillouteux et beaucoup de soleil, même au cœur de l’hiver.',
    relief: 'hautes',
    view: { lat: 44.9, lng: 6.38, place: 'le massif des Écrins' },
  },
  {
    name: 'Provence',
    slug: 'provence',
    title: 'Provence',
    text: 'Garrigue, calcaire et mistral : Ventoux, Luberon, Sainte-Victoire, Alpilles. Des sentiers secs et souvent techniques, et un hiver assez doux pour courir toute l’année.',
    relief: 'calcaire',
    view: { lat: 44.17, lng: 5.28, place: 'le mont Ventoux' },
  },
  {
    name: 'Pyrénées',
    slug: 'pyrenees',
    title: 'Pyrénées',
    text: 'Du Canigou au Pays basque, des pentes raides qui montent vite depuis la vallée. L’hiver, la plupart des courses se tiennent sur les contreforts et le piémont.',
    relief: 'hautes',
    view: { lat: 42.52, lng: 2.46, place: 'le Canigou' },
  },
  {
    name: 'Massif central',
    slug: 'massif-central',
    title: 'Massif central',
    text: 'Volcans d’Auvergne, causses, Cévennes, monts du Lyonnais et du Forez : une immense moyenne montagne, ouverte et souvent ventée. C’est le terrain de la SaintéLyon et de l’Hivernale des Templiers.',
    relief: 'puys',
    view: { lat: 45.77, lng: 2.96, place: 'la chaîne des Puys' },
  },
  {
    name: 'Vosges',
    slug: 'vosges',
    title: 'Vosges',
    text: 'Ballons arrondis, forêts de sapins et lacs d’altitude, du Donon au Ballon d’Alsace. Des sentiers roulants mais de longues montées, et souvent de la neige sur les crêtes en hiver.',
    relief: 'ballons',
    view: { lat: 47.9, lng: 7.1, place: 'le Grand Ballon' },
  },
  {
    name: 'Jura',
    slug: 'jura',
    title: 'Jura',
    text: 'Une montagne de plis réguliers, de combes et de forêts, du Bugey au Doubs. On y court sur des sentiers souples et des crêtes qui font face aux Alpes.',
    relief: 'plis',
    view: { lat: 46.27, lng: 5.93, place: 'le Reculet' },
  },
  {
    name: 'Morvan',
    slug: 'morvan',
    title: 'Morvan',
    text: 'Le massif granitique au cœur de la Bourgogne : forêts profondes, lacs et villages. Des dénivelés modestes mais répétés, autour du mont Beuvray et de Bibracte.',
    relief: 'collines',
    view: { lat: 46.92, lng: 4.04, place: 'le mont Beuvray' },
  },
  {
    name: 'Corse',
    slug: 'corse',
    title: 'Corse',
    text: 'Une montagne dans la mer : granite, maquis et dénivelés sévères dès le départ. Les courses de la saison froide se tiennent surtout près des côtes et dans les vallées.',
    relief: 'ile',
    view: { lat: 42.27, lng: 9.1, place: 'la vallée de la Restonica' },
  },
  {
    name: 'Bretagne',
    slug: 'bretagne',
    title: 'Bretagne',
    text: 'Pas de grands sommets, mais des landes, des chaos rocheux, des forêts et le sentier des douaniers. Les trails bretons enchaînent les courtes bosses et se courent toute l’année.',
    relief: 'collines',
    view: { lat: 48.39, lng: -3.93, place: 'les monts d’Arrée' },
  },
  {
    name: 'Normandie',
    slug: 'normandie',
    title: 'Normandie',
    text: 'Falaises, Suisse normande, bocage et forêts : un relief de petites montées raides, souvent boueuses en hiver.',
    relief: 'collines',
    view: { lat: 48.92, lng: -0.48, place: 'la Suisse normande' },
  },
  {
    name: 'Île-de-France',
    slug: 'ile-de-france',
    title: 'Île-de-France',
    text: 'Fontainebleau, Rambouillet, la vallée de Chevreuse : du trail à une heure de Paris, sur sable, rochers et racines.',
    relief: 'collines',
    view: { lat: 48.41, lng: 2.68, place: 'la forêt de Fontainebleau' },
  },
  {
    name: 'Outre-mer',
    slug: 'outre-mer',
    title: 'Outre-mer',
    text: 'La Réunion, la Guadeloupe, la Martinique, Mayotte : des volcans et des forêts tropicales où l’on court pendant l’hiver de la métropole.',
    relief: 'volcan',
    view: { lat: -21.1, lng: 55.48, place: 'le cirque de Cilaos' },
  },
  {
    name: 'Littoral',
    slug: 'littoral',
    title: 'Littoral',
    text: 'Des trails au bord de l’eau : calanques, dunes, falaises et plages.',
    relief: 'cote',
    view: { lat: 43.21, lng: 5.45, place: 'les calanques' },
  },
  {
    name: 'Plaine / campagne',
    slug: 'plaines-et-campagnes',
    title: 'Plaines et campagnes',
    text: 'Vignobles, bocages, bords de rivière et chemins de campagne : la France des trails de village, accessibles et conviviaux.',
    relief: 'plaine',
    view: { lat: 44.53, lng: -0.34, place: 'le Sauternais' },
  },
];

export function massifBySlug(slug: string | undefined): Massif | undefined {
  return MASSIFS.find((m) => m.slug === slug);
}

export function massifByName(name: string | undefined): Massif | undefined {
  if (!name) return undefined;
  const key = normalize(name);
  return MASSIFS.find((m) => normalize(m.name) === key);
}

/** Courses à venir d'un massif, de la plus proche à la plus lointaine. */
export function massifEvents(massif: Massif, events: RaceEvent[], today: string): RaceEvent[] {
  return events
    .filter((e) => !e.custom && e.massif === massif.name && e.dateEnd >= today)
    .sort((a, b) => a.dateStart.localeCompare(b.dateStart) || b.popularity - a.popularity);
}
