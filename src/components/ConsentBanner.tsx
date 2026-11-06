import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { type Consent, GA_ID, loadAnalytics, onConsentChange, readConsent, setConsent, trackPageView } from '../lib/analytics';

/** Bandeau de consentement à la mesure d'audience, et envoi des pages vues si accepté. */
export function ConsentBanner() {
  const [consent, setLocal] = useState<Consent>(() => (GA_ID ? readConsent() : 'refuse'));
  const { pathname, search } = useLocation();

  useEffect(() => {
    const off = onConsentChange(setLocal);
    return off;
  }, []);
  useEffect(() => {
    if (consent === 'accepte') loadAnalytics();
  }, [consent]);
  useEffect(() => {
    if (consent !== 'accepte') return;
    // Laisse la page poser son titre avant d'envoyer la vue.
    const t = window.setTimeout(() => trackPageView(pathname + search, document.title), 300);
    return () => window.clearTimeout(t);
  }, [consent, pathname, search]);

  if (!GA_ID || consent !== null) return null;
  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label="Mesure d’audience">
      <p>
        <b>On peut compter tes visites ?</b> Avec ton accord, Google Analytics mesure la fréquentation du site (pages vues,
        durée, appareil) pour savoir ce qui est utile. Aucune publicité. <Link to="/confidentialite">En savoir plus</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="button" onClick={() => setConsent('refuse')}>
          Refuser
        </button>
        <button type="button" className="button button-primary" onClick={() => setConsent('accepte')}>
          Accepter
        </button>
      </div>
    </div>
  );
}
