import { useRef, useState } from 'react';
import type { Course } from '../data/types';
import type { ParsedTrack } from '../lib/gpx';
import { downloadFile } from '../lib/ical';
import { fmtKm, fmtM } from './bits';
import { DownloadIcon, ExternalIcon, TrashIcon, UploadIcon } from './Icons';

interface Props {
  course: Course;
  track: ParsedTrack | null;
  fileName: string | null;
  text: string | null;
  /** Trace officielle chargée depuis la base (pas de suppression possible). */
  remote?: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onRemove: () => void;
}

/** Import d'un GPX (glisser-déposer ou sélection) et téléchargement. */
export function GpxPanel({ course, track, fileName, text, remote = false, error, onFile, onRemove }: Props) {
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
            {remote
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
            <strong>Déposez le GPX du parcours ici</strong>
            <br />
            <span className="muted">
              Le tracé s’affiche sur la carte et le profil devient détaillé. Récupérez-le sur le site officiel de la course.
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
