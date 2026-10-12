import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RaceEvent } from '../data/types';
import { type Collection, COLLECTIONS, collectionItems } from '../lib/collections';
import { MONTH_SHORT, parseYMD } from '../lib/dates';
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
  /** Même photo que la page du massif. */
  photo: Photo | null;
  next: RaceEvent | null;
  /** Plus long parcours à venir, en km. */
  longest: number;
}

export function useMassifEntries(events: RaceEvent[], today: string): MassifEntry[] {
  return useMemo(
    () =>
      MASSIFS.map((massif) => {
        const list = massifEvents(massif, events, today);
        const longest = Math.max(0, ...list.flatMap((e) => e.courses.map((c) => c.distanceKm ?? 0)));
        return { massif, count: list.length, photo: coverPhoto(list), next: list[0] ?? null, longest: Math.round(longest) };
      }).filter((m) => m.count > 0),
    [events, today],
  );
}

/** « 31 oct. », « 1er nov. » */
function shortDate(iso: string) {
  const { d, m } = parseYMD(iso);
  return `${d === 1 ? '1er' : d} ${MONTH_SHORT[m - 1]}`;
}

/**
 * Index des massifs : une ligne par massif, avec la silhouette stylisée de son
 * relief, la prochaine course et le plus long parcours. À la souris, la photo
 * du massif suit le pointeur ; au doigt, elle s'affiche en vignette.
 */
export function MassifIndex({ entries }: { entries: MassifEntry[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const floatRef = useRef<HTMLDivElement>(null);
  const motion = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0, shown: false });

  // La photo suit le pointeur avec un léger retard et penche dans le sens du geste.
  useEffect(() => {
    const m = motion.current;
    return () => cancelAnimationFrame(m.raf);
  }, []);
  const follow = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const m = motion.current;
    m.tx = e.clientX;
    m.ty = e.clientY;
    if (!m.shown) {
      m.x = m.tx;
      m.y = m.ty;
      m.shown = true;
    }
    if (m.raf) return;
    const tick = () => {
      const el = floatRef.current;
      m.raf = 0;
      if (!el) return;
      const dx = m.tx - m.x;
      m.x += dx * 0.16;
      m.y += (m.ty - m.y) * 0.16;
      el.style.setProperty('--fx', `${m.x.toFixed(1)}px`);
      el.style.setProperty('--fy', `${m.y.toFixed(1)}px`);
      el.style.setProperty('--tilt', `${Math.max(-8, Math.min(8, dx * 0.08)).toFixed(2)}deg`);
      if (Math.abs(dx) > 0.3 || Math.abs(m.ty - m.y) > 0.3) m.raf = requestAnimationFrame(tick);
    };
    m.raf = requestAnimationFrame(tick);
  };
  const photoOf = (entry: MassifEntry) => (entry.photo && !broken.has(entry.photo.src) ? entry.photo : null);
  const markBroken = (src: string) => setBroken((prev) => new Set(prev).add(src));
  const current = active == null ? null : entries[active];
  const currentPhoto = current ? photoOf(current) : null;

  return (
    <div
      className="massif-index-wrap"
      onPointerMove={follow}
      onPointerLeave={() => {
        motion.current.shown = false;
        setActive(null);
      }}
    >
      <ul className="massif-index">
        {entries.map((entry, i) => {
          const { massif, count, next, longest } = entry;
          const photo = photoOf(entry);
          return (
            <li key={massif.slug}>
              <Link
                to={`/massif/${massif.slug}`}
                className={`massif-line ${active === i ? 'is-active' : ''}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <span className="massif-line-index" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {photo && (
                  <span className="massif-line-thumb" aria-hidden="true">
                    <img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => markBroken(photo.src)} />
                  </span>
                )}
                <span className="massif-line-head">
                  <span className="massif-line-name">{massif.title}</span>
                  <span className="massif-line-meta">
                    {next && (
                      <span>
                        Prochaine : <b>{shortDate(next.dateStart)}</b>, {next.name}
                      </span>
                    )}
                    {longest > 0 && <span>Jusqu’à {longest} km</span>}
                    {photo && <span className="massif-line-credit">Photo : {photo.credit}</span>}
                  </span>
                </span>
                <RidgeProfile kind={massif.relief} seed={i * 7 + 5} className="massif-line-ridge" />
                <span className="massif-line-count">{plural(count)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div ref={floatRef} className={`massif-float ${currentPhoto ? 'is-on' : ''}`} aria-hidden="true">
        <div className="massif-float-frame">
          {entries.map((entry, i) => {
            const photo = photoOf(entry);
            return photo ? (
              <img
                key={entry.massif.slug}
                className={active === i ? 'is-on' : ''}
                src={photo.src}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => markBroken(photo.src)}
              />
            ) : null;
          })}
        </div>
        {current && currentPhoto && (
          <span className="massif-float-caption">
            <b>{currentPhoto.event.name}</b>
            <small>Photo : {currentPhoto.credit}</small>
          </span>
        )}
      </div>
    </div>
  );
}
