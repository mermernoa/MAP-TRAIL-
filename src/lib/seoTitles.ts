/**
 * Titres des pages (balise <title>), partagés entre le pré-rendu (scripts/prerender.ts)
 * et le site : Google lit le titre de la page affichée, il doit donc être le même des deux
 * côtés. Viser 60 caractères au plus, le nom du site en fin de titre.
 */
const SITE = 'Take Ton Trail';
const withSite = (s: string) => `${s} – ${SITE}`;

export const TITLES = {
  home: `${SITE} – Carte et calendrier des trails en France`,
  map: withSite('Carte des trails en France'),
  calendar: withSite('Calendrier des trails en France'),
  highlights: withSite('Trails à la une'),
};

export const massifTitle = (name: string) => withSite(`Trails ${name}`);
export const collectionTitle = (title: string) => withSite(title);
export const infoTitle = (title: string) => withSite(title);
/** Pages Trails (src/lib/trailPages.ts) : « Trails en Isère (38) : 20 courses – Take Ton Trail ». */
export const trailsTitle = (title: string) => withSite(title);

/** « Trail des Gens Bons 2027, Ryes – Take Ton Trail », raccourci si trop long. */
export function raceTitle(name: string, year: string | number, city: string): string {
  const full = withSite(`${name} ${year}, ${city}`);
  if (full.length <= 70) return full;
  const noCity = withSite(`${name} ${year}`);
  return noCity.length <= 70 ? noCity : withSite(name);
}
