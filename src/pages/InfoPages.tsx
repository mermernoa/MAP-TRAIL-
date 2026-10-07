import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CONTACT_EMAIL } from '../lib/messages';
import { accountsEnabled } from '../lib/supabase';
import { useCatalog } from '../store/catalog';

export const INFO_LINKS = [
  { to: '/a-propos', label: 'À propos' },
  { to: '/contact', label: 'Contact' },
  { to: '/signaler', label: 'Signaler une erreur' },
  { to: '/proposer-une-course', label: 'Proposer une course' },
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Confidentialité' },
];

/** Gabarit commun des pages d'information : titre, sommaire des pages voisines, contenu. */
export function InfoLayout({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  useEffect(() => {
    document.title = `${title} – Take Ton Trail`;
    return () => {
      document.title = 'Take Ton Trail';
    };
  }, [title]);
  return (
    <div className="info-page">
      <header className="info-head">
        <h1>{title}</h1>
        {lede && <p className="info-lede">{lede}</p>}
      </header>
      <div className="info-layout">
        <nav className="info-nav" aria-label="Informations">
          <ul>
            {INFO_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to}>{l.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="info-content">{children}</div>
      </div>
    </div>
  );
}

export function AboutPage() {
  const count = useCatalog((s) => s.events.length);
  return (
    <InfoLayout
      title="À propos"
      lede="Take Ton Trail rassemble les courses de trail de France et d’outre-mer, du petit trail de village à l’ultra mythique, sur une carte en relief et dans un calendrier."
    >
      <section>
        <h2>Pourquoi ce site</h2>
        <p>
          Trouver une course de trail, c’est souvent jongler entre les calendriers, les réseaux sociaux et les sites des
          organisations. Take Ton Trail met tout au même endroit : où, quand, combien de kilomètres et de dénivelé, à quel
          prix, et quand ouvrent les inscriptions. Puis vous gardez vos courses dans votre saison.
        </p>
      </section>
      <section>
        <h2>D’où viennent les informations</h2>
        <p>
          La base compte aujourd’hui {count} événements. Elle est tenue dans un tableur, à partir des sites officiels des
          courses, des plateformes d’inscription et de chronométrage, de Miles Republic, Finishers, Betrail et de l’UTMB Index.
          Chaque fiche indique sa source et la date de sa dernière mise à jour.
        </p>
        <p>
          Les prix sont le tarif de base de l’édition la plus récente publiée par l’organisation. Ils peuvent changer selon
          la date d’inscription ou la licence : vérifiez toujours sur le site de la course avant de vous inscrire.
        </p>
      </section>
      <section>
        <h2>Ce que le site ne fait pas</h2>
        <p>
          Take Ton Trail ne vend pas de dossards et n’organise aucune course. Pour vous inscrire, chaque fiche renvoie vers
          l’organisation ou sa plateforme d’inscription. Le site est indépendant : il n’est lié à aucune organisation ni à
          aucune des plateformes citées.
        </p>
      </section>
      <section>
        <h2>Les photos</h2>
        <p>
          Chaque photo affichée est créditée : auteur, journal, office de tourisme ou plateforme d’origine, avec le lien vers
          l’image. Si vous êtes l’auteur d’une photo et souhaitez la faire retirer ou corriger son crédit,{' '}
          <Link to="/signaler?sujet=photo">dites-le nous</Link> : elle sera retirée rapidement.
        </p>
      </section>
      <section>
        <h2>Participer</h2>
        <p>
          Une date a changé, un prix est faux, une course manque ? <Link to="/signaler">Signalez une erreur</Link> ou{' '}
          <Link to="/proposer-une-course">proposez une course</Link>. Chaque message est lu et la base est corrigée à la main.
        </p>
      </section>
    </InfoLayout>
  );
}

export function LegalPage() {
  return (
    <InfoLayout title="Mentions légales">
      <section>
        <h2>Éditeur</h2>
        <p>
          Take Ton Trail est un site personnel, édité à titre non professionnel. Conformément à l’article 6, III, 2° de la
          loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique, son éditeur, personne physique, a choisi
          de ne pas publier son identité ; ses coordonnées sont tenues à la disposition de l’hébergeur.
        </p>
        <p>
          Pour toute question : <Link to="/contact">formulaire de contact</Link>
          {CONTACT_EMAIL && (
            <>
              {' '}
              ou <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </>
          )}
          .
        </p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <p>
          Site hébergé par GitHub Pages : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis
          (github.com).
        </p>
        {accountsEnabled && (
          <p>Comptes et données des comptes hébergés par Supabase, Inc. (supabase.com).</p>
        )}
      </section>
      <section>
        <h2>Contenus et photos</h2>
        <p>
          Le nom Take Ton Trail, ses logos, ses illustrations et ses textes appartiennent à leur auteur ; toute reproduction
          demande son accord. Les informations sur les courses (dates, distances, prix) sont des données factuelles publiées
          par les organisations, rassemblées et vérifiées pour ce site.
        </p>
        <p>
          Les photos de courses restent la propriété de leurs auteurs ; chacune est créditée avec un lien vers son origine.
          Pour faire retirer une photo ou corriger un crédit, utilisez le formulaire{' '}
          <Link to="/signaler?sujet=photo">Signaler une erreur</Link>.
        </p>
      </section>
      <section>
        <h2>Cartes et relief</h2>
        <p>
          Fonds de carte : © les contributeurs d’OpenStreetMap (ODbL), OpenFreeMap, OpenTopoMap (CC-BY-SA). Imagerie
          satellite : © Esri, Maxar, Earthstar Geographics. Relief : Terrain Tiles (AWS Open Data, Mapzen). Les mentions
          détaillées s’affichent sur chaque carte.
        </p>
      </section>
      <section>
        <h2>Responsabilité</h2>
        <p>
          Les informations sont données à titre indicatif et peuvent changer sans préavis. Seuls le site et le règlement de
          l’organisation font foi : vérifiez-les avant de vous inscrire ou de vous déplacer.
        </p>
      </section>
    </InfoLayout>
  );
}

export function PrivacyPage() {
  return (
    <InfoLayout
      title="Confidentialité"
      lede="Le site fonctionne sans compte, sans publicité et sans mesure d’audience. Voici exactement ce qui est conservé, où, et comment l’effacer."
    >
      <section>
        <h2>Sans compte</h2>
        <p>
          Votre saison, vos courses ajoutées à la main, vos réglages de carte et les traces GPX que vous importez restent dans
          votre navigateur (stockage local). Rien n’est envoyé à nos serveurs. Pour tout effacer, videz les données du site
          dans les réglages de votre navigateur.
        </p>
        <p>
          La localisation n’est demandée que si vous cliquez sur « Près de chez moi » ou « Autour de moi ». Votre position sert
          à filtrer la carte dans votre navigateur et n’est jamais transmise ni conservée.
        </p>
      </section>
      <section>
        <h2>Avec un compte</h2>
        <p>
          Le compte sert à retrouver votre saison sur tous vos appareils et à vous proposer des courses. Il conserve votre
          adresse e-mail, votre mot de passe (chiffré, jamais lisible), le nom et la région que vous indiquez, et votre saison
          (courses, statuts, objectifs, notes). Ces données sont hébergées par Supabase et ne sont ni vendues, ni partagées,
          ni utilisées pour de la publicité.
        </p>
        <p>
          Elles sont gardées tant que le compte existe. Le bouton « Supprimer mon compte », dans la page Mon compte, efface le
          compte et la saison immédiatement et définitivement.
        </p>
      </section>
      <section>
        <h2>Messages</h2>
        <p>
          Les formulaires (contact, signaler une erreur, proposer une course) transmettent votre message et, si vous la
          donnez, votre adresse e-mail pour vous répondre. Les messages sont conservés le temps de traiter la demande, puis
          supprimés au plus tard un an après.
        </p>
      </section>
      <section>
        <h2>Cookies et services extérieurs</h2>
        <p>
          Le site ne dépose aucun cookie publicitaire ni de mesure d’audience. Le seul stockage utilisé est celui nécessaire au
          fonctionnement (saison, réglages, connexion au compte) : il ne demande pas de consentement.
        </p>
        <p>
          Pour s’afficher, les cartes et le relief chargent des images depuis OpenFreeMap, OpenTopoMap, Esri et Amazon Web
          Services, et les photos de courses depuis leur site d’origine. Comme pour toute page web, ces serveurs reçoivent
          l’adresse IP de votre appareil.
        </p>
      </section>
      <section>
        <h2>Vos droits</h2>
        <p>
          Vous pouvez accéder à vos données, les corriger, les exporter (bouton « Sauvegarder » de Ma saison) ou les effacer à
          tout moment. Pour toute question ou demande, <Link to="/contact">écrivez-nous</Link>. Vous pouvez aussi adresser une
          réclamation à la CNIL (cnil.fr).
        </p>
      </section>
    </InfoLayout>
  );
}
