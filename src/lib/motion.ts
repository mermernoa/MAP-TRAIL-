import { useEffect, useRef } from 'react';

/** Vrai si le visiteur a demandé de limiter les animations. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Parallaxe : expose `--parallax` (en px) sur l'élément, proportionnel à son
 * défilement hors du haut de l'écran. Le CSS décide de ce qui bouge.
 */
export function useParallax<T extends HTMLElement>(factor = 0.3) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0) return;
      el.style.setProperty('--parallax', `${(Math.max(0, -rect.top) * factor).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [factor]);
  return ref;
}
