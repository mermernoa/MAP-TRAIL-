// Alerte e-mail Take Ton Trail : un message des formulaires (contact, erreur, course)
// vient d'être enregistré ; on l'envoie à taketontrail@gmail.com.
// Le site appelle la fonction avec le seul identifiant du message : elle relit le
// message en base, ne l'envoie qu'une fois et seulement s'il a moins de 10 minutes.
// Impossible donc de s'en servir pour envoyer un texte arbitraire.
// Secret requis : SMTP_PASSWORD (posé par le workflow .github/workflows/supabase-config.yml).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import nodemailer from 'npm:nodemailer@6.9.16';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const KIND: Record<string, string> = { contact: 'Message', erreur: 'Erreur signalée', course: 'Course proposée' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || !UUID.test(id)) return json({ error: 'id' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // On réserve l'envoi d'abord : deux appels ne donnent pas deux e-mails.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: m } = await admin
    .from('messages')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', id)
    .is('notified_at', null)
    .gte('created_at', since)
    .select('id, kind, subject, body, email, course_id, page, created_at')
    .maybeSingle();
  if (!m) return json({ sent: false });

  const pass = Deno.env.get('SMTP_PASSWORD');
  if (!pass) return json({ sent: false, reason: 'smtp' }, 503);

  const label = KIND[m.kind] ?? 'Message';
  const replyTo = m.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email) ? m.email : undefined;
  const rows = [
    ['Type', label],
    ['De', m.email || 'adresse non laissée'],
    ...(m.course_id ? [['Course', `https://taketontrail.fr/course/${m.course_id}`]] : []),
    ...(m.page ? [['Page', m.page]] : []),
  ];
  try {
    await nodemailer
      .createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'taketontrail@gmail.com', pass } })
      .sendMail({
        from: '"Take Ton Trail – site" <taketontrail@gmail.com>',
        to: 'taketontrail@gmail.com',
        replyTo,
        subject: `[${label}] ${m.subject}`.slice(0, 200),
        text: `${m.body}\n\n—\n${rows.map(([k, v]) => `${k} : ${v}`).join('\n')}\n\nÀ traiter dans l'espace admin : https://taketontrail.fr/admin`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#071c3f;max-width:560px">
<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:.05em;text-transform:uppercase;color:#c554a5">${esc(label)}</p>
<h2 style="margin:0 0 14px;font-size:20px">${esc(m.subject)}</h2>
<div style="white-space:pre-wrap;padding:14px 16px;border-left:4px solid #fe66c4;background:#f7f0f7;border-radius:6px">${esc(m.body)}</div>
<table style="margin-top:14px;font-size:13px;color:#472f61">${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0"><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`).join('')}</table>
<p style="margin-top:16px;font-size:13px">${replyTo ? 'Réponds directement à cet e-mail pour répondre à la personne.' : 'La personne n’a pas laissé d’adresse.'} · <a href="https://taketontrail.fr/admin" style="color:#854183">Espace admin</a></p>
</div>`,
      });
  } catch (e) {
    await admin.from('messages').update({ notified_at: null }).eq('id', id);
    console.error('notify-message', e);
    return json({ sent: false, reason: 'send' }, 502);
  }
  return json({ sent: true });
});
