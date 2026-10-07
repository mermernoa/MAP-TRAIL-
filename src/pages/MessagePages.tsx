import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CONTACT_EMAIL, messagesEnabled, type OutgoingMessage, type SendResult, sendMessage } from '../lib/messages';
import { useRace } from '../store/races';
import { InfoLayout } from './InfoPages';

type Status = 'idle' | 'sending' | SendResult;

/** Envoi d'un formulaire et message de retour. */
function useSend() {
  const [status, setStatus] = useState<Status>('idle');
  const send = async (m: OutgoingMessage) => {
    setStatus('sending');
    setStatus(await sendMessage(m));
  };
  return { status, send, reset: () => setStatus('idle') };
}

function SendFeedback({ status, onAgain }: { status: Status; onAgain: () => void }) {
  if (status === 'sent') {
    return (
      <div className="form-done" role="status">
        <p>
          <strong>Message envoyé, merci.</strong> Il sera lu et la base corrigée si besoin.
        </p>
        <button type="button" className="button" onClick={onAgain}>
          Écrire un autre message
        </button>
      </div>
    );
  }
  if (status === 'mail') {
    return (
      <p className="form-note" role="status">
        Votre messagerie s’est ouverte avec le message prêt à partir. Rien ne s’est ouvert ? Écrivez à{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p className="form-error" role="alert">
        Le message n’est pas parti. Vérifiez votre connexion, puis réessayez.
      </p>
    );
  }
  if (status === 'unavailable') {
    return (
      <p className="form-error" role="alert">
        L’envoi de messages n’est pas encore ouvert sur le site. Réessayez dans quelques jours.
      </p>
    );
  }
  return null;
}

function NotOpenYet() {
  return (
    <p className="form-note">
      L’envoi de messages ouvre bientôt. Vous pouvez déjà préparer votre message : il partira dès que le formulaire sera
      relié.
    </p>
  );
}

const lines = (pairs: [string, string | undefined][]) =>
  pairs
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k} : ${v!.trim()}`)
    .join('\n');

export function ContactPage() {
  const id = useId();
  const { status, send, reset } = useSend();
  const [form, setForm] = useState({ name: '', email: '', topic: 'Question', message: '' });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <InfoLayout title="Contact" lede="Une question, une idée, un partenariat ? Écrivez-nous : chaque message est lu.">
      {status === 'sent' ? (
        <SendFeedback status={status} onAgain={reset} />
      ) : (
        <form
          className="info-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send({
              kind: 'contact',
              subject: `${form.topic}${form.name ? ` – ${form.name}` : ''}`,
              body: lines([
                ['Nom', form.name],
                ['Sujet', form.topic],
                ['Message', `\n${form.message}`],
              ]),
              email: form.email || undefined,
            });
          }}
        >
          {!messagesEnabled && <NotOpenYet />}
          <div className="form-row">
            <label htmlFor={`${id}-name`}>Votre nom (facultatif)</label>
            <input id={`${id}-name`} value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-email`}>Votre e-mail, pour vous répondre</label>
            <input
              id={`${id}-email`}
              type="email"
              required
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              autoComplete="email"
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-topic`}>Sujet</label>
            <select id={`${id}-topic`} value={form.topic} onChange={(e) => set({ topic: e.target.value })}>
              <option>Question</option>
              <option>Idée pour le site</option>
              <option>Organisation d’une course</option>
              <option>Partenariat ou presse</option>
              <option>Mes données personnelles</option>
              <option>Autre</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-message`}>Message</label>
            <textarea id={`${id}-message`} required rows={7} maxLength={4000} value={form.message} onChange={(e) => set({ message: e.target.value })} />
          </div>
          <p className="form-hint">
            Une erreur sur une course ? Le formulaire <Link to="/signaler">Signaler une erreur</Link> est plus rapide à
            traiter.
          </p>
          <button type="submit" className="button button-primary" disabled={status === 'sending'}>
            {status === 'sending' ? 'Envoi…' : 'Envoyer le message'}
          </button>
          <SendFeedback status={status} onAgain={reset} />
        </form>
      )}
    </InfoLayout>
  );
}

const ERROR_TOPICS = [
  'Date',
  'Distance ou dénivelé',
  'Prix',
  'Inscriptions',
  'Lieu de départ',
  'Course annulée ou reportée',
  'Photo : crédit ou retrait',
  'Autre',
];

