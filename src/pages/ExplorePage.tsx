import { useEffect } from 'react';
import { CollectionRail, MassifIndex, useCollectionEntries, useMassifEntries } from '../components/Explore';
import { useReveal } from '../lib/motion';
import { useAllRaces } from '../store/races';
import { useToday } from '../store/useToday';

/** Toutes les entrées éditoriales : collections et massifs. */
export function ExplorePage() {
  const events = useAllRaces();
  const today = useToday();
  const collections = useCollectionEntries(events, today, 1);
  const massifs = useMassifEntries(events, today);
  const ref = useReveal<HTMLDivElement>('.reveal-item', [events.length]);

  useEffect(() => {
    document.title = 'Explorer – Take Ton Trail';
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, []);

  return (
    <div ref={ref} className="explore-page">
      <header className="explore-head">
        <h1>Explorer</h1>
        <p>Des collections pour trouver une idée de course, et les massifs pour choisir un terrain.</p>
      </header>
      <section className="home-section" aria-labelledby="explore-collections">
        <div className="home-section-head reveal-item">
          <h2 id="explore-collections">Collections</h2>
        </div>
        <div className="reveal-item">
          <CollectionRail entries={collections} />
        </div>
      </section>
      <section className="home-section" aria-labelledby="explore-massifs">
        <div className="home-section-head reveal-item">
          <h2 id="explore-massifs">Massifs</h2>
        </div>
        <div className="reveal-item">
          <MassifIndex entries={massifs} />
        </div>
      </section>
    </div>
  );
}
