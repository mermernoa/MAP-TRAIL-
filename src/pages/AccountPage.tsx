import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, SparkIcon, UserIcon } from '../components/Icons';
import { missingRules, PASSWORD_HINT, PASSWORD_RULES } from '../lib/password';
import { enabledProviders, type OAuthProvider } from '../lib/supabase';
import { SuggestionList } from '../components/SuggestionList';
import { resolveEntries } from '../lib/season';
import { suggestRaces } from '../lib/suggestions';
import { useAccount } from '../store/account';
import { useAllRaces } from '../store/races';
import { useSeasonStore } from '../store/season';
import { useToday } from '../store/useToday';

export function AccountPage() {
  const status = useAccount((s) => s.status);
  const recovery = useAccount((s) => s.recovery);
  const user = useAccount((s) => s.user);
  const ensure = useAccount((s) => s.ensure);
  const [confirmed] = useState(() => /[?&]code=/.test(window.location.search));
  const linkResult = useAccount((s) => s.linkResult);

  useEffect(() => {
    document.title = 'Mon compte – Take Ton Trail';
    void ensure().then(() => {
      // Le code de retour de l'e-mail a servi : on le retire de l'adresse.
      if (/[?&]code=/.test(window.location.search)) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, [ensure]);

  return (
    <div className="account-page">
      <header className="account-head">
        <h1 className="account-title">{user ? `Salut ${user.name || 'à toi'} !` : 'Mon compte'}</h1>
        <p className="account-lead">
          Ta saison sur tous tes appareils, et des courses proposées d’après celles que tu as déjà choisies.
        </p>
      </header>

      <div className="account-grid">
        <div className="account-side">
          {status === 'disabled' && <ComingSoon />}
          {(status === 'idle' || status === 'loading') && (
            <section className="panel account-card" aria-busy="true">
              <p className="muted">Connexion à ton compte…</p>
            </section>
          )}
          {recovery && (status === 'signedIn' || status === 'signedOut') && <NewPasswordForm />}
          {linkResult === 'invalid' && (
            <p className="form-error" role="alert">
              Ce lien a expiré ou a déjà servi. Connecte-toi, ou demande un nouveau lien avec « Mot de passe oublié ».
            </p>
          )}
          {!recovery && status === 'signedOut' && <AuthForms confirmed={confirmed || linkResult === 'confirmed'} />}
          {!recovery && status === 'signedIn' && <Profile />}
        </div>
        <Suggestions />
      </div>
    </div>
  );
}

function Benefits() {
  return (
    <ul className="account-benefits">
      <li>Ta saison enregistrée et synchronisée sur ordinateur et téléphone</li>
      <li>Des courses proposées selon tes distances, ton dénivelé et tes régions</li>
      <li>Gratuit, et supprimable à tout moment</li>
    </ul>
  );
}

function ComingSoon() {
  return (
    <section className="panel account-card">
      <h2 className="account-card-title">Les comptes arrivent</h2>
      <Benefits />
      <p className="muted small">
        En attendant, ta saison reste enregistrée dans ce navigateur, et tes propositions de courses sont déjà là.
      </p>
      <Link to="/ma-saison" className="button">
        Voir ma saison
      </Link>
    </section>
  );
}

function AuthForms({ confirmed }: { confirmed: boolean }) {
  const [mode, setMode] = useState<'signup' | 'signin' | 'reset'>(confirmed ? 'signin' : 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(confirmed ? 'Adresse confirmée : connecte-toi pour retrouver ta saison.' : '');
  const [busy, setBusy] = useState(false);
  const { signUp, signIn, resetPassword } = useAccount.getState();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (mode === 'signup' && missingRules(password).length) {
      setError(`Mot de passe trop faible : ${PASSWORD_HINT}`);
      return;
    }
    setBusy(true);
    if (mode === 'signup') {
      const res = await signUp(email.trim(), password, name);
      if (res.error) setError(res.error);
      else if (res.confirm) setInfo(`C’est presque fini : ouvre l’e-mail envoyé à ${email.trim()} et clique sur le lien pour activer ton compte.`);
    } else if (mode === 'signin') {
      const res = await signIn(email.trim(), password);
      if (res.error) setError(res.error);
    } else {
      const res = await resetPassword(email.trim());
      if (res.error) setError(res.error);
      else setInfo(`Si un compte existe pour ${email.trim()}, un lien pour choisir un nouveau mot de passe vient d’y être envoyé.`);
    }
    setBusy(false);
  };

  return (
    <section className="panel account-card">
      {mode !== 'reset' && (
        <div className="segmented account-tabs" role="tablist" aria-label="Compte">
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-on' : ''} onClick={() => setMode('signup')}>
            Créer un compte
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-on' : ''} onClick={() => setMode('signin')}>
            Se connecter
          </button>
        </div>
      )}
      {mode === 'signup' && <Benefits />}
      {mode === 'reset' && <h2 className="account-card-title">Mot de passe oublié</h2>}
      {mode !== 'reset' && <SocialButtons mode={mode} />}
      <form className="account-form" onSubmit={submit}>
        {mode === 'signup' && (
          <label className="field">
            Prénom
            <input type="text" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label className="field">
          E-mail
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode !== 'reset' && (
          <label className="field">
            Mot de passe
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={8}
              placeholder={mode === 'signup' ? 'Au moins 8 caractères' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={mode === 'signup' ? 'password-rules' : undefined}
              required
            />
          </label>
        )}
        {mode === 'signup' && <PasswordChecklist password={password} />}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="notice" role="status">
            {info}
          </p>
        )}
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? 'Un instant…' : mode === 'signup' ? 'Créer mon compte' : mode === 'signin' ? 'Me connecter' : 'Recevoir le lien'}
        </button>
        {mode === 'signin' && (
          <button type="button" className="link-button" onClick={() => setMode('reset')}>
            Mot de passe oublié ?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="link-button" onClick={() => setMode('signin')}>
            Retour à la connexion
          </button>
        )}
        {mode === 'signup' && (
          <p className="muted small">
            Ta saison est enregistrée de façon sécurisée pour la retrouver partout. Tu peux supprimer ton compte à tout moment.
          </p>
        )}
      </form>
    </section>
  );
}

/** Les règles du mot de passe, cochées en direct pendant la saisie. */
function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="password-rules" id="password-rules" aria-label="Règles du mot de passe">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.id} className={ok ? 'is-ok' : ''}>
            <span className="password-rule-mark" aria-hidden="true">
              {ok ? <CheckIcon size={12} /> : null}
            </span>
            {r.label}
            <span className="sr-only">{ok ? ' : respecté' : ' : manquant'}</span>
          </li>
        );
      })}
    </ul>
  );
}

