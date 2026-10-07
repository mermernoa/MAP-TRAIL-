import { useEffect, useRef, useState } from 'react';
import { introDelay, prefersReducedMotion, whenInView } from '../lib/motion';

interface Props {
  value: number;
  format: (n: number) => string;
  /** Durée de l'animation, en millisecondes. */
  duration?: number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Chiffre qui défile jusqu'à sa valeur quand il apparaît à l'écran, puis d'une
 * valeur à l'autre quand elle change. Les lecteurs d'écran lisent la valeur finale.
 */
export function CountUp({ value, format, duration = 900 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = prefersReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [seen, setSeen] = useState(reduce);

  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    return whenInView([el], () => setSeen(true), 0);
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    if (reduce) {
      setShown(value);
      return;
    }
    const from = shownRef.current;
    const decimals = Number.isInteger(value) ? 0 : 1;
    // Pendant le rideau d'ouverture, le compteur attend d'être visible.
    const start = performance.now() + introDelay();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const v = from + (value - from) * easeOut(t);
      setShown(t < 1 ? Math.round(v * 10 ** decimals) / 10 ** decimals : value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, seen, duration, reduce]);

  return (
    <>
      <span ref={ref} className="count-up" aria-hidden="true">
        {format(shown)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
