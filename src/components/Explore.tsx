import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RaceEvent } from '../data/types';
import { type Collection, COLLECTIONS, collectionItems } from '../lib/collections';
import { type Massif, MASSIFS, massifEvents } from '../lib/massifs';
import { coverPhoto, type Photo } from '../lib/photos';
import { RidgeProfile } from './RidgeProfile';

const plural = (n: number) => `${n} ${n > 1 ? 'courses' : 'course'}`;

export interface CollectionEntry {
  collection: Collection;
  count: number;
  photo: Photo | null;
}

/** Collections non vides, chacune avec une photo de couverture différente. */
export function useCollectionEntries(events: RaceEvent[], today: string, minCount = 3): CollectionEntry[] {
  return useMemo(() => {
    const used = new Set<string>();
    const out: CollectionEntry[] = [];
    for (const collection of COLLECTIONS) {
      const items = collectionItems(collection, events, today);
      if (items.length < minCount) continue;
      const photo = coverPhoto(
        items.map((i) => i.event),
        used,
      );
      if (photo) used.add(photo.src);
      out.push({ collection, count: items.length, photo });
    }
    return out;
  }, [events, today, minCount]);
}

/** Collections en affiches de course, dans un tiroir qui défile horizontalement. */
export function CollectionRail({ entries }: { entries: CollectionEntry[] }) {
  return (
    <ul className="poster-rail">
      {entries.map((entry, i) => (
        <Poster key={entry.collection.slug} entry={entry} index={i} />
      ))}
    </ul>
  );
}

function Poster({ entry: { collection, count, photo }, index }: { entry: CollectionEntry; index: number }) {
  // Photo introuvable : l'affiche garde son décor de crêtes, sans crédit.
  const [failed, setFailed] = useState(false);
  const shown = photo && !failed ? photo : null;
  return (
    <li className="poster-slot" style={{ '--tilt': `${[-1.6, 1.2, -0.6, 1.8, -1.2][index % 5]}deg` } as React.CSSProperties}>
      <Link to={`/collection/${collection.slug}`} className={`poster ${shown ? 'has-photo' : ''}`}>
        {shown ? (
          <img
            className="poster-photo"
            src={shown.src}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <RidgeProfile kind={(['hautes', 'puys', 'ballons', 'aiguilles', 'plis'] as const)[index % 5]} seed={index + 3} className="poster-ridge" />
        )}
        <span className="poster-shade" aria-hidden="true" />
        <span className="poster-count">{plural(count)}</span>
        <span className="poster-title">{collection.title}</span>
        <span className="poster-tagline">{collection.tagline}</span>
      </Link>
      {shown && (
        <a className="poster-credit" href={shown.src} target="_blank" rel="noreferrer">
          Photo : {shown.credit}
        </a>
      )}
    </li>
  );
}

export interface MassifEntry {
  massif: Massif;
  count: number;
}

export function useMassifEntries(events: RaceEvent[], today: string): MassifEntry[] {
  return useMemo(
    () => MASSIFS.map((massif) => ({ massif, count: massifEvents(massif, events, today).length })).filter((m) => m.count > 0),
    [events, today],
  );
}

/** Index des massifs : une ligne par massif, avec la silhouette stylisée de son relief. */
export function MassifIndex({ entries }: { entries: MassifEntry[] }) {
  return (
    <ul className="massif-index">
      {entries.map(({ massif, count }, i) => (
        <li key={massif.slug}>
          <Link to={`/massif/${massif.slug}`} className="massif-line">
            <span className="massif-line-name">{massif.title}</span>
            <RidgeProfile kind={massif.relief} seed={i * 7 + 5} className="massif-line-ridge" />
            <span className="massif-line-count">{plural(count)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
