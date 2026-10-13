import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RaceEvent } from '../data/types';
import { formatRange } from '../lib/dates';
import { MASSIFS } from '../lib/massifs';
import { normalize } from '../lib/filters';
import { accountsEnabled, getSupabase } from '../lib/supabase';
import { useAccount } from '../store/account';
import { useCatalog } from '../store/catalog';
import { type Banner, type MassifPhoto, useSiteSettings } from '../store/siteSettings';

/**
 * Espace admin (#/admin) : non relié au site, non indexé, et réservé aux comptes
 * inscrits dans la table `admins` : la base refuse les données à tout autre compte.
 */

interface Stats {
  users: number;
  users_confirmed: number;
  users_7d: number;
  users_30d: number;
  active_30d: number;
  seasons: number;
  season_entries: number;
  messages_open: number;
  messages_total: number;
  views_today: number;
  views_7d: number;
  views_30d: number;
  views_by_day: { day: string; n: number }[];
  signups_by_day: { day: string; n: number }[];
  top_pages: { path: string; n: number }[];
  top_races: { id: string; n: number }[];
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  confirmed: boolean;
  last_sign_in_at: string | null;
  races: number;
  admin: boolean;
}

interface Message {
  id: string;
  kind: 'contact' | 'erreur' | 'course';
  subject: string;
  body: string;
  email: string | null;
  course_id: string | null;
  page: string | null;
  created_at: string;
  handled: boolean;
}

const TABS = [
  { id: 'bord', label: 'Tableau de bord' },
  { id: 'messages', label: 'Messages' },
  { id: 'comptes', label: 'Comptes' },
  { id: 'site', label: 'Site' },
  { id: 'liens', label: 'Outils' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const KIND_LABEL: Record<Message['kind'], string> = { contact: 'Contact', erreur: 'Erreur signalée', course: 'Course proposée' };

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminPage() {
  const status = useAccount((s) => s.status);
  const ensure = useAccount((s) => s.ensure);
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    document.title = 'Admin – Take Ton Trail';
    // Jamais dans les moteurs de recherche.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    void ensure();
    return () => {
      meta.remove();
      document.title = 'Take Ton Trail';
    };
  }, [ensure]);

  useEffect(() => {
    if (status !== 'signedIn') {
      setAdmin(null);
      return;
    }
    let live = true;
    void getSupabase()
      .then((sb) => sb.rpc('is_admin'))
      .then(({ data }) => live && setAdmin(data === true))
      .catch(() => live && setAdmin(false));
    return () => {
      live = false;
    };
  }, [status]);

  if (!accountsEnabled || status === 'disabled' || (status === 'signedIn' && admin === false)) return <Gone />;
  if (status === 'signedOut') {
    return (
      <div className="page-message">
        <h1>Espace réservé</h1>
        <p>Connectez-vous avec le compte administrateur.</p>
        <Link to="/compte" className="button button-primary">
          Se connecter
        </Link>
      </div>
    );
  }
  if (status !== 'signedIn' || admin == null) {
    return (
      <div className="page-message">
        <p>Vérification de l’accès…</p>
      </div>
    );
  }
  return <Dashboard />;
}

/** Même réponse qu'une adresse inconnue : rien ne signale l'existence de la page. */
function Gone() {
  return (
    <div className="page-message">
      <img src="brand/3t.webp" alt="" width={136} height={100} />
      <h1>Page introuvable</h1>
      <p>Cette adresse ne correspond à aucune page.</p>
      <Link to="/" className="button button-primary">
        Revenir à l’accueil
      </Link>
    </div>
  );
}

