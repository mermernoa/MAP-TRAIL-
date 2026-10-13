import type { RaceEvent } from '../data/types';

export interface Photo {
  src: string;
  /** Auteur ou origine de la photo, tel que noté dans la feuille. */
  credit: string;
  event: RaceEvent;
  /** Photo de paysage choisie dans l'espace admin, et non une photo de course. */
  chosen?: boolean;
}

/** Image générique (ville, département) fournie par une plateforme, et non une photo de la course. */
export function isIllustration(event: RaceEvent): boolean {
  return /illustration/i.test(event.imageCredit ?? '');
}

/** Photo d'un événement, seulement si elle est créditée : aucune image n'est affichée sans sa source. */
export function eventPhoto(event: RaceEvent): Photo | null {
  if (!event.image || !event.imageCredit) return null;
  return { src: event.image, credit: event.imageCredit, event };
}

/**
 * Photo de couverture pour un ensemble de courses (massif, collection) : une
 * vraie photo de course plutôt qu'une illustration, de préférence la plus connue.
 * `skip` écarte des photos déjà utilisées ailleurs sur la page.
 */
export function coverPhoto(events: RaceEvent[], skip: Set<string> = new Set()): Photo | null {
  let best: { photo: Photo; score: number } | null = null;
  for (const event of events) {
    const photo = eventPhoto(event);
    if (!photo || skip.has(photo.src)) continue;
    // Les affiches (beaucoup de texte, format portrait) passent après les photos.
    const poster = /affiche|bannière|vignette/i.test(photo.credit);
    const score = event.popularity * 10 + (isIllustration(event) ? -40 : 0) + (poster ? -15 : 0) + event.courses.length / 10;
    if (!best || score > best.score) best = { photo, score };
  }
  return best?.photo ?? null;
}

/**
 * Photo d'un massif : celle choisie dans l'espace admin si elle existe, sinon la
 * meilleure photo de course créditée du massif.
 */
export function massifCover(
  slug: string,
  events: RaceEvent[],
  chosen: Record<string, { src: string; credit: string }>,
): Photo | null {
  const pick = chosen[slug];
  if (pick && events[0]) return { src: pick.src, credit: pick.credit, event: events[0], chosen: true };
  return coverPhoto(events);
}
