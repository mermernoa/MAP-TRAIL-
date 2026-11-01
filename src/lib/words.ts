/**
 * Compter juste : un « événement » est une date et un lieu (une fiche du site), une « course »
 * est un parcours de cet événement (le 10 km, le 42 km…). Une ligne de la feuille = une course.
 */
const nf = new Intl.NumberFormat('fr-FR');

/** « 1 événement », « 1 228 événements » */
export const eventsWord = (n: number) => `${nf.format(n)} ${n > 1 ? 'événements' : 'événement'}`;

/** « 1 course », « 3 167 courses » */
export const coursesWord = (n: number) => `${nf.format(n)} ${n > 1 ? 'courses' : 'course'}`;
