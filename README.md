# Take Ton Trail

La carte et le calendrier des trails, du plus confidentiel au plus mythique.

- **Carte interactive** : zoom, regroupement des repères, survol, sélection, aperçu ; fonds plan ombré, topo et satellite ; globe à l'ouverture ; **relief 3D** accentué selon le zoom, sous un ciel teinté de rose, que l'on parcourt comme dans Street View (glisser pour regarder, trackpad, clavier ZQSD ou flèches, joystick à l'écran, manette).
- **Filtres** communs à la carte et au calendrier : distance, dénivelé, technicité, type de course (court, long, ultra, nocturne, urbain, KV), format (solo, duo, relais), massif, région, rayon autour de soi, période, notoriété, points ITRA, catégorie UTMB Index, circuits, prix maximum, inscriptions ouvertes, courses complètes masquées.
- **Calendrier** en vues mois, année et liste, avec les ouvertures et clôtures d'inscription.
- **Fiche course** : photo de la base (ou relief 3D du lieu), chaque parcours avec ses chiffres, son prix, son lien d'inscription et le document demandé, profil altimétrique, carte du tracé, import et export GPX, dates importantes (export agenda) et liens utiles.
- **Ma saison** : statut, priorité A/B/C, objectif ou temps réalisé, notes, frise des 12 prochains mois, cumuls, alertes d'inscription et de récupération, export agenda, sauvegarde JSON et courses hors catalogue.

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

## Stockage

La saison et les courses personnelles restent dans le navigateur (`localStorage`), les GPX importés dans IndexedDB. Rien n'est envoyé à un serveur.

## Pile technique

Vite, React 19, TypeScript, MapLibre GL JS 6, Zustand, Vitest, tsx (script d'import).
