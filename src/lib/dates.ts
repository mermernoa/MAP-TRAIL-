/**
 * Les dates des courses sont stockées en heure locale du lieu de course
 * (« YYYY-MM-DD » ou « YYYY-MM-DDTHH:mm »), sans fuseau. On les manipule en
 * composantes calendaires pour éviter tout décalage lié au fuseau du navigateur.
 */

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export const MONTH_NAMES = MONTHS;
export const MONTH_SHORT = MONTHS_SHORT;
export const WEEKDAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

export interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

export function parseYMD(value: string): YMD {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

export function toISODate({ y, m, d }: YMD): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Nombre de jours depuis l'époque, en UTC (sert aux comparaisons et différences). */
export function dayNumber(value: string): number {
  const { y, m, d } = parseYMD(value);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function fromDayNumber(n: number): string {
  const date = new Date(n * 86400000);
  return toISODate({ y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() });
}

export function addDays(value: string, days: number): string {
  return fromDayNumber(dayNumber(value) + days);
}

export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function weekday(value: string): number {
  // 0 = dimanche
  return (dayNumber(value) + 4) % 7;
}

/** Date du jour dans le fuseau du navigateur, au format YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return toISODate({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

export function formatDate(value: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const { y, m, d } = parseYMD(value);
  const parts = [];
  if (opts.weekday) parts.push(WEEKDAYS[weekday(value)]);
  parts.push(d === 1 ? '1er' : String(d), MONTHS[m - 1]);
  if (opts.year !== false) parts.push(String(y));
  return parts.join(' ');
}

export function formatShortDate(value: string): string {
  const { m, d } = parseYMD(value);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatTime(value: string): string | null {
  if (value.length < 16) return null;
  return value.slice(11, 16).replace(':', 'h');
}

/** « 22 – 25 octobre 2026 », « 30 mai – 2 juin 2027 », « 7 août 2027 ». */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  const a = parseYMD(start);
  const b = parseYMD(end);
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function monthLabel(y: number, m: number): string {
  return `${MONTHS[m - 1]} ${y}`;
}

/** Libellé relatif : « aujourd'hui », « dans 12 jours », « il y a 3 jours ». */
export function relativeDays(target: string, today: string = todayISO()): string {
  const n = daysBetween(today, target);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n > 0) {
    if (n < 60) return `dans ${n} jours`;
    const months = Math.round(n / 30.4);
    return `dans ${months} mois`;
  }
  const p = -n;
  if (p < 60) return `il y a ${p} jours`;
  return `il y a ${Math.round(p / 30.4)} mois`;
}

/** Premier jour du mois, décalé de `delta` mois. */
export function addMonths(value: string, delta: number): string {
  const { y, m } = parseYMD(value);
  const total = y * 12 + (m - 1) + delta;
  return toISODate({ y: Math.floor(total / 12), m: (total % 12) + 1, d: 1 });
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
