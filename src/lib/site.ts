/**
 * Identité de l'éditeur du site, pour les mentions légales et le contact.
 * Les champs vides ne s'affichent pas : complétez-les dès que Take Ton Trail
 * est immatriculé (raison sociale, adresse du siège, SIRET, responsable de la publication).
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
