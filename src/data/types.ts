/** Technicité du terrain, de 1 (chemins larges et roulants) à 5 (terrain alpin). */
export type Technicity = 1 | 2 | 3 | 4 | 5;

/** Notoriété, de 1 (course locale confidentielle) à 5 (course mythique). */
export type Popularity = 1 | 2 | 3 | 4 | 5;

/** Catégories de l'UTMB Index. */
export type UtmbCategory = '20K' | '50K' | '100K' | '100M';

/** État de remplissage d'une course. */
export type FullState = 'yes' | 'no' | 'waitlist';

/** Un point de passage (ravitaillement, col, sommet…) d'un parcours. */
export interface Checkpoint {
  name: string;
  km: number;
  /** Altitude en mètres. */
  alt: number;
}

/** Un parcours (une distance) proposé par un événement. Une ligne de la feuille « Courses ». */
export interface Course {
  id: string;
  name: string;
  distanceKm: number;
  /** Dénivelé positif en mètres (absent quand l'organisation ne le publie pas). */
  elevationGain?: number;
  /** Dénivelé négatif en mètres (si différent du D+). */
  elevationLoss?: number;
  /** Jour de départ (YYYY-MM-DD), éventuellement avec l'heure (YYYY-MM-DDTHH:mm). */
  start: string;
  /** Barrière horaire finale, en heures. */
  timeLimitH?: number;
  technicity?: Technicity;
  /** Trail court, Trail long, Ultra-trail, Trail nocturne, Trail urbain, Kilomètre vertical… */
  type?: string;
  /** Solo, Duo, Relais, Équipe. */
  format?: string;
  /** Boucle, Point à point, Aller-retour. */
  courseShape?: string;
  terrain?: string;
  /** Points ITRA (0 à 6). Estimés à partir des km-effort si absents. */
  itraPoints?: number;
  /** La course fait partie de l'UTMB Index. */
  utmbIndex?: boolean;
  /** Catégorie UTMB Index publiée. */
  utmbCategory?: UtmbCategory;
  /** Nombre de Running Stones (événements UTMB World Series). */
  runningStones?: number;
  qualifierFor?: string;
  startPlace?: string;
  finishPlace?: string;
  /** Coordonnées du départ, quand il diffère du lieu de l'événement (relais, point à point). */
  lat?: number;
  lng?: number;
  maxRunners?: number;
  priceEur?: number;
  registrationUrl?: string;
  /** Document demandé à l'inscription (PPS, licence, certificat médical…). */
  requiredDocument?: string;
  full?: FullState;
  popularity?: Popularity;
  participantsLastEdition?: number;
  aidStations?: number;
  mandatoryGear?: string;
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
  /** Premier arrivé premier servi, Tirage au sort, Qualification… */
  mode?: string;
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
  /** Département, par exemple « Ain (01) ». */
  department?: string;
  /** Massif ou grande zone (Alpes du Nord, Massif central, Plaine / campagne…). */
  massif?: string;
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
  edition?: string;
  popularity: Popularity;
  /** Circuits et labels (UTMB World Series, championnats…). */
  circuits: string[];
  description: string;
  highlights?: string;
  access?: string;
  website?: string;
  links: RaceLink[];
  registration: Registration;
  /** Photo de l'événement (sinon le relief 3D sert d'image de fond). */
  image?: string;
  imageCredit?: string;
  /** Origine des données (Miles Republic, Finishers, site officiel…). */
  source?: string;
  /** Dernière mise à jour dans la base (YYYY-MM-DD). */
  updatedAt?: string;
  courses: Course[];
  /** Course ajoutée par l'utilisateur (stockée dans le navigateur). */
  custom?: boolean;
}
