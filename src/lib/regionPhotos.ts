/**
 * Photos des régions (public/regions/<slug de la région>.webp), fournies par Take Ton Trail.
 * Utilisées uniquement sur la page /trails/ : vignettes des régions et photo du haut de page.
 * Une région sans photo garde le décor de crêtes.
 */
const PHOTOS = new Set([
  'auvergne-rhone-alpes',
  'bourgogne-franche-comte',
  'bretagne',
  'centre-val-de-loire',
  'corse',
  'grand-est',
  'hauts-de-france',
  'ile-de-france',
  'normandie',
  'nouvelle-aquitaine',
  'occitanie',
  'outre-mer',
  'pays-de-la-loire',
  'provence-alpes-cote-d-azur',
]);

export const regionPhoto = (regionSlug: string): string | null => (PHOTOS.has(regionSlug) ? `regions/${regionSlug}.webp` : null);

/** Haut de la page /trails/. */
export const TRAILS_PHOTO = 'regions/trails.webp';

/** Photos des grandes villes (public/villes/<nom>.webp), elles aussi seulement sur /trails/. */
const CITY_PHOTOS: Record<string, string> = {
  'Aix-en-Provence': 'aix-en-provence',
  Amiens: 'amiens',
  Angers: 'angers',
  Annecy: 'annecy',
  Avignon: 'avignon',
  Besançon: 'besancon',
  Bordeaux: 'bordeaux',
  Brest: 'brest',
  Caen: 'caen',
  'Clermont-Ferrand': 'clermont-ferrand',
  Dijon: 'dijon',
  Dunkerque: 'dunkerque',
  Grenoble: 'grenoble',
  'La Rochelle': 'la-rochelle',
  'Le Havre': 'le-havre',
  'Le Mans': 'le-mans',
  Lille: 'lille',
  Limoges: 'limoges',
  Lyon: 'lyon',
  Marseille: 'marseille',
  Metz: 'metz',
  Montpellier: 'montpellier',
  Mulhouse: 'mulhouse',
  Nancy: 'nancy',
  Nantes: 'nantes',
  Nice: 'nice',
  Nîmes: 'nimes',
  Orléans: 'orleans',
  Paris: 'paris',
  Pau: 'pau',
  Perpignan: 'perpignan',
  Poitiers: 'poitiers',
  Reims: 'reims',
  Rennes: 'rennes',
  Rouen: 'rouen',
  'Saint-Denis': 'saint-denis-la-reunion',
  'Saint-Étienne': 'saint-etienne',
  Strasbourg: 'strasbourg',
  Toulon: 'toulon',
  Toulouse: 'toulouse',
  Tours: 'tours',
};

export const cityPhoto = (cityName: string): string | null => (CITY_PHOTOS[cityName] ? `villes/${CITY_PHOTOS[cityName]}.webp` : null);

