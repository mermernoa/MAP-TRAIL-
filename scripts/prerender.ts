/**
 * Après `vite build` : une page HTML par adresse du site, pour Google et les aperçus de partage.
 *
 * Chaque page reprend dist/index.html (le site complet démarre ensuite normalement) avec
 * son titre, sa description, son adresse canonique, ses balises Open Graph, ses données
 * structurées (schema.org) et un contenu lisible sans JavaScript. GitHub Pages sert
 * « /course/xyz » depuis « course/xyz.html ». Écrit aussi sitemap.xml, robots.txt et 404.html.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { RaceEvent } from '../src/data/types';
import { collectionItems, COLLECTIONS } from '../src/lib/collections';
import { formatRange } from '../src/lib/dates';
import {
  departementEvents,
  departementOf,
  departementsWithRaces,
  introText,
  MIN_INDEXED,
  monthEvents,
  monthsWithRaces,
  summarize,
} from '../src/lib/departements';
import { massifEvents, MASSIFS } from '../src/lib/massifs';

const DIST = 'dist';
const env = Object.fromEntries(
  readFileSync('.env.production', 'utf8')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2]]),
);
const SITE_URL = (process.env.VITE_SITE_URL ?? env.VITE_SITE_URL ?? '').replace(/\/$/, '');
if (!SITE_URL) throw new Error('VITE_SITE_URL manquant (.env.production)');
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const today = new Date().toISOString().slice(0, 10);

const template = readFileSync(join(DIST, 'index.html'), 'utf8');
const { events } = JSON.parse(readFileSync(join(DIST, 'data/races.json'), 'utf8')) as { events: RaceEvent[] };
const upcoming = events.filter((e) => e.dateEnd >= today).sort((a, b) => a.dateStart.localeCompare(b.dateStart));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const km = (v: number) => `${nf.format(v)} km`;
const clip = (s: string, n = 158) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/[\s,;:·–-]+\S*$/, '')}…`);
const place = (e: RaceEvent) => `${e.city}${e.department ? `, ${e.department}` : e.region ? `, ${e.region}` : ''}`;

interface Page {
  path: string; // sans barre initiale ; '' pour l'accueil
  title: string;
  description: string;
  body: string;
  jsonLd?: object[];
  noindex?: boolean;
  lastmod?: string;
}

function raceLink(e: RaceEvent) {
  const longest = Math.max(...e.courses.map((c) => c.distanceKm));
  return `<li><a href="course/${e.id}">${esc(e.name)}</a> · ${esc(place(e))} · ${esc(formatRange(e.dateStart, e.dateEnd))} · jusqu’à ${km(longest)}</li>`;
}

const massifLink = (name: string | undefined) => {
  const m = MASSIFS.find((x) => x.name === name);
  return m ? ` · Massif : <a href="massif/${m.slug}">${esc(m.name)}</a>` : '';
};

const depLink = (e: RaceEvent) => {
  const d = departementOf(e);
  return d ? ` · <a href="trails/${d.slug}">Trails ${esc(d.inName)}</a>` : '';
};

const NAV = `<nav><a href="./">Accueil</a> · <a href="carte">Carte</a> · <a href="calendrier">Calendrier</a> · <a href="a-la-une">À la une</a> · <a href="ma-saison">Ma saison</a></nav>`;
const FOOT = `<footer><p><a href="trails/">Trails par département et par mois</a> · <a href="a-propos">À propos</a> · <a href="contact">Contact</a> · <a href="proposer-une-course">Proposer une course</a> · <a href="mentions-legales">Mentions légales</a> · <a href="confidentialite">Confidentialité</a></p></footer>`;
const MASSIF_LINKS = `<h2>Par massif</h2><ul>${MASSIFS.map((m) => `<li><a href="massif/${m.slug}">${esc(m.name)}</a></li>`).join('')}</ul>`;
const COLLECTION_LINKS = `<h2>Par envie</h2><ul>${COLLECTIONS.map((c) => `<li><a href="collection/${c.slug}">${esc(c.title)}</a> : ${esc(c.tagline)}</li>`).join('')}</ul>`;

function render(p: Page): string {
  const url = p.path ? `${SITE_URL}/${p.path}` : `${SITE_URL}/`;
  const head = [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    p.noindex ? '<meta name="robots" content="noindex" />' : '',
    '<meta property="og:site_name" content="Take Ton Trail" />',
    '<meta property="og:locale" content="fr_FR" />',
    `<meta property="og:type" content="${p.path.startsWith('course/') ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    ...(p.jsonLd ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ]
    .filter(Boolean)
    .join('\n    ');
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace(/\n\s*\n/g, '\n');
  // Contenu lisible sans JavaScript ; le site le remplace dès qu'il démarre.
  html = html.replace('<div id="root"></div>', `<div id="root"><div class="prerender">${NAV}${p.body}${FOOT}</div></div>`);
  return html;
}

const pages: Page[] = [];
const ORG = { '@type': 'Organization', name: 'Take Ton Trail', url: `${SITE_URL}/`, logo: `${SITE_URL}/icon-512.png` };

pages.push({
  path: '',
  title: 'Take Ton Trail – la carte et le calendrier des trails en France',
  description: `${upcoming.length} courses de trail à venir en France et outre-mer, du petit trail du coin à l’ultra mythique : carte en relief, calendrier, distances, D+, prix et dates d’inscription.`,
  body: `<h1>Du petit trail du coin à l’ultra mythique</h1><p>${upcoming.length} courses de trail à venir en France et outre-mer, sur une carte en relief et dans un calendrier. Filtre par distance, dénivelé, technicité, massif et date, puis construis ta saison.</p>${MASSIF_LINKS}${COLLECTION_LINKS}`,
  jsonLd: [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Take Ton Trail', url: `${SITE_URL}/`, inLanguage: 'fr-FR' },
    { '@context': 'https://schema.org', ...ORG },
  ],
});
pages.push({
  path: 'carte',
  title: 'Carte des courses de trail en France – Take Ton Trail',
  description: 'Toutes les courses de trail sur une carte en relief 3D : filtre par distance, dénivelé, massif, date et prix, et trouve les courses près de chez toi.',
  body: `<h1>La carte des trails</h1><p>Toutes les courses de trail de France et d’outre-mer sur une carte en relief, avec leurs distances, leur dénivelé et leurs dates.</p>${MASSIF_LINKS}`,
});

// Calendrier : toutes les courses à venir, mois par mois (le meilleur point d'entrée pour Google).
const byMonth = new Map<string, RaceEvent[]>();
for (const e of upcoming) {
  const k = e.dateStart.slice(0, 7);
  byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
}
const monthSlug = (k: string) => monthsWithRaces(events, today).find((x) => x.month.key === k)?.month.slug ?? '';
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
pages.push({
  path: 'calendrier',
  title: 'Calendrier des trails en France – Take Ton Trail',
  description: `Le calendrier des ${upcoming.length} prochaines courses de trail en France, mois par mois : dates, lieux, distances, dénivelé, prix et ouverture des inscriptions.`,
  body: `<h1>Calendrier des trails</h1>${[...byMonth]
    .map(([k, list]) => `<h2><a href="trails/${monthSlug(k)}">${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}</a></h2><ul>${list.map(raceLink).join('')}</ul>`)
    .join('')}`,
});
pages.push({
  path: 'a-la-une',
  title: 'Courses de trail à la une – Take Ton Trail',
  description: 'Nos coups de cœur, une course par thème (défi, mythique, pépite, nocturne, ultra, KV) et le prochain week-end de trail.',
  body: '<h1>À la une</h1><p>Nos coups de cœur, une course par thème et le prochain week-end de course.</p>',
});

for (const m of MASSIFS) {
  const list = massifEvents(m, events, today);
  pages.push({
    path: `massif/${m.slug}`,
    title: `Trails ${m.name} : ${list.length} courses – Take Ton Trail`,
    description: clip(`${list.length} courses de trail à venir dans le massif ${m.name}. ${m.text}`),
    body: `<h1>Trails ${esc(m.name)}</h1><p>${esc(m.text)}</p><ul>${list.map(raceLink).join('')}</ul>`,
  });
}
for (const c of COLLECTIONS) {
  const items = collectionItems(c, events, today);
  pages.push({
    path: `collection/${c.slug}`,
    title: `${c.title} : ${items.length} courses de trail – Take Ton Trail`,
    description: clip(`${c.tagline} ${c.text}`),
    body: `<h1>${esc(c.title)}</h1><p>${esc(c.text)}</p><ul>${items.map((i) => raceLink(i.event)).join('')}</ul>`,
  });
}

// Pages « Trails en Haute-Savoie » et « Trails en novembre 2026 » (recherches locales et saisonnières).
const deps = departementsWithRaces(events, today);
const months = monthsWithRaces(events, today);
const DEP_LINKS = (list: typeof deps) =>
  `<ul>${list.map(({ dep, count }) => `<li><a href="trails/${dep.slug}">Trails ${esc(dep.inName)}</a> (${count})</li>`).join('')}</ul>`;
const MONTH_LINKS = `<ul>${months.map(({ month, count }) => `<li><a href="trails/${month.slug}">Trails en ${esc(month.label)}</a> (${count})</li>`).join('')}</ul>`;
pages.push({
  path: 'trails/',
  title: 'Trails par département et par mois – Take Ton Trail',
  description: `Les ${upcoming.length} courses de trail à venir en France, classées par département et par mois : trouve les trails près de chez toi et construis ta saison.`,
  body: `<h1>Trails par département et par mois</h1><h2>Par mois</h2>${MONTH_LINKS}<h2>Par département</h2>${DEP_LINKS(deps)}`,
});
for (const { dep } of deps) {
  const list = departementEvents(dep, events, today);
  const intro = introText(dep.inName, summarize(list, today));
  const neighbours = deps.filter((d) => d.dep.region === dep.region && d.dep !== dep);
  pages.push({
    path: `trails/${dep.slug}`,
    title: `Trails ${dep.inName} (${dep.code}) : ${list.length} courses à venir – Take Ton Trail`,
    description: clip(`${intro} Calendrier, distances, dénivelé et inscriptions.`),
    body: `<h1>Trails ${esc(dep.inName)}</h1><p>${esc(intro)}</p><h2>Le calendrier des trails ${esc(dep.inName)}</h2><ul>${list.map(raceLink).join('')}</ul>${
      neighbours.length ? `<h2>Ailleurs en ${esc(dep.region)}</h2>${DEP_LINKS(neighbours)}` : ''
    }`,
    noindex: list.length < MIN_INDEXED,
  });
}
for (const { month } of months) {
  const list = monthEvents(month, events, today);
  const intro = introText(`en ${month.label}`, summarize(list, today));
  pages.push({
    path: `trails/${month.slug}`,
    title: `Trails en ${month.label} : ${list.length} courses en France – Take Ton Trail`,
    description: clip(`${intro} Dates, lieux, distances et inscriptions.`),
    body: `<h1>Trails en ${esc(month.label)}</h1><p>${esc(intro)}</p><ul>${list.map(raceLink).join('')}</ul><h2>Les autres mois</h2>${MONTH_LINKS}`,
    noindex: list.length < MIN_INDEXED,
  });
}

for (const e of events) {
  const courses = [...e.courses].sort((a, b) => b.distanceKm - a.distanceKm);
  const year = e.edition ?? e.dateStart.slice(0, 4);
  const dist = courses.map((c) => (c.elevationGain != null ? `${km(c.distanceKm)} (${nf.format(c.elevationGain)} m D+)` : km(c.distanceKm))).join(', ');
  const when = formatRange(e.dateStart, e.dateEnd);
  const estimated = e.dateStatus === 'estimated';
  const prices = courses.map((c) => c.priceEur).filter((v): v is number => v != null);
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: e.name,
    sport: 'Trail running',
    startDate: e.dateStart,
    endDate: e.dateEnd,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: `${SITE_URL}/course/${e.id}`,
    image: [OG_IMAGE],
    description: clip(`${e.name}, course de trail à ${place(e)}. Parcours : ${dist}.`, 300),
    location: {
      '@type': 'Place',
      name: e.city,
      address: { '@type': 'PostalAddress', addressLocality: e.city, addressRegion: e.region, addressCountry: e.country },
      geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lng },
    },
  };
  if (prices.length) {
    ld.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      ...(e.website ? { url: e.website } : {}),
    };
  }
  pages.push({
    path: `course/${e.id}`,
    title: `${e.name} ${year} – ${e.city} | Take Ton Trail`,
    description: clip(`${e.name} à ${place(e)}, ${estimated ? 'date prévisionnelle : ' : ''}${when}. Parcours : ${dist}. Prix, inscriptions, carte et profil.`),
    lastmod: e.updatedAt,
    body: `<h1>${esc(e.name)}</h1><p>${esc(place(e))}${depLink(e)} · ${estimated ? 'Date prévisionnelle : ' : ''}${esc(when)}${massifLink(e.massif)}</p><h2>Parcours</h2><ul>${courses
      .map((c) => `<li>${esc(c.name)} : ${km(c.distanceKm)}${c.elevationGain != null ? `, ${nf.format(c.elevationGain)} m D+` : ''}${c.priceEur != null ? `, ${nf.format(c.priceEur)} €` : ''}</li>`)
      .join('')}</ul>${e.description ? `<p>${esc(e.description)}</p>` : ''}${e.website ? `<p><a href="${esc(e.website)}" rel="nofollow">Site de l’organisation</a></p>` : ''}`,
    // Date pas encore publiée : pas de données d'événement (Google demande une date sûre).
    jsonLd: estimated ? undefined : [ld],
  });
}

const STATIC: [string, string, string, boolean?][] = [
  ['a-propos', 'À propos', 'Take Ton Trail rassemble toutes les courses de trail au même endroit : où, quand, combien de kilomètres et de dénivelé, à quel prix, et quand ouvrent les inscriptions.'],
  ['contact', 'Contact', 'Une question, une idée, un partenariat ? Écris à Take Ton Trail : chaque message est lu.'],
  ['proposer-une-course', 'Proposer une course', 'Une course de trail manque à la carte ? Donne-nous l’essentiel : elle sera vérifiée sur son site officiel, puis ajoutée.'],
  ['signaler', 'Signaler une erreur', 'Une date a changé, un prix est faux ? Signale-le : la base est corrigée à la main.'],
  ['mentions-legales', 'Mentions légales', 'Éditeur, hébergement, sources des données et responsabilité du site Take Ton Trail.'],
  ['confidentialite', 'Confidentialité', 'Ce que Take Ton Trail conserve, pourquoi, où, combien de temps, et comment l’effacer.'],
  ['ma-saison', 'Ma saison', 'Ta saison de trail : tes courses, tes objectifs et les dates d’inscription.', true],
  ['compte', 'Mon compte', 'Ton compte Take Ton Trail : ta saison sur tous tes appareils.', true],
];
for (const [path, title, description, noindex] of STATIC) {
  pages.push({ path, title: `${title} – Take Ton Trail`, description, body: `<h1>${esc(title)}</h1><p>${esc(description)}</p>`, noindex });
}

for (const p of pages) {
  const file = join(DIST, !p.path ? 'index.html' : p.path.endsWith('/') ? `${p.path}index.html` : `${p.path}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(p));
}
// Adresse inconnue (et espace admin) : GitHub Pages sert 404.html, le site s'y retrouve tout seul.
writeFileSync(
  join(DIST, '404.html'),
  render({ path: '', title: 'Take Ton Trail', description: 'Page introuvable.', body: '<h1>Chargement…</h1>', noindex: true }).replace(
    /<link rel="canonical"[^>]*>\n\s*/,
    '',
  ),
);

const indexed = pages.filter((p) => !p.noindex);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed
    .map((p) => `  <url><loc>${p.path ? `${SITE_URL}/${p.path}` : `${SITE_URL}/`}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`,
);
const basePath = new URL(`${SITE_URL}/`).pathname;
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${basePath}admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`${pages.length} pages, ${indexed.length} dans le plan du site (${SITE_URL})`);
