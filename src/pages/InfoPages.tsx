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

/** Date de la dernière mise à jour des mentions légales et de la page Confidentialité. */
const LEGAL_UPDATED = '14 octobre 2026';

/** Une donnée conservée : ce que c'est, pourquoi, combien de temps. */
function DataRow({ what, why, until }: { what: string; why: string; until: string }) {
  return (
    <div>
      <dt>{what}</dt>
      <dd>
        {why} <span className="muted">Conservation : {until}</span>
      </dd>
    </div>
  );
}

export function LegalPage() {
  const professional = Boolean(SITE.legalName);
  return (
    <InfoLayout title="Mentions légales" lede={`Mises à jour le ${LEGAL_UPDATED}.`}>
      <section>
        <h2>Éditeur</h2>
        {professional ? (
          <>
            <p>Le site Take Ton Trail est édité par {SITE.legalName}.</p>
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
          </>
        ) : (
          <p>
            Take Ton Trail est un site personnel, édité par un particulier à titre non professionnel, sans publicité ni vente.
            Comme le permet l’article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie
            numérique, l’éditeur a choisi de ne pas publier son nom : ses coordonnées sont connues de l’hébergeur du site
            (ci-dessous), qui peut les communiquer à la justice sur demande.
          </p>
        )}
        <p>
          Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ou le <Link to="/contact">formulaire de contact</Link>.
        </p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <dl className="legal-facts">
          <div>
            <dt>Site</dt>
            <dd>GitHub Pages, GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (github.com)</dd>
          </div>
          {accountsEnabled && (
            <div>
              <dt>Comptes, messages et traces GPX proposées</dt>
              <dd>Supabase, Inc. (supabase.com), serveurs situés dans l’Union européenne (Irlande)</dd>
            </div>
          )}
        </dl>
      </section>
      <section>
        <h2>D’où viennent les informations</h2>
        <p>
          Les fiches sont rassemblées à la main à partir des sites officiels des courses et de leurs règlements, des
          plateformes d’inscription et de chronométrage, de Miles Republic, Finishers, Betrail, de l’ITRA et de l’UTMB Index.
          Chaque fiche indique sa source et la date de sa dernière mise à jour. Dates, distances, dénivelés et prix sont des
          informations factuelles publiées par les organisations.
        </p>
        <p>
          Quand une information n’est pas publiée, le site l’indique (« non communiqué », « date prévisionnelle ») ou, pour la
          technicité, la marque « estimée » d’après le dénivelé. Les points ITRA et les catégories UTMB Index ne sont affichés
          que lorsqu’ils sont publiés par l’ITRA ou l’UTMB.
        </p>
      </section>
      <section>
        <h2>Marques, contenus et photos</h2>
        <p>
          Le nom Take Ton Trail, ses logos, ses illustrations et ses textes appartiennent à l’éditeur ; toute reproduction
          demande son accord. ITRA, UTMB, UTMB Index et UTMB World Series sont des marques de leurs propriétaires
          respectifs : leurs logos sont affichés uniquement pour indiquer qu’une course est classée, sans lien ni partenariat
          avec ces organisations. Les noms des courses appartiennent à leurs organisations.
        </p>
        <p>
          Les photos de courses restent la propriété de leurs auteurs ; chacune est créditée avec un lien vers son origine.
          Les photos de paysage des massifs sont celles de Take Ton Trail. Pour faire retirer une photo ou corriger un crédit,
          utilise le formulaire <Link to="/signaler?sujet=photo">Signaler une erreur</Link>.
        </p>
        <p>
          Les traces GPX proposées par les coureurs sont vérifiées avant publication. En proposant une trace, tu confirmes
          qu’elle peut être partagée (trace publiée par l’organisation ou enregistrée par toi) et tu acceptes qu’elle soit
          affichée et téléchargeable sur la fiche de la course.
        </p>
      </section>
      <section>
        <h2>Cartes et relief</h2>
        <p>
          Fonds de carte : © les contributeurs d’OpenStreetMap (ODbL), OpenFreeMap, OpenTopoMap (CC-BY-SA). En France,
          les vues Topo et Satellite utilisent le Plan IGN v2 et les photographies aériennes de l’IGN (© IGN –
          Géoplateforme, Licence Ouverte Etalab 2.0). Imagerie satellite hors de France : © Esri, Maxar, Earthstar
          Geographics. Relief : Terrain Tiles (AWS Open Data, Mapzen). Les mentions détaillées s’affichent sur chaque carte.
        </p>
      </section>
      <section>
        <h2>Responsabilité</h2>
        <p>
          Les informations sont données à titre indicatif et peuvent changer sans préavis. Seuls le site et le règlement de
          l’organisation font foi : vérifie-les avant de t’inscrire ou de te déplacer. Take Ton Trail ne vend pas de dossards,
          n’organise aucune course et n’est lié à aucune organisation : les liens vers les sites extérieurs n’engagent pas
          l’éditeur.
        </p>
      </section>
    </InfoLayout>
  );
}

