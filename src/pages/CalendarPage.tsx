import { useEffect, useMemo, useState } from 'react';
import { FilterBar } from '../components/FilterBar';
import { FilterPanel } from '../components/FilterPanel';
import { ChevronLeft, ChevronRight, CloseIcon } from '../components/Icons';
import { RaceListItem } from '../components/RaceListItem';
import { RacePreview } from '../components/RacePreview';
import type { RaceEvent } from '../data/types';
import {
  addDays,
  daysInMonth,
  formatDate,
  MONTH_NAMES,
  monthLabel,
  parseYMD,
  toISODate,
  WEEKDAY_SHORT,
  weekday,
} from '../lib/dates';
import { applyFilters, type Match, sortMatches } from '../lib/filters';
import { distanceBand } from '../lib/metrics';
import { useFilterStore } from '../store/filters';
import { useAllRaces } from '../store/races';
import { useSeasonStore } from '../store/season';
import { useToday } from '../store/useToday';

type View = 'month' | 'year' | 'list';

type DayItem =
  | { kind: 'race'; match: Match; first: boolean }
  | { kind: 'opens' | 'closes' | 'lottery'; event: RaceEvent };

const REG_TEXT = { opens: 'Ouverture inscriptions', closes: 'Clôture inscriptions', lottery: 'Tirage au sort' };

function buildDayIndex(matches: Match[], withRegistration: boolean): Map<string, DayItem[]> {
  const index = new Map<string, DayItem[]>();
  const push = (day: string, item: DayItem) => {
    const list = index.get(day);
    if (list) list.push(item);
    else index.set(day, [item]);
  };
  for (const match of matches) {
    const { event } = match;
    for (let day = event.dateStart; day <= event.dateEnd; day = addDays(day, 1)) {
      push(day, { kind: 'race', match, first: day === event.dateStart });
    }
    if (withRegistration) {
      const { opens, closes, lotteryDate } = event.registration;
      if (opens) push(opens, { kind: 'opens', event });
      if (closes) push(closes, { kind: 'closes', event });
      if (lotteryDate) push(lotteryDate, { kind: 'lottery', event });
    }
  }
  return index;
}

function maxBand(match: Match) {
  return distanceBand(Math.max(...match.courses.map((c) => c.distanceKm)));
}

