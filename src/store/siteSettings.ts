import { create } from 'zustand';
import { accountsEnabled, getSupabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../lib/supabase';

/**
 * Réglages du site modifiés depuis l'espace admin (/admin), sans repasser par
 * le code : table `site_settings` de Supabase, lisible par tous les visiteurs.
 */
export interface Banner {
  text: string;
  link: string;
  active: boolean;
}

export interface MassifPhoto {
  src: string;
  credit: string;
}

export interface SiteSettings {
  banner: Banner;
  /** Courses mises en avant sur l'accueil (« Coups de cœur »), dans l'ordre. */
  featured: string[];
  /** Courses retirées du site sans toucher à la feuille. */
  hidden: string[];
  /** Photo choisie pour un massif (clé : slug du massif). */
  massif_photos: Record<string, MassifPhoto>;
}

export type SettingKey = keyof SiteSettings;

export const DEFAULT_SETTINGS: SiteSettings = {
  banner: { text: '', link: '', active: false },
  featured: [],
  hidden: [],
  massif_photos: {},
};

interface State extends SiteSettings {
  loaded: boolean;
  load: () => Promise<void>;
  /** Enregistre un réglage (administrateurs seulement : les règles de la base refusent les autres). */
  save: <K extends SettingKey>(key: K, value: SiteSettings[K]) => Promise<{ error?: string }>;
}

/** Ne garde que des valeurs du bon type : une ligne mal formée ne casse pas le site. */
export function parseSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const out: SiteSettings = structuredClone(DEFAULT_SETTINGS);
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  for (const { key, value } of rows) {
    const v = value as Record<string, unknown> | null;
    if (key === 'banner' && v && typeof v === 'object') {
      out.banner = { text: String(v.text ?? '').slice(0, 280), link: String(v.link ?? ''), active: v.active === true };
    } else if (key === 'featured') out.featured = strings(value);
    else if (key === 'hidden') out.hidden = strings(value);
    else if (key === 'massif_photos' && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [slug, photo] of Object.entries(v)) {
        const p = photo as Record<string, unknown> | null;
        if (p && typeof p.src === 'string' && /^https:\/\//.test(p.src) && typeof p.credit === 'string' && p.credit.trim()) {
          out.massif_photos[slug] = { src: p.src, credit: p.credit };
        }
      }
    }
  }
  return out;
}

export const useSiteSettings = create<State>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    if (!accountsEnabled || get().loaded) return;
    try {
      // Simple requête REST : le client Supabase n'est chargé que pour les comptes.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?select=key,value`, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      set({ ...parseSettings((await res.json()) as { key: string; value: unknown }[]), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  save: async (key, value) => {
    try {
      const sb = await getSupabase();
      const { error } = await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) return { error: error.message };
      set({ [key]: value } as Partial<State>);
      return {};
    } catch {
      return { error: 'Base injoignable. Réessaie.' };
    }
  },
}));

/** Compteur de pages vues anonyme (un total par jour et par page, sans cookie ni identifiant). */
export function trackView(path: string) {
  if (!accountsEnabled || /^(localhost|127\.)/.test(window.location.hostname)) return;
  const clean = path.toLowerCase().split('?')[0].replace(/[^a-z0-9/_-]/g, '').slice(0, 80) || '/';
  if (clean.startsWith('/admin')) return;
  void fetch(`${SUPABASE_URL}/rest/v1/rpc/track_view`, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_path: clean }),
  }).catch(() => {});
}
