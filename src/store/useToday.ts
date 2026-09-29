import { todayISO } from '../lib/dates';

/** Date du jour ; surchargeable par ?today=YYYY-MM-DD pour les démonstrations et les tests. */
export function useToday(): string {
  const match = window.location.search.match(/today=(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : todayISO();
}
