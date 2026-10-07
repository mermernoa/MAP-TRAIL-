import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { holdForIntro } from '../lib/motion';

interface Props {
  /** Données chargées : la jauge finit de se remplir puis s'efface. */
  done: boolean;
  onFinish: () => void;
}

/** Temps minimum à l'écran, pour que la jauge ait le temps de se remplir. */
const MIN_MS = 500;
const FILL_MS = 380;
const HOLD_MS = 140;
const LEAVE_MS = 300;

/**
 * Écran de chargement : la jauge Take Ton Trail se remplit pendant que les
 * courses arrivent, se complète, puis l'écran s'efface sur la page.
 */
export function LoadingGauge({ done, onFinish }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(performance.now());
  const doneRef = useRef(done);
  doneRef.current = done;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  // Avant que les pages ne lancent leurs animations : elles attendent la fin de l'écran.
  useLayoutEffect(() => {
    if (!done) return;
    const remaining = Math.max(0, MIN_MS - (performance.now() - started.current));
    holdForIntro(remaining + FILL_MS + HOLD_MS + LEAVE_MS * 0.5);
  }, [done]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let timer = 0;
    let last = performance.now();
    let p = 0;
    let doneAt = 0;
    let from = 0;
    const show = (v: number) => {
      el.style.setProperty('--p', v.toFixed(4));
      el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    };
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!doneRef.current || now - started.current < MIN_MS) {
        // Avance vite au début puis ralentit, sans jamais atteindre le bout avant la fin.
        p += (0.9 - p) * (1 - Math.exp(-dt * 2.4));
      } else {
        if (!doneAt) {
          doneAt = now;
          from = p;
        }
        const t = Math.min(1, (now - doneAt) / FILL_MS);
        p = from + (1 - from) * (1 - (1 - t) ** 3);
        if (t >= 1) {
          show(1);
          timer = window.setTimeout(() => {
            setLeaving(true);
            timer = window.setTimeout(() => finishRef.current(), LEAVE_MS);
          }, HOLD_MS);
          return;
        }
      }
      show(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`gauge-loader ${leaving ? 'is-leaving' : ''}`}
      role="progressbar"
      aria-label="Chargement des courses"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <div className="gauge">
        <img src="brand/progression-vide.webp" alt="" width={280} height={92} />
        <img className="gauge-fill" src="brand/progression-pleine.webp" alt="" width={280} height={92} />
      </div>
      <p>Chargement des courses…</p>
    </div>
  );
}
