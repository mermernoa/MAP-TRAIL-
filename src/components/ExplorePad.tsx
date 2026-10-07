import { useEffect, useRef, useState } from 'react';
import { clamp, headingLabel, type MapExplorer } from '../lib/explore';

interface Props {
  explorer: MapExplorer | null;
  bearing: number;
  pitch: number;
  /** Altitude réelle du sol visé, en mètres. */
  altitude: number | null;
  /** Clé de mémorisation de l'aide (une par carte). */
  helpKey: string;
  compact?: boolean;
  /** Afficher l'aide au premier passage (pas quand un survol démarre). */
  autoHelp?: boolean;
  /** Carte insérée dans la page : un clic active la molette et le clavier. */
  contained?: boolean;
}

const HELP_STORAGE = 'ttt-aide-3d';

function helpSeen(key: string): boolean {
  try {
    return (localStorage.getItem(HELP_STORAGE) ?? '').split(',').includes(key);
  } catch {
    return false;
  }
}

function rememberHelp(key: string) {
  try {
    const seen = new Set((localStorage.getItem(HELP_STORAGE) ?? '').split(',').filter(Boolean));
    seen.add(key);
    localStorage.setItem(HELP_STORAGE, [...seen].join(','));
  } catch {
    /* stockage indisponible : l'aide réapparaîtra */
  }
}

/** Commandes d'exploration 3D : boussole, altitude, joystick, montée et descente. */
export function ExplorePad({ explorer, bearing, pitch, altitude, helpKey, compact, autoHelp = true, contained }: Props) {
  const [help, setHelp] = useState(() => autoHelp && !helpSeen(helpKey));
  const closeHelp = () => {
    setHelp(false);
    rememberHelp(helpKey);
  };

  return (
    <>
      <div className={`explore-hud ${compact ? 'is-compact' : ''}`} aria-live="off">
        <button type="button" className="explore-compass" onClick={() => explorer?.faceNorth()} aria-label={`Cap ${headingLabel(bearing)}. Remettre le nord en haut`} title="Remettre le nord en haut">
          <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
            <circle cx="20" cy="20" r="18.5" className="compass-ring" />
            <g style={{ transform: `rotate(${-bearing}deg)`, transformOrigin: '20px 20px' }}>
              <path d="M20 5 25 20H15Z" className="compass-north" />
              <path d="M20 35 15 20h10Z" className="compass-south" />
              <text x="20" y="13.6" className="compass-n">N</text>
            </g>
          </svg>
        </button>
        <dl className="explore-readout">
          <div>
            <dt>Cap</dt>
            <dd>{headingLabel(bearing)}</dd>
          </div>
          <div>
            <dt>Sol</dt>
            <dd>{altitude == null ? '…' : `${altitude.toLocaleString('fr-FR')} m`}</dd>
          </div>
          {!compact && (
            <div>
              <dt>Regard</dt>
              <dd>{Math.round(pitch)}°</dd>
            </div>
          )}
        </dl>
        <button type="button" className="explore-help-toggle" onClick={() => setHelp((v) => !v)} aria-expanded={help} aria-label="Commandes de la vue 3D">
          ?
        </button>
      </div>

      <div className="explore-pad">
        <Joystick explorer={explorer} />
        <div className="explore-climb" role="group" aria-label="Altitude">
          <HoldButton explorer={explorer} input={{ climb: 1 }} label="Prendre de l’altitude">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          </HoldButton>
          <HoldButton explorer={explorer} input={{ climb: -1 }} label="Descendre vers le sol">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          </HoldButton>
        </div>
      </div>

      {help && (
        <div className="explore-help" role="dialog" aria-label="Se déplacer en 3D">
          <strong>Se déplacer en 3D</strong>
          <ul>
            {contained && <li className="for-mouse"><b>Clic</b> dans la carte : la molette et le clavier la pilotent</li>}
            <li className="for-mouse"><b>Glisser</b> : regarder autour de soi</li>
            <li className="for-mouse"><b>Trackpad</b> : deux doigts à l’horizontale pour tourner, à la verticale pour avancer, pincer pour l’altitude</li>
            <li className="for-mouse"><b>Clavier</b> : flèches ou ZQSD, A et E en pas de côté, R et F pour le regard, Maj pour aller plus vite</li>
            <li className="for-mouse"><b>Double-clic</b> : aller à l’endroit visé</li>
            <li className="for-touch"><b>Un doigt</b> : regarder autour de soi</li>
            <li className="for-touch"><b>Deux doigts</b> : pincer pour l’altitude, tourner pour changer de cap</li>
            <li>
              <b>Joystick</b>
              {contained && <span className="for-touch"> (en plein écran)</span>} ou <b>manette</b> : avancer et tourner
            </li>
          </ul>
          <button type="button" className="button button-primary" onClick={closeHelp}>
            C’est parti
          </button>
        </div>
      )}
    </>
  );
}

function HoldButton({ explorer, input, label, children }: { explorer: MapExplorer | null; input: Parameters<MapExplorer['setPad']>[0]; label: string; children: React.ReactNode }) {
  const release = () => explorer?.setPad({});
  return (
    <button
      type="button"
      className="explore-hold"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        explorer?.setPad(input);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') explorer?.setPad(input);
      }}
      onKeyUp={release}
    >
      {children}
    </button>
  );
}

/** Joystick : vers le haut pour avancer, sur les côtés pour tourner. */
function Joystick({ explorer }: { explorer: MapExplorer | null }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);

  useEffect(() => {
    return () => explorer?.setPad({});
  }, [explorer]);

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    const radius = r.width / 2;
    let x = (clientX - (r.left + radius)) / radius;
    let y = (clientY - (r.top + radius)) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    setKnob({ x, y });
    // Courbe douce : précision au centre, pleine vitesse au bord.
    const curve = (v: number) => Math.sign(v) * Math.abs(v) ** 1.6;
    explorer?.setPad({ forward: curve(-y), turn: curve(x) * 0.8 });
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    explorer?.setPad({});
  };

  return (
    <div
      ref={baseRef}
      className="explore-joystick"
      role="application"
      aria-label="Joystick : vers le haut pour avancer, sur les côtés pour tourner"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="joystick-arrows" aria-hidden="true" />
      <span className="joystick-knob" style={{ transform: `translate(${clamp(knob.x, -1, 1) * 34}px, ${clamp(knob.y, -1, 1) * 34}px)` }} aria-hidden="true" />
    </div>
  );
}
