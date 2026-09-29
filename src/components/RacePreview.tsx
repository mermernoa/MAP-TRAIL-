import { Link } from 'react-router-dom';
import type { RaceEvent } from '../data/types';
import { formatRange, formatShortDate, relativeDays } from '../lib/dates';
import { registrationState } from '../lib/filters';
import { countryFlag, countryName, itraPoints, kmEffort, utmbCategory } from '../lib/metrics';
import { useToday } from '../store/useToday';
import { BandSwatch, fmtKm, fmtM, PopularityLabel, TechnicityMeter } from './bits';
import { CloseIcon } from './Icons';
import { SeasonToggle } from './SeasonToggle';

interface Props {
  event: RaceEvent;
  /** Parcours correspondant aux filtres (mis en avant). */
  matchingIds?: string[];
  onClose: () => void;
}

const REG_LABEL = {
  open: 'Inscriptions ouvertes',
  upcoming: 'Inscriptions à venir',
  closed: 'Inscriptions closes',
  unknown: 'Inscriptions : voir le site',
};

/** Carte d'aperçu d'une course, affichée sur la carte ou le calendrier. */
export function RacePreview({ event, matchingIds, onClose }: Props) {
  const today = useToday();
  const reg = registrationState(event, today);
  const courses = [...event.courses].sort((a, b) => b.distanceKm - a.distanceKm);
  return (
    <article className="preview" aria-labelledby={`preview-${event.id}`}>
      <header className="preview-head">
        <div>
          <p className="preview-place">
            <span aria-hidden="true">{countryFlag(event.country)}</span> {event.city}, {countryName(event.country)}
          </p>
          <h2 id={`preview-${event.id}`} className="preview-title">
            <Link to={`/course/${event.id}`}>{event.name}</Link>
          </h2>
          <p className="preview-date">
            {formatRange(event.dateStart, event.dateEnd)}
            <span className="muted"> ({relativeDays(event.dateStart, today)})</span>
            {event.dateStatus === 'estimated' && <span className="tag tag-soft">Date prévisionnelle</span>}
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer l'aperçu">
          <CloseIcon />
        </button>
      </header>

      <div className="preview-badges">
        <PopularityLabel level={event.popularity} />
        <span className={`reg-state reg-${reg}`}>
          {REG_LABEL[reg]}
          {reg === 'upcoming' && event.registration.opens && ` le ${formatShortDate(event.registration.opens)}`}
          {reg === 'open' && event.registration.closes && ` jusqu'au ${formatShortDate(event.registration.closes)}`}
        </span>
        {event.circuits.map((c) => (
          <span key={c} className="tag">
            {c}
          </span>
        ))}
      </div>

      <ul className="preview-courses">
        {courses.map((c) => {
          const dim = matchingIds && !matchingIds.includes(c.id);
          const cat = utmbCategory(kmEffort(c));
          return (
            <li key={c.id} className={dim ? 'is-dim' : ''}>
              <div className="preview-course-main">
                <BandSwatch km={c.distanceKm} />
                <span className="preview-course-name">{c.name}</span>
              </div>
              <div className="preview-course-stats">
                <span className="num">{fmtKm(c.distanceKm)}</span>
                <span className="num">{fmtM(c.elevationGain)} D+</span>
                <TechnicityMeter level={c.technicity} />
                <span className="muted small" title="Points ITRA estimés, catégorie UTMB Index">
                  {itraPoints(c)} pts{cat ? `, ${cat}` : ''}
                </span>
              </div>
              <SeasonToggle eventId={event.id} courseId={c.id} courseName={c.name} compact />
            </li>
          );
        })}
      </ul>

      <footer className="preview-foot">
        <Link to={`/course/${event.id}`} className="button button-primary">
          Voir la fiche complète
        </Link>
      </footer>
    </article>
  );
}