export function ReportPage() {
  const id = useId();
  const [params] = useSearchParams();
  const event = useRace(params.get('course') ?? undefined);
  const { status, send, reset } = useSend();
  const [form, setForm] = useState({
    race: '',
    topic: params.get('sujet') === 'photo' ? 'Photo : crédit ou retrait' : 'Date',
    correct: '',
    source: '',
    email: '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const raceName = event?.name ?? form.race;
  return (
    <InfoLayout
      title="Signaler une erreur"
      lede="Une date a bougé, un prix est faux, une photo pose problème ? Dites-nous quoi corriger : la fiche sera mise à jour à la main."
    >
      {status === 'sent' ? (
        <SendFeedback status={status} onAgain={reset} />
      ) : (
        <form
          className="info-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send({
              kind: 'erreur',
              subject: `${form.topic} – ${raceName || 'course non précisée'}`,
              body: lines([
                ['Course', raceName],
                ['Fiche', event ? `${window.location.origin}${window.location.pathname}#/course/${event.id}` : undefined],
                ['Problème', form.topic],
                ['Information correcte', `\n${form.correct}`],
                ['Source', form.source],
              ]),
              email: form.email || undefined,
              courseId: event?.id,
            });
          }}
        >
          {!messagesEnabled && <NotOpenYet />}
          <div className="form-row">
            <label htmlFor={`${id}-race`}>Course concernée</label>
            {event ? (
              <p className="form-fixed" id={`${id}-race`}>
                <Link to={`/course/${event.id}`}>{event.name}</Link>, {event.city}
              </p>
            ) : (
              <input id={`${id}-race`} required value={form.race} onChange={(e) => set({ race: e.target.value })} placeholder="Nom de la course et ville" />
            )}
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-topic`}>Ce qui ne va pas</label>
            <select id={`${id}-topic`} value={form.topic} onChange={(e) => set({ topic: e.target.value })}>
              {ERROR_TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-correct`}>
              {form.topic.startsWith('Photo') ? 'Votre demande (retrait, crédit à afficher…)' : 'La bonne information'}
            </label>
            <textarea id={`${id}-correct`} required rows={5} maxLength={3000} value={form.correct} onChange={(e) => set({ correct: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-source`}>Où l’avez-vous vue ? (lien, facultatif)</label>
            <input id={`${id}-source`} type="url" value={form.source} onChange={(e) => set({ source: e.target.value })} placeholder="https://" />
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-email`}>Votre e-mail (facultatif, pour vous prévenir de la correction)</label>
            <input id={`${id}-email`} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
          </div>
          <button type="submit" className="button button-primary" disabled={status === 'sending'}>
            {status === 'sending' ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
          <SendFeedback status={status} onAgain={reset} />
        </form>
      )}
    </InfoLayout>
  );
}

export function ProposePage() {
  const id = useId();
  const { status, send, reset } = useSend();
  const [form, setForm] = useState({ name: '', city: '', date: '', distances: '', website: '', organizer: 'non', email: '', comment: '' });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <InfoLayout
      title="Proposer une course"
      lede="Une course manque à la carte ? Donnez-nous l’essentiel : elle sera vérifiée sur son site officiel, puis ajoutée."
    >
      {status === 'sent' ? (
        <SendFeedback status={status} onAgain={reset} />
      ) : (
        <form
          className="info-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send({
              kind: 'course',
              subject: `Nouvelle course : ${form.name}`,
              body: lines([
                ['Course', form.name],
                ['Ville', form.city],
                ['Date', form.date],
                ['Distances', form.distances],
                ['Site', form.website],
                ['Proposée par l’organisation', form.organizer === 'oui' ? 'oui' : 'non'],
                ['Commentaire', form.comment ? `\n${form.comment}` : undefined],
              ]),
              email: form.email || undefined,
            });
          }}
        >
          {!messagesEnabled && <NotOpenYet />}
          <div className="form-row">
            <label htmlFor={`${id}-name`}>Nom de la course</label>
            <input id={`${id}-name`} required value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor={`${id}-city`}>Ville de départ</label>
              <input id={`${id}-city`} required value={form.city} onChange={(e) => set({ city: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor={`${id}-date`}>Date de la prochaine édition</label>
              <input id={`${id}-date`} type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-distances`}>Distances proposées</label>
            <input id={`${id}-distances`} value={form.distances} onChange={(e) => set({ distances: e.target.value })} placeholder="Par exemple : 12 km, 25 km et 45 km" />
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-website`}>Site officiel ou page d’inscription</label>
            <input id={`${id}-website`} type="url" required value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
          </div>
          <fieldset className="form-row form-choice">
            <legend>Vous êtes…</legend>
            <label>
              <input type="radio" name={`${id}-who`} checked={form.organizer === 'non'} onChange={() => set({ organizer: 'non' })} /> Coureur ou coureuse
            </label>
            <label>
              <input type="radio" name={`${id}-who`} checked={form.organizer === 'oui'} onChange={() => set({ organizer: 'oui' })} /> De l’organisation
            </label>
          </fieldset>
          <div className="form-row">
            <label htmlFor={`${id}-comment`}>Autre chose à savoir ? (facultatif)</label>
            <textarea id={`${id}-comment`} rows={4} maxLength={2000} value={form.comment} onChange={(e) => set({ comment: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor={`${id}-email`}>Votre e-mail (facultatif, pour vous prévenir de l’ajout)</label>
            <input id={`${id}-email`} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
          </div>
          <p className="form-hint">
            Vous voulez seulement la suivre dans votre saison ? Ajoutez-la vous-même depuis <Link to="/ma-saison">Ma saison</Link>.
          </p>
          <button type="submit" className="button button-primary" disabled={status === 'sending'}>
            {status === 'sending' ? 'Envoi…' : 'Proposer la course'}
          </button>
          <SendFeedback status={status} onAgain={reset} />
        </form>
      )}
    </InfoLayout>
  );
}