function Dashboard() {
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('onglet');
    return TABS.some((x) => x.id === t) ? (t as Tab) : 'bord';
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  const loadStats = async () => {
    const sb = await getSupabase();
    const { data, error: e } = await sb.rpc('admin_stats');
    if (e) setError(e.message);
    else setStats(data as Stats);
  };
  useEffect(() => {
    void loadStats();
  }, []);

  return (
    <div className="admin-page">
      <header className="admin-head">
        <h1>Espace admin</h1>
        <p>Statistiques, messages, comptes et réglages du site, sans passer par le code.</p>
      </header>
      <nav className="admin-tabs" role="tablist" aria-label="Rubriques">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'messages' && stats && stats.messages_open > 0 && <span className="admin-badge">{stats.messages_open}</span>}
          </button>
        ))}
      </nav>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-panel" role="tabpanel">
        {tab === 'bord' && <Overview stats={stats} />}
        {tab === 'messages' && <Messages onChange={loadStats} />}
        {tab === 'comptes' && <Users />}
        {tab === 'site' && <SiteSettingsPanel />}
        {tab === 'liens' && <Tools />}
      </div>
    </div>
  );
}

// ---------- Tableau de bord

function Overview({ stats }: { stats: Stats | null }) {
  const all = useCatalog((s) => s.allEvents);
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  if (!stats) return <p className="muted">Chargement des chiffres…</p>;
  const pageName = (path: string) => {
    if (path === '/') return 'Accueil';
    const named: Record<string, string> = { '/carte': 'Carte', '/calendrier': 'Calendrier', '/compte': 'Mon compte', '/ma-saison': 'Ma saison', '/explorer': 'Explorer (ancienne page)' };
    if (named[path]) return named[path];
    const race = path.match(/^\/course\/(.+)$/);
    if (race) return byId.get(race[1])?.name ?? path;
    return path;
  };
  return (
    <div className="admin-grid">
      <section className="admin-tiles" aria-label="Chiffres clés">
        <Tile label="Visites aujourd’hui" value={stats.views_today} />
        <Tile label="Visites sur 7 jours" value={stats.views_7d} />
        <Tile label="Visites sur 30 jours" value={stats.views_30d} />
        <Tile label="Comptes" value={stats.users} hint={`${stats.users_7d} cette semaine`} />
        <Tile label="Actifs sur 30 jours" value={stats.active_30d} hint={`${stats.users_confirmed} adresses confirmées`} />
        <Tile label="Saisons remplies" value={stats.seasons} hint={`${stats.season_entries} courses ajoutées`} />
        <Tile label="Messages à traiter" value={stats.messages_open} hint={`${stats.messages_total} reçus`} />
        <Tile label="Courses en ligne" value={useCatalog.getState().events.length} />
      </section>
      <DayBars title="Pages vues par jour" data={stats.views_by_day} unit="vue" since="(le compteur tourne depuis le 13 octobre 2026)" />
      <DayBars title="Inscriptions par jour" data={stats.signups_by_day} unit="inscription" since="sur la période" />
      <RecentUsers />
      <section className="panel admin-list">
        <h2>Pages les plus vues (30 jours)</h2>
        <RankList rows={stats.top_pages.map((p) => ({ label: pageName(p.path), sub: p.path, n: p.n }))} empty="Pas encore de visite comptée (le compteur tourne depuis le 13 octobre 2026)." />
      </section>
      <section className="panel admin-list">
        <h2>Courses les plus ajoutées aux saisons</h2>
        <RankList
          rows={stats.top_races.map((r) => ({ label: byId.get(r.id)?.name ?? r.id, sub: `${r.n} ${r.n > 1 ? 'comptes' : 'compte'}`, n: r.n, to: `/course/${r.id}` }))}
          empty="Aucun compte n’a encore de course dans sa saison. Elles apparaîtront ici dès que les inscrits en ajouteront."
        />
      </section>
    </div>
  );
}

