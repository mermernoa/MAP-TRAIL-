import { formatShortDate } from '../lib/dates';
import { countActiveFilters, DEFAULT_FILTERS, type Filters } from '../lib/filters';
import { countryName, POPULARITY_LABELS, TECHNICITY_LABELS } from '../lib/metrics';
import { useFilterStore } from '../store/filters';
import { fmtNum } from './bits';
import { CloseIcon, FilterIcon, SearchIcon } from './Icons';

interface Removable {
  key: string;
  label: string;
  clear: Partial<Filters>;
}

function describe(f: Filters): Removable[] {
  const out: Removable[] = [];
  const range = (r: [number, number], unit: (v: number) => string) =>
    r[1] === Infinity ? `${unit(r[0])} et plus` : r[0] === 0 ? `jusqu'à ${unit(r[1])}` : `${unit(r[0])} à ${unit(r[1])}`;
  if (f.distance[0] > 0 || f.distance[1] !== Infinity)
    out.push({ key: 'distance', label: range(f.distance, (v) => `${v} km`), clear: { distance: DEFAULT_FILTERS.distance } });
  if (f.elevation[0] > 0 || f.elevation[1] !== Infinity)
    out.push({
      key: 'elevation',
      label: `D+ ${range(f.elevation, (v) => `${fmtNum(v)} m`)}`,
      clear: { elevation: DEFAULT_FILTERS.elevation },
    });
  if (f.technicity.length)
    out.push({
      key: 'tech',
      label: f.technicity.length === 1 ? TECHNICITY_LABELS[f.technicity[0]].label : `Technicité ${[...f.technicity].sort().join(', ')}`,
      clear: { technicity: [] },
    });
  if (f.itraMin > 0) out.push({ key: 'itra', label: `${f.itraMin}+ points ITRA`, clear: { itraMin: 0 } });
  if (f.utmbCategories.length) out.push({ key: 'utmb', label: `UTMB ${f.utmbCategories.join(', ')}`, clear: { utmbCategories: [] } });
  for (const c of f.circuits)
    out.push({ key: `circuit-${c}`, label: c, clear: { circuits: f.circuits.filter((x) => x !== c) } });
  for (const c of f.countries)
    out.push({ key: `country-${c}`, label: countryName(c), clear: { countries: f.countries.filter((x) => x !== c) } });
  if (f.near) out.push({ key: 'near', label: `${f.near.label} (${f.near.radiusKm} km)`, clear: { near: null } });
  if (f.dateFrom || f.dateTo)
    out.push({
      key: 'date',
      label:
        f.dateFrom && f.dateTo
          ? `${formatShortDate(f.dateFrom)} – ${formatShortDate(f.dateTo)}`
          : f.dateFrom
            ? `À partir du ${formatShortDate(f.dateFrom)}`
            : `Jusqu'au ${formatShortDate(f.dateTo as string)}`,
      clear: { dateFrom: null, dateTo: null },
    });
  if (f.popularity.length)
    out.push({
      key: 'pop',
      label: [...f.popularity].sort().map((p) => POPULARITY_LABELS[p].label).join(', '),
      clear: { popularity: [] },
    });
  if (f.registrationOpen) out.push({ key: 'reg', label: 'Inscriptions ouvertes', clear: { registrationOpen: false } });
  if (f.includePast) out.push({ key: 'past', label: 'Courses passées incluses', clear: { includePast: false } });
  return out;
}

export function FilterBar({ onOpenFilters }: { onOpenFilters: () => void }) {
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const active = countActiveFilters(filters);
  const chips = describe(filters);
  return (
    <div className="filter-bar">
      <div className="filter-bar-row">
        <label className="search">
          <SearchIcon />
          <span className="sr-only">Rechercher une course, une ville, une région</span>
          <input
            type="search"
            placeholder="Course, ville, région…"
            value={filters.query}
            onChange={(e) => setFilters({ query: e.target.value })}
          />
        </label>
        <button type="button" className="button filter-button" onClick={onOpenFilters} aria-haspopup="dialog">
          <FilterIcon />
          Filtres
          {active > 0 && <span className="badge">{active}</span>}
        </button>
      </div>
      {chips.length > 0 && (
        <ul className="active-filters" aria-label="Filtres actifs">
          {chips.map((c) => (
            <li key={c.key}>
              <button type="button" className="chip is-on is-removable" onClick={() => setFilters(c.clear)}>
                {c.label}
                <CloseIcon size={14} aria-label="" />
                <span className="sr-only">Retirer ce filtre</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
