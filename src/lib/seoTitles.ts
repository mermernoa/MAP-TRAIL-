/**
 * Titres des pages (balise <title>), partagés entre le pré-rendu (scripts/prerender.ts)
 * et le site : Google lit le titre de la page affichée, il doit donc être le même des deux
 * côtés. 60 caractères au plus (au-delà, Google coupe) : le nom du site n'est ajouté que
 * s'il tient. Les mots cherchés d'abord (« trail », le lieu, « calendrier », la saison).
 */
const SITE = 'Take Ton Trail';
export const TITLE_MAX = 60;

/** Ajoute « – Take Ton Trail » si le titre reste sous 60 caractères. */
export const withSite = (s: string) => (`${s} – ${SITE}`.length <= TITLE_MAX ? `${s} – ${SITE}` : s);

/** Premier titre de la liste qui tient en 60 caractères (sinon le plus court). */
export function fitTitle(...candidates: string[]): string {
  for (const c of candidates) {
    const t = withSite(c);
    if (t.length <= TITLE_MAX) return t;
  }
  return candidates.reduce((a, b) => (b.length < a.length ? b : a));
}

/**
 * Saison affichée dans les titres : « 2026-2027 » d'août à décembre (le calendrier court
 * sur l'année suivante), « 2027 » de janvier à juillet.
 */
export function seasonLabel(now: Date = new Date()): string {
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : String(y);
}
const SEASON = seasonLabel();

export const TITLES = {
  home: `${SITE} : calendrier et carte des trails ${SEASON}`,
  map: withSite(`Carte des trails en France ${SEASON}`),
  calendar: withSite(`Calendrier des trails ${SEASON} en France`),
  highlights: withSite('Trails à la une : nos coups de cœur'),
};

export const massifTitle = (name: string) => fitTitle(`Trail ${name} : calendrier ${SEASON}`, `Trail ${name} ${SEASON}`, `Trail ${name}`);
export const collectionTitle = (title: string) => fitTitle(`${title} : trails ${SEASON}`, title);
export const infoTitle = (title: string) => withSite(title);
/** Pages Trails (src/lib/trailPages.ts) : le titre y est déjà calibré, on ajoute le nom du site s'il tient. */
export const trailsTitle = (title: string) => withSite(title);

/** « SaintéLyon 2026, trail à Saint-Étienne – Take Ton Trail », raccourci si trop long. */
export function raceTitle(name: string, year: string | number, city: string): string {
  const hasTrail = /trail|ultra|kv|kilom[eè]tre vertical|skyrace/i.test(name);
  return fitTitle(hasTrail ? `${name} ${year} à ${city}` : `${name} ${year}, trail à ${city}`, `${name} ${year}, ${city}`, `${name} ${year}`, name);
}
