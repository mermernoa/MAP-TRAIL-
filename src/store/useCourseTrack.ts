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
  track: ParsedTrack | null;
  fileName: string | null;
  text: string | null;
  error: string | null;
}

const EMPTY: TrackState = { loading: false, track: null, fileName: null, text: null, error: null };

/** Trace GPX importée par l'utilisateur pour un parcours (stockée dans IndexedDB). */
export function useCourseTrack(key: string) {
  const [state, setState] = useState<TrackState>({ ...EMPTY, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    idbGet<StoredTrack>(`gpx:${key}`)
      .then((stored) => {
        if (cancelled) return;
        if (!stored) return setState(EMPTY);
        try {
          setState({ loading: false, track: parseGpx(stored.text), fileName: stored.fileName, text: stored.text, error: null });
        } catch {
          setState({ ...EMPTY, error: 'La trace enregistrée est illisible. Importez-la à nouveau.' });
        }
      })
      .catch(() => !cancelled && setState(EMPTY));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const save = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const track = parseGpx(text);
        await idbSet(`gpx:${key}`, { fileName: file.name, text, importedAt: new Date().toISOString() } satisfies StoredTrack);
        setState({ loading: false, track, fileName: file.name, text, error: null });
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
