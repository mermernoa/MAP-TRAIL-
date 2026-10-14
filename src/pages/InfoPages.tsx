import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CONTACT_EMAIL } from '../lib/messages';
import { SITE } from '../lib/site';
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
          prix, et quand ouvrent les inscriptions. Puis tu gardes tes courses dans ta saison.
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
          la date d’inscription ou la licence : vérifie toujours sur le site de la course avant de t’inscrire.
        </p>
      </section>
      <section>
        <h2>Ce que le site ne fait pas</h2>
        <p>
          Take Ton Trail ne vend pas de dossards et n’organise aucune course. Pour t’inscrire, chaque fiche renvoie vers
          l’organisation ou sa plateforme d’inscription. Le site est indépendant : il n’est lié à aucune organisation ni à
          aucune des plateformes citées.
        </p>
      </section>
      <section>
        <h2>Les photos</h2>
        <p>
          Chaque photo affichée est créditée : auteur, journal, office de tourisme ou plateforme d’origine, avec le lien vers
          l’image. Si tu es l’auteur d’une photo et souhaites la faire retirer ou corriger son crédit,{' '}
          <Link to="/signaler?sujet=photo">dites-le nous</Link> : elle sera retirée rapidement.
        </p>
      </section>
      <section>
        <h2>Participer</h2>
        <p>
          Une date a changé, un prix est faux, une course manque ? <Link to="/signaler">Signale une erreur</Link> ou{' '}
          <Link to="/proposer-une-course">propose une course</Link>. Chaque message est lu et la base est corrigée à la main.
          Pour tout le reste : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
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
        <p>Le site Take Ton Trail est édité par {SITE.legalName || SITE.name}.</p>
        {(SITE.address || SITE.siret || SITE.publicationDirector) && (
          <dl className="legal-facts">
            {SITE.address && (
              <div>
                <dt>Adresse</dt>
                <dd>{SITE.address}</dd>
              </div>
            )}
            {SITE.siret && (
              <div>
                <dt>SIRET</dt>
                <dd>{SITE.siret}</dd>
              </div>
            )}
            {SITE.publicationDirector && (
              <div>
                <dt>Responsable de la publication</dt>
                <dd>{SITE.publicationDirector}</dd>
              </div>
            )}
          </dl>
        )}
        <p>
          Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ou le <Link to="/contact">formulaire de contact</Link>.
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
          Pour faire retirer une photo ou corriger un crédit, utilise le formulaire{' '}
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
          l’organisation font foi : vérifie-les avant de t’inscrire ou de te déplacer.
        </p>
      </section>
    </InfoLayout>
  );
}

export function PrivacyPage() {
  return (
    <InfoLayout
      title="Confidentialité"
      lede="Le site fonctionne sans compte, sans publicité et sans traceur. Voici exactement ce qui est conservé, où, et comment l’effacer."
    >
      <section>
        <h2>Sans compte</h2>
        <p>
          Ta saison, tes courses ajoutées à la main, tes réglages de carte et les traces GPX que tu importes restent dans
          ton navigateur (stockage local). Rien n’est envoyé à nos serveurs, sauf si tu choisis de proposer une trace (voir
          plus bas). Pour tout effacer, vide les données du site dans les réglages de ton navigateur.
        </p>
        <p>
          La localisation n’est demandée que si tu cliques sur « Près de chez moi » ou « Autour de moi ». Ta position sert
          à filtrer la carte dans ton navigateur et n’est jamais transmise ni conservée.
        </p>
      </section>
      <section>
        <h2>Avec un compte</h2>
        <p>
          Le compte sert à retrouver ta saison sur tous tes appareils et à te proposer des courses. Il conserve ton
          adresse e-mail, ton mot de passe (chiffré, jamais lisible), le nom et la région que tu indiques, et ta saison
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
          Les formulaires (contact, signaler une erreur, proposer une course) transmettent ton message et, si tu la
          donnes, ton adresse e-mail pour te répondre. Les messages sont conservés le temps de traiter la demande, puis
          supprimés au plus tard un an après.
        </p>
        <p>
          Quand tu proposes une trace GPX depuis une fiche, le fichier et le mot facultatif qui l’accompagne sont envoyés à
          Take Ton Trail, avec ton compte si tu es connecté. Une trace validée s’affiche sur la fiche pour tout le monde, sans
          ton nom ni ton mot ; une trace refusée est supprimée.
        </p>
      </section>
      <section>
        <h2>Cookies et services extérieurs</h2>
        <p>
          Le site ne dépose aucun cookie publicitaire ni de mesure d’audience. Le seul stockage utilisé est celui nécessaire au
          fonctionnement (saison, réglages, connexion au compte) : il ne demande pas de consentement.
        </p>
        <p>
          Pour savoir quelles pages servent, le site compte les pages vues : un simple total par jour et par page (par
          exemple « fiche SaintéLyon : 42 vues le 12 octobre »), sans cookie, sans adresse IP et sans aucun identifiant. Ce
          compteur ne permet de reconnaître personne.
        </p>
        <p>
          Pour s’afficher, les cartes et le relief chargent des images depuis OpenFreeMap, OpenTopoMap, Esri et Amazon Web
          Services, et les photos de courses depuis leur site d’origine. Comme pour toute page web, ces serveurs reçoivent
          l’adresse IP de ton appareil.
        </p>
      </section>
      <section>
        <h2>Tes droits</h2>
        <p>
          Tu peux accéder à tes données, les corriger, les exporter (bouton « Sauvegarder » de Ma saison) ou les effacer à
          tout moment. Pour toute question ou demande, écris à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Tu
          peux aussi adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </section>
    </InfoLayout>
  );
}
