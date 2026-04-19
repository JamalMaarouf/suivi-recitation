// Vercel Serverless Function - Ping anti-suspension Supabase
// ═════════════════════════════════════════════════════════════════
// Rôle : maintenir Supabase Free actif (suspension après 7 jours d'inactivité)
// + enregistrer chaque ping dans sante_systeme pour visibilité.
//
// Exécution : cron Vercel 3 fois par semaine (lundi, mercredi, vendredi à 10h UTC)
// Voir vercel.json.
//
// Sécurité : vérification du CRON_SECRET (même mécanisme que /api/backup).
// ═════════════════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  const cronSecret  = process.env.CRON_SECRET;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Missing env vars',
      has_url: !!supabaseUrl,
      has_service_key: !!serviceKey,
    });
  }

  // Security check : cron Vercel OU appel manuel ?manual=true
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.query.manual !== 'true') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  let status = 'ok';
  let message = '';
  let nbEcoles = 0;

  try {
    // 1. Requête légère sur une table système pour "toucher" Supabase
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/ecoles?select=id&limit=5`,
      {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact',
        },
      }
    );

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text().then(t => t.slice(0, 100))}`);
    }

    const data = await resp.json();
    nbEcoles = Array.isArray(data) ? data.length : 0;
    message = `Ping OK · ${nbEcoles} école(s) retournée(s)`;
  } catch (err) {
    status = 'error';
    message = `Ping ÉCHEC : ${err.message}`;
  }

  const latency_ms = Date.now() - startTime;

  // 2. Enregistrer le résultat dans sante_systeme (même si erreur)
  try {
    await fetch(`${supabaseUrl}/rest/v1/sante_systeme`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        check_type: 'ping_supabase',
        status,
        latency_ms,
        message,
        metadata: { nb_ecoles: nbEcoles, source: 'cron_ping' },
      }),
    });
  } catch (e) {
    // Non bloquant — si même cette écriture échoue, Supabase est vraiment down
    console.error('[ping-supabase] Impossible d\'écrire dans sante_systeme:', e.message);
  }

  // 3. Si erreur, alerte par mail (à implémenter dans Itération 2)
  // TODO Itération 2 : si status === 'error' + derniers 2 pings en erreur → mail

  return res.status(status === 'ok' ? 200 : 500).json({
    status,
    latency_ms,
    message,
    nb_ecoles: nbEcoles,
    timestamp: new Date().toISOString(),
  });
};