const PROVIDER_LABEL: Record<OAuthProvider, string> = { google: 'Google', apple: 'Apple' };

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === 'apple')
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.47-.03-.01-2.3-.88-2.32-3.5ZM14.18 6.15c.6-.73 1.01-1.75.9-2.76-.87.04-1.93.58-2.55 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.57-1.23Z" />
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.27a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

/** « Continuer avec Google / Apple » : seulement les connexions ouvertes sur le projet. */
function SocialButtons({ mode }: { mode: 'signup' | 'signin' }) {
  const [list, setList] = useState<OAuthProvider[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void enabledProviders().then((p) => alive && setList(p));
    return () => {
      alive = false;
    };
  }, []);
  if (!list.length) return null;
  return (
    <div className="account-social">
      {list.map((p) => (
        <button
          key={p}
          type="button"
          className={`button account-social-button is-${p}`}
          onClick={async () => {
            setError('');
            const res = await useAccount.getState().signInWith(p);
            if (res.error) setError(res.error);
          }}
        >
          <ProviderIcon provider={p} />
          {mode === 'signup' ? `S’inscrire avec ${PROVIDER_LABEL[p]}` : `Continuer avec ${PROVIDER_LABEL[p]}`}
        </button>
      ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="account-or">
        <span>ou avec ton e-mail</span>
      </p>
    </div>
  );
}

function NewPasswordForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingRules(password).length) return setError(`Mot de passe trop faible : ${PASSWORD_HINT}`);
    setBusy(true);
    const res = await useAccount.getState().setNewPassword(password);
    setBusy(false);
    if (res.error) setError(res.error);
  };
  return (
    <section className="panel account-card">
      <h2 className="account-card-title">Nouveau mot de passe</h2>
      <form className="account-form" onSubmit={submit}>
        <label className="field">
          Choisis un mot de passe
          <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-rules" required />
        </label>
        <PasswordChecklist password={password} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button-primary" disabled={busy}>
          Enregistrer
        </button>
      </form>
    </section>
  );
}

