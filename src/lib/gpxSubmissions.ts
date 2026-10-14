import type { ParsedTrack } from './gpx';
import { accountsEnabled, getSupabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase';

/**
 * Traces GPX proposées par les visiteurs (voir supabase/migrations/…_depots_gpx.sql) :
 * le fichier part dans l'espace privé « gpx », une ligne « en attente » est créée,
 * et la trace n'apparaît pour tout le monde qu'une fois validée dans l'espace admin.
 */

export const GPX_BUCKET = 'gpx';

/** Envoie une trace à valider. Lève une erreur lisible en cas d'échec. */
export async function submitGpx(input: {
  eventId: string;
  courseId: string;
  fileName: string;
  text: string;
  track: ParsedTrack;
  note?: string;
}): Promise<void> {
  if (!accountsEnabled) throw new Error('L’envoi de traces n’est pas disponible pour le moment.');
  const sb = await getSupabase();
  const path = `depots/${input.eventId}/${input.courseId}/${crypto.randomUUID()}.gpx`;
  const upload = await sb.storage
    .from(GPX_BUCKET)
    .upload(path, new Blob([input.text], { type: 'application/gpx+xml' }), { contentType: 'application/gpx+xml', upsert: false });
  if (upload.error) throw new Error('Le fichier n’a pas pu être envoyé. Réessaie dans un instant.');
  const { error } = await sb.from('gpx_submissions').insert({
    event_id: input.eventId,
    course_id: input.courseId,
    file_path: path,
    file_name: input.fileName.slice(0, 200),
    distance_km: Math.round(input.track.distanceKm * 100) / 100,
    elevation_gain: input.track.maxEle != null ? Math.round(input.track.elevationGain) : null,
    note: input.note?.trim().slice(0, 500) || null,
  });
  if (error) throw new Error('La trace n’a pas pu être enregistrée. Réessaie dans un instant.');
}

/** Dernière trace validée d'un parcours, ou null (pas de base, rien de validé, réseau). */
export async function fetchApprovedGpx(eventId: string, courseId: string): Promise<{ text: string; fileName: string } | null> {
  if (!accountsEnabled) return null;
  // Simples requêtes REST : le client Supabase n'est chargé que pour envoyer une trace.
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` };
  try {
    const query = new URLSearchParams({
      select: 'file_path,file_name',
      event_id: `eq.${eventId}`,
      course_id: `eq.${courseId}`,
      status: 'eq.approved',
      order: 'reviewed_at.desc.nullslast',
      limit: '1',
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gpx_submissions?${query}`, { headers });
    if (!res.ok) return null;
    const row = ((await res.json()) as { file_path: string; file_name: string }[])[0];
    if (!row) return null;
    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${GPX_BUCKET}/${row.file_path}`, { headers });
    if (!file.ok) return null;
    return { text: await file.text(), fileName: row.file_name };
  } catch {
    return null;
  }
}
