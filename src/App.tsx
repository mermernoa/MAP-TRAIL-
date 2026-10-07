import { useEffect, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserIcon } from './components/Icons';
import { LoadingGauge } from './components/LoadingGauge';
import { CalendarPage } from './pages/CalendarPage';
import { AccountPage } from './pages/AccountPage';
import { MapPage } from './pages/MapPage';
import { RacePage } from './pages/RacePage';
import { SeasonPage } from './pages/SeasonPage';
import { useTilt } from './lib/motion';
import { startAccount, useAccount } from './store/account';
import { useCatalog } from './store/catalog';
import { useSeasonStore } from './store/season';

function Header() {
  const count = useSeasonStore((s) => s.entries.length);
  const user = useAccount((s) => s.user);
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="Take Ton Trail, accueil">
        <img className="brand-wordmark" src="brand/wordmark.webp" alt="" width={74} height={48} />
        <span className="brand-name">Take Ton Trail</span>
      </Link>
      <nav className="app-nav" aria-label="Navigation principale">
        <NavLink to="/" end>
          Carte
        </NavLink>
        <NavLink to="/calendrier">Calendrier</NavLink>
        <NavLink to="/ma-saison">
          Ma saison
          {count > 0 && <span className="badge">{count}</span>}
        </NavLink>
      </nav>
      <NavLink to="/compte" className="account-link" aria-label={user ? `Mon compte (${user.name || user.email})` : 'Mon compte'}>
        {user ? (
          <span className="account-avatar is-small" aria-hidden="true">
            {(user.name || user.email).trim().slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <UserIcon size={20} />
        )}
        <span className="account-link-label">{user ? user.name || 'Mon compte' : 'Mon compte'}</span>
      </NavLink>
    </header>
  );
}

/** Charge la base des courses avant d'afficher les pages qui en ont besoin. */
function CatalogGate({ children }: { children: React.ReactNode }) {
  const status = useCatalog((s) => s.status);
  const load = useCatalog((s) => s.load);
  // Jauge de chargement : affichée tant que les courses arrivent, puis le temps de se remplir.
  const [gauge, setGauge] = useState(() => status !== 'ready');
  useEffect(() => {
    load();
  }, [load]);
  if (status === 'error') {
    return (
      <div className="page-message">
        <img src="brand/boussole.webp" alt="" width={142} height={180} />
        <h1>Impossible de charger les courses</h1>
        <p>Vérifiez votre connexion, puis réessayez.</p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            useCatalog.setState({ status: 'idle' });
            load();
          }}
        >
          Réessayer
        </button>
      </div>
    );
  }
  return (
    <>
      {status === 'ready' && children}
      {(gauge || status !== 'ready') && <LoadingGauge done={status === 'ready'} onFinish={() => setGauge(false)} />}
    </>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  // Accolades obligatoires : Chrome récent renvoie une promesse depuis scrollTo, que React
  // prendrait pour une fonction de nettoyage et appellerait au changement de page (écran vide).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PageRoutes() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/calendrier" element={<CalendarPage />} />
        <Route path="/course/:id" element={<RacePage />} />
        <Route path="/ma-saison" element={<SeasonPage />} />
        <Route path="/compte" element={<AccountPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

function NotFound() {
  return (
    <div className="page-message">
      <img src="brand/3t.webp" alt="" width={136} height={100} />
      <h1>Page introuvable</h1>
      <p>Cette adresse ne correspond à aucune page.</p>
      <Link to="/" className="button button-primary">
        Revenir à la carte
      </Link>
    </div>
  );
}

export function App() {
  useTilt('.course-tab', 4);
  useEffect(() => {
    startAccount();
  }, []);
  return (
    // Changements de page immédiats : en mode « transition », React attendait que le
    // navigateur soit libre, ce que les cartes WebGL retardaient parfois de plusieurs secondes.
    <HashRouter useTransitions={false}>
      <ScrollToTop />
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          // Le routeur utilise le fragment d'URL : on déplace le focus sans changer d'adresse.
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Aller au contenu
      </a>
      <Header />
      <main id="main" className="app-main" tabIndex={-1}>
        <CatalogGate>
          <PageRoutes />
        </CatalogGate>
      </main>
    </HashRouter>
  );
}
