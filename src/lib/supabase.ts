import type { SupabaseClient } from '@supabase/supabase-js';

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
        // PKCE : le retour des e-mails arrive en « ?code=… », compatible avec les adresses en #/.
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
  return `${window.location.origin}${window.location.pathname}#/compte`;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  user_already_exists: 'Un compte existe déjà avec cet e-mail. Connectez-vous.',
  email_exists: 'Un compte existe déjà avec cet e-mail. Connectez-vous.',
  weak_password: 'Mot de passe trop faible : 8 caractères minimum, avec des lettres et des chiffres.',
  email_not_confirmed: 'Confirmez d’abord votre adresse e-mail grâce au lien reçu.',
  over_email_send_rate_limit: 'Trop d’e-mails envoyés. Réessayez dans quelques minutes.',
  over_request_rate_limit: 'Trop de tentatives. Réessayez dans quelques minutes.',
  same_password: 'Choisissez un mot de passe différent de l’ancien.',
  email_address_invalid: 'Cette adresse e-mail n’est pas valide.',
  signup_disabled: 'La création de compte est momentanément fermée.',
  validation_failed: 'Vérifiez l’e-mail et le mot de passe saisis.',
};

/** Message lisible pour une erreur Supabase. */
export function authErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string; status?: number; name?: string } | null;
  if (e?.code && MESSAGES[e.code]) return MESSAGES[e.code];
  if (e?.name === 'AuthRetryableFetchError' || e?.status === 0 || /fetch|network/i.test(e?.message ?? '')) {
    return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  }
  return 'Une erreur est survenue. Réessayez dans un instant.';
}
