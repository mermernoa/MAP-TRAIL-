import { useCallback, useEffect, useState } from 'react';
import { GpxError, parseGpx, type ParsedTrack } from '../lib/gpx';
import { idbDelete, idbGet, idbSet } from '../lib/idb';

interface StoredTrack {
  fileName: string;
  text: string;
  importedAt: string;
}

interface TrackState {
  loading: boolean;
  /** Trace chargée depuis le lien GPX de la base (et non importée par l'utilisateur). */
  remote: boolean;
  track: ParsedTrack | null;
  fileName: string | null;
  text: string | null;
  error: string | null;
}

const EMPTY: TrackState = { loading: false, remote: false, track: null, fileName: null, text: null, error: null };

/** Télécharge le GPX officiel quand le serveur l'autorise (CORS) ; sinon null. */
async function fetchRemote(url: string): Promise<{ text: string; fileName: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    parseGpx(text);
    const fileName = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'parcours.gpx');
    return { text, fileName: fileName.endsWith('.gpx') ? fileName : `${fileName}.gpx` };
  } catch {
    return null;
  }
}

/**
 * Trace GPX d'un parcours : celle importée par l'utilisateur (IndexedDB) en
 * priorité, sinon le GPX officiel référencé dans la base quand il est lisible.
 */
export function useCourseTrack(key: string, gpxUrl?: string) {
  const [state, setState] = useState<TrackState>({ ...EMPTY, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    const loadRemote = async () => {
      const remote = gpxUrl ? await fetchRemote(gpxUrl) : null;
      if (cancelled) return;
      if (!remote) return setState(EMPTY);
      setState({ loading: false, remote: true, track: parseGpx(remote.text), fileName: remote.fileName, text: remote.text, error: null });
    };
    idbGet<StoredTrack>(`gpx:${key}`)
      .then((stored) => {
        if (cancelled) return;
        if (!stored) {
          void loadRemote();
          return;
        }
        try {
          setState({ loading: false, remote: false, track: parseGpx(stored.text), fileName: stored.fileName, text: stored.text, error: null });
        } catch {
          setState({ ...EMPTY, error: 'La trace enregistrée est illisible. Importez-la à nouveau.' });
        }
      })
      .catch(() => {
        if (!cancelled) void loadRemote();
      });
    return () => {
      cancelled = true;
    };
  }, [key, gpxUrl]);

  const save = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const track = parseGpx(text);
        await idbSet(`gpx:${key}`, { fileName: file.name, text, importedAt: new Date().toISOString() } satisfies StoredTrack);
        setState({ loading: false, remote: false, track, fileName: file.name, text, error: null });
      } catch (err) {
        const message =
          err instanceof GpxError ? err.message : "Impossible d'enregistrer ce fichier. Vérifiez qu'il s'agit bien d'un GPX.";
        setState((s) => ({ ...s, error: message }));
      }
    },
    [key],
  );

  const remove = useCallback(async () => {
    await idbDelete(`gpx:${key}`);
    setState(EMPTY);
  }, [key]);

  return { ...state, save, remove };
}
