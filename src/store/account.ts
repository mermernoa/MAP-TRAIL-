import { create } from 'zustand';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { accountReturnUrl, accountsEnabled, authErrorMessage, getSupabase, hasStoredSession } from '../lib/supabase';
import { mergeSeasons, sameSeason, type SeasonSnapshot } from '../lib/seasonSync';
import { useSeasonStore } from './season';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  /** Région de résidence, pour les propositions de courses proches. */
  region: string;
}

type Status = 'disabled' | 'idle' | 'loading' | 'signedOut' | 'signedIn';
type SyncState = 'idle' | 'saving' | 'saved' | 'error';

interface AccountState {
  status: Status;
  user: AccountUser | null;
  sync: SyncState;
  syncedAt: string | null;
  /** Retour depuis l'e-mail « mot de passe oublié » : on propose d'en choisir un nouveau. */
  recovery: boolean;
  /** Charge le client et restaure la session (à l'ouverture de la page compte). */
  ensure: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; confirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  setNewPassword: (password: string) => Promise<{ error?: string }>;
  updateProfile: (profile: { name: string; region: string }) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
}

const TABLE = 'seasons';

function toUser(session: Session | null): AccountUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as { name?: string; region?: string };
  return { id: u.id, email: u.email ?? '', name: meta.name ?? '', region: meta.region ?? '' };
}

function localSnapshot(): SeasonSnapshot {
  const { entries, customRaces, removed } = useSeasonStore.getState();
  return { entries, customRaces, removed };
}

let started: Promise<void> | null = null;
let applyingRemote = false;
let pushTimer = 0;
let lastPushed: SeasonSnapshot | null = null;

export const useAccount = create<AccountState>()((set, get) => {
  async function client(): Promise<SupabaseClient> {
    await get().ensure();
    return getSupabase();
  }

  /** Récupère la saison du compte, la fusionne avec celle de l'appareil et renvoie le résultat. */
  async function pull() {
    const user = get().user;
    if (!user) return;
    const sb = await getSupabase();
    const { data, error } = await sb.from(TABLE).select('entries, custom_races, removed').eq('user_id', user.id).maybeSingle();
    if (error) {
      set({ sync: 'error' });
      return;
    }
    const remote: SeasonSnapshot = {
      entries: data?.entries ?? [],
      customRaces: data?.custom_races ?? [],
      removed: data?.removed ?? [],
    };
    const merged = mergeSeasons(localSnapshot(), remote);
    if (!sameSeason(merged, localSnapshot())) {
      applyingRemote = true;
      useSeasonStore.getState().replaceAll(merged);
      applyingRemote = false;
    }
    lastPushed = remote;
    if (!data || !sameSeason(merged, remote)) await push();
    else set({ sync: 'saved', syncedAt: new Date().toISOString() });
  }

  async function push() {
    const user = get().user;
    if (!user) return;
    const snapshot = localSnapshot();
    if (lastPushed && sameSeason(snapshot, lastPushed)) return;
    set({ sync: 'saving' });
    const sb = await getSupabase();
    const { error } = await sb.from(TABLE).upsert({
      user_id: user.id,
      entries: snapshot.entries,
      custom_races: snapshot.customRaces,
      removed: snapshot.removed,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      set({ sync: 'error' });
      return;
    }
    lastPushed = snapshot;
    set({ sync: 'saved', syncedAt: new Date().toISOString() });
  }

  function onSession(session: Session | null) {
    const user = toUser(session);
    const wasIn = get().status === 'signedIn';
    set({ user, status: user ? 'signedIn' : 'signedOut' });
    if (user && !wasIn) void pull();
    if (!user) {
      lastPushed = null;
      set({ sync: 'idle', syncedAt: null });
    }
  }

  return {
    status: accountsEnabled ? 'idle' : 'disabled',
    user: null,
    sync: 'idle',
    syncedAt: null,
    recovery: false,

    ensure: () => {
      if (!accountsEnabled) return Promise.resolve();
      started ??= (async () => {
        set({ status: 'loading' });
        try {
          const sb = await getSupabase();
          sb.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') set({ recovery: true });
            // Les appels Supabase dans ce rappel peuvent bloquer le client : on les diffère.
            setTimeout(() => onSession(session), 0);
          });
          const { data } = await sb.auth.getSession();
          onSession(data.session);
          // Chaque modification de la saison part vers le compte, regroupée sur une seconde.
          useSeasonStore.subscribe((state, prev) => {
            if (applyingRemote || get().status !== 'signedIn') return;
            if (state.entries === prev.entries && state.customRaces === prev.customRaces && state.removed === prev.removed) return;
            clearTimeout(pushTimer);
            set({ sync: 'saving' });
            pushTimer = window.setTimeout(() => void push(), 1000);
          });
          // Retour sur l'onglet : on récupère ce qui a pu changer sur un autre appareil.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && get().status === 'signedIn') void pull();
          });
        } catch {
          set({ status: 'signedOut', sync: 'error' });
        }
      })();
      return started;
    },

    signUp: async (email, password, name) => {
      const sb = await client();
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim() }, emailRedirectTo: accountReturnUrl() },
      });
      if (error) return { error: authErrorMessage(error) };
      // Sans session, l'adresse doit d'abord être confirmée par e-mail.
      return { confirm: !data.session };
    },

    signIn: async (email, password) => {
      const sb = await client();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? { error: authErrorMessage(error) } : {};
    },

    signOut: async () => {
      const sb = await client();
      clearTimeout(pushTimer);
      await push();
      // Déconnexion de cet appareil seulement : les autres restent connectés.
      await sb.auth.signOut({ scope: 'local' });
      // La saison reste dans le compte : on ne la laisse pas sur un appareil partagé.
      applyingRemote = true;
      useSeasonStore.getState().clear();
      applyingRemote = false;
    },

    resetPassword: async (email) => {
      const sb = await client();
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: accountReturnUrl() });
      return error ? { error: authErrorMessage(error) } : {};
    },

    setNewPassword: async (password) => {
      const sb = await client();
      const { error } = await sb.auth.updateUser({ password });
      if (error) return { error: authErrorMessage(error) };
      set({ recovery: false });
      return {};
    },

    updateProfile: async ({ name, region }) => {
      const sb = await client();
      const { data, error } = await sb.auth.updateUser({ data: { name: name.trim(), region } });
      if (error) return { error: authErrorMessage(error) };
      const user = get().user;
      if (user && data.user) set({ user: { ...user, name: name.trim(), region } });
      return {};
    },

    deleteAccount: async () => {
      const sb = await client();
      const { error } = await sb.rpc('delete_my_account');
      if (error) return { error: authErrorMessage(error) };
      await sb.auth.signOut();
      applyingRemote = true;
      useSeasonStore.getState().clear();
      applyingRemote = false;
      return {};
    },
  };
});

/** Au démarrage : on ne charge Supabase que si une session existe ou qu'un e-mail ramène ici. */
export function startAccount() {
  if (!accountsEnabled) return;
  if (hasStoredSession() || /[?&]code=/.test(window.location.search)) void useAccount.getState().ensure();
}
