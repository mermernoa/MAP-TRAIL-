import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CollectionRail, useCollectionEntries } from '../components/Explore';
import { PhotoCredit } from '../components/PhotoCredit';
import { RaceRow } from '../components/RaceRow';
import { RidgeProfile } from '../components/RidgeProfile';
import { type CollectionItem, collectionBySlug, collectionItems } from '../lib/collections';
import { monthLabel, parseYMD } from '../lib/dates';
import { useParallax, useReveal } from '../lib/motion';
import { coverPhoto } from '../lib/photos';
import { useAllRaces } from '../store/races';
import { useToday } from '../store/useToday';

const PAGE = 40;
const firstDay = (i: CollectionItem) => i.courses.map((c) => c.start.slice(0, 10)).sort()[0];

export function CollectionPage() {
  const { slug } = useParams();
  const collection = collectionBySlug(slug);
  const events = useAllRaces();
  const today = useToday();
  const [shown, setShown] = useState(PAGE);
  const items = useMemo(() => (collection ? collectionItems(collection, events, today) : []), [collection, events, today]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const cover = useMemo(() => coverPhoto(items.map((i) => i.event)), [items]);
  const photo = photoFailed ? null : cover;
  const others = useCollectionEntries(events, today).filter((e) => e.collection.slug !== slug);
  const heroRef = useParallax<HTMLElement>(0.35);
  const bodyRef = useReveal<HTMLDivElement>('.panel', [slug]);

  useEffect(() => {
    if (!collection) return;
    document.title = `${collection.title} – Take Ton Trail`;
    setShown(PAGE);
    setPhotoFailed(false);
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, [collection]);

  if (!collection) {
    return (
      <div className="page-message">
        <h1>Collection introuvable</h1>
        <p>Cette adresse ne correspond à aucune collection.</p>
        <Link to="/explorer" className="button button-primary">
          Voir toutes les collections
        </Link>
      </div>
    );
  }

  // Par date : intertitres de mois. Par notoriété : une seule liste.
  const visible = items.slice(0, shown);
  const groups: { label: string | null; items: CollectionItem[] }[] = [];
  for (const item of visible) {
    const { y, m } = parseYMD(firstDay(item));
    const label = collection.order === 'fame' ? null : monthLabel(y, m);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  const showPrice = collection.slug === 'moins-de-20-euros';

  return (
    <article className="collection-page">
      <header ref={heroRef} className={`race-hero collection-hero ${photo ? 'has-photo' : ''}`}>
        {photo ? (
          <img className="race-hero-photo" src={photo.src} alt="" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} />
        ) : (
          <div className="collection-hero-night" aria-hidden="true">
            <RidgeProfile kind="hautes" seed={slug?.length ?? 3} className="collection-hero-ridge" />
          </div>
        )}
        <div className="race-hero-shade" aria-hidden="true" />
        <div className="race-hero-content">
          <nav className="breadcrumb" aria-label="Fil d’Ariane">
            <Link to="/">Accueil</Link>
            <span aria-hidden="true">/</span>
            <Link to="/explorer">Collections</Link>
          </nav>
          <h1 className="race-title">{collection.title}</h1>
          <p className="collection-lede">{collection.text}</p>
          <p className="race-hero-place">
            {items.length} {items.length > 1 ? 'courses à venir' : 'course à venir'}
          </p>
        </div>
        {photo && <PhotoCredit credit={`${photo.credit}, ${photo.event.name}`} src={photo.src} className="race-hero-credit" />}
      </header>

      <div ref={bodyRef} className="collection-body">
        <section className="panel" aria-label="Courses de la collection">
          {items.length ? (
            <>
              {groups.map((g, i) => (
                <div key={`${g.label}-${i}`} className="collection-group">
                  {g.label && <h2 className="collection-month">{g.label}</h2>}
                  <ul className="race-list">
                    {g.items.map((item) => (
                      <RaceRow key={item.event.id} event={item.event} courses={item.courses} showPrice={showPrice} />
                    ))}
                  </ul>
                </div>
              ))}
              {shown < items.length && (
                <button type="button" className="button list-more" onClick={() => setShown((n) => n + PAGE)}>
                  Afficher plus de courses
                </button>
              )}
              {collection.note && <p className="muted small collection-note">{collection.note}</p>}
            </>
          ) : (
            <p className="muted">Aucune course à venir dans cette collection pour l’instant.</p>
          )}
        </section>

        {others.length > 0 && (
          <section className="collection-others" aria-labelledby="others-title">
            <h2 id="others-title">D’autres envies</h2>
            <CollectionRail entries={others} />
          </section>
        )}
      </div>
    </article>
  );
}