export function CalendarPage() {
  const races = useAllRaces();
  const filters = useFilterStore((s) => s.filters);
  const entries = useSeasonStore((s) => s.entries);
  const today = useToday();
  // Sur petit écran, la grille mensuelle est trop serrée : on ouvre la liste.
  const [view, setView] = useState<View>(() => (window.innerWidth < 700 ? 'list' : 'month'));
  const [cursor, setCursor] = useState(() => {
    const { y, m } = parseYMD(today);
    return { y, m };
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showRegistration, setShowRegistration] = useState(true);
  const [seasonOnly, setSeasonOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const matches = useMemo(() => {
    const base = applyFilters(races, filters, today);
    const inSeason = new Set(entries.map((e) => e.eventId));
    return sortMatches(seasonOnly ? base.filter((m) => inSeason.has(m.event.id)) : base, 'date');
  }, [races, filters, today, seasonOnly, entries]);

  const index = useMemo(() => buildDayIndex(matches, showRegistration), [matches, showRegistration]);
  const selected = matches.find((m) => m.event.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected && !openDay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setOpenDay(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, openDay]);

  const move = (delta: number) =>
    setCursor(({ y, m }) => {
      if (view === 'year') return { y: y + delta, m };
      const total = y * 12 + (m - 1) + delta;
      return { y: Math.floor(total / 12), m: (total % 12) + 1 };
    });

  const goToday = () => {
    const { y, m } = parseYMD(today);
    setCursor({ y, m });
  };

  const openRace = (id: string) => {
    setOpenDay(null);
    setSelectedId(id);
  };

  const title = view === 'year' ? String(cursor.y) : view === 'month' ? monthLabel(cursor.y, cursor.m) : 'Toutes les dates';

  return (
    <div className="calendar-page">
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          {view !== 'list' && (
            <>
              <button type="button" className="icon-button" onClick={() => move(-1)} aria-label="Période précédente">
                <ChevronLeft />
              </button>
              <button type="button" className="icon-button" onClick={() => move(1)} aria-label="Période suivante">
                <ChevronRight />
              </button>
            </>
          )}
          <h1 className="calendar-title" aria-live="polite">
            {title}
          </h1>
          {view !== 'list' && (
            <button type="button" className="button button-ghost" onClick={goToday}>
              Aujourd'hui
            </button>
          )}
        </div>
        <div className="segmented" role="tablist" aria-label="Vue">
          {(
            [
              ['month', 'Mois'],
              ['year', 'Année'],
              ['list', 'Liste'],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-on' : ''} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-filters">
        <FilterBar onOpenFilters={() => setFiltersOpen(true)} />
        <div className="calendar-switches">
          <label className="switch switch-small">
            <input type="checkbox" checked={showRegistration} onChange={(e) => setShowRegistration(e.target.checked)} />
            <span>Dates d’inscription</span>
          </label>
          <label className="switch switch-small">
            <input type="checkbox" checked={seasonOnly} onChange={(e) => setSeasonOnly(e.target.checked)} />
            <span>Seulement ma saison</span>
          </label>
          <span className="muted small">
            {matches.length} {matches.length > 1 ? 'courses' : 'course'}
          </span>
        </div>
      </div>

      {view === 'month' && (
        <MonthGrid y={cursor.y} m={cursor.m} today={today} index={index} onOpenRace={openRace} onOpenDay={setOpenDay} />
      )}
      {view === 'year' && (
        <YearGrid
          y={cursor.y}
          today={today}
          index={index}
          onOpenMonth={(m) => {
            setCursor({ y: cursor.y, m });
            setView('month');
          }}
          onOpenDay={setOpenDay}
        />
      )}
      {view === 'list' && <AgendaList matches={matches} onOpenRace={openRace} selectedId={selectedId} />}

      {(selected || openDay) && (
        <div className="drawer-backdrop" onClick={() => (setSelectedId(null), setOpenDay(null))}>
          <div className="side-sheet" role="dialog" aria-modal="true" aria-label={selected ? selected.event.name : 'Journée'} onClick={(e) => e.stopPropagation()}>
            {selected ? (
              <RacePreview event={selected.event} matchingIds={selected.courses.map((c) => c.id)} onClose={() => setSelectedId(null)} />
            ) : (
              openDay && <DayPanel day={openDay} items={index.get(openDay) ?? []} onOpenRace={openRace} onClose={() => setOpenDay(null)} />
            )}
          </div>
        </div>
      )}

      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} races={races} resultCount={matches.length} />
    </div>
  );
}

function ItemChip({ item, onOpenRace }: { item: DayItem; onOpenRace: (id: string) => void }) {
  if (item.kind === 'race') {
    const { event } = item.match;
    return (
      <button
        type="button"
        className={`cal-chip band-edge-${maxBand(item.match)} ${item.first ? '' : 'is-continuation'}`}
        onClick={() => onOpenRace(event.id)}
        title={event.name}
      >
        {event.name}
      </button>
    );
  }
  return (
    <button type="button" className={`cal-chip cal-chip-reg reg-${item.kind}`} onClick={() => onOpenRace(item.event.id)} title={`${REG_TEXT[item.kind]} : ${item.event.name}`}>
      <span className="cal-chip-reg-kind">{item.kind === 'opens' ? 'Ouverture' : item.kind === 'closes' ? 'Clôture' : 'Tirage'}</span> {item.event.name}
    </button>
  );
}

function MonthGrid({
  y,
  m,
  today,
  index,
  onOpenRace,
  onOpenDay,
}: {
  y: number;
  m: number;
  today: string;
  index: Map<string, DayItem[]>;
  onOpenRace: (id: string) => void;
  onOpenDay: (day: string) => void;
}) {
  const first = toISODate({ y, m, d: 1 });
  const lead = (weekday(first) + 6) % 7; // lundi = 0
  const count = daysInMonth(y, m);
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = 1; d <= count; d++) cells.push(toISODate({ y, m, d }));
  while (cells.length % 7) cells.push(null);
  const MAX = 3;

  return (
    <div className="month-grid" role="grid" aria-label={monthLabel(y, m)}>
      <div className="month-row month-head" role="row">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} role="columnheader" className="month-headcell">
            {d}
          </div>
        ))}
      </div>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <div className="month-row" role="row" key={w}>
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (!day) return <div key={i} role="gridcell" className="month-cell is-empty" />;
            const items = index.get(day) ?? [];
            const races = items.filter((it) => it.kind === 'race');
            const regs = items.filter((it) => it.kind !== 'race');
            const ordered = [...races.filter((r) => r.kind === 'race' && r.first), ...races.filter((r) => r.kind === 'race' && !r.first), ...regs];
            const shown = ordered.slice(0, MAX);
            const d = parseYMD(day).d;
            return (
              <div key={day} role="gridcell" className={`month-cell ${day === today ? 'is-today' : ''} ${day < today ? 'is-past' : ''}`}>
                <button type="button" className="month-daynum" onClick={() => onOpenDay(day)} aria-label={`${formatDate(day, { weekday: true })}, ${items.length} éléments`}>
                  {d}
                </button>
                <div className="month-items">
                  {shown.map((item, k) => (
                    <ItemChip key={k} item={item} onOpenRace={onOpenRace} />
                  ))}
                  {ordered.length > MAX && (
                    <button type="button" className="month-more" onClick={() => onOpenDay(day)}>
                      +{ordered.length - MAX} autres
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function YearGrid({
  y,
  today,
  index,
  onOpenMonth,
  onOpenDay,
}: {
  y: number;
  today: string;
  index: Map<string, DayItem[]>;
  onOpenMonth: (m: number) => void;
  onOpenDay: (day: string) => void;
}) {
  return (
    <div className="year-grid">
      {MONTH_NAMES.map((name, i) => {
        const m = i + 1;
        const first = toISODate({ y, m, d: 1 });
        const lead = (weekday(first) + 6) % 7;
        const count = daysInMonth(y, m);
        let raceDays = 0;
        const days = Array.from({ length: count }, (_, k) => {
          const day = toISODate({ y, m, d: k + 1 });
          const items = index.get(day) ?? [];
          const starts = items.filter((it): it is Extract<DayItem, { kind: 'race' }> => it.kind === 'race' && it.first);
          const ongoing = items.some((it) => it.kind === 'race');
          const reg = items.some((it) => it.kind !== 'race');
          if (starts.length) raceDays++;
          const top = starts.sort((a, b) => b.match.event.popularity - a.match.event.popularity)[0];
          return { day, d: k + 1, top, ongoing, reg, n: items.length };
        });
        return (
          <section key={m} className="year-month">
            <button type="button" className="year-month-title" onClick={() => onOpenMonth(m)}>
              <span>{name}</span>
              <span className="muted small">
                {raceDays ? `${raceDays} ${raceDays > 1 ? 'jours de course' : 'jour de course'}` : '—'}
              </span>
            </button>
            <div className="year-days">
              {Array.from({ length: lead }, (_, k) => (
                <span key={`e${k}`} />
              ))}
              {days.map(({ day, d, top, ongoing, reg, n }) => (
                <button
                  key={day}
                  type="button"
                  className={`year-day ${top ? `has-race band-bg-${maxBand(top.match)}` : ongoing ? 'is-ongoing' : ''} ${reg ? 'has-reg' : ''} ${day === today ? 'is-today' : ''}`}
                  onClick={() => n && onOpenDay(day)}
                  disabled={!n}
                  aria-label={`${formatDate(day)}${n ? `, ${n} éléments` : ''}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AgendaList({ matches, onOpenRace, selectedId }: { matches: Match[]; onOpenRace: (id: string) => void; selectedId: string | null }) {
  const groups = useMemo(() => {
    const g = new Map<string, Match[]>();
    for (const match of matches) {
      const key = match.firstDate.slice(0, 7);
      g.set(key, [...(g.get(key) ?? []), match]);
    }
    return [...g.entries()];
  }, [matches]);
  if (!groups.length) {
    return (
      <div className="empty">
        <p>Aucune course ne correspond à ces critères.</p>
      </div>
    );
  }
  return (
    <div className="agenda">
      {groups.map(([key, list]) => {
        const { y, m } = parseYMD(`${key}-01`);
        return (
          <section key={key} className="agenda-month">
            <h2 className="agenda-month-title">{monthLabel(y, m)}</h2>
            <ul className="race-list">
              {list.map((match) => (
                <RaceListItem
                  key={match.event.id}
                  event={match.event}
                  courses={match.courses}
                  selected={match.event.id === selectedId}
                  onSelect={() => onOpenRace(match.event.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function DayPanel({ day, items, onOpenRace, onClose }: { day: string; items: DayItem[]; onOpenRace: (id: string) => void; onClose: () => void }) {
  return (
    <div className="day-panel">
      <header className="preview-head">
        <h2 className="preview-title">{formatDate(day, { weekday: true })}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">
          <CloseIcon />
        </button>
      </header>
      {items.length ? (
        <ul className="day-list">
          {items.map((item, i) => (
            <li key={i}>
              <ItemChip item={item} onOpenRace={onOpenRace} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Rien ce jour-là avec les filtres actuels.</p>
      )}
    </div>
  );
}
