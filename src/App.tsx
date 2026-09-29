import { useEffect } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CalendarPage } from './pages/CalendarPage';
import { MapPage } from './pages/MapPage';
import { RacePage } from './pages/RacePage';
import { SeasonPage } from './pages/SeasonPage';
import { useSeasonStore } from './store/season';

function Header() {
  const count = useSeasonStore((s) => s.entries.length);
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="Balise, accueil">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </span>
        <span className="brand-name">Balise</span>
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
    </header>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="page-message">
      <h1>Page introuvable</h1>
      <p>Cette adresse ne correspond à aucune page.</p>
      <Link to="/" className="button button-primary">
        Revenir à la carte
      </Link>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
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
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/calendrier" element={<CalendarPage />} />
          <Route path="/course/:id" element={<RacePage />} />
          <Route path="/ma-saison" element={<SeasonPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
