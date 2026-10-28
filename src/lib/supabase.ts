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
  weak_password: 'Mot de passe trop faible : 8 caractères minimum, avec des lettres et des chiffres.',
  email_not_confirmed: 'Confirme d’abord ton adresse e-mail grâce au lien reçu.',
  over_email_send_rate_limit: 'Trop d’e-mails envoyés. Réessaie dans quelques minutes.',
  over_request_rate_limit: 'Trop de tentatives. Réessaie dans quelques minutes.',
  same_password: 'Choisis un mot de passe différent de l’ancien.',
  email_address_invalid: 'Cette adresse e-mail n’est pas valide.',
  signup_disabled: 'La création de compte est momentanément fermée.',
  validation_failed: 'Vérifie l’e-mail et le mot de passe saisis.',
};

/** Message lisible pour une erreur Supabase. */
export function authErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string; status?: number; name?: string } | null;
  if (e?.code && MESSAGES[e.code]) return MESSAGES[e.code];
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
