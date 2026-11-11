// Santé du site pour l'espace admin : vérifie que le compte Gmail d'envoi
// (taketontrail@gmail.com, secret SMTP_PASSWORD) accepte la connexion. C'est le même
// mot de passe que Supabase utilise pour les e-mails de confirmation : s'il est refusé,
// plus personne ne peut créer de compte. Réservée aux comptes de la table admins.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import nodemailer from 'npm:nodemailer@6.9.16';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return json({ error: 'unauthorized' }, 401);
  const { data: row } = await admin.from('admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
  if (!row) return json({ error: 'forbidden' }, 403);

  const pass = Deno.env.get('SMTP_PASSWORD');
  if (!pass) return json({ mail: 'missing' });
  try {
    await nodemailer
      .createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'taketontrail@gmail.com', pass } })
      .verify();
    return json({ mail: 'ok' });
  } catch (e) {
    const detail = String((e as Error)?.message ?? e);
    return json({ mail: /535|BadCredentials|Username and Password/i.test(detail) ? 'refused' : 'error', detail: detail.slice(0, 200) });
  }
});
