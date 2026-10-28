/**
 * Adresses du site. Les pages ont de vraies adresses (/course/…, /massif/…) servies
 * par des fichiers HTML générés au build (scripts/prerender.ts) ; la balise <base> de
 * index.html (VITE_BASE_PATH) fait pointer les chemins relatifs (images, données) au bon endroit.
 */

/** Chemin de base du site, avec la barre finale : « /MAP-TRAIL-/ » sur GitHub Pages, « / » en local. */
export const BASE_PATH = new URL(document.baseURI).pathname.replace(/[^/]*$/, '');

/** Base du routeur, sans la barre finale (« / » si le site est à la racine). */
export const ROUTER_BASENAME = BASE_PATH.replace(/\/$/, '') || '/';

/** Adresse complète d'une page du site, par exemple appUrl('compte'). */
export function appUrl(path = ''): string {
  return `${window.location.origin}${BASE_PATH}${path.replace(/^\//, '')}`;
}

/**
 * Anciennes adresses en « #/… » (liens partagés, e-mails déjà envoyés) : on les convertit
 * en vraies adresses avant le démarrage du routeur.
 */
export function upgradeHashUrl(): void {
  const { hash } = window.location;
  if (!hash.startsWith('#/')) return;
  window.history.replaceState(null, '', `${BASE_PATH}${hash.slice(2)}`);
}
