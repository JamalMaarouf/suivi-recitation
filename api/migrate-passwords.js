// Script de migration unique — hache TOUS les mots de passe en clair
// Accessible via GET /api/migrate-passwords?secret=MIGRATION_SECRET
// À SUPPRIMER après migration

const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SECRET = process.env.MIGRATION_SECRET || 'migrate2024';

  // Protection
  const { secret } = req.query;
  if (secret !== SECRET) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Charger tous les utilisateurs
    const r = await fetch(`${SUPABASE_URL}/rest/v1/utilisateurs?select=id,identifiant,mot_de_passe,role`, { headers });
    const users = await r.json();

    if (!Array.isArray(users)) {
      return res.status(500).json({ error: 'Impossible de charger les utilisateurs', raw: users });
    }

    const results = { migrated: [], already_hashed: [], errors: [] };

    for (const user of users) {
      const pwd = user.mot_de_passe;

      // Déjà hashé
      if (pwd && (pwd.startsWith('$2b$') || pwd.startsWith('$2a$'))) {
        results.already_hashed.push(user.identifiant);
        continue;
      }

      // Vide ou null
      if (!pwd) {
        results.errors.push({ id: user.identifiant, reason: 'mot_de_passe vide' });
        continue;
      }

      // Hacher
      try {
        const hashed = await bcrypt.hash(pwd, 10);
        const patch = await fetch(
          `${SUPABASE_URL}/rest/v1/utilisateurs?id=eq.${user.id}`,
          {
            method: 'PATCH',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mot_de_passe: hashed }),
          }
        );
        if (patch.ok) {
          results.migrated.push(user.identifiant);
        } else {
          const errText = await patch.text();
          results.errors.push({ id: user.identifiant, reason: errText.slice(0, 100) });
        }
      } catch (e) {
        results.errors.push({ id: user.identifiant, reason: e.message });
      }
    }

    return res.status(200).json({
      total: users.length,
      migrated: results.migrated.length,
      already_hashed: results.already_hashed.length,
      errors: results.errors.length,
      details: results,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
