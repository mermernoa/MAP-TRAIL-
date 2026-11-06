/**
 * Photos des pages Trails (public/regions/<slug de la région>.webp), fournies par Take Ton Trail.
 * Une région sans photo garde le relief 3D ou le décor de crêtes.
 */
const PHOTOS = new Set([
  'auvergne-rhone-alpes',
  'bourgogne-franche-comte',
  'bretagne',
  'centre-val-de-loire',
  'corse',
  'grand-est',
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
