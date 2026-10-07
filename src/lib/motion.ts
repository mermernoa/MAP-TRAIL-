import { useEffect, useRef } from 'react';

let introEnd = 0;

/** Le rideau d'ouverture couvre la page jusqu'à `ms` d'ici : les animations l'attendent. */
export function holdForIntro(ms: number) {
  introEnd = performance.now() + ms;
}

/** Temps restant avant la fin du rideau d'ouverture, en millisecondes. */
export function introDelay(): number {
  return typeof performance === 'undefined' ? 0 : Math.max(0, introEnd - performance.now());
}

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

/**
 * Appelle `cb` une fois par élément, quand il entre à l'écran ou qu'on l'a
 * dépassé (un saut de défilement ne le laisse pas masqué). Renvoie l'arrêt.
 */
export function whenInView(elements: Element[], cb: (el: Element) => void, bottomMargin = 0.08): () => void {
  const pending = new Set(elements);
  const fire = (el: Element) => {
    if (!pending.delete(el)) return;
    observer?.unobserve(el);
    cb(el);
  };
  const check = () => {
    const limit = window.innerHeight * (1 - bottomMargin);
    for (const el of [...pending]) if (el.getBoundingClientRect().top < limit) fire(el);
  };
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) if (entry.isIntersecting) fire(entry.target);
          },
          { rootMargin: `0px 0px -${bottomMargin * 100}% 0px` },
        );
  for (const el of elements) observer?.observe(el);
  let raf = 0;
  const onScroll = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        check();
      });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  check();
  return () => {
    observer?.disconnect();
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
  };
}

/**
 * Apparition au défilement : les éléments visés montent et se dévoilent en
 * entrant à l'écran. Avec animations réduites, rien n'est masqué.
 */
export function useReveal<T extends HTMLElement>(selector: string, deps: unknown[] = []) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const items = [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => !el.classList.contains('is-revealed'));
    let batch = 0;
    let frame = 0;
    for (const el of items) el.classList.add('reveal-armed');
    const stop = whenInView(items, (target) => {
      const el = target as HTMLElement;
      // Léger décalage entre éléments révélés ensemble.
      el.style.setProperty('--reveal-delay', `${Math.round(introDelay()) + Math.min(batch++, 5) * 70}ms`);
      el.classList.add('is-revealed');
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => (batch = 0));
    });
    return () => {
      stop();
      cancelAnimationFrame(frame);
      // Rien ne doit rester masqué si le composant change.
      for (const el of items) el.classList.add('is-revealed');
    };
    // Les dépendances sont fournies par l'appelant : on réarme quand le contenu change.
  }, deps);
  return ref;
}

/**
 * Inclinaison 3D au survol (souris uniquement) des éléments visés, par
 * délégation : un seul écouteur pour toute l'application.
 */
export function useTilt(selector: string, maxDeg = 5) {
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let current: HTMLElement | null = null;
    const reset = (el: HTMLElement) => {
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
      el.classList.remove('is-tilting');
    };
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(selector) ?? null;
      if (current && current !== el) reset(current);
      current = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--tilt-x', `${(x * maxDeg * 2).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${(-y * maxDeg * 2).toFixed(2)}deg`);
      el.classList.add('is-tilting');
    };
    const onLeave = () => {
      if (current) reset(current);
      current = null;
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (current) reset(current);
    };
  }, [selector, maxDeg]);
}
