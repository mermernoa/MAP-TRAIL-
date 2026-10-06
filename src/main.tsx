import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/chewy/400.css';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';

const container = document.getElementById('root') as HTMLElement;

/** Dernier filet : une erreur qui échappe aux barrières des pages s'affiche au lieu d'un écran vide. */
function showFatalError(error: unknown) {
  const box = document.createElement('div');
  box.className = 'page-message';
  box.setAttribute('role', 'alert');
  box.innerHTML = `
    <img src="brand/3t.webp" alt="" width="136" height="100" />
    <h1>Le site a rencontré un problème</h1>
    <p>Rechargez la page. Si le problème revient, envoyez-nous le message ci-dessous.</p>
    <button type="button" class="button button-primary">Recharger la page</button>
    <details class="error-details"><summary>Détail technique</summary><pre></pre></details>`;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  (box.querySelector('pre') as HTMLElement).textContent = `${message}\n${navigator.userAgent}`;
  box.querySelector('button')?.addEventListener('click', () => window.location.reload());
  container.replaceChildren(box);
}

createRoot(container, {
  onUncaughtError(error, info) {
    console.error('[site]', error, info.componentStack);
    // React vide la racine après cet appel : le message est posé juste après.
    setTimeout(() => showFatalError(error), 0);
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