function SyncStatus() {
  const sync = useAccount((s) => s.sync);
  if (sync === 'saving') return <p className="account-sync">Enregistrement de ta saison…</p>;
  if (sync === 'error') return <p className="account-sync is-error">Synchronisation impossible pour l’instant : nouvel essai à la prochaine modification.</p>;
  if (sync === 'saved')
    return (
      <p className="account-sync is-ok">
        <CheckIcon size={16} /> Saison synchronisée sur tous tes appareils
      </p>
    );
  return null;
}

function Profile() {
  const user = useAccount((s) => s.user)!;
  const races = useAllRaces();
  const regions = useMemo(() => [...new Set(races.map((r) => r.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [races]);
  const [name, setName] = useState(user.name);
  const [region, setRegion] = useState(user.region);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const count = useSeasonStore((s) => s.entries.length);
  const initials = (user.name || user.email).trim().slice(0, 1).toUpperCase();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    const res = await useAccount.getState().updateProfile({ name, region });
    if (res.error) setError(res.error);
    else setMessage('Profil enregistré.');
  };

  return (
    <section className="panel account-card">
      <div className="account-id">
        <span className="account-avatar" aria-hidden="true">
          {initials}
        </span>
        <div>
          <strong>{user.name || 'Mon profil'}</strong>
          <span className="muted small">{user.email}</span>
        </div>
      </div>
      <SyncStatus />
      <p className="small">
        <Link to="/ma-saison">
          {count ? `${count} course${count > 1 ? 's' : ''} dans ta saison` : 'Ta saison est vide pour l’instant'}
        </Link>
      </p>
      <form className="account-form" onSubmit={save}>
        <label className="field">
          Prénom
          <input type="text" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Région où tu habites
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Non précisée</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <button type="submit" className="button">
          Enregistrer mon profil
        </button>
      </form>
      <div className="account-actions">
        <button type="button" className="button button-ghost" onClick={() => void useAccount.getState().signOut()}>
          Se déconnecter
        </button>
        {confirmDelete ? (
          <button
            type="button"
            className="button button-danger"
            onClick={async () => {
              const res = await useAccount.getState().deleteAccount();
              if (res.error) setError(res.error);
            }}
          >
            Confirmer : supprimer mon compte et ma saison
          </button>
        ) : (
          <button type="button" className="link-button" onClick={() => setConfirmDelete(true)}>
            Supprimer mon compte
          </button>
        )}
      </div>
    </section>
  );
}

function Suggestions() {
  const entries = useSeasonStore((s) => s.entries);
  const races = useAllRaces();
  const today = useToday();
  const region = useAccount((s) => s.user?.region);
  const resolved = useMemo(() => resolveEntries(entries, races), [entries, races]);
  const list = useMemo(() => suggestRaces(resolved, races, today, { limit: 8, homeRegion: region || undefined }), [resolved, races, today, region]);

  return (
    <section className="panel account-suggestions" aria-labelledby="suggestions-title">
      <div className="panel-head">
        <h2 id="suggestions-title">
          <SparkIcon size={20} /> Courses pour toi
        </h2>
        {resolved.length > 0 && (
          <p className="muted small">
            D’après {resolved.length === 1 ? 'la course' : `les ${resolved.length} courses`} de ta saison.
          </p>
        )}
      </div>
      {resolved.length === 0 ? (
        <div className="empty-inline account-empty">
          <UserIcon size={22} />
          <p>Ajoute une ou deux courses à ta saison : on te proposera des courses qui te ressemblent.</p>
          <Link to="/carte" className="button button-primary">
            Explorer la carte
          </Link>
        </div>
      ) : list.length ? (
        <SuggestionList suggestions={list} />
      ) : (
        <p className="empty-inline">Aucune course ne se glisse dans ton calendrier pour l’instant : reviens après le prochain ajout de courses.</p>
      )}
    </section>
  );
}
