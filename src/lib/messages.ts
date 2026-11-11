import { SITE } from './site';
import { accountsEnabled, getSupabase } from './supabase';

/** Adresse de contact affichée et utilisée si les messages ne peuvent pas être enregistrés en ligne. */
export const CONTACT_EMAIL: string = SITE.contactEmail;

export type MessageKind = 'contact' | 'erreur' | 'course';

export interface OutgoingMessage {
  kind: MessageKind;
  subject: string;
  /** Contenu lisible du message (champs du formulaire mis en forme). */
  body: string;
  /** Pour répondre, si la personne le souhaite. */
  email?: string;
  courseId?: string;
}

export type SendResult = 'sent' | 'mail' | 'unavailable' | 'error';

/** Les messages peuvent-ils partir d'une façon ou d'une autre ? */
export const messagesEnabled = accountsEnabled || !!CONTACT_EMAIL;

export function mailtoUrl(m: OutgoingMessage): string {
  const body = m.email ? `${m.body}\n\nRépondre à : ${m.email}` : m.body;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[Take Ton Trail] ${m.subject}`)}&body=${encodeURIComponent(body)}`;
}

/**
 * Envoie un message : enregistré dans la base quand les comptes sont actifs,
 * sinon ouvert dans la messagerie du visiteur avec l'adresse de contact.
 */
export async function sendMessage(m: OutgoingMessage): Promise<SendResult> {
  if (accountsEnabled) {
    try {
      const sb = await getSupabase();
      // Identifiant choisi ici : la fonction d'alerte relit ce message en base pour l'envoyer par e-mail.
      const id = crypto.randomUUID();
      const { error } = await sb.from('messages').insert({
        id,
        kind: m.kind,
        subject: m.subject.slice(0, 200),
        body: m.body.slice(0, 5000),
        email: m.email?.slice(0, 200) || null,
        course_id: m.courseId ?? null,
        page: window.location.href.slice(0, 500),
      });
      if (!error) {
        // Copie par e-mail à taketontrail@gmail.com ; le message reste dans l'espace admin même si elle échoue.
        void sb.functions.invoke('notify-message', { body: { id } }).catch(() => undefined);
        return 'sent';
      }
    } catch {
      // Base injoignable : on tente la messagerie.
    }
    if (!CONTACT_EMAIL) return 'error';
  }
  if (CONTACT_EMAIL) {
    window.location.href = mailtoUrl(m);
    return 'mail';
  }
  return 'unavailable';
}
