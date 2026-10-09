# Take Ton Trail

La carte et le calendrier des trails, du plus confidentiel au plus mythique.

- **Accueil** (`#/`) : une nuit en relief dessinée en lignes de crête, un sentier où montent des frontales jusqu'à la lune et au logo 3T, la recherche (courses, massifs, collections, lieux) et trois portes : près de chez moi, ce week-end (ou le prochain week-end de course), les mythiques.
- **Collections** (`#/collection/…`) : premiers ultras, nocturnes d'Halloween, moins de 20 €, premier dossard, fin d'année, hiver en montagne, au soleil l'hiver, en équipe, mythiques (`src/lib/collections.ts`).
- **Massifs** (`#/massif/…`) : relief 3D du massif, texte court, photo de course créditée et courses à venir (`src/lib/massifs.ts`). `#/explorer` réunit collections et massifs.
- **Pages d'information** : à propos, contact, signaler une erreur (lien sur chaque fiche), proposer une course, mentions légales, confidentialité.
- **Carte interactive** (`#/carte`) : zoom, regroupement des repères, survol, sélection, aperçu ; fonds plan ombré, topo et satellite ; globe à l'ouverture ; **relief 3D** accentué selon le zoom, sous un ciel teinté de rose, que l'on parcourt comme dans Street View (glisser pour regarder, trackpad, clavier ZQSD ou flèches, joystick à l'écran, manette).
- **Filtres** communs à la carte et au calendrier : distance, dénivelé, technicité, type de course (court, long, ultra, nocturne, urbain, KV), format (solo, duo, relais), massif, région, rayon autour de soi, période, notoriété, points ITRA, catégorie UTMB Index, circuits, prix maximum, inscriptions ouvertes, courses complètes masquées.
- **Calendrier** en vues mois, année et liste, avec les ouvertures et clôtures d'inscription.
- **Fiche course** : photo de la base (ou relief 3D du lieu en lente rotation), chaque parcours avec ses chiffres, son prix, son lien d'inscription et le document demandé, profil altimétrique, carte du tracé avec relief 3D et **survol du parcours** (la caméra suit la trace GPX, le profil avance en même temps), import et export GPX, dates importantes (export agenda) et liens utiles.
- **Mon compte** : saison synchronisée entre appareils et courses proposées d'après celles déjà choisies.
- **Ma saison** : statut, priorité A/B/C, objectif ou temps réalisé, notes, frise des 12 prochains mois, cumuls, alertes d'inscription et de récupération, export agenda, sauvegarde JSON et courses hors catalogue.

Le site reste lisible sans carte graphique : relief, globe et survol 3D ne s'activent qu'avec une accélération matérielle, et toutes les animations (chiffres qui défilent, apparitions au défilement, parallaxe) s'effacent si le système demande de réduire les animations.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests (Vitest)
npm run build      # site statique dans dist/
```

Ajoutez `?today=2026-10-06` à l'URL pour figer la date du jour (démonstrations, captures).

## Base des courses

La source de vérité est la feuille Google **« Maps Trail - Base des courses »**, onglet **Courses** (une ligne par parcours, voir l'onglet Guide). Le site lit `public/data/races.json`, généré depuis cette feuille :

```bash
npm run import:sheet                         # export CSV de la feuille (partage par lien requis)
npm run import:sheet -- --csv courses.csv    # fichier CSV téléchargé depuis Google Sheets
SHEET_CSV_URL=<lien CSV> npm run import:sheet
```

Règles d'import (`src/lib/sheetImport.ts`) :

- seules les lignes aux statuts **Validé**, **Prêt** ou **En ligne** sont publiées ;
- les lignes d'un même événement (EVT001-A, EVT001-B…) forment une fiche ; son identifiant (`evt001-nom-de-la-course`) reste valable si le nom change ;
- une technicité vide est estimée depuis le D+ par km (barème du Guide) ; un D+ vide reste « non communiqué » ;
- les prix saisis en centimes (1 200,00 € pour 12 €) sont corrigés et listés dans le rapport ;
- les liens photo qui ne pointent pas vers une image (pages web, vignettes Google) sont ignorés.

Chaque import écrit **`data/rapport-import.md`** : lignes ignorées et points à corriger dans la feuille.

### Synchronisation automatique

Le workflow **Synchronisation de la feuille** (`.github/workflows/sync-sheet.yml`) relance l'import, les tests, puis publie la base mise à jour et redéploie le site.

1. Rendez la feuille lisible par lien (Partager → Toute personne disposant du lien → Lecteur), ou publiez l'onglet Courses au format CSV (Fichier → Partager → Publier sur le Web) et enregistrez ce lien dans le secret de dépôt `SHEET_CSV_URL`.
2. Lancez-le à la main depuis l'onglet Actions, ou créez la variable de dépôt `SHEET_SYNC` = `on` pour une synchronisation chaque matin.

## Identité visuelle

Charte Take Ton Trail : polices **Chewy** (titres, embarquée via `@fontsource/chewy`) et **Tahoma** (texte, police système avec repli Verdana), couleurs `#ffffff`, `#fe66c4`, `#071c3f`, `#c554a5`, `#854183`, `#472f61` (`src/styles/tokens.css`).
Les fichiers d'origine sont dans `brand-sources/` ; les versions détourées utilisées par le site sont dans `public/brand/` (logo, TTT, 3T, médaille, boussole, barre de progression).

## Déploiement

Le workflow `.github/workflows/pages.yml` publie le site sur GitHub Pages à chaque push sur `main` ou sur la branche de travail `claude/interactive-trails-map-rxpucs`, et après chaque synchronisation de la feuille.
Activez-le une fois dans **Settings → Pages → Build and deployment → Source : GitHub Actions**.

**Sauvegarde** : la version du site d'avant la refonte immersive 3D (commit `a5b225b`, 6 octobre 2026) est construite à chaque déploiement et reste en ligne sous `/sauvegarde/` (par exemple https://mermernoa.github.io/map-trail-/sauvegarde/). Pour y revenir entièrement : `git revert` des commits suivants, ou `git checkout a5b225b -- .` puis commit.

## Fonds de carte

Aucune clé d'API n'est nécessaire par défaut :

| Fond | Source | Variable pour le remplacer |
| --- | --- | --- |
| Plan | OpenFreeMap (Positron) + ombrage | `VITE_STYLE_PLAN` |
| Topo | OpenTopoMap | `VITE_TOPO_TILES` (URLs séparées par des virgules) |
| Satellite | Esri World Imagery | `VITE_SATELLITE_TILES` |
| Relief | Terrain Tiles (AWS Open Data) | `VITE_DEM_TILES` |
| Polices des étiquettes | OpenFreeMap | `VITE_GLYPHS_URL` |

Pour un usage commercial ou à fort trafic, passez sur un fournisseur avec clé (MapTiler, Stadia, IGN Géoplateforme…) et respectez les conditions de chaque source.

## Comptes

La page **Mon compte** (`#/compte`) permet de créer un compte Take Ton Trail : la saison est alors enregistrée en ligne et synchronisée entre ordinateur et téléphone (la version modifiée le plus récemment l'emporte, les suppressions sont propagées). La page propose aussi des courses d'après celles déjà choisies (`src/lib/suggestions.ts` : distance et dénivelé voisins, un cran au-dessus de la plus longue course, mêmes massifs et circuits, assez de récupération entre deux courses) ; ces propositions fonctionnent aussi sans compte.

Les comptes reposent sur [Supabase](https://supabase.com) (offre gratuite). Pour les activer :

1. Créez un projet Supabase, puis exécutez `supabase/schema.sql` dans son éditeur SQL (table `seasons` protégée par des règles d'accès par utilisateur, fonction de suppression de compte).
2. Dans **Authentication → URL Configuration**, indiquez l'adresse du site (`https://mermernoa.github.io/map-trail-/`) comme Site URL et ajoutez-la aux Redirect URLs.
3. Renseignez l'URL du projet et sa clé publiable (`sb_publishable_…`, faite pour être publique) dans `.env.production` : `VITE_SUPABASE_URL=…` et `VITE_SUPABASE_PUBLISHABLE_KEY=…`. Ne mettez jamais la clé secrète dans le site.
4. Pour envoyer les e-mails de confirmation à grande échelle, configurez un serveur SMTP (Authentication → Emails) : l'envoi intégré de Supabase est limité à quelques messages par heure.

Sans ces réglages, la page indique que les comptes arrivent bientôt et la saison reste enregistrée dans le navigateur.

### Formulaires

Contact, signaler une erreur et proposer une course enregistrent les messages dans la table `messages` de Supabase (créée par `supabase/schema.sql`, envoi possible sans compte, lecture impossible par l'API : on les lit dans le tableau de bord). Sans Supabase, les formulaires ouvrent la messagerie du visiteur avec le message prêt à partir vers l'adresse de contact, taketontrail@gmail.com (`VITE_CONTACT_EMAIL` dans `.env.production`).

L'identité de l'éditeur affichée dans les mentions légales (raison sociale, adresse, SIRET, responsable de la publication) se règle dans `src/lib/site.ts` : les champs vides ne s'affichent pas.

## Photos

Une photo n'est affichée qu'avec son crédit (colonne « Crédit photo » de la feuille), qui renvoie vers l'image d'origine. Les demandes de retrait passent par « Signaler une erreur ».

## Stockage

Sans compte, la saison et les courses personnelles restent dans le navigateur (`localStorage`), les GPX importés dans IndexedDB. Avec un compte, la saison (pas les GPX) est aussi enregistrée dans Supabase.

## Pile technique

Vite, React 19, TypeScript, MapLibre GL JS 6, Supabase (comptes, chargé à la demande), Zustand, Vitest, tsx (script d'import).
