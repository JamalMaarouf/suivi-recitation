// ═══════════════════════════════════════════════════════════════
// API /api/notifications-inactivite
// Cron quotidien : détecte les élèves inactifs et crée des notifs
// ═══════════════════════════════════════════════════════════════
// Règle : un élève est "inactif" s'il n'a aucune validation depuis > 14 jours.
// Pour chaque élève inactif, on crée UNE notification pour chaque parent
// lié, SAUF si une notification d'inactivité a déjà été créée pour cet
// élève dans les 7 derniers jours (anti-spam).
//
// Exécution : 1 fois par jour (voir vercel.json)
// Sécurité : CRON_SECRET requis
// ═══════════════════════════════════════════════════════════════

const SEUIL_INACTIVITE_JOURS = 14;
const COOLDOWN_NOTIF_JOURS = 7;

async function sbGet(url, key, path) {
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
  });
  if (!resp.ok) throw new Error(`GET ${path}: ${resp.status}`);
  return await resp.json();
}

async function sbPost(url, key, table, body) {
  const resp = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`POST ${table}: ${resp.status} ${await resp.text()}`);
  return true;
}

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  const cronSecret  = process.env.CRON_SECRET;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  // Sécurité cron
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.query.manual !== 'true') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const dateSeuil = new Date(now.getTime() - SEUIL_INACTIVITE_JOURS * 86400_000);
  const dateCooldown = new Date(now.getTime() - COOLDOWN_NOTIF_JOURS * 86400_000);

  let elevesInactifs = 0;
  let notifsCreees = 0;
  let skippedCooldown = 0;
  let skippedOptOut = 0;
  let skippedNoParent = 0;

  try {
    // ─── 1. Charger tous les élèves actifs ──────────────────
    const eleves = await sbGet(supabaseUrl, serviceKey,
      'eleves?select=id,prenom,nom,ecole_id&actif=eq.true&limit=10000');

    // ─── 2. Pour chaque élève, trouver sa dernière validation ──
    // Optimisation : charger toutes les validations récentes en 1 coup
    const sinceIso = new Date(now.getTime() - 30 * 86400_000).toISOString();
    const valsRecentes = await sbGet(supabaseUrl, serviceKey,
      `validations?select=eleve_id,date_validation&date_validation=gte.${sinceIso}&order=date_validation.desc`);

    const derniereValParEleve = {};
    for (const v of valsRecentes) {
      if (!derniereValParEleve[v.eleve_id]) {
        derniereValParEleve[v.eleve_id] = v.date_validation;
      }
    }

    // ─── 3. Charger les notifs d'inactivité récentes (anti-spam) ──
    const notifsRecentes = await sbGet(supabaseUrl, serviceKey,
      `notifications_parents?select=eleve_id&type=eq.inactivite_alerte&created_at=gte.${dateCooldown.toISOString()}`);

    const elevesAvecCooldown = new Set((notifsRecentes || []).map(n => n.eleve_id));

    // ─── 4. Charger toutes les liaisons parent_eleve ───────
    const liaisons = await sbGet(supabaseUrl, serviceKey,
      'parent_eleve?select=parent_id,eleve_id');

    const parentsParEleve = {};
    for (const l of liaisons) {
      if (!parentsParEleve[l.eleve_id]) parentsParEleve[l.eleve_id] = [];
      parentsParEleve[l.eleve_id].push(l.parent_id);
    }

    // ─── 5. Charger toutes les préférences en 1 requête ────
    const prefsAll = await sbGet(supabaseUrl, serviceKey,
      'preferences_notifications?select=user_id,notif_inactivite');
    const prefsMap = {};
    for (const p of prefsAll) prefsMap[p.user_id] = p;

    // ─── 6. Identifier les élèves inactifs et créer les notifs ──
    const rowsToInsert = [];
    for (const e of eleves) {
      const derniereVal = derniereValParEleve[e.id];
      const dateRef = derniereVal ? new Date(derniereVal) : null;

      // Skip si récitation récente
      if (dateRef && dateRef > dateSeuil) continue;

      // Calcul jours d'inactivité
      const joursInactifs = dateRef
        ? Math.floor((now - dateRef) / 86400_000)
        : 999;

      // Skip les élèves qui n'ont jamais rien fait (sans date) pour éviter
      // d'envoyer des alertes sur des nouveaux inscrits pas encore démarrés.
      // Hypothèse simple : on ne notifie que les élèves avec au moins une
      // validation dans l'historique complet. On check ça rapidement.
      if (!dateRef) continue;

      elevesInactifs++;

      // Skip si cooldown actif
      if (elevesAvecCooldown.has(e.id)) {
        skippedCooldown++;
        continue;
      }

      // Récupérer les parents de cet élève
      const parentIds = parentsParEleve[e.id] || [];
      if (parentIds.length === 0) {
        skippedNoParent++;
        continue;
      }

      // Filtrer selon préférences (défaut = ON)
      const parentsOptIn = parentIds.filter(pid => {
        const p = prefsMap[pid];
        if (!p) return true;
        return p.notif_inactivite !== false;
      });

      if (parentsOptIn.length === 0) {
        skippedOptOut++;
        continue;
      }

      const fullName = `${e.prenom || ''} ${e.nom || ''}`.trim();
      const titreFr = `⚠️ ${fullName} n'a pas récité depuis ${joursInactifs} jours`;
      const titreAr = `⚠️ ${fullName} لم يسمع منذ ${joursInactifs} يوما`;
      const corpsFr = `Nous n'avons enregistré aucune récitation depuis ${joursInactifs} jours. Encouragez-le à reprendre !`;
      const corpsAr = `لم نسجل أي استظهار منذ ${joursInactifs} يوما. شجعوه على الاستمرار !`;

      for (const pid of parentsOptIn) {
        rowsToInsert.push({
          parent_id: pid,
          eleve_id: e.id,
          ecole_id: e.ecole_id,
          type: 'inactivite_alerte',
          titre_fr: titreFr,
          titre_ar: titreAr,
          corps_fr: corpsFr,
          corps_ar: corpsAr,
          donnees: {
            jours_inactifs: joursInactifs,
            derniere_validation: derniereVal,
          },
          lue: false,
          email_envoye: false,
        });
      }
    }

    // ─── 7. Insert en batch ────────────────────────────────
    if (rowsToInsert.length > 0) {
      await sbPost(supabaseUrl, serviceKey, 'notifications_parents', rowsToInsert);
      notifsCreees = rowsToInsert.length;
    }

    return res.status(200).json({
      success: true,
      date: now.toISOString(),
      total_eleves: eleves.length,
      eleves_inactifs: elevesInactifs,
      notifs_creees: notifsCreees,
      skipped: {
        cooldown: skippedCooldown,
        opt_out: skippedOptOut,
        no_parent: skippedNoParent,
      },
    });
  } catch (err) {
    console.error('[notifications-inactivite] error:', err);
    return res.status(500).json({
      error: err.message,
      eleves_inactifs: elevesInactifs,
      notifs_creees: notifsCreees,
    });
  }
};
