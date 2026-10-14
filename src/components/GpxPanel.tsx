import { useRef, useState } from 'react';
import type { Course } from '../data/types';
import type { ParsedTrack } from '../lib/gpx';
import { submitGpx } from '../lib/gpxSubmissions';
import { downloadFile } from '../lib/ical';
import { accountsEnabled } from '../lib/supabase';
import { fmtKm, fmtM } from './bits';
import { DownloadIcon, ExternalIcon, TrashIcon, UploadIcon } from './Icons';

interface Props {
  eventId: string;
  course: Course;
  track: ParsedTrack | null;
  fileName: string | null;
  text: string | null;
  /** Trace chargée depuis la base (pas de suppression possible). */
  remote?: boolean;
  source?: 'local' | 'validee' | 'officielle' | null;
  error: string | null;
  onFile: (file: File) => void;
  onRemove: () => void;
}

/** Import d'un GPX (glisser-déposer ou sélection) et téléchargement. */
export function GpxPanel({ eventId, course, track, fileName, text, remote = false, source = null, error, onFile, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="gpx-panel">
      {track ? (
        <>
          <dl className="gpx-stats">
            <div>
              <dt>Distance mesurée</dt>
              <dd>{fmtKm(track.distanceKm)}</dd>
            </div>
            <div>
              <dt>D+ calculé</dt>
              <dd>{track.maxEle != null ? fmtM(track.elevationGain) : '—'}</dd>
            </div>
            <div>
              <dt>Point culminant</dt>
              <dd>{track.maxEle != null ? fmtM(track.maxEle) : '—'}</dd>
            </div>
            <div>
              <dt>Point bas</dt>
              <dd>{track.minEle != null ? fmtM(track.minEle) : '—'}</dd>
            </div>
          </dl>
          <p className="muted small">
            {source === 'validee'
              ? `Trace proposée par un coureur et vérifiée par Take Ton Trail (${fileName}).`
              : remote
                ? `Trace officielle (${fileName}).`
                : `Fichier : ${fileName}. Enregistré dans ce navigateur uniquement.`}{' '}
            Le D+ calculé depuis un GPX diffère souvent de quelques pourcents du chiffre officiel.
          </p>
          <div className="button-row">
            {text && (
              <button
                type="button"
                className="button"
                onClick={() => downloadFile(fileName ?? `${course.id}.gpx`, text, 'application/gpx+xml')}
              >
                <DownloadIcon size={16} /> Télécharger le GPX
              </button>
            )}
            <button type="button" className="button button-ghost" onClick={() => inputRef.current?.click()}>
              <UploadIcon size={16} /> {remote ? 'Importer un autre GPX' : 'Remplacer'}
            </button>
            {!remote && (
              <button type="button" className="button button-ghost" onClick={onRemove}>
                <TrashIcon size={16} /> Supprimer
              </button>
            )}
          </div>
          {source === 'local' && accountsEnabled && text && (
            <ShareGpx key={`${eventId}/${course.id}/${fileName}`} eventId={eventId} courseId={course.id} fileName={fileName ?? `${course.id}.gpx`} text={text} track={track} />
          )}
        </>
      ) : (
        <div
          className={`dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
        >
          <UploadIcon size={22} />
          <p>
            <strong>Dépose le GPX du parcours ici</strong>
            <br />
            <span className="muted">
              Le tracé s’affiche sur la carte et le profil devient détaillé. Tu peux ensuite le proposer pour qu’il s’affiche pour tout le monde.
            </span>
          </p>
          <button type="button" className="button" onClick={() => inputRef.current?.click()}>
            Choisir un fichier
          </button>
        </div>
      )}
      {course.gpxUrl && (
        <a className="button button-ghost" href={course.gpxUrl} target="_blank" rel="noreferrer">
          <ExternalIcon size={16} /> GPX officiel
        </a>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * Proposer la trace importée à Take Ton Trail : elle est vérifiée dans l'espace
 * admin avant d'apparaître sur la fiche pour tous les visiteurs.
 */
function ShareGpx({ eventId, courseId, fileName, text, track }: { eventId: string; courseId: string; fileName: string; text: string; track: ParsedTrack }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  if (state === 'sent') {
    return (
      <p className="gpx-share-done" role="status">
        Merci ! Ta trace part en vérification. Une fois validée, elle s’affichera sur la fiche pour tout le monde.
      </p>
    );
  }
  const send = async () => {
    setState('sending');
    setError('');
    try {
      await submitGpx({ eventId, courseId, fileName, text, track, note });
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible. Réessaie dans un instant.');
      setState('idle');
    }
  };
  return (
    <div className="gpx-share">
      <p>
        <strong>C’est le bon tracé ?</strong> Propose-le à Take Ton Trail : après vérification, tous les coureurs verront le profil et le
        survol 3D de ce parcours.
      </p>
      <label className="gpx-share-note">
        <span className="muted small">Un mot pour nous (facultatif) : édition, source du fichier…</span>
        <input type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : GPX officiel 2026, pris sur le site de la course" />
      </label>
      <button type="button" className="button button-primary" onClick={send} disabled={state === 'sending'}>
        <UploadIcon size={16} /> {state === 'sending' ? 'Envoi…' : 'Proposer ce tracé'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