export function PrivacyPage() {
  return (
    <InfoLayout
      title="Confidentialité"
      lede={`Le site fonctionne sans compte, sans publicité et sans traceur. Voici exactement ce qui est conservé, pourquoi, où, combien de temps, et comment l’effacer. Mise à jour le ${LEGAL_UPDATED}.`}
    >
      <section>
        <h2>Qui est responsable de tes données</h2>
        <p>
          L’éditeur de Take Ton Trail (voir les <Link to="/mentions-legales">mentions légales</Link>). Pour toute question :{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Tes données ne sont jamais vendues, louées ni utilisées pour
          de la publicité.
        </p>
      </section>
      <section>
        <h2>Sans compte : tout reste sur ton appareil</h2>
        <p>
          Ces données sont enregistrées dans ton navigateur (stockage local) et ne sont envoyées nulle part. Elles restent
          jusqu’à ce que tu les effaces : bouton « Supprimer » d’une trace, retrait d’une course de Ma saison, ou effacement
          des données du site dans les réglages du navigateur.
        </p>
        <ul>
          <li>Ta saison : courses suivies, statuts, objectifs, notes, et les courses que tu ajoutes à la main.</li>
          <li>Les traces GPX que tu importes sur une fiche.</li>
          <li>Les aides déjà vues (relief 3D) et, le temps de la visite, l’animation d’ouverture de la carte et le bandeau fermé.</li>
        </ul>
        <p>
          La localisation n’est demandée que si tu cliques sur « Près de chez moi » ou « Autour de moi ». Ta position sert à
          filtrer la carte dans ton navigateur et n’est jamais transmise ni conservée.
        </p>
      </section>
      {accountsEnabled && (
        <section>
          <h2>Ce qui est envoyé à Take Ton Trail</h2>
          <dl className="legal-facts legal-data">
            <DataRow
              what="Compte"
              why="Adresse e-mail, mot de passe (chiffré, jamais lisible), nom et région si tu les indiques, et ta saison. Sert à te connecter, à retrouver ta saison sur tous tes appareils et à te proposer des courses (exécution du service que tu demandes en créant un compte)."
              until="tant que le compte existe ; « Supprimer mon compte » (page Mon compte) efface le compte et la saison immédiatement et définitivement."
            />
            <DataRow
              what="Messages des formulaires"
              why="Contact, signaler une erreur, proposer une course : ton message, la page d’où il part et, si tu la donnes, ton adresse e-mail pour te répondre (intérêt légitime : traiter ta demande)."
              until="le temps de traiter la demande, puis suppression au plus tard un an après."
            />
            <DataRow
              what="Traces GPX proposées"
              why="Le fichier, le mot facultatif qui l’accompagne et, si tu es connecté, le lien avec ton compte. Sert à vérifier la trace puis à l’afficher sur la fiche. Une trace publiée ne montre ni ton nom ni ton mot."
              until="une trace refusée est supprimée ; une trace validée reste en ligne tant que la fiche existe (tu peux demander son retrait à tout moment)."
            />
            <DataRow
              what="Pages vues"
              why="Un simple total par jour et par page (par exemple « fiche SaintéLyon : 42 vues le 12 octobre »), sans cookie, sans adresse IP et sans identifiant : il ne permet de reconnaître personne. Sert à savoir quelles pages sont utiles."
              until="au plus deux ans."
            />
          </dl>
          <p>
            Ces données sont hébergées par Supabase, dans l’Union européenne (Irlande). Les e-mails du compte (confirmation,
            mot de passe oublié) partent depuis l’adresse {CONTACT_EMAIL}, via Gmail (Google). Seul l’éditeur, depuis son
            espace d’administration protégé, peut lire les messages, la liste des comptes et les traces proposées. Pour assurer
            la sécurité du service, Supabase enregistre aussi des journaux techniques de connexion (adresse IP, navigateur),
            conservés quelques jours.
          </p>
        </section>
      )}
      <section>
        <h2>Cookies et services extérieurs</h2>
        <p>
          Le site ne dépose aucun cookie publicitaire, de réseau social ni de mesure d’audience. Le seul stockage utilisé est
          celui nécessaire au fonctionnement (saison, réglages, connexion au compte) : il ne demande donc pas de
          consentement.
        </p>
        <p>
          Comme pour toute page web, certains serveurs reçoivent l’adresse IP de ton appareil pour t’envoyer leurs fichiers :
          GitHub Pages (le site lui-même, États-Unis), OpenFreeMap, OpenTopoMap, l’IGN (Géoplateforme), Esri et Amazon Web
          Services (cartes et relief),
          les sites d’origine des photos de courses, et Supabase si tu utilises un compte, les formulaires ou les traces
          proposées. Ils ne reçoivent rien d’autre de Take Ton Trail.
        </p>
      </section>
      <section>
        <h2>Tes droits</h2>
        <p>
          Tu peux accéder à tes données, les corriger, les exporter (bouton « Sauvegarder » de Ma saison), les effacer, ou
          t’opposer à leur utilisation, à tout moment. La plupart se font directement sur le site (Mon compte, Ma saison) ;
          pour le reste, écris à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : réponse sous un mois au plus. Si tu
          estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </section>
    </InfoLayout>
  );
}
