import type { Course, RaceEvent } from '../data/types';
import { collectionBySlug } from './collections';
import type { Noun } from './departements';
import { normalize } from './filters';

/**
 * Formats de course des pages Trails (« Ultra-trails », « Trails nocturnes »…). Module léger :
 * il sert aussi aux liens « Dans le coin » des fiches course.
 */

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