/** Les dernières inscriptions, directement sur le tableau de bord. */
function RecentUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  useEffect(() => {
    void getSupabase()
      .then((sb) => sb.rpc('admin_users'))
      .then(({ data }) => setUsers((data as AdminUser[] | null) ?? []));
  }, []);
  return (
    <section className="panel admin-list admin-recent">
      <h2>Dernières inscriptions</h2>
      {!users ? (
        <p className="muted">Chargement…</p>
      ) : !users.length ? (
        <p className="muted">Aucun compte pour l’instant.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Prénom</th>
                <th>Inscription</th>
                <th>Adresse confirmée</th>
                <th>Dernière connexion</th>
                <th>Courses dans sa saison</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 8).map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '—'}</td>
                  <td>{dateTime(u.created_at)}</td>
                  <td>{u.confirmed ? 'Oui' : 'Non'}</td>
                  <td>{dateTime(u.last_sign_in_at)}</td>
                  <td>{u.races}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="admin-tile">
      <span className="admin-tile-value">{value.toLocaleString('fr-FR')}</span>
      <span className="admin-tile-label">{label}</span>
      {hint && <span className="admin-tile-hint">{hint}</span>}
    </div>
  );
}

/** Histogramme sur 30 jours : une barre par jour, valeur au survol. */
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Histogramme par jour, du premier jour compté (au moins une semaine) à aujourd'hui,
 * sur 30 jours au plus : avec peu d'historique, les barres restent lisibles.
 */
