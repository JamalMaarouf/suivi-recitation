// ═══════════════════════════════════════════════════════════════
// API /api/notifications-email
// Cron quotidien : envoie les emails aux parents pour les notifs
// qui n'ont pas encore été envoyées (email_envoye = false)
// ═══════════════════════════════════════════════════════════════
// Déclenché par cron Vercel 1 fois par jour a 9h30 UTC (limite Hobby).
// Batch de 500 notifs par run pour couvrir la charge quotidienne.
// Si RESEND_API_KEY absente : skip gracieusement (in-app continue).
// Les notifications restent visibles instantanement dans le portail,
// seul l'email est différé d'au maximum 24h.
// ═══════════════════════════════════════════════════════════════

const { Resend } = require('resend');

const EMAIL_FROM_DEFAULT = 'notifications@suivi-recitation.vercel.app';
const BATCH_SIZE = 500;

async function sbGet(url, key, path) {
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
  });
  if (!resp.ok) throw new Error(`GET ${path}: ${resp.status}`);
  return await resp.json();
}

async function sbPatch(url, key, table, filter, body) {
  const resp = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`PATCH ${table}: ${resp.status} ${await resp.text()}`);
  return true;
}

function buildHtml({ titre, corps, ecoleName, lang = 'fr' }) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const alignStart = lang === 'ar' ? 'right' : 'left';
  return `<!DOCTYPE html>
<html dir="${dir}">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:20px;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#085041,#1D9E75);padding:20px 24px;color:#fff">
      <div style="font-size:12px;opacity:0.85;margin-bottom:4px">${ecoleName || 'متابعة التحفيظ'}</div>
      <div style="font-size:18px;font-weight:700">${titre}</div>
    </div>
    <div style="padding:24px;color:#333;line-height:1.6;font-size:14px;text-align:${alignStart}">
      <p style="margin:0 0 16px">${corps}</p>
      <p style="margin:16px 0 0;font-size:13px;color:#888">
        ${lang === 'ar'
          ? 'يمكنكم الاطلاع على تفاصيل أكثر عبر بوابة الأولياء.'
          : 'Vous pouvez consulter plus de détails dans le portail parents.'}
      </p>
    </div>
    <div style="padding:14px 24px;background:#fafaf7;border-top:0.5px solid #e0e0d8;font-size:11px;color:#888;text-align:center">
      ${lang === 'ar'
        ? 'أُرسلت هذه الرسالة بناءً على تفضيلاتكم. يمكنكم تعديلها في البوابة.'
        : 'Cet email a été envoyé selon vos préférences. Vous pouvez les modifier dans votre portail.'}
    </div>
  </div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  const cronSecret  = process.env.CRON_SECRET;
  const resendKey   = process.env.RESEND_API_KEY;
  const emailFrom   = process.env.RESEND_FROM || EMAIL_FROM_DEFAULT;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  // Sécurité cron
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.query.manual !== 'true') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Si pas de clé Resend, on skip (in-app continue de marcher)
  if (!resendKey) {
    return res.status(200).json({
      success: true,
      skipped: 'no_resend_key',
      message: 'RESEND_API_KEY non configurée. Notifications in-app uniquement.',
    });
  }

  const resend = new Resend(resendKey);
  let sent = 0;
  let failed = 0;
  let skippedNoEmail = 0;
  let skippedOptOut = 0;

  try {
    // ─── 1. Charger les notifs non envoyées (limite BATCH_SIZE) ──
    const notifs = await sbGet(supabaseUrl, serviceKey,
      `notifications_parents?select=*&email_envoye=eq.false&limit=${BATCH_SIZE}&order=created_at.desc`);

    if (notifs.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: 'Aucune notif en attente' });
    }

    // ─── 2. Charger tous les parents concernés en 1 requête ──
    const parentIds = [...new Set(notifs.map(n => n.parent_id))];
    const parentsUrl = `utilisateurs?select=id,prenom,nom,email&id=in.(${parentIds.join(',')})&deleted_at=is.null`;
    const parents = await sbGet(supabaseUrl, serviceKey, parentsUrl);
    const parentsMap = {};
    for (const p of parents) parentsMap[p.id] = p;

    // ─── 3. Charger les préférences en 1 requête ──────────
    const prefsUrl = `preferences_notifications?select=user_id,canal_email&user_id=in.(${parentIds.join(',')})`;
    const prefsAll = await sbGet(supabaseUrl, serviceKey, prefsUrl);
    const prefsMap = {};
    for (const p of prefsAll) prefsMap[p.user_id] = p;

    // ─── 4. Charger les écoles en 1 requête ───────────────
    const ecoleIds = [...new Set(notifs.map(n => n.ecole_id))];
    const ecolesUrl = `ecoles?select=id,nom&id=in.(${ecoleIds.join(',')})`;
    const ecoles = await sbGet(supabaseUrl, serviceKey, ecolesUrl);
    const ecolesMap = {};
    for (const e of ecoles) ecolesMap[e.id] = e;

    // ─── 5. Traiter chaque notif ──────────────────────────
    for (const notif of notifs) {
      const parent = parentsMap[notif.parent_id];

      // Skip si parent sans email
      if (!parent?.email) {
        skippedNoEmail++;
        // Marquer comme "traité" pour ne pas réessayer à chaque cron
        await sbPatch(supabaseUrl, serviceKey, 'notifications_parents',
          `id=eq.${notif.id}`,
          { email_envoye: true, email_error: 'no_email_address' });
        continue;
      }

      // Skip si canal email désactivé
      const pref = prefsMap[notif.parent_id];
      if (pref && pref.canal_email === false) {
        skippedOptOut++;
        await sbPatch(supabaseUrl, serviceKey, 'notifications_parents',
          `id=eq.${notif.id}`,
          { email_envoye: true, email_error: 'canal_email_disabled' });
        continue;
      }

      // Composer l'email (bilingue — on envoie en fr par défaut, ar si dispo)
      const ecoleName = ecolesMap[notif.ecole_id]?.nom || 'متابعة التحفيظ';

      // Stratégie : si titre_ar dispo, on envoie un email avec les deux langues
      // Simple pour l'instant : envoi FR uniquement (pourra être affiné via pref langue)
      const subject = notif.titre_fr || notif.titre_ar || 'Notification';
      const html = buildHtml({
        titre: notif.titre_fr || notif.titre_ar,
        corps: notif.corps_fr || notif.corps_ar,
        ecoleName,
        lang: 'fr',
      });

      try {
        await resend.emails.send({
          from: emailFrom,
          to: parent.email,
          subject,
          html,
        });
        await sbPatch(supabaseUrl, serviceKey, 'notifications_parents',
          `id=eq.${notif.id}`,
          { email_envoye: true });
        sent++;
      } catch (err) {
        console.error(`[notif email] failed ${notif.id}:`, err.message);
        await sbPatch(supabaseUrl, serviceKey, 'notifications_parents',
          `id=eq.${notif.id}`,
          { email_envoye: true, email_error: err.message?.slice(0, 200) });
        failed++;
      }
    }

    return res.status(200).json({
      success: true,
      total: notifs.length,
      sent,
      failed,
      skipped_no_email: skippedNoEmail,
      skipped_opt_out: skippedOptOut,
    });
  } catch (err) {
    console.error('[notifications-email] error:', err);
    return res.status(500).json({
      error: err.message,
      sent,
      failed,
    });
  }
};
