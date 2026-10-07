import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RaceEvent } from '../data/types';
import { COLLECTIONS } from '../lib/collections';
import { formatShortDate } from '../lib/dates';
import { normalize } from '../lib/filters';
import { MASSIFS } from '../lib/massifs';
import { useFilterStore } from '../store/filters';
import { SearchIcon } from './Icons';

interface Props {
  events: RaceEvent[];
  today: string;
}

interface Suggestion {
  key: string;
  group: 'Courses' | 'Massifs et collections' | 'Lieux';
  label: string;
  detail: string;
  go: () => void;
}

/** Recherche de l'accueil : courses, massifs, collections et lieux, avec suggestions au clavier. */
export function HomeSearch({ events, today }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  const searchMap = (q: string) => {
    const store = useFilterStore.getState();
    store.reset();
    store.setFilters({ query: q });
    navigate('/carte');
  };

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    const out: Suggestion[] = [];
    const upcoming = events.filter((e) => !e.custom && e.dateEnd >= today);
    const named = upcoming
      .map((e) => ({ e, n: normalize(e.name) }))
      .filter(({ n }) => n.includes(q))
      .sort((a, b) => Number(b.n.startsWith(q)) - Number(a.n.startsWith(q)) || b.e.popularity - a.e.popularity)
      .slice(0, 5);
    for (const { e } of named) {
      out.push({
        key: `c-${e.id}`,
        group: 'Courses',
        label: e.name,
        detail: `${e.city}, ${formatShortDate(e.dateStart)}`,
        go: () => navigate(`/course/${e.id}`),
      });
    }
    for (const m of MASSIFS) {
      if (normalize(m.title).includes(q) || normalize(m.name).includes(q)) {
        out.push({ key: `m-${m.slug}`, group: 'Massifs et collections', label: m.title, detail: 'Massif', go: () => navigate(`/massif/${m.slug}`) });
      }
    }
    for (const c of COLLECTIONS) {
      if (normalize(c.title).includes(q)) {
        out.push({ key: `k-${c.slug}`, group: 'Massifs et collections', label: c.title, detail: 'Collection', go: () => navigate(`/collection/${c.slug}`) });
      }
    }
    // Lieux : villes, départements et régions où se trouvent des courses.
    const places = new Map<string, { label: string; count: number; kind: string }>();
    for (const e of upcoming) {
      for (const [value, kind] of [
        [e.city, 'Ville'],
        [e.department, 'Département'],
        [e.region, 'Région'],
      ] as const) {
        if (!value || !normalize(value).includes(q)) continue;
        const key = normalize(value);
        const p = places.get(key) ?? { label: value, count: 0, kind };
        p.count++;
        places.set(key, p);
      }
    }
    for (const p of [...places.values()].sort((a, b) => b.count - a.count).slice(0, 3)) {
      out.push({
        key: `p-${p.label}`,
        group: 'Lieux',
        label: p.label,
        detail: `${p.kind}, ${p.count} ${p.count > 1 ? 'courses' : 'course'}`,
        go: () => searchMap(p.label),
      });
    }
    return out.slice(0, 9);
    // searchMap ne dépend que de navigate.
  }, [query, events, today, navigate]);

  const showList = open && suggestions.length > 0;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && suggestions[active]) suggestions[active].go();
    else if (query.trim()) searchMap(query.trim());
    else navigate('/carte');
  };

  return (
    <form className="home-search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Chercher une course, une ville ou un massif
      </label>
      <div className="home-search-field">
        <SearchIcon size={20} />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Une course, une ville, un massif…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && suggestions.length) {
              e.preventDefault();
              setOpen(true);
              setActive((a) => (a + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp' && suggestions.length) {
              e.preventDefault();
              setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
            } else if (e.key === 'Escape') {
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        <button type="submit" className="button button-primary">
          Chercher
        </button>
      </div>
      {showList && (
        <ul className="home-search-list" id={listId} role="listbox" aria-label="Suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => {
                // Avant la perte du focus du champ, qui fermerait la liste.
                e.preventDefault();
                s.go();
              }}
              onMouseEnter={() => setActive(i)}
            >
              {(i === 0 || suggestions[i - 1].group !== s.group) && (
                <span className="home-search-group" aria-hidden="true">
                  {s.group}
                </span>
              )}
              <span className="home-search-label">{s.label}</span>
              <span className="home-search-detail">{s.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
