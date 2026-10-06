import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Si une page plante, on l'affiche clairement au lieu de laisser un écran vide.
 * La barrière est remontée à chaque changement de page (clé = adresse).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[page]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="page-message" role="alert">
        <img src="brand/3t.webp" alt="" width={136} height={100} />
        <h1>Cette page n’a pas pu s’afficher</h1>
        <p>Rechargez la page. Si le problème revient, envoyez-nous le message ci-dessous.</p>
        <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
          Recharger la page
        </button>
        <details className="error-details">
          <summary>Détail technique</summary>
          <pre>{`${error.name}: ${error.message}\n${navigator.userAgent}`}</pre>
        </details>
      </div>
    );
  }
}
