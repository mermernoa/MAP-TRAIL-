import { europeRaces } from './races-europe';
import { franceRaces } from './races-france';
import { worldRaces } from './races-world';
import type { RaceEvent, RaceLink } from './types';

function search(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Liens utiles communs à toutes les courses (site, recherche ITRA, UTMB…). */
export function derivedLinks(event: RaceEvent): RaceLink[] {
  const links: RaceLink[] = [];
  if (event.website) links.push({ label: 'Site officiel', url: event.website });
  links.push(...event.links);
  if (!event.website) {
    links.push({ label: 'Rechercher le site officiel', url: search(`${event.name} trail site officiel`) });
  }
  links.push({ label: 'Fiche ITRA', url: search(`site:itra.run ${event.name}`) });
  if (event.circuits.includes('UTMB World Series')) {
    links.push({ label: 'UTMB World Series', url: 'https://utmb.world/utmb-world-series-events' });
  }
  if (event.circuits.includes('Golden Trail Series')) {
    links.push({ label: 'Golden Trail Series', url: 'https://www.goldentrailseries.com' });
  }
  links.push({ label: 'Résultats des éditions passées', url: search(`${event.name} résultats`) });
  return links;
}

export const builtinRaces: RaceEvent[] = [...franceRaces, ...europeRaces, ...worldRaces];

export const ALL_CIRCUITS = Array.from(new Set(builtinRaces.flatMap((r) => r.circuits))).sort();
