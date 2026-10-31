import type { Course, RaceEvent } from '../data/types';
import { DEPARTEMENTS, departementOf } from './departements';
import { normalize } from './filters';
import { haversineKm } from './metrics';

/**
 * Pages d'atterrissage pour le référencement, en plus des départements et des mois :
 * régions (« Trails en Bretagne »), grandes villes (« Trails autour de Lyon ») et
 * catégories (« Ultra-trails », « Trails nocturnes »…). Toutes vivent sous /trails/<slug>.
 */
export interface Landing {
  kind: 'region' | 'ville' | 'categorie';
  slug: string;
  /** Titre de la page (h1). */
  h1: string;
  /** Pour la phrase d'introduction : « en Bretagne », « autour de Lyon », « de plus de 80 km ». */
  where: string;
  /** Texte de présentation propre à la page. */
  text: string;
  /** Point de vue du relief 3D en tête de page (villes). */
  view?: { lat: number; lng: number };
  /** Courses retenues dans un événement (au moins une pour qu'il apparaisse). */
  courses: (e: RaceEvent, today: string) => Course[];
}

const slugify = (s: string) =>
  normalize(s)
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const upcoming = (e: RaceEvent, today: string) => e.courses.filter((c) => c.start.slice(0, 10) >= today);

// ——— Régions ———

const REGION_IN: Record<string, string> = {
  'Auvergne-Rhône-Alpes': 'en Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté': 'en Bourgogne-Franche-Comté',
  Bretagne: 'en Bretagne',
  'Centre-Val de Loire': 'en Centre-Val de Loire',
  Corse: 'en Corse',
  'Grand Est': 'dans le Grand Est',
  'Hauts-de-France': 'dans les Hauts-de-France',
  'Île-de-France': 'en Île-de-France',
  Normandie: 'en Normandie',
  'Nouvelle-Aquitaine': 'en Nouvelle-Aquitaine',
  Occitanie: 'en Occitanie',
  'Pays de la Loire': 'dans les Pays de la Loire',
  'Provence-Alpes-Côte d’Azur': 'en Provence-Alpes-Côte d’Azur',
  'Outre-mer': 'en outre-mer',
};

export const REGIONS: Landing[] = Object.entries(REGION_IN).map(([name, inName]) => {
  const deps = DEPARTEMENTS.filter((d) => d.region === name);
  return {
    kind: 'region',
    slug: slugify(name),
    h1: `Trails ${inName}`,
    where: inName,
    text: `Les courses de trail ${inName}, département par département : ${deps.map((d) => d.name).join(', ')}.`,
    courses: (e, today) => {
      const d = departementOf(e);
      return d && d.region === name ? upcoming(e, today) : [];
    },
  };
});

export const regionLanding = (name: string) => REGIONS.find((r) => r.slug === slugify(name));

// ——— Villes : courses à moins de RADIUS km ———

export const CITY_RADIUS_KM = 50;

// [nom, lat, lng, préposition « de » / « d’ »]
const CITIES: [string, number, number][] = [
  ['Paris', 48.8566, 2.3522],
  ['Lyon', 45.764, 4.8357],
  ['Marseille', 43.2965, 5.3698],
  ['Toulouse', 43.6047, 1.4442],
  ['Nice', 43.7102, 7.262],
  ['Nantes', 47.2184, -1.5536],
  ['Montpellier', 43.6108, 3.8767],
  ['Strasbourg', 48.5734, 7.7521],
  ['Bordeaux', 44.8378, -0.5792],
  ['Lille', 50.6292, 3.0573],
  ['Rennes', 48.1173, -1.6778],
  ['Reims', 49.2583, 4.0317],
  ['Toulon', 43.1242, 5.928],
  ['Saint-Étienne', 45.4397, 4.3872],
  ['Le Havre', 49.4944, 0.1079],
  ['Grenoble', 45.1885, 5.7245],
  ['Dijon', 47.322, 5.0415],
  ['Angers', 47.4784, -0.5632],
  ['Nîmes', 43.8367, 4.3601],
  ['Clermont-Ferrand', 45.7772, 3.087],
  ['Le Mans', 48.0061, 0.1996],
  ['Aix-en-Provence', 43.5297, 5.4474],
  ['Brest', 48.3904, -4.4861],
  ['Tours', 47.3941, 0.6848],
  ['Amiens', 49.894, 2.2958],
  ['Limoges', 45.8336, 1.2611],
  ['Annecy', 45.8992, 6.1294],
  ['Perpignan', 42.6887, 2.8948],
  ['Metz', 49.1193, 6.1757],
  ['Besançon', 47.238, 6.0243],
  ['Orléans', 47.9029, 1.9093],
  ['Rouen', 49.4432, 1.0999],
  ['Caen', 49.1829, -0.3707],
  ['Nancy', 48.6921, 6.1844],
  ['Avignon', 43.9493, 4.8055],
  ['Poitiers', 46.5802, 0.3404],
  ['Pau', 43.2951, -0.3708],
  ['La Rochelle', 46.1603, -1.1511],
  ['Chambéry', 45.5646, 5.9178],
  ['Valence', 44.9334, 4.8924],
  ['Bayonne', 43.4929, -1.4748],
  ['Lorient', 47.7483, -3.3702],
  ['Vannes', 47.6582, -2.7608],
  ['Saint-Brieuc', 48.5146, -2.7603],
  ['Quimper', 47.996, -4.1024],
  ['Mulhouse', 47.7508, 7.3359],
  ['Colmar', 48.0794, 7.3585],
  ['Troyes', 48.2973, 4.0744],
  ['Ajaccio', 41.9192, 8.7386],
  ['Bastia', 42.6977, 9.4508],
  ['Saint-Denis de La Réunion', -20.8823, 55.4504],
  ['Gap', 44.5594, 6.0786],
  ['Annemasse', 46.1934, 6.2342],
  ['Albi', 43.9289, 2.1464],
  ['Carcassonne', 43.2121, 2.3537],
  ['Béziers', 43.3442, 3.2158],
  ['Cannes', 43.5528, 7.0174],
  ['Niort', 46.3237, -0.4588],
  ['Angoulême', 45.6484, 0.1562],
  ['Périgueux', 45.1847, 0.7214],
  ['Brive-la-Gaillarde', 45.1589, 1.5332],
  ['Rodez', 44.3506, 2.5751],
  ['Le Puy-en-Velay', 45.0434, 3.885],
  ['Bourg-en-Bresse', 46.2052, 5.2255],
  ['Saint-Malo', 48.6493, -2.0257],
];

