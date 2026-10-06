import type { RaceEvent, RaceLink } from './types';

function search(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function siteLabel(url: string): string {
  if (/milesrepublic\.com/.test(url)) return 'Fiche Miles Republic';
  if (/finishers\.com/.test(url)) return 'Fiche Finishers';
  if (/betrail\.run/.test(url)) return 'Fiche Betrail';
  if (/utmb\.world/.test(url)) return 'Site UTMB';
  return 'Site officiel';
}

/** Liens utiles d'un événement : site, inscription, recherches ITRA et résultats. */
export function derivedLinks(event: RaceEvent): RaceLink[] {
  const links: RaceLink[] = [];
  if (event.website) links.push({ label: siteLabel(event.website), url: event.website });
  const registration = event.courses.find((c) => c.registrationUrl)?.registrationUrl;
  if (registration && registration !== event.website) links.push({ label: 'Inscriptions', url: registration });
  links.push(...event.links);
  if (!event.website || siteLabel(event.website) !== 'Site officiel') {
    links.push({ label: 'Rechercher le site de l’organisation', url: search(`${event.name} ${event.city} trail`) });
  }
  if (event.courses.some((c) => c.utmbIndex)) {
    links.push({ label: 'UTMB Index', url: search(`site:utmb.world ${event.name}`) });
  }
  links.push({ label: 'Fiche ITRA', url: search(`site:itra.run ${event.name}`) });
  links.push({ label: 'Résultats des éditions passées', url: search(`${event.name} résultats`) });
  return links;
}

/** Valeurs distinctes d'un champ, triées par fréquence décroissante. */
export function distinctValues(values: (string | undefined)[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'fr'));
}
