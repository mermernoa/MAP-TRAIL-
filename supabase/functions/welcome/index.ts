// E-mail de bienvenue Take Ton Trail, envoyé une seule fois par compte.
// Appelée par le site (page compte) avec la session de l'utilisateur : la fonction
// vérifie elle-même le compte (adresse confirmée, compte récent, pas déjà accueilli),
// envoie l'e-mail depuis taketontrail@gmail.com puis le note dans app_metadata.
// Secret requis : SMTP_PASSWORD (mot de passe d'application Gmail), posé par le
// workflow .github/workflows/supabase-config.yml.
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

function html(name: string) {
  const hello = name ? `Bienvenue ${esc(name)} !` : 'Bienvenue à toi !';
  const step = (n: string, title: string, text: string) => `
        <tr><td style="padding:0 32px 14px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td valign="top" style="width:34px"><div style="width:28px;height:28px;border-radius:50%;background:#fe66c4;border:2px solid #071c3f;color:#071c3f;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:14px;line-height:28px;text-align:center">${n}</div></td>
            <td style="padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#2b2747"><strong style="color:#071c3f">${title}</strong><br>${text}</td>
          </tr></table>
        </td></tr>`;
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bienvenue sur Take Ton Trail</title></head>
<body style="margin:0;padding:0;background:#f7f0f7">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f0f7">
    <tr><td align="center" style="padding:28px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;border:2px solid #071c3f">
        <tr><td align="center" style="background:#071c3f;padding:26px 24px 20px">
          <a href="https://taketontrail.fr/"><img src="https://taketontrail.fr/brand/email-logo.png" width="120" alt="Take Ton Trail" style="display:block;border:0;width:120px;height:auto"></a>
        </td></tr>
        <tr><td style="height:6px;background:#fe66c4;line-height:6px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:30px 32px 6px;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#071c3f">${hello}</td></tr>
        <tr><td style="padding:8px 32px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15.5px;line-height:1.6;color:#2b2747">Ton compte Take Ton Trail est prêt. Plus de 3 000 courses de trail en France t’attendent, du petit trail du coin à l’ultra mythique. Voici par où commencer :</td></tr>
        ${step('1', 'Trouve ta prochaine course', 'Sur la carte en relief, filtre par distance, dénivelé, date et prix.')}
        ${step('2', 'Construis ta saison', 'Ajoute tes objectifs : on te prévient des ouvertures d’inscription.')}
        ${step('3', 'Laisse-toi surprendre', 'Ta page compte te propose des courses qui te ressemblent.')}
        <tr><td align="center" style="padding:12px 32px 30px">
          <a href="https://taketontrail.fr/carte" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#fe66c4;color:#071c3f;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;border:2px solid #071c3f">Trouver ma course</a>
        </td></tr>
        <tr><td style="padding:0 32px 26px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#635c7d">Une course manque ou une info est fausse ? Réponds simplement à cet e-mail, on corrige à la main. Bonne saison !</td></tr>
        <tr><td style="padding:18px 32px;background:#f3eaf4;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#635c7d">
          Tu reçois cet e-mail parce que tu viens de créer ton compte sur Take Ton Trail. C’est le seul envoyé automatiquement : pas de newsletter sans ton accord.<br>
          <a href="https://taketontrail.fr/" style="color:#854183">taketontrail.fr</a> · <a href="mailto:taketontrail@gmail.com" style="color:#854183">taketontrail@gmail.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function text(name: string) {
  return `${name ? `Bienvenue ${name} !` : 'Bienvenue à toi !'}

Ton compte Take Ton Trail est prêt. Plus de 3 000 courses de trail en France t'attendent.

1. Trouve ta prochaine course sur la carte : https://taketontrail.fr/carte
2. Construis ta saison et suis les ouvertures d'inscription.
3. Ta page compte te propose des courses qui te ressemblent : https://taketontrail.fr/compte

Une course manque ? Réponds à cet e-mail. Bonne saison !
Take Ton Trail – taketontrail.fr`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth.user;
  if (!user?.email) return json({ error: 'unauthorized' }, 401);

  // Une seule fois, pour un compte confirmé et créé il y a moins de 7 jours.
  if (user.app_metadata?.welcome_sent) return json({ sent: false, reason: 'already' });
  if (!user.email_confirmed_at) return json({ sent: false, reason: 'unconfirmed' });
  if (Date.now() - new Date(user.created_at).getTime() > 7 * 86_400_000) return json({ sent: false, reason: 'old' });

  const pass = Deno.env.get('SMTP_PASSWORD');
  if (!pass) return json({ sent: false, reason: 'smtp' }, 503);

  // On note l'envoi d'abord : deux appels simultanés ne donnent pas deux e-mails.
  const { error: markError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, welcome_sent: new Date().toISOString() },
  });
  if (markError) return json({ sent: false, reason: 'mark' }, 500);

  const meta = (user.user_metadata ?? {}) as { name?: string; full_name?: string; given_name?: string };
  const name = (meta.name || meta.given_name || meta.full_name?.split(' ')[0] || '').trim().slice(0, 40);
  try {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'taketontrail@gmail.com', pass },
    });
    await transport.sendMail({
      from: '"Take Ton Trail" <taketontrail@gmail.com>',
      to: user.email,
      replyTo: 'taketontrail@gmail.com',
      subject: name ? `Bienvenue ${name} ! Ta saison de trail commence ici` : 'Bienvenue ! Ta saison de trail commence ici',
      html: html(name),
      text: text(name),
    });
  } catch (e) {
    // Échec d'envoi : on retire la marque pour réessayer à la prochaine connexion.
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, welcome_sent: null } });
    console.error('welcome', e);
    return json({ sent: false, reason: 'send' }, 502);
  }
  return json({ sent: true });
});
