import type { RaceEvent } from '../../data/types';
import { europeRaces } from './races-europe';
import { franceRaces } from './races-france';
import { worldRaces } from './races-world';

/**
 * Jeu d'essai pour les tests de logique (filtres, saison, export agenda).
 * Ces courses ne sont pas publiées : le site lit public/data/races.json,
 * généré depuis la feuille Google.
 */
export const fixtureRaces: RaceEvent[] = [...franceRaces, ...europeRaces, ...worldRaces];
