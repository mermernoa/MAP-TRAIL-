# Balise

La carte et le calendrier des trails, du plus confidentiel au plus mythique.

Balise permet de :

- **explorer une carte interactive** des courses (zoom, regroupement des repères, survol, sélection, aperçu), avec trois fonds de carte (plan ombré, topo, satellite) et un mode relief 3D ;
- **filtrer** par distance, dénivelé, technicité, points ITRA, catégorie UTMB Index, circuit (UTMB World Series, Golden Trail Series…), pays, rayon autour de soi, période, notoriété et inscriptions ouvertes ;
- **parcourir le même catalogue en calendrier** (mois, année ou liste), avec les dates d'ouverture et de clôture des inscriptions et les tirages au sort ;
- **ouvrir la fiche d'une course** : en-tête en relief 3D du lieu réel, tous les parcours, statistiques et index, profil altimétrique interactif, carte du tracé, points de passage, dates importantes (export `.ics`) et liens utiles ;
- **importer le GPX** d'un parcours (glisser-déposer) : tracé sur la carte et dans l'en-tête, profil détaillé, distance et D+ recalculés, re-téléchargement du fichier ;
- **construire sa saison** dans l'onglet « Ma saison » : statut (envie, inscription prévue, inscrit, terminée), priorité A/B/C, objectif ou temps réalisé, notes, frise de l'année, cumul km / D+ / points ITRA / Running Stones, alertes d'inscription et d'enchaînement trop serré, export vers l'agenda, sauvegarde et restauration JSON, ajout de courses hors catalogue.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (Vitest)
npm run build      # build statique dans dist/
```

Ajoutez `?today=2026-09-29` à l'URL pour figer la date du jour (démonstrations, captures).

## Déploiement

Le workflow `.github/workflows/pages.yml` publie le site sur GitHub Pages à chaque push sur `main`.
Activez-le une fois dans **Settings → Pages → Build and deployment → Source : GitHub Actions**.
Le build utilise des chemins relatifs et un routage par fragment (`#/course/...`) : il fonctionne sur n'importe quel hébergement statique.

## Données

Le catalogue (`src/data/races-*.ts`) contient une soixantaine d'événements réels en France, en Europe et dans le monde, de la course locale au 100 miles mythique.
**Ces données sont indicatives** : distances, dénivelés et horaires viennent des éditions précédentes, les dates des prochaines éditions sont prévisionnelles (`dateStatus: 'estimated'`) et les dates d'inscription sont estimées. L'interface le signale et renvoie vers les sites officiels.

- Les points ITRA et la catégorie UTMB Index sont calculés depuis les km-effort (distance + D+/100) quand la valeur officielle n'est pas renseignée.
- Les Running Stones sont calculées pour les événements UTMB World Series (hors finales).
- Les profils « simplifiés » sont reconstitués à partir des principaux points de passage ; importez le GPX officiel pour un profil exact.

### Ajouter une course au catalogue

Ajoutez un objet `RaceEvent` (voir `src/data/types.ts`) dans le fichier de la bonne zone, puis lancez `npm test` : les tests vérifient l'unicité des identifiants, la cohérence des dates (chaque départ dans les dates de l'événement, inscriptions avant la course) et des points de passage.

Les courses ajoutées depuis l'interface (« Course hors catalogue ») sont stockées dans le navigateur et incluses dans la sauvegarde JSON.

## Fonds de carte

Aucune clé d'API n'est nécessaire par défaut :

| Fond | Source | Variable pour le remplacer |
| --- | --- | --- |
| Plan | OpenFreeMap (Positron) + ombrage | `VITE_STYLE_PLAN` (URL d'un style MapLibre) |
| Topo | OpenTopoMap | `VITE_TOPO_TILES` (URLs de tuiles séparées par des virgules) |
| Satellite | Esri World Imagery | `VITE_SATELLITE_TILES` |
| Relief | Terrain Tiles (AWS Open Data, Terrarium) | `VITE_DEM_TILES` |
| Polices des étiquettes | OpenFreeMap | `VITE_GLYPHS_URL` |

Pour un usage commercial ou à fort trafic, passez sur un fournisseur avec clé (MapTiler, Stadia, IGN Géoplateforme…) en renseignant ces variables au build, et respectez les conditions d'utilisation de chaque source.

## Stockage

Tout reste dans le navigateur : la saison et les courses personnelles dans `localStorage`, les GPX importés dans IndexedDB. Rien n'est envoyé à un serveur.

## Pile technique

Vite, React 19, TypeScript, MapLibre GL JS 6, Zustand, Vitest. Police : Archivo (variable, largeur 62–125 %).
