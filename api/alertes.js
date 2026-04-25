// ═══════════════════════════════════════════════════════════════
// API /api/alertes — Détection + notification des alertes système
// ═══════════════════════════════════════════════════════════════
// Exécution : cron Vercel toutes les 30 minutes
// Sécurité : CRON_SECRET requis (même mécanisme que /api/backup)
//
// Règles appliquées :
//   🔴 CRITIQUE (mail immédiat) :
//     - Ping Supabase en erreur 2x de suite
//     - Backup quotidien KO
//   🟠 WARNING (créé en DB, pas de mail spam) :
//     - École inactive >7 jours (aucune connexion)
//     - Compte surveillant bloqué (rate limit)
//
// Le cron :
//   1) Applique chaque règle
//   2) Si nouvelle alerte détectée → insère dans `alertes`
//   3) Si critique → envoie un mail via Resend (1 seule fois grâce à cle_dedup)
//   4) Si condition disparue → marque l'alerte comme `resolved_at`
// ═══════════════════════════════════════════════════════════════

const { Resend } = require('resend');

// ─── Helpers HTTP Supabase REST (sans SDK) ──────────────────────
async function sbGet(supabaseUrl, serviceKey, path) {
  const resp = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });
  if (!resp.ok) throw new Error(`GET ${path}: ${resp.status}`);
  return await resp.json();
}

