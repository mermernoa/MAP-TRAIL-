/**
 * Photos des pages Trails (public/regions/<slug de la région>.webp), fournies par Take Ton Trail.
 * Une région sans photo garde le relief 3D ou le décor de crêtes.
 */
const PHOTOS = new Set(['corse', 'grand-est', 'ile-de-france', 'normandie']);

export const regionPhoto = (regionSlug: string): string | null => (PHOTOS.has(regionSlug) ? `regions/${regionSlug}.webp` : null);

/** Haut de la page /trails/. */
export const TRAILS_PHOTO = 'regions/trails.webp';
