/** Technicité du terrain, de 1 (chemins roulants) à 5 (très technique, hors sentier). */
export type Technicity = 1 | 2 | 3 | 4 | 5;

/** Notoriété de l'événement, du plus confidentiel (1) au plus mythique (5). */
export type Popularity = 1 | 2 | 3 | 4 | 5;

/** Catégories de l'UTMB Index, calculées à partir des km-effort. */
export type UtmbCategory = '20K' | '50K' | '100K' | '100M';

/** Un point de passage (ravitaillement, col, sommet…) d'un parcours. */
export interface Checkpoint {
  name: string;
  km: number;
  /** Altitude en mètres. */
  alt: number;
}

/** Un parcours (une distance) proposé par un événement. */
export interface Course {
  id: string;
  name: string;
  distanceKm: number;
  /** Dénivelé positif en mètres. */
  elevationGain: number;
  /** Dénivelé négatif en mètres (si différent du D+). */
  elevationLoss?: number;
  /** Date et heure de départ, au format ISO local (YYYY-MM-DDTHH:mm). */
  start: string;
  /** Barrière horaire finale, en heures. */
  timeLimitH?: number;
  technicity: Technicity;
  /** Points ITRA (0 à 6). Estimés à partir des km-effort si absents. */
  itraPoints?: number;
  /** Nombre de Running Stones (événements UTMB World Series). */
  runningStones?: number;
  startPlace?: string;
  finishPlace?: string;
  maxRunners?: number;
  priceEur?: number;
  /** Lien vers le GPX officiel, quand il est public. */
  gpxUrl?: string;
  /** Points de passage principaux (profil simplifié). */
  checkpoints?: Checkpoint[];
}

export interface RaceLink {
  label: string;
  url: string;
}

export interface Registration {
  /** Ouverture des inscriptions ou des pré-inscriptions (YYYY-MM-DD). */
  opens?: string;
  /** Clôture des inscriptions (YYYY-MM-DD). */
  closes?: string;
  /** Inscription par tirage au sort. */
  lottery?: boolean;
  /** Date du tirage au sort (YYYY-MM-DD). */
  lotteryDate?: string;
  /** Précisions (qualification, points requis…). */
  note?: string;
}

/** Un événement trail (un lieu, une date, un ou plusieurs parcours). */
export interface RaceEvent {
  id: string;
  name: string;
  /** Code pays ISO 3166-1 alpha-2. */
  country: string;
  region: string;
  city: string;
  lat: number;
  lng: number;
  /** Premier et dernier jour de l'événement (YYYY-MM-DD). */
  dateStart: string;
  dateEnd: string;
  /**
   * `official` : date publiée par l'organisation.
   * `estimated` : date prévisionnelle déduite des éditions précédentes.
   */
  dateStatus: 'official' | 'estimated';
  popularity: Popularity;
  /** Circuits et labels (UTMB World Series, Golden Trail Series…). */
  circuits: string[];
  description: string;
  website?: string;
  links: RaceLink[];
  registration: Registration;
  /** Photo de l'événement (facultatif ; sinon le relief 3D sert d'image de fond). */
  image?: string;
  imageCredit?: string;
  courses: Course[];
  /** Course ajoutée par l'utilisateur (stockée dans le navigateur). */
  custom?: boolean;
}