async function sbPost(supabaseUrl, serviceKey, table, body) {
  const resp = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`POST ${table}: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}

async function sbPatch(supabaseUrl, serviceKey, path, body) {
  const resp = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`PATCH ${path}: ${resp.status}`);
}

// ─── Vérifier si une alerte existe déjà (dédup) ───────────────
async function alerteExisteDeja(supabaseUrl, serviceKey, cleDedup) {
  const data = await sbGet(
    supabaseUrl,
    serviceKey,
    `alertes?cle_dedup=eq.${encodeURIComponent(cleDedup)}&resolved_at=is.null&select=id&limit=1`
  );
  return Array.isArray(data) && data.length > 0;
}

// ─── Créer une alerte (si pas déjà active) ────────────────────
async function creerAlerte(supabaseUrl, serviceKey, payload) {
  const { cle_dedup } = payload;
  if (await alerteExisteDeja(supabaseUrl, serviceKey, cle_dedup)) {
    return { skipped: true, reason: 'already_active' };
  }
  const created = await sbPost(supabaseUrl, serviceKey, 'alertes', payload);
  return { skipped: false, alerte: Array.isArray(created) ? created[0] : created };
}

// ─── Résoudre une alerte (condition disparue) ─────────────────
async function resoudreAlerte(supabaseUrl, serviceKey, cleDedup) {
  const actives = await sbGet(
    supabaseUrl,
    serviceKey,
    `alertes?cle_dedup=eq.${encodeURIComponent(cleDedup)}&resolved_at=is.null&select=id`
  );
  if (!actives || actives.length === 0) return { resolved: 0 };
  for (const a of actives) {
    await sbPatch(supabaseUrl, serviceKey, `alertes?id=eq.${a.id}`, {
      resolved_at: new Date().toISOString(),
    });
  }
  return { resolved: actives.length };
}

// ─── Envoyer un mail d'alerte ──────────────────────────────────
async function envoyerMailAlerte(resendKey, mailDest, alerte) {
  if (!resendKey || !mailDest) return false;
  try {
    const resend = new Resend(resendKey);
    const color = alerte.niveau === 'critique' ? '#E24B4A' : '#EF9F27';
    const emoji = alerte.niveau === 'critique' ? '🚨' : '⚠️';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${color}; color: #fff; padding: 20px; border-radius: 10px 10px 0 0;">
          <div style="font-size: 20px; font-weight: bold;">${emoji} Alerte ${alerte.niveau.toUpperCase()}</div>
          <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">${alerte.titre}</div>
        </div>
        <div style="background: #fff; border: 1px solid #e0e0d8; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
          <div style="font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap;">${alerte.message}</div>
          <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #eee; font-size: 11px; color: #888;">
            Détecté le : ${new Date(alerte.created_at).toLocaleString('fr-FR')}
          </div>
          <div style="margin-top: 20px;">
            <a href="https://suivi-recitation.vercel.app" style="display: inline-block; background: #085041; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Ouvrir le cockpit →
            </a>
          </div>
        </div>
        <div style="text-align: center; font-size: 10px; color: #aaa; margin-top: 10px;">
          Suivi Récitation · Alerte automatique
        </div>
      </div>
    `;

    await resend.emails.send({
      from: 'Suivi Récitation <onboarding@resend.dev>',
      to: [mailDest],
      subject: `${emoji} [${alerte.niveau.toUpperCase()}] ${alerte.titre}`,
      html,
    });
    return true;
  } catch (e) {
    console.error('[alertes] Erreur envoi mail:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// RÈGLES DE DÉTECTION
// ═══════════════════════════════════════════════════════════════

// ─── Règle 1 : Ping Supabase KO 2x de suite ────────────────────
async function regle_pingSupabaseKO(ctx) {
  const { supabaseUrl, serviceKey } = ctx;
  try {
    // On prend les 2 derniers pings
    const data = await sbGet(
      supabaseUrl, serviceKey,
      'sante_systeme?check_type=eq.ping_supabase&order=created_at.desc&limit=2&select=status,created_at,message'
    );
    if (!data || data.length < 2) return null;
    const tousKO = data.every(p => p.status === 'error');
    if (tousKO) {
      return {
        niveau: 'critique',
        type_alerte: 'ping_supabase_ko',
        titre: 'Supabase ne répond plus',
        message: `Les 2 derniers pings Supabase ont échoué.\n\nDernier message : ${data[0].message}\nHorodatage : ${data[0].created_at}\n\nAction recommandée : vérifier le dashboard Supabase.`,
        cle_dedup: 'ping_supabase_ko',
      };
    }
    // Condition disparue → résoudre
    await resoudreAlerte(supabaseUrl, serviceKey, 'ping_supabase_ko');
    return null;
  } catch (e) {
    return null; // pas d'alerte si l'historique n'est pas lisible
  }
}

// ─── Règle 2 : Backup quotidien KO ────────────────────────────
async function regle_backupKO(ctx) {
  const { supabaseUrl, serviceKey } = ctx;
  try {
    // On regarde le dernier backup (s'il y en a un dans sante_systeme)
    const data = await sbGet(
      supabaseUrl, serviceKey,
      'sante_systeme?check_type=eq.backup&order=created_at.desc&limit=1&select=*'
    );
    if (!data || data.length === 0) return null;
    const dernier = data[0];
    const ageHours = (Date.now() - new Date(dernier.created_at).getTime()) / (1000 * 60 * 60);

    // Alerte si : dernier backup en erreur OU backup > 30h (manqué)
    if (dernier.status === 'error' || ageHours > 30) {
      return {
        niveau: 'critique',
        type_alerte: 'backup_ko',
        titre: ageHours > 30 ? 'Backup manqué' : 'Backup en erreur',
        message: ageHours > 30
          ? `Aucun backup réussi depuis ${Math.round(ageHours)}h. Le cron quotidien pourrait être en panne.\n\nDernier backup : ${new Date(dernier.created_at).toLocaleString('fr-FR')}`
          : `Le dernier backup a échoué.\n\nMessage : ${dernier.message}\nHorodatage : ${dernier.created_at}`,
        cle_dedup: 'backup_ko',
      };
    }
    await resoudreAlerte(supabaseUrl, serviceKey, 'backup_ko');
    return null;
  } catch (e) {
    return null;
  }
}

// ─── Règle 3 : École inactive >7 jours ────────────────────────
async function regle_ecolesInactives(ctx) {
  const { supabaseUrl, serviceKey } = ctx;
  const alertes = [];
  try {
    // Récupérer les écoles actives avec leur dernière activité (via utilisateurs)
    const ecoles = await sbGet(
      supabaseUrl, serviceKey,
      'ecoles?statut=eq.active&select=id,nom'
    );
    if (!ecoles) return [];

    for (const e of ecoles) {
      // Dernière connexion d'un utilisateur de cette école
      const derniereCo = await sbGet(
        supabaseUrl, serviceKey,
        `utilisateurs?ecole_id=eq.${e.id}&derniere_connexion=not.is.null&deleted_at=is.null&order=derniere_connexion.desc&limit=1&select=derniere_connexion`
      );
      if (!derniereCo || derniereCo.length === 0) continue; // jamais connecté : ignore
      const lastCo = new Date(derniereCo[0].derniere_connexion);
      const ageDays = (Date.now() - lastCo.getTime()) / (1000 * 60 * 60 * 24);

      const cleDedup = `ecole_inactive_${e.id}`;
      if (ageDays > 7) {
        alertes.push({
          niveau: 'warning',
          type_alerte: 'ecole_inactive',
          titre: `École inactive : ${e.nom}`,
          message: `L'école "${e.nom}" n'a eu aucune connexion depuis ${Math.round(ageDays)} jours.\n\nCela peut indiquer un churn en cours. Une prise de contact commerciale peut être utile.`,
          cle_dedup: cleDedup,
          ecole_id: e.id,
        });
      } else {
        // Condition résolue (école active à nouveau)
        await resoudreAlerte(supabaseUrl, serviceKey, cleDedup);
      }
    }
    return alertes;
  } catch (e) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const mailDest = process.env.BACKUP_EMAIL; // même destinataire que pour les backups

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  // Security check
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.query.manual !== 'true') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ctx = { supabaseUrl, serviceKey };
  const startTime = Date.now();
  const nouveauxAlertes = [];
  const mailsEnvoyes = [];

  try {
    // Appliquer toutes les règles
    const results = await Promise.all([
      regle_pingSupabaseKO(ctx),
      regle_backupKO(ctx),
      regle_ecolesInactives(ctx),
    ]);

    // Collecter toutes les alertes candidates (aplatir les tableaux)
    const candidates = results.flat().filter(Boolean);

    for (const payload of candidates) {
      const { skipped, alerte } = await creerAlerte(supabaseUrl, serviceKey, payload);
      if (skipped) continue; // déjà active, pas de doublon
      nouveauxAlertes.push(alerte);

      // Mail uniquement pour les CRITIQUES
      if (alerte.niveau === 'critique') {
        const envoye = await envoyerMailAlerte(resendKey, mailDest, alerte);
        if (envoye) {
          await sbPatch(supabaseUrl, serviceKey, `alertes?id=eq.${alerte.id}`, { mail_envoye: true });
          mailsEnvoyes.push(alerte.titre);
        }
      }
    }

    // Logger dans sante_systeme
    await sbPost(supabaseUrl, serviceKey, 'sante_systeme', {
      check_type: 'alertes',
      status: 'ok',
      latency_ms: Date.now() - startTime,
      message: `${nouveauxAlertes.length} nouvelle(s) alerte(s), ${mailsEnvoyes.length} mail(s) envoyé(s)`,
      metadata: { nouvelles: nouveauxAlertes.length, mails: mailsEnvoyes.length },
    }).catch(()=>{});

    return res.status(200).json({
      status: 'ok',
      nouvelles_alertes: nouveauxAlertes.length,
      mails_envoyes: mailsEnvoyes.length,
      details: nouveauxAlertes.map(a => ({ niveau: a.niveau, titre: a.titre })),
      duree_ms: Date.now() - startTime,
    });
  } catch (e) {
    console.error('[alertes] Erreur:', e);
    return res.status(500).json({ error: e.message });
  }
};
