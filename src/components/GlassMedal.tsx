import { useEffect, useRef, useState } from 'react';
import { hasFastWebGL, supportsWebGL } from '../lib/maplibre';

interface Props {
  /** `ribbon` : médaille et ruban (illustration) ; `badge` : médaille seule. */
  variant?: 'ribbon' | 'badge';
  className?: string;
}

/**
 * Médaille de finisher en verre 3D. L'illustration de la marque s'affiche
 * d'abord, et reste en place sans carte graphique.
 */
export function GlassMedal({ variant = 'ribbon', className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supportsWebGL() || !hasFastWebGL()) return;
    let cancelled = false;
    let dispose: (() => void) | null = null;
    import('../lib/glassMedal')
      .then(({ mountGlassMedal }) => {
        if (cancelled) return;
        dispose = mountGlassMedal(host, { ribbon: variant === 'ribbon', onReady: () => setReady(true) });
      })
      .catch((err) => console.warn('[médaille]', err));
    return () => {
      cancelled = true;
      dispose?.();
      setReady(false);
    };
  }, [variant]);

  return (
    <div ref={hostRef} className={`glass-medal glass-medal-${variant} ${ready ? 'is-ready' : ''} ${className}`} aria-hidden="true">
      <img src="brand/medaille.webp" alt="" width={150} height={219} />
    </div>
  );
}
