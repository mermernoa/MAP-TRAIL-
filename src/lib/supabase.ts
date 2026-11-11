import type { SupabaseClient } from '@supabase/supabase-js';
import { appUrl } from './base';

/**
 * Projet Supabase des comptes Take Ton Trail. L'URL et la clé publiable sont
 * faites pour être publiques (la sécurité repose sur les règles d'accès de la
 * base, voir supabase/migrations/) ; elles peuvent être remplacées au build.
 */
const env = import.meta.env;
export const SUPABASE_URL: string = env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY: string = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Les comptes ne s'activent qu'une fois le projet Supabase renseigné. */
export const accountsEnabled = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let client: Promise<SupabaseClient> | null = null;

/** Client Supabase, chargé à la demande : le reste du site n'en paie pas le poids. */
export function getSupabase(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        // PKCE : le retour des e-mails arrive en « ?code=… » sur la page compte.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  );
  return client;
}

/** Vrai si une session a été enregistrée sur cet appareil (sans charger le client). */
export function hasStoredSession(): boolean {
  if (!accountsEnabled) return false;
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    return localStorage.getItem(`sb-${ref}-auth-token`) != null;
  } catch {
    return false;
  }
}

/** Adresse de retour des e-mails (confirmation, mot de passe oublié) : la page compte. */
export function accountReturnUrl(): string {
  return appUrl('compte');
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  user_already_exists: 'Un compte existe déjà avec cet e-mail. Connecte-toi.',
  email_exists: 'Un compte existe déjà avec cet e-mail. Connecte-toi.',
  weak_password: 'Mot de passe trop faible : 8 caractères minimum, avec une majuscule, une minuscule, un chiffre et un caractère spécial.',
  email_not_confirmed: 'Confirme d’abord ton adresse e-mail grâce au lien reçu.',
  over_email_send_rate_limit: 'Trop d’e-mails envoyés. Réessaie dans quelques minutes.',
  over_request_rate_limit: 'Trop de tentatives. Réessaie dans quelques minutes.',
  same_password: 'Choisis un mot de passe différent de l’ancien.',
  email_address_invalid: 'Cette adresse e-mail n’est pas valide.',
  signup_disabled: 'La création de compte est momentanément fermée.',
  validation_failed: 'Vérifie l’e-mail et le mot de passe saisis.',
  provider_disabled: 'Cette connexion n’est pas encore ouverte. Utilise ton e-mail.',
  identity_already_exists: 'Ce compte est déjà relié à une autre adresse.',
  reauthentication_needed: 'Par sécurité, reconnecte-toi avant de changer ton mot de passe.',
};

/** Message lisible pour une erreur Supabase. */
export function authErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string; status?: number; name?: string } | null;
  if (e?.code && MESSAGES[e.code]) return MESSAGES[e.code];
  // L'e-mail de confirmation n'a pas pu partir (serveur d'envoi refusé) : le compte n'est pas créé.
  if (/sending (confirmation|recovery|magic link)? ?e-?mail|confirmation email|smtp/i.test(e?.message ?? '')) {
    return 'Le compte n’a pas pu être créé : l’e-mail de confirmation ne part pas pour le moment. On règle ça au plus vite, réessaie un peu plus tard.';
  }
  if (e?.name === 'AuthRetryableFetchError' || e?.status === 0 || /fetch|network/i.test(e?.message ?? '')) {
    return 'Connexion impossible. Vérifie ton réseau puis réessaie.';
  }
  return 'Une erreur est survenue. Réessaie dans un instant.';
}

export type EmailLinkType = 'email' | 'signup' | 'recovery' | 'email_change' | 'invite' | 'magiclink';

/**
 * Lien d'e-mail au format « compte?token_hash=…&type=… » (voir supabase/templates/) ;
 * l'ancien format « #/compte?… » reste lu.
 * il fonctionne même ouvert sur un autre appareil que celui de l'inscription.
 */
export function emailLinkToken(url = window.location.search || window.location.hash): { tokenHash: string; type: EmailLinkType } | null {
  const query = url.split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailLinkType | null;
  if (!tokenHash || !type) return null;
  return { tokenHash, type };
}

/** Vrai si l'adresse arrive d'un e-mail du compte (code PKCE ou jeton). */
export function hasEmailReturn(): boolean {
  return /[?&]code=/.test(window.location.search) || emailLinkToken() != null;
}

export type OAuthProvider = 'google' | 'apple';

let providers: Promise<OAuthProvider[]> | null = null;

/**
 * Connexions Google / Apple ouvertes sur le projet (réglages publics de Supabase) :
 * un bouton n'apparaît que si la connexion fonctionne vraiment.
 */
export function enabledProviders(): Promise<OAuthProvider[]> {
  if (!accountsEnabled) return Promise.resolve([]);
  providers ??= fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } })
    .then((r) => (r.ok ? r.json() : { external: {} }))
    .then((s: { external?: Record<string, boolean> }) => (['google', 'apple'] as const).filter((p) => s.external?.[p]))
    .catch(() => []);
  return providers;
}
