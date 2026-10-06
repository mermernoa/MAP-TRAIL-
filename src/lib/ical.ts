import type { Course, RaceEvent } from '../data/types';
import { addDays } from './dates';

export interface IcsItem {
  uid: string;
  title: string;
  /** YYYY-MM-DD (journée entière) ou YYYY-MM-DDTHH:mm (heure locale du lieu). */
  start: string;
  /** Durée en heures pour un évènement horaire. */
  durationH?: number;
  location?: string;
  description?: string;
  url?: string;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
}

/** Replie les lignes à 75 octets environ, comme l'exige la RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

function compact(value: string): string {
  return value.replace(/[-:]/g, '');
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs(items: IcsItem[], now: Date = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Take Ton Trail//Calendrier trail//FR', 'CALSCALE:GREGORIAN'];
  for (const item of items) {
    lines.push('BEGIN:VEVENT', `UID:${item.uid}`, `DTSTAMP:${stamp(now)}`);
    if (item.start.length > 10 && item.durationH) {
      // Heure « flottante » : l'heure locale du lieu de course, quel que soit le fuseau de l'agenda.
      lines.push(`DTSTART:${compact(item.start)}00`);
      lines.push(`DURATION:PT${Math.round(item.durationH * 60)}M`);
    } else {
      const day = item.start.slice(0, 10);
      lines.push(`DTSTART;VALUE=DATE:${compact(day)}`, `DTEND;VALUE=DATE:${compact(addDays(day, 1))}`);
    }
    lines.push(`SUMMARY:${escapeText(item.title)}`);
    if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
    if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`);
    if (item.url) lines.push(`URL:${item.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Évènements d'agenda pour un parcours : la course et les dates d'inscription. */
export function courseIcsItems(event: RaceEvent, course: Course, withRegistration = true): IcsItem[] {
  const items: IcsItem[] = [
    {
      uid: `${event.id}-${course.id}@taketontrail`,
      title: `${course.name} – ${event.name}`,
      start: course.start,
      durationH: course.timeLimitH ?? 8,
      location: `${course.startPlace ?? event.city}, ${event.region}`,
      description: `${course.distanceKm} km${course.elevationGain != null ? `, ${course.elevationGain} m D+` : ''}.${
        event.dateStatus === 'estimated' ? ' Date prévisionnelle à confirmer.' : ''
      }`,
      url: event.website,
    },
  ];
  if (withRegistration) {
    const { opens, closes, lotteryDate } = event.registration;
    if (opens) items.push({ uid: `${event.id}-opens@taketontrail`, title: `Ouverture des inscriptions – ${event.name}`, start: opens, url: event.website });
    if (closes) items.push({ uid: `${event.id}-closes@taketontrail`, title: `Clôture des inscriptions – ${event.name}`, start: closes, url: event.website });
    if (lotteryDate) items.push({ uid: `${event.id}-lottery@taketontrail`, title: `Tirage au sort – ${event.name}`, start: lotteryDate, url: event.website });
  }
  return items;
}

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
