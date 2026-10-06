/**
 * Importe la feuille Google « Maps Trail - Base des courses » dans le site.
 *
 *   npm run import:sheet -- --csv <url ou fichier>   export CSV de l'onglet Courses
 *   npm run import:sheet -- --json <fichiers...>     réponses JSON de l'API Sheets (values)
 *   SHEET_CSV_URL=<url> npm run import:sheet         URL CSV par variable d'environnement
 *
 * Écrit public/data/races.json (lu par le site) et data/rapport-import.md
 * (lignes à corriger dans la feuille).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { formatDate } from '../src/lib/dates';
import { convertSheet, parseCsv, PUBLISHED_STATUSES } from '../src/lib/sheetImport';

const SHEET_ID = '1tlEPRZwGDRcVItYsQ3eiIwBnvq52MbBsoUlq_etARMs';
const SHEET_GID = '933447012';

async function readRows(argv: string[]): Promise<{ rows: string[][]; origin: string }> {
  const [flag, ...rest] = argv;
  if (flag === '--json') {
    const rows = rest.flatMap((file) => (JSON.parse(readFileSync(file, 'utf8')) as { values: string[][] }).values);
    return { rows, origin: `${rest.length} fichier(s) JSON de l'API Sheets` };
  }
  const source =
    flag === '--csv'
      ? rest[0]
      : process.env.SHEET_CSV_URL ?? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}). La feuille est-elle partagée en lecture par lien ?`);
    const text = await res.text();
    if (text.trimStart().startsWith('<')) throw new Error('Google a renvoyé une page HTML au lieu du CSV : vérifiez le partage de la feuille.');
    return { rows: parseCsv(text), origin: 'export CSV de la feuille' };
  }
  return { rows: parseCsv(readFileSync(source, 'utf8')), origin: source };
}

const { rows, origin } = await readRows(process.argv.slice(2));
const result = convertSheet(rows);
const { stats, issues, events, dateShifts } = result;

const json = `{"generatedAt":"${new Date().toISOString()}","source":"Google Sheets ${SHEET_ID}","events":[\n${events
  .map((e) => JSON.stringify(e))
  .join(',\n')}\n]}\n`;
writeFileSync('public/data/races.json', json);

const skipped = Object.entries(stats.skippedByStatus)
  .map(([s, n]) => `${n} « ${s} »`)
  .join(', ');
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');
const lines = [
  '# Rapport d’import de la base des courses',
  '',
  `Import du ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} depuis ${origin}.`,
  '',
  `- ${stats.rows} lignes lues, ${stats.published} publiées (statuts ${PUBLISHED_STATUSES.join(', ')})${skipped ? `, non publiées : ${skipped}` : ''}.`,
  `- ${stats.events} événements et ${stats.courses} parcours sur le site.`,
  `- ${stats.pricesInCents} prix saisis en centimes (ex. 1 200,00 € pour 12 €) corrigés à l’import : à rectifier dans la feuille.`,
  `- ${stats.tentativeDates} événements à date « à confirmer » (affichés « Date prévisionnelle »), dont ${dateShifts.length} ramenés au jour de la semaine de l’édition précédente (liste ci-dessous).`,
  '',
  `## Lignes ignorées (${errors.length})`,
  '',
  ...(errors.length ? errors.map((i) => `- **${i.rowId}** ${i.event} : ${i.message}`) : ['Aucune.']),
  '',
  `## À vérifier (${warnings.length})`,
  '',
  ...(warnings.length ? warnings.map((i) => `- **${i.rowId}** ${i.event} : ${i.message}`) : ['Rien à signaler.']),
  '',
  `## Dates à confirmer déplacées (${dateShifts.length})`,
  '',
  'La feuille reprend le jour et le mois de l’édition précédente avec l’année suivante, ce qui décale le jour de la semaine (dimanche 9 novembre 2025 → lundi 9 novembre 2026). Le site affiche la date au même jour de la semaine que l’édition précédente. Reportez la vraie date dans la feuille dès qu’elle est annoncée.',
  '',
  '| Événement | Date dans la feuille | Date affichée |',
  '| --- | --- | --- |',
  ...dateShifts.map((d) => `| **${d.code}** ${d.event} | ${formatDate(d.sheetDate, { weekday: true, year: true })} | ${formatDate(d.shownDate, { weekday: true, year: true })} |`),
  '',
];
writeFileSync('data/rapport-import.md', lines.join('\n'));

console.log(`${stats.events} événements, ${stats.courses} parcours → public/data/races.json`);
console.log(`${errors.length} lignes ignorées, ${warnings.length} avertissements → data/rapport-import.md`);
