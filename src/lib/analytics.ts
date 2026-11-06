/**
 * Mesure d'audience Google, chargée seulement après accord du visiteur (exigence de la CNIL :
 * Google Analytics dépose des cookies et envoie des données hors de l'UE).
 * VITE_GA_ID dans .env.production : un conteneur Google Tag Manager (« GTM-XXXXXXX », Google
 * Analytics se règle alors dans Tag Manager) ou directement Google Analytics 4 (« G-XXXXXXXXXX »).
 * Sans identifiant, rien n'est chargé et aucun bandeau n'apparaît.
 */
export const GA_ID: string = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() ?? '';

const KEY = 'ttt-consentement-mesure';
/** Le choix est redemandé au bout de 6 mois (recommandation de la CNIL). */
const MAX_AGE_MS = 182 * 24 * 3600 * 1000;

export type Consent = 'accepte' | 'refuse' | null;

export function readConsent(): Consent {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { value, at } = JSON.parse(raw) as { value: Consent; at: number };
    return Date.now() - at < MAX_AGE_MS ? value : null;
  } catch {
    return null;
  }
}

type Listener = (c: Consent) => void;
const listeners = new Set<Listener>();
export const onConsentChange = (fn: Listener) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function setConsent(value: Exclude<Consent, null>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ value, at: Date.now() }));
  } catch {
    /* stockage indisponible : le choix vaut pour cette visite */
  }
  if (value === 'accepte') loadAnalytics();
  else removeAnalyticsCookies();
  listeners.forEach((fn) => fn(value));
}

/** Rouvre le bandeau (lien « Gérer les cookies »). */
export function resetConsent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
  removeAnalyticsCookies();
  listeners.forEach((fn) => fn(null));
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;
const isGtm = GA_ID.startsWith('GTM-');

export function loadAnalytics(): void {
  if (loaded || !GA_ID || typeof document === 'undefined') return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  if (isGtm) {
    // Google Tag Manager : le conteneur décide des balises (Google Analytics 4…).
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);
    return;
  }
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  // Pages vues envoyées à la main à chaque changement d'adresse (site à une seule page).
  window.gtag('config', GA_ID, { send_page_view: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

export function trackPageView(path: string, title: string): void {
  if (!loaded) return;
  if (isGtm) {
    // Événement « page_view » pour Tag Manager (déclencheur : Événement personnalisé page_view).
    window.dataLayer!.push({ event: 'page_view', page_path: path, page_location: window.location.href, page_title: title });
    return;
  }
  if (!window.gtag) return;
  window.gtag('event', 'page_view', { page_path: path, page_location: window.location.href, page_title: title });
}

/** Refus après accord : on efface les cookies _ga du domaine. */
function removeAnalyticsCookies(): void {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  const domains = ['', host, `.${host.replace(/^www\./, '')}`];
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (!name.startsWith('_ga')) continue;
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
  }
}
