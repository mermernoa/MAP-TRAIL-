import type { RaceEvent } from '../data/types';
import { type Departement, DEPARTEMENTS, departementOf, slugify } from './departements';
import { haversineKm } from './metrics';

/**
 * Grandes villes des pages « Trails près de Lyon »… (src/lib/trailPages.ts), et liens
 * « dans le coin » des fiches course. Module léger : il est chargé avec chaque fiche.
 */

export interface PageLink {
  label: string;
  /** Adresse sans barre initiale, '' pour l'accueil. */
  path: string;
  count?: number;
}

// ——— Grandes villes ———

export interface City {
  name: string;
  slug: string;
  /** « près de Lyon », « près du Havre ». */
  nearName: string;
  lat: number;
  lng: number;
  /** Code du département. */
  dep: string;
}

/** Rayon des pages « près de… », à vol d'oiseau depuis le centre-ville. */
export const CITY_RADIUS_KM = 50;

// Les 40 plus grandes villes de France métropolitaine (sans les communes de banlieue, déjà
// couvertes par leur grande ville), puis Saint-Denis de La Réunion. Coordonnées : centre-ville.
// [nom, lat, lng, département, « du » pour Le Havre et Le Mans]
const CITY_RAW: [string, number, number, string, string?][] = [
  ['Paris', 48.8566, 2.3522, '75'],
  ['Marseille', 43.2965, 5.3698, '13'],
  ['Lyon', 45.764, 4.8357, '69'],
  ['Toulouse', 43.6047, 1.4442, '31'],
  ['Nice', 43.7102, 7.262, '06'],
  ['Nantes', 47.2184, -1.5536, '44'],
  ['Montpellier', 43.6108, 3.8767, '34'],
  ['Strasbourg', 48.5734, 7.7521, '67'],
  ['Bordeaux', 44.8378, -0.5792, '33'],
  ['Lille', 50.6292, 3.0573, '59'],
  ['Rennes', 48.1173, -1.6778, '35'],
  ['Toulon', 43.1242, 5.928, '83'],
  ['Reims', 49.2583, 4.0317, '51'],
  ['Saint-Étienne', 45.4397, 4.3872, '42'],
  ['Le Havre', 49.4944, 0.1079, '76', 'du'],
  ['Dijon', 47.322, 5.0415, '21'],
  ['Grenoble', 45.1885, 5.7245, '38'],
  ['Angers', 47.4784, -0.5632, '49'],
  ['Nîmes', 43.8367, 4.3601, '30'],
  ['Aix-en-Provence', 43.5297, 5.4474, '13'],
  ['Clermont-Ferrand', 45.7772, 3.087, '63'],
  ['Le Mans', 48.0061, 0.1996, '72', 'du'],
  ['Brest', 48.3904, -4.4861, '29'],
  ['Tours', 47.3941, 0.6848, '37'],
  ['Amiens', 49.8941, 2.2958, '80'],
  ['Limoges', 45.8336, 1.2611, '87'],
  ['Annecy', 45.8992, 6.1294, '74'],
  ['Perpignan', 42.6887, 2.8948, '66'],
  ['Metz', 49.1193, 6.1757, '57'],
  ['Besançon', 47.2378, 6.0241, '25'],
  ['Orléans', 47.903, 1.9093, '45'],
  ['Rouen', 49.4432, 1.0999, '76'],
  ['Mulhouse', 47.7508, 7.3359, '68'],
  ['Caen', 49.1829, -0.3707, '14'],
  ['Nancy', 48.6921, 6.1844, '54'],
  ['Avignon', 43.9493, 4.8055, '84'],
  ['Poitiers', 46.5802, 0.3404, '86'],
  ['Dunkerque', 51.0343, 2.3768, '59'],
  ['La Rochelle', 46.1603, -1.1511, '17'],
  ['Pau', 43.2951, -0.3708, '64'],
  ['Saint-Denis', -20.8823, 55.4504, '974'],
];

export const CITIES: City[] = CITY_RAW.map(([name, lat, lng, dep, prep]) => {
  // « près du Havre », « près d’Annecy », « près de Lyon ».
  const of = prep === 'du' ? `du ${name.replace(/^Le /, '')}` : /^[aeiouyâéèêîô]/i.test(name) ? `d’${name}` : `de ${name}`;
  const reunion = dep === '974';
  const nearName = `près ${of}${reunion ? ' (La Réunion)' : ''}`;
  return { name, lat, lng, dep, nearName, slug: slugify(`pres ${of}${reunion ? ' la reunion' : ''}`) };
});

export const cityDep = (c: City): Departement => DEPARTEMENTS.find((d) => d.code === c.dep)!;

/** Grande ville la plus proche d'un point, si elle est dans le rayon des pages « près de… ». */
export function nearestCity(lat: number, lng: number): { city: City; km: number } | null {
  let best: { city: City; km: number } | null = null;
  for (const city of CITIES) {
    const km = haversineKm(city.lat, city.lng, lat, lng);
    if (km <= CITY_RADIUS_KM && (!best || km < best.km)) best = { city, km };
  }
  return best;
}

/** Liens discrets en bas d'une fiche course : la grande ville la plus proche et le département. */
export function courseNearbyLinks(event: RaceEvent, events: RaceEvent[], today: string): PageLink[] {
  if (event.custom) return [];
  const upcoming = events.filter((e) => !e.custom && e.dateEnd >= today && e.courses.some((c) => c.start.slice(0, 10) >= today));
  const out: PageLink[] = [];
  const near = nearestCity(event.lat, event.lng);
  if (near) {
    const count = upcoming.filter((e) => haversineKm(near.city.lat, near.city.lng, e.lat, e.lng) <= CITY_RADIUS_KM).length;
    if (count > 1) out.push({ label: `Autres trails ${near.city.nearName}`, path: `trails/${near.city.slug}`, count });
  }
  const dep = departementOf(event);
  if (dep) {
    const count = upcoming.filter((e) => departementOf(e) === dep).length;
    if (count > 1) out.push({ label: `Autres trails ${dep.inName}`, path: `trails/${dep.slug}`, count });
  }
  return out;
}
