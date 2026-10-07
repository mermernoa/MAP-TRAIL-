import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, SparkIcon, UserIcon } from '../components/Icons';
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

  useEffect(() => {
    document.title = 'Mon compte – Take Ton Trail';
    void ensure().then(() => {
      // Le code de retour de l'e-mail a servi : on le retire de l'adresse.
      if (/[?&]code=/.test(window.location.search)) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
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
          Votre saison sur tous vos appareils, et des courses proposées d’après celles que vous avez déjà choisies.
        </p>
      </header>

      <div className="account-grid">
        <div className="account-side">
          {status === 'disabled' && <ComingSoon />}
          {(status === 'idle' || status === 'loading') && (
            <section className="panel account-card" aria-busy="true">
              <p className="muted">Connexion à votre compte…</p>
            </section>
          )}
          {recovery && (status === 'signedIn' || status === 'signedOut') && <NewPasswordForm />}
          {!recovery && status === 'signedOut' && <AuthForms confirmed={confirmed} />}
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
      <li>Votre saison enregistrée et synchronisée sur ordinateur et téléphone</li>
      <li>Des courses proposées selon vos distances, votre dénivelé et vos régions</li>
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
        En attendant, votre saison reste enregistrée dans ce navigateur, et vos propositions de courses sont déjà là.
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
  const [info, setInfo] = useState(confirmed ? 'Adresse confirmée : connectez-vous pour retrouver votre saison.' : '');
  const [busy, setBusy] = useState(false);
  const { signUp, signIn, resetPassword } = useAccount.getState();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (mode !== 'reset' && password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setBusy(true);
    if (mode === 'signup') {
      const res = await signUp(email.trim(), password, name);
      if (res.error) setError(res.error);
      else if (res.confirm) setInfo(`C’est presque fini : ouvrez l’e-mail envoyé à ${email.trim()} et cliquez sur le lien pour activer votre compte.`);
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
              placeholder={mode === 'signup' ? '8 caractères minimum' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        )}
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
            Votre saison est enregistrée de façon sécurisée pour la retrouver partout. Vous pouvez supprimer votre compte à tout moment.
          </p>
        )}
      </form>
    </section>
  );
}

function NewPasswordForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères.');
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
          Choisissez un mot de passe
          <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
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
  if (sync === 'saving') return <p className="account-sync">Enregistrement de votre saison…</p>;
  if (sync === 'error') return <p className="account-sync is-error">Synchronisation impossible pour l’instant : nouvel essai à la prochaine modification.</p>;
  if (sync === 'saved')
    return (
      <p className="account-sync is-ok">
        <CheckIcon size={16} /> Saison synchronisée sur tous vos appareils
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
          {count ? `${count} course${count > 1 ? 's' : ''} dans votre saison` : 'Votre saison est vide pour l’instant'}
        </Link>
      </p>
      <form className="account-form" onSubmit={save}>
        <label className="field">
          Prénom
          <input type="text" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Région où vous habitez
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
          <SparkIcon size={20} /> Courses pour vous
        </h2>
        {resolved.length > 0 && (
          <p className="muted small">
            D’après {resolved.length === 1 ? 'la course' : `les ${resolved.length} courses`} de votre saison.
          </p>
        )}
      </div>
      {resolved.length === 0 ? (
        <div className="empty-inline account-empty">
          <UserIcon size={22} />
          <p>Ajoutez une ou deux courses à votre saison : nous vous proposerons des courses qui vous ressemblent.</p>
          <Link to="/" className="button button-primary">
            Explorer la carte
          </Link>
        </div>
      ) : list.length ? (
        <SuggestionList suggestions={list} />
      ) : (
        <p className="empty-inline">Aucune course ne se glisse dans votre calendrier pour l’instant : revenez après le prochain ajout de courses.</p>
      )}
    </section>
  );
}