function DayBars({ title, data, unit, since }: { title: string; data: { day: string; n: number }[]; unit: string; since: string }) {
  const days = useMemo(() => {
    const map = new Map(data.map((d) => [d.day, Number(d.n)]));
    const now = new Date();
    const first = data.map((d) => d.day).sort()[0];
    const span = first ? Math.round((new Date(`${dayKey(now)}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) / 864e5) : 0;
    const count = Math.min(30, Math.max(7, span + 1));
    const out: { day: string; n: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const key = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      out.push({ day: key, n: map.get(key) ?? 0 });
    }
    return out;
  }, [data]);
  const max = Math.max(1, ...days.map((d) => d.n));
  const total = days.reduce((a, d) => a + d.n, 0);
  const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' });
  const label = (d: { day: string; n: number }) =>
    `${new Date(`${d.day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} : ${d.n} ${unit}${d.n > 1 ? 's' : ''}`;
  const few = days.length <= 14;
  return (
    <section className="panel admin-chart">
      <h2>
        {title}{' '}
        <small>
          {total.toLocaleString('fr-FR')} sur {days.length} jours
        </small>
      </h2>
      <div className={`admin-bars ${few ? 'is-few' : ''}`} role="img" aria-label={`${title} : ${total} sur ${days.length} jours, maximum ${max} en un jour`}>
        {days.map((d) => (
          <span key={d.day} className="admin-bar" title={label(d)}>
            {few && d.n > 0 && <b>{d.n}</b>}
            <span style={{ height: `${(d.n / max) * 100}%` }} />
          </span>
        ))}
      </div>
      {few ? (
        <div className="admin-bars-days" aria-hidden="true">
          {days.map((d) => (
            <span key={d.day}>{short(d.day)}</span>
          ))}
        </div>
      ) : (
        <div className="admin-bars-axis" aria-hidden="true">
          <span>{short(days[0].day)}</span>
          <span>max {max}</span>
          <span>aujourd’hui</span>
        </div>
      )}
      {total === 0 && <p className="muted">Rien pour l’instant {since}.</p>}
    </section>
  );
}

function RankList({ rows, empty }: { rows: { label: string; sub: string; n: number; to?: string }[]; empty: string }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ol className="admin-rank">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="admin-rank-text">
            {r.to ? <Link to={r.to}>{r.label}</Link> : r.label}
            <small>{r.sub}</small>
          </span>
          <span className="admin-rank-bar" aria-hidden="true">
            <span style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <b>{r.n.toLocaleString('fr-FR')}</b>
        </li>
      ))}
    </ol>
  );
}

// ---------- Messages

function Messages({ onChange }: { onChange: () => void }) {
  const [list, setList] = useState<Message[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    const sb = await getSupabase();
    const { data, error: e } = await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(300);
    if (e) setError(e.message);
    else setList(data as Message[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const setHandled = async (m: Message, handled: boolean) => {
    const sb = await getSupabase();
    const { error: e } = await sb.from('messages').update({ handled }).eq('id', m.id);
    if (e) return setError(e.message);
    setList((l) => l?.map((x) => (x.id === m.id ? { ...x, handled } : x)) ?? null);
    onChange();
  };
  const remove = async (m: Message) => {
    if (!window.confirm('Supprimer définitivement ce message ?')) return;
    const sb = await getSupabase();
    const { error: e } = await sb.from('messages').delete().eq('id', m.id);
    if (e) return setError(e.message);
    setList((l) => l?.filter((x) => x.id !== m.id) ?? null);
    onChange();
  };
  if (!list) return <p className="muted">Chargement des messages…</p>;
  const shown = list.filter((m) => showDone || !m.handled);
  return (
    <section className="admin-messages">
      <label className="form-choice admin-toggle">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Afficher aussi les messages traités
      </label>
      {error && <p className="form-error">{error}</p>}
      {!shown.length && <p className="muted">Aucun message à traiter. 🎉</p>}
      <ul>
        {shown.map((m) => (
          <li key={m.id} className={`panel admin-message ${m.handled ? 'is-done' : ''}`}>
            <div className="admin-message-head">
              <span className={`admin-kind kind-${m.kind}`}>{KIND_LABEL[m.kind]}</span>
              <strong>{m.subject}</strong>
              <time dateTime={m.created_at}>{dateTime(m.created_at)}</time>
            </div>
            <p className="admin-message-body">{m.body}</p>
            <div className="admin-message-meta">
              {m.email && (
                <a className="button button-primary" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re : ${m.subject}`)}`}>
                  Répondre à {m.email}
                </a>
              )}
              {m.course_id && (
                <Link className="button" to={`/course/${m.course_id}`}>
                  Voir la course
                </Link>
              )}
              <button type="button" className="button" onClick={() => setHandled(m, !m.handled)}>
                {m.handled ? 'Remettre à traiter' : 'Marquer comme traité'}
              </button>
              <button type="button" className="button admin-danger" onClick={() => remove(m)}>
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Comptes

function Users() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void getSupabase()
      .then((sb) => sb.rpc('admin_users'))
      .then(({ data, error: e }) => (e ? setError(e.message) : setUsers(data as AdminUser[])));
  }, []);
  if (error) return <p className="form-error">{error}</p>;
  if (!users) return <p className="muted">Chargement des comptes…</p>;
  const csv = () => {
    const rows = [['Prénom', 'E-mail', 'Inscription', 'Confirmé', 'Dernière connexion', 'Courses']];
    for (const u of users) rows.push([u.name, u.email, u.created_at, u.confirmed ? 'oui' : 'non', u.last_sign_in_at ?? '', String(u.races)]);
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'comptes-take-ton-trail.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="panel admin-users">
      <div className="admin-users-head">
        <h2>
          {users.length} compte{users.length > 1 ? 's' : ''}
        </h2>
        <button type="button" className="button" onClick={csv}>
          Exporter en CSV
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Prénom</th>
              <th>E-mail</th>
              <th>Inscription</th>
              <th>Confirmé</th>
              <th>Dernière connexion</th>
              <th>Courses</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.name || '—'}
                  {u.admin && <span className="admin-kind kind-admin">admin</span>}
                </td>
                <td>{u.email}</td>
                <td>{dateTime(u.created_at)}</td>
                <td>{u.confirmed ? 'Oui' : 'Non'}</td>
                <td>{dateTime(u.last_sign_in_at)}</td>
                <td>{u.races}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Pour supprimer un compte : Supabase, Authentication → Users. Les comptes peuvent aussi se supprimer eux-mêmes.</p>
    </section>
  );
}

// ---------- Réglages du site

function SiteSettingsPanel() {
  return (
    <div className="admin-settings">
      <BannerForm />
      <RacePicker settingKey="featured" title="Coups de cœur de l’accueil" help="Ces courses apparaissent en haut de l’accueil, dans cet ordre. Les courses passées disparaissent d’elles-mêmes." />
      <RacePicker settingKey="hidden" title="Courses masquées" help="Retirées du site (carte, calendrier, recherche) sans toucher à la feuille. Pratique pour une course annulée en attendant la mise à jour." />
      <MassifPhotos />
    </div>
  );
}

function useSaver() {
  const [state, setState] = useState<{ busy: boolean; msg: string; error: boolean }>({ busy: false, msg: '', error: false });
  const run = async (fn: () => Promise<{ error?: string }>) => {
    setState({ busy: true, msg: '', error: false });
    const { error } = await fn();
    setState({ busy: false, msg: error ? `Échec : ${error}` : 'Enregistré : visible pour les nouveaux visiteurs.', error: !!error });
  };
  return { ...state, run };
}

function SaveNote({ msg, error }: { msg: string; error: boolean }) {
  if (!msg) return null;
  return (
    <p className={error ? 'form-error' : 'form-note'} role="status">
      {msg}
    </p>
  );
}

function BannerForm() {
  const current = useSiteSettings((s) => s.banner);
  const save = useSiteSettings((s) => s.save);
  const [banner, setBanner] = useState<Banner>(current);
  const saver = useSaver();
  useEffect(() => {
    setBanner(current);
  }, [current]);
  return (
    <form
      className="panel admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        void saver.run(() => save('banner', { ...banner, text: banner.text.trim(), link: banner.link.trim() }));
      }}
    >
      <h2>Bandeau d’annonce</h2>
      <p className="muted">Un message en bas de chaque page : nouveauté, course à ne pas manquer, inscriptions qui ouvrent…</p>
      <label className="form-row">
        <span>Texte</span>
        <input value={banner.text} maxLength={280} onChange={(e) => setBanner({ ...banner, text: e.target.value })} placeholder="Les inscriptions de la SaintéLyon ouvrent vendredi !" />
      </label>
      <label className="form-row">
        <span>Lien (facultatif)</span>
        <input value={banner.link} onChange={(e) => setBanner({ ...banner, link: e.target.value })} placeholder="/course/evt378-saintelyon ou https://…" />
      </label>
      <label className="form-choice">
        <input type="checkbox" checked={banner.active} onChange={(e) => setBanner({ ...banner, active: e.target.checked })} /> Afficher le bandeau
      </label>
      <button type="submit" className="button button-primary" disabled={saver.busy}>
        Enregistrer
      </button>
      <SaveNote msg={saver.msg} error={saver.error} />
    </form>
  );
}

function RacePicker({ settingKey, title, help }: { settingKey: 'featured' | 'hidden'; title: string; help: string }) {
  const ids = useSiteSettings((s) => s[settingKey]);
  const save = useSiteSettings((s) => s.save);
  const all = useCatalog((s) => s.allEvents);
  const [query, setQuery] = useState('');
  const saver = useSaver();
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return all.filter((e) => !ids.includes(e.id) && normalize(`${e.name} ${e.city}`).includes(q)).slice(0, 8);
  }, [query, all, ids]);
  const update = (next: string[]) => void saver.run(() => save(settingKey, next));
  const label = (e: RaceEvent | undefined, id: string) => (e ? `${e.name} · ${e.city} · ${formatRange(e.dateStart, e.dateEnd)}` : `${id} (introuvable)`);
  return (
    <section className="panel admin-form">
      <h2>{title}</h2>
      <p className="muted">{help}</p>
      {ids.length > 0 ? (
        <ol className="admin-picked">
          {ids.map((id, i) => (
            <li key={id}>
              <span>{label(byId.get(id), id)}</span>
              {settingKey === 'featured' && i > 0 && (
                <button type="button" className="button" aria-label="Monter" onClick={() => update([...ids.slice(0, i - 1), id, ids[i - 1], ...ids.slice(i + 1)])}>
                  ↑
                </button>
              )}
              <button type="button" className="button admin-danger" onClick={() => update(ids.filter((x) => x !== id))}>
                Retirer
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Aucune pour l’instant.</p>
      )}
      <label className="form-row">
        <span>Ajouter une course</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom de la course ou ville" />
      </label>
      {results.length > 0 && (
        <ul className="admin-results">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  update([...ids, e.id]);
                }}
              >
                {label(e, e.id)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <SaveNote msg={saver.msg} error={saver.error} />
    </section>
  );
}

function MassifPhotos() {
  const current = useSiteSettings((s) => s.massif_photos);
  const save = useSiteSettings((s) => s.save);
  const [photos, setPhotos] = useState<Record<string, MassifPhoto>>(current);
  const saver = useSaver();
  useEffect(() => {
    setPhotos(current);
  }, [current]);
  const set = (slug: string, patch: Partial<MassifPhoto>) => setPhotos((p) => ({ ...p, [slug]: { ...(p[slug] ?? { src: '', credit: '' }), ...patch } }));
  return (
    <form
      className="panel admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        const clean: Record<string, MassifPhoto> = {};
        for (const [slug, p] of Object.entries(photos)) {
          if (/^https:\/\//.test(p.src.trim()) && p.credit.trim()) clean[slug] = { src: p.src.trim(), credit: p.credit.trim() };
        }
        void saver.run(() => save('massif_photos', clean));
      }}
    >
      <h2>Photos des massifs</h2>
      <p className="muted">
        Adresse d’une image (https://…) et son crédit, obligatoire : auteur et licence. Sans photo choisie ici, le massif montre la photo de
        paysage fournie avec le site. Wikimedia Commons propose des photos libres : clic droit sur l’image, « Copier l’adresse de l’image ».
      </p>
      <div className="admin-massifs">
        {MASSIFS.map((m) => (
          <fieldset key={m.slug} className="admin-massif">
            <legend>{m.title}</legend>
            {photos[m.slug]?.src && /^https:\/\//.test(photos[m.slug].src) && <img src={photos[m.slug].src} alt="" referrerPolicy="no-referrer" />}
            <input aria-label={`Adresse de la photo, ${m.title}`} placeholder="https://…" value={photos[m.slug]?.src ?? ''} onChange={(e) => set(m.slug, { src: e.target.value })} />
            <input aria-label={`Crédit de la photo, ${m.title}`} placeholder="Auteur, licence" value={photos[m.slug]?.credit ?? ''} onChange={(e) => set(m.slug, { credit: e.target.value })} />
          </fieldset>
        ))}
      </div>
      <button type="submit" className="button button-primary" disabled={saver.busy}>
        Enregistrer les photos
      </button>
      <SaveNote msg={saver.msg} error={saver.error} />
    </form>
  );
}

// ---------- Outils

const TOOLS = [
  { href: 'https://docs.google.com/spreadsheets/d/1tlEPRZwGDRcVItYsQ3eiIwBnvq52MbBsoUlq_etARMs/edit', title: 'Feuille des courses', text: 'Ajouter ou corriger une course, un prix, une photo.' },
  { href: 'https://github.com/mermernoa/MAP-TRAIL-/actions/workflows/sync-sheet.yml', title: 'Mettre à jour le site depuis la feuille', text: 'Bouton « Run workflow » : la feuille est relue et le site republié.' },
  { href: 'https://supabase.com/dashboard/project/lmlafljyqfmargqlbdsf', title: 'Supabase', text: 'Comptes, base de données, e-mails, journaux.' },
  { href: 'https://supabase.com/dashboard/project/lmlafljyqfmargqlbdsf/auth/users', title: 'Comptes (Supabase)', text: 'Supprimer un compte, renvoyer une confirmation.' },
  { href: 'https://github.com/mermernoa/MAP-TRAIL-/actions', title: 'Déploiements', text: 'Voir si la dernière mise en ligne a réussi.' },
  { href: 'https://trello.com', title: 'Trello', text: 'Suivi des tâches du projet.' },
];

function Tools() {
  return (
    <ul className="admin-tools">
      {TOOLS.map((t) => (
        <li key={t.href}>
          <a className="panel" href={t.href} target="_blank" rel="noreferrer">
            <strong>{t.title}</strong>
            <span>{t.text}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