const deVille = (name: string) => (/^[AEIOUYÉÈÂ]/i.test(name) ? `d’${name}` : name.startsWith('Le ') ? `du ${name.slice(3)}` : `de ${name}`);

export const CITIES_LANDING: Landing[] = CITIES.map(([name, lat, lng]) => ({
  kind: 'ville',
  slug: `autour-${slugify(deVille(name).replace('’', ' '))}`,
  h1: `Trails autour ${deVille(name)}`,
  where: `à moins de ${CITY_RADIUS_KM} km ${deVille(name)}`,
  text: `Les courses de trail à moins de ${CITY_RADIUS_KM} km ${deVille(name)}, à vol d’oiseau : de quoi courir sans passer la journée sur la route.`,
  view: { lat, lng },
  courses: (e, today) => (haversineKm(lat, lng, e.lat, e.lng) <= CITY_RADIUS_KM ? upcoming(e, today) : []),
}));

// ——— Catégories : distance et type de course ———

const byCourse = (pred: (c: Course) => boolean) => (e: RaceEvent, today: string) => upcoming(e, today).filter(pred);

export const CATEGORIES: Landing[] = [
  {
    kind: 'categorie',
    slug: 'trails-courts',
    h1: 'Trails courts : moins de 20 km',
    where: 'de moins de 20 km',
    text: 'Les trails de moins de 20 km : pour découvrir le trail, travailler la vitesse ou enchaîner les courses dans la saison.',
    courses: byCourse((c) => c.distanceKm < 20),
  },
  {
    kind: 'categorie',
    slug: 'trails-de-20-a-42-km',
    h1: 'Trails de 20 à 42 km',
    where: 'de 20 à 42 km',
    text: 'Du semi au marathon : la distance reine du trail, assez longue pour un vrai défi, assez courte pour s’y aligner souvent.',
    courses: byCourse((c) => c.distanceKm >= 20 && c.distanceKm < 42),
  },
  {
    kind: 'categorie',
    slug: 'trails-longs',
    h1: 'Trails longs : 42 à 80 km',
    where: 'de 42 à 80 km',
    text: 'Au-delà du marathon : les trails longs, pour passer la journée en montagne et préparer un premier ultra.',
    courses: byCourse((c) => c.distanceKm >= 42 && c.distanceKm < 80),
  },
  {
    kind: 'categorie',
    slug: 'ultra-trails',
    h1: 'Ultra-trails : plus de 80 km',
    where: 'de plus de 80 km',
    text: 'Les ultra-trails de plus de 80 km en France : nuit en course, barrières horaires et grandes traversées.',
    courses: byCourse((c) => c.distanceKm >= 80),
  },
  {
    kind: 'categorie',
    slug: 'trails-nocturnes',
    h1: 'Trails nocturnes',
    where: 'de nuit',
    text: 'Frontale vissée sur la tête : les trails qui se courent de nuit, en tout ou en partie.',
    courses: byCourse((c) => c.type === 'Trail nocturne' || /nocturne|nuit|night/i.test(c.name)),
  },
  {
    kind: 'categorie',
    slug: 'trails-urbains',
    h1: 'Trails urbains',
    where: 'en ville',
    text: 'Escaliers, parcs, ruelles et collines urbaines : le trail en ville, sans quitter le centre.',
    courses: byCourse((c) => c.type === 'Trail urbain' || /urba/i.test(c.name)),
  },
  {
    kind: 'categorie',
    slug: 'kilometres-verticaux',
    h1: 'Kilomètres verticaux',
    where: 'en kilomètre vertical',
    text: 'Mille mètres de dénivelé positif sur la distance la plus courte possible : le KV, l’effort le plus intense du trail.',
    courses: byCourse((c) => c.type === 'Kilomètre vertical' || /\bKV\b|vertical/i.test(c.name)),
  },
];

export const LANDINGS: Landing[] = [...REGIONS, ...CITIES_LANDING, ...CATEGORIES];

export function landingBySlug(slug: string | undefined): Landing | undefined {
  return LANDINGS.find((l) => l.slug === slug);
}

/** Événements de la page, avec les parcours retenus, du plus proche au plus lointain. */
export function landingItems(l: Landing, events: RaceEvent[], today: string): { event: RaceEvent; courses: Course[] }[] {
  return events
    .filter((e) => !e.custom && e.dateEnd >= today)
    .map((event) => ({ event, courses: l.courses(event, today) }))
    .filter((i) => i.courses.length > 0)
    .sort((a, b) => a.event.dateStart.localeCompare(b.event.dateStart) || b.event.popularity - a.event.popularity);
}
