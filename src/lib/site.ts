/**
 * Identité de l'éditeur du site, pour les mentions légales et le contact.
 * Tant que legalName est vide, les mentions légales présentent un éditeur particulier
 * non professionnel (anonyme, identité connue de l'hébergeur, LCEN art. 6 III 2).
 * Dès que Take Ton Trail a une structure, remplir raison sociale, adresse du siège,
 * SIRET (ou RNA pour une association) et responsable de la publication.
 */
export const SITE = {
  name: 'Take Ton Trail',
  /** Adresse publique de contact ; reçoit aussi les messages des formulaires sans Supabase. */
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'taketontrail@gmail.com',
  legalName: '',
  address: '',
  siret: '',
  publicationDirector: '',
};
