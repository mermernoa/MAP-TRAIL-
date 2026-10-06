import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Un effet écrit `useEffect(() => appel(), …)` renvoie la valeur de l'appel, que React
 * exécute comme nettoyage. Chrome récent renvoie une promesse depuis window.scrollTo :
 * le changement de page plantait et vidait l'écran.
 */
describe('effets React', () => {
  it('ne renvoient rien d’autre qu’une fonction de nettoyage', () => {
    const offenders = sources('src').flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
        .filter(({ line }) => /use(Layout|Insertion)?Effect\(\s*\(\)\s*=>\s*(?!\{)\S/.test(line))
        .map(({ at }) => at),
    );
    expect(offenders).toEqual([]);
  });
});
