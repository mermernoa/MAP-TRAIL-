import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '../lib/messages';
import { INFO_LINKS } from '../pages/InfoPages';

const EXPLORE_LINKS: { to: string; label: string; section?: string }[] = [
  { to: '/carte', label: 'Carte' },
  { to: '/calendrier', label: 'Calendrier' },
  { to: '/a-la-une', label: 'À la une' },
  { to: '/', label: 'Collections', section: 'collections' },
  { to: '/', label: 'Massifs', section: 'massifs' },
  { to: '/ma-saison', label: 'Ma saison' },
  { to: '/compte', label: 'Mon compte' },
];

/** Pied de page : navigation, pages de confiance et mentions. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link to="/" aria-label="Take Ton Trail, accueil">
            <img src="brand/3t.webp" alt="" width={108} height={80} />
          </Link>
          <p>Toutes les courses de trail, du plus confidentiel au plus mythique.</p>
          <a className="site-footer-mail" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>
        <nav aria-label="Explorer">
          <h2>Explorer</h2>
          <ul>
            {EXPLORE_LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to} state={l.section ? { section: l.section } : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Informations">
          <h2>Take Ton Trail</h2>
          <ul>
            {INFO_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="site-footer-note">
        Informations données à titre indicatif : vérifie toujours auprès de l’organisation avant de t’inscrire. Photos
        créditées à leurs auteurs.
      </p>
    </footer>
  );
}
