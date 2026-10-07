import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmtDplus, fmtKm, fmtM, fmtNum, TechnicityMeter } from '../components/bits';
import { CountUp } from '../components/CountUp';
import { CustomRaceForm } from '../components/CustomRaceForm';
import { AlertIcon, CalendarIcon, ClockIcon, DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/Icons';
import type { RaceEvent } from '../data/types';
import { addMonths, daysBetween, formatDate, formatShortDate, formatTime, MONTH_SHORT, parseYMD, relativeDays } from '../lib/dates';
import { buildIcs, courseIcsItems, downloadFile } from '../lib/ical';
import { countryFlag, distanceBand } from '../lib/metrics';
import { useReveal } from '../lib/motion';
import {
  PRIORITY_LABELS,
  resolveEntries,
  seasonTotals,
  seasonWarnings,
  STATUS_LABELS,
  upcomingDeadlines,
  type EntryStatus,
  type Priority,
  type ResolvedEntry,
  type SeasonEntry,
} from '../lib/season';
import { useAllRaces } from '../store/races';
import { useSeasonStore } from '../store/season';
import { useToday } from '../store/useToday';

type SeasonRange = 'next' | 'all' | number;

const DEADLINE_TEXT = { opens: 'Ouverture des inscriptions', closes: 'Clôture des inscriptions', lottery: 'Tirage au sort' };

export function SeasonPage() {
  const races = useAllRaces();
  const entries = useSeasonStore((s) => s.entries);
  const importData = useSeasonStore((s) => s.importData);
  const customRaces = useSeasonStore((s) => s.customRaces);
  const today = useToday();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const resolved = useMemo(() => resolveEntries(entries, races), [entries, races]);
  const years = useMemo(() => [...new Set(resolved.map((r) => parseYMD(r.date).y))].sort(), [resolved]);
  // Par défaut : les douze prochains mois, la fenêtre utile pour planifier.
  const [range, setRange] = useState<SeasonRange>('next');
  const windowStart = addMonths(today, 0);
  const windowEnd = addMonths(today, 12);
  const shown =
    range === 'all'
      ? resolved
      : range === 'next'
        ? resolved.filter((r) => r.date >= windowStart && r.date < windowEnd)
        : resolved.filter((r) => parseYMD(r.date).y === range);
  const totals = seasonTotals(shown);
  const warnings = seasonWarnings(shown);
  const deadlines = upcomingDeadlines(resolved, today, 60);
  const next = resolved.find((r) => r.date >= today && r.entry.status !== 'abandon');
  const pageRef = useReveal<HTMLDivElement>('.entry, .season-totals', [shown.length, range]);

  const exportIcs = () => {
    const items = shown.flatMap((r) => courseIcsItems(r.event, r.course, r.entry.status === 'envie' || r.entry.status === 'prevue'));
    downloadFile(`ma-saison-${typeof range === 'number' ? range : 'take-ton-trail'}.ics`, buildIcs(items), 'text/calendar');
  };
  const exportJson = () => {
    downloadFile(
      'take-ton-trail-ma-saison.json',
      JSON.stringify({ app: 'take-ton-trail', version: 1, exportedAt: new Date().toISOString(), entries, customRaces }, null, 2),
      'application/json',
    );
  };
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { entries?: SeasonEntry[]; customRaces?: RaceEvent[] };
      if (!Array.isArray(data.entries)) throw new Error('format');
      importData(data);
      setImportMsg(`${data.entries.length} courses importées.`);
    } catch {
      setImportMsg('Fichier non reconnu. Utilisez un fichier exporté depuis « Sauvegarder ».');
    }
  };

  return (
    <div ref={pageRef} className="season-page">
      <header className="season-head">
        <div>
          <h1 className="season-title">Ma saison {typeof range === 'number' ? range : ''}</h1>
          {next ? (
            <p className="season-next">
              Prochaine course : <Link to={`/course/${next.event.id}?parcours=${next.course.id}`}>{next.course.name}</Link>{' '}
              {next.course.name !== next.event.name && <>({next.event.name}) </>}
              {relativeDays(next.date, today)}.
            </p>
          ) : (
            <p className="season-next muted">Aucune course à venir dans votre saison.</p>
          )}
        </div>
        <div className="season-actions">
          <button type="button" className="button" onClick={() => setFormOpen(true)}>
            <PlusIcon size={16} /> Course hors catalogue
          </button>
          <button type="button" className="button" onClick={exportIcs} disabled={!shown.length}>
            <CalendarIcon size={16} /> Exporter vers mon agenda
          </button>
          <button type="button" className="button button-ghost" onClick={exportJson} disabled={!entries.length}>
            <DownloadIcon size={16} /> Sauvegarder
          </button>
          <button type="button" className="button button-ghost" onClick={() => fileRef.current?.click()}>
            <UploadIcon size={16} /> Restaurer
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>
      {importMsg && (
        <p className="notice" role="status">
          {importMsg}
        </p>
      )}

      {resolved.length > 0 && (
        <div className="segmented season-range" role="tablist" aria-label="Période">
          <button type="button" role="tab" aria-selected={range === 'next'} className={range === 'next' ? 'is-on' : ''} onClick={() => setRange('next')}>
            12 prochains mois
          </button>
          {years.map((y) => (
            <button key={y} type="button" role="tab" aria-selected={range === y} className={range === y ? 'is-on' : ''} onClick={() => setRange(y)}>
              {y}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={range === 'all'} className={range === 'all' ? 'is-on' : ''} onClick={() => setRange('all')}>
            Tout
          </button>
        </div>
      )}

      {!resolved.length ? (
        <div className="empty empty-large">
          <img className="empty-illustration" src="brand/medaille.webp" alt="" width={150} height={219} />
          <h2>Votre saison est vide</h2>
          <p>Ajoutez des courses depuis la carte ou le calendrier avec le bouton « Ma saison », ou saisissez une course locale absente du catalogue.</p>
          <div className="button-row">
            <Link to="/" className="button button-primary">
              Explorer la carte
            </Link>
            <Link to="/calendrier" className="button">
              Ouvrir le calendrier
            </Link>
            <button type="button" className="button button-ghost" onClick={() => setFormOpen(true)}>
              Ajouter une course hors catalogue
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="season-totals">
            <div>
              <dt>Courses</dt>
              <dd>
                <CountUp value={totals.races} format={fmtNum} />
              </dd>
            </div>
            <div>
              <dt>Distance cumulée</dt>
              <dd>
                <CountUp value={totals.distanceKm} format={fmtKm} />
              </dd>
            </div>
            <div>
              <dt>Dénivelé cumulé</dt>
              <dd>
                <CountUp value={totals.elevationGain} format={fmtM} />
              </dd>
            </div>
            <div>
              <dt>Points ITRA</dt>
              <dd>
                <CountUp value={totals.itraPoints} format={fmtNum} />
              </dd>
            </div>
            <div>
              <dt>Running Stones</dt>
              <dd>
                <CountUp value={totals.runningStones} format={fmtNum} />
              </dd>
            </div>
          </dl>

          {(deadlines.length > 0 || warnings.length > 0) && (
            <section className="season-alerts" aria-label="À surveiller">
              {deadlines.map((d) => (
                <p key={`${d.entryId}-${d.kind}`} className="alert alert-deadline">
                  <ClockIcon size={16} />
                  <span>
                    <strong>{DEADLINE_TEXT[d.kind]}</strong> pour <Link to={`/course/${d.event.id}`}>{d.event.name}</Link> le{' '}
                    {formatShortDate(d.date)} ({relativeDays(d.date, today)}).
                  </span>
                </p>
              ))}
              {warnings.map((w) => (
                <p key={w.entryIds.join('|')} className="alert alert-warning">
                  <AlertIcon size={16} />
                  <span>{w.message}</span>
                </p>
              ))}
            </section>
          )}

          {range !== 'all' && (
            <SeasonStrip start={range === 'next' ? windowStart : `${range}-01-01`} items={shown} today={today} />
          )}
          {!shown.length && (
            <p className="empty-inline">
              Aucune course sur cette période. {range === 'next' ? 'Choisissez une autre année ci-dessus.' : ''}
            </p>
          )}

          <ol className="entries">
            {shown.map((r, i) => (
              <EntryCard key={r.entry.id} item={r} gapDays={i ? daysBetween(shown[i - 1].date, r.date) : null} today={today} />
            ))}
          </ol>
        </>
      )}

      {formOpen && (
        <CustomRaceForm
          onClose={() => setFormOpen(false)}
          onCreated={(race) => {
            setFormOpen(false);
            navigate(`/course/${race.id}`);
          }}
        />
      )}
    </div>
  );
}

/** Frise de l'année : un repère par course, taille selon la distance, remplissage selon la priorité. */
function SeasonStrip({ start, items, today }: { start: string; items: ResolvedEntry[]; today: string }) {
  const end = addMonths(start, 12);
  const total = daysBetween(start, end);
  const pos = (date: string) => (daysBetween(start, date) / total) * 100;
  const todayPos = today >= start && today < end ? pos(today) : null;
  const months = Array.from({ length: 12 }, (_, i) => addMonths(start, i));
  return (
    <figure className="season-strip">
      <div className="season-strip-track">
        {months.map((m) => (
          <span key={m} className="season-strip-month" style={{ left: `${pos(m)}%` }}>
            {MONTH_SHORT[parseYMD(m).m - 1]}
            {parseYMD(m).m === 1 && m !== start && ` ${parseYMD(m).y}`}
          </span>
        ))}
        {todayPos != null && <span className="season-strip-today" style={{ left: `${todayPos}%` }} aria-hidden="true" />}
        {items.map((r) => (
          <Link
            key={r.entry.id}
            to={`/course/${r.event.id}?parcours=${r.course.id}`}
            className={`season-strip-mark prio-${r.entry.priority} band-${distanceBand(r.course.distanceKm)} status-${r.entry.status}`}
            style={{ left: `${pos(r.date)}%` }}
            title={`${r.course.name}, ${formatDate(r.date)}`}
          >
            <span className="sr-only">
              {r.course.name}, {formatDate(r.date)}
            </span>
          </Link>
        ))}
      </div>
      <figcaption className="season-strip-legend">
        <span>
          <span className="season-strip-key prio-A" aria-hidden="true" /> {PRIORITY_LABELS.A}
        </span>
        <span>
          <span className="season-strip-key prio-B" aria-hidden="true" /> {PRIORITY_LABELS.B}
        </span>
        <span>
          <span className="season-strip-key prio-C" aria-hidden="true" /> {PRIORITY_LABELS.C}
        </span>
      </figcaption>
    </figure>
  );
}

function EntryCard({ item, gapDays, today }: { item: ResolvedEntry; gapDays: number | null; today: string }) {
  const { entry, event, course, date } = item;
  const update = useSeasonStore((s) => s.update);
  const remove = useSeasonStore((s) => s.remove);
  const removeCustomRace = useSeasonStore((s) => s.removeCustomRace);
  const [notesOpen, setNotesOpen] = useState(!!entry.notes);
  const { d, m } = parseYMD(date);
  const time = formatTime(course.start);
  const past = date < today;

  return (
    <li className={`entry prio-${entry.priority} ${past ? 'is-past' : ''}`}>
      {gapDays != null && (
        <p className="entry-gap" aria-label={`${gapDays} jours depuis la course précédente`}>
          {gapDays >= 14 ? `${Math.round(gapDays / 7)} semaines` : `${gapDays} jours`}
        </p>
      )}
      <div className="entry-card">
        <div className="entry-date" aria-hidden="true">
          <span className="entry-day">{d}</span>
          <span className="entry-month">{MONTH_SHORT[m - 1]}</span>
        </div>
        <div className="entry-body">
          <h2 className="entry-title">
            <Link to={`/course/${event.id}?parcours=${course.id}`}>{course.name}</Link>
          </h2>
          <p className="entry-sub">
            {course.name !== event.name && <>{event.name}, </>}
            <span aria-hidden="true">{countryFlag(event.country)}</span> {event.city}
            <span className="sr-only">, {formatDate(date)}</span>
            {time && <span className="muted"> départ à {time}</span>}
          </p>
          <p className="entry-stats">
            <span className="num">{fmtKm(course.distanceKm)}</span>
            <span className="num">{fmtDplus(course.elevationGain)}</span>
            <TechnicityMeter level={course.technicity} />
            {event.dateStatus === 'estimated' && <span className="tag tag-soft">Date prévisionnelle</span>}
          </p>
          <div className="entry-controls">
            <label className="field field-inline">
              Statut
              <select value={entry.status} onChange={(e) => update(entry.id, { status: e.target.value as EntryStatus })}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented segmented-small" role="radiogroup" aria-label="Priorité">
              {(['A', 'B', 'C'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={entry.priority === p}
                  className={entry.priority === p ? 'is-on' : ''}
                  title={PRIORITY_LABELS[p]}
                  onClick={() => update(entry.id, { priority: p })}
                >
                  {p}
                </button>
              ))}
            </div>
            <label className="field field-inline">
              {entry.status === 'termine' ? 'Temps réalisé' : 'Objectif'}
              <input
                value={entry.status === 'termine' ? entry.result : entry.goal}
                placeholder={entry.status === 'termine' ? '12 h 34' : 'Finir, ou moins de 12 h'}
                onChange={(e) => update(entry.id, entry.status === 'termine' ? { result: e.target.value } : { goal: e.target.value })}
              />
            </label>
          </div>
          {notesOpen ? (
            <label className="field">
              Notes
              <textarea
                rows={2}
                value={entry.notes}
                placeholder="Logement, matériel obligatoire, plan de course…"
                onChange={(e) => update(entry.id, { notes: e.target.value })}
              />
            </label>
          ) : (
            <button type="button" className="link-button" onClick={() => setNotesOpen(true)}>
              Ajouter des notes
            </button>
          )}
        </div>
        <div className="entry-side">
          <button
            type="button"
            className="icon-button"
            onClick={() => (event.custom && event.courses.length === 1 ? removeCustomRace(event.id) : remove(entry.id))}
            aria-label={`Retirer ${course.name} de ma saison`}
            title="Retirer de ma saison"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </li>
  );
}
