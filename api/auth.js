// API d'authentification sécurisée avec bcryptjs
// Remplace la comparaison mot_de_passe en clair dans Login.js

const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function query(table, filters = {}, select = '*') {
  const params = new URLSearchParams({ select });
  Object.entries(filters).forEach(([k, v]) => params.set(k, `eq.${v}`));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  return res.json();
}

async function update(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  return res.ok;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { identifiant, mot_de_passe, action } = req.body || {};

  // ── LOGIN ────────────────────────────────────────────────────────
  if (action === 'login') {
    if (!identifiant || !mot_de_passe) {
      return res.status(400).json({ error: 'Champs manquants' });
    }

    // Chercher l'utilisateur par identifiant
    const users = await query('utilisateurs', { identifiant: identifiant.trim() }, 
      '*,ecole:ecole_id(id,nom,ville,statut)');
    
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    const user = users[0];

    // Vérification statut compte
    if (user.statut_compte === 'en_attente') {
      return res.status(403).json({ error: 'compte_en_attente' });
    }
    if (user.statut_compte === 'suspendu') {
      return res.status(403).json({ error: 'compte_suspendu' });
    }

    let passwordOk = false;

    // Cas 1 : mot de passe déjà hashé (commence par $2b$ ou $2a$)
    if (user.mot_de_passe && user.mot_de_passe.startsWith('$2')) {
      passwordOk = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    } else {
      // Cas 2 : mot de passe en clair — on compare ET on migre vers le hash
      passwordOk = (user.mot_de_passe === mot_de_passe);
      if (passwordOk) {
        // Migration silencieuse : on hash le mot de passe pour la prochaine fois
        const hashed = await bcrypt.hash(mot_de_passe, 10);
        await update('utilisateurs', user.id, { mot_de_passe: hashed });
      }
    }

    if (!passwordOk) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    // Retourner l'utilisateur sans le mot de passe
    const { mot_de_passe: _, ...safeUser } = user;
    return res.status(200).json({ user: safeUser });
  }

  // ── CHANGE PASSWORD ──────────────────────────────────────────────
  if (action === 'change_password') {
    const { user_id, old_password, new_password } = req.body || {};
    if (!user_id || !old_password || !new_password) {
      return res.status(400).json({ error: 'Champs manquants' });
    }
    if (new_password.length < 4) {
      return res.status(400).json({ error: 'Mot de passe trop court (min 4 caractères)' });
    }

    const users = await query('utilisateurs', { id: user_id });
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    const user = users[0];

    // Vérifier l'ancien mot de passe
    let oldOk = false;
    if (user.mot_de_passe && user.mot_de_passe.startsWith('$2')) {
      oldOk = await bcrypt.compare(old_password, user.mot_de_passe);
    } else {
      oldOk = (user.mot_de_passe === old_password);
    }

    if (!oldOk) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await update('utilisateurs', user.id, { mot_de_passe: hashed });
    return res.status(200).json({ success: true });
  }

  // ── HASH ADMIN (migration manuelle si besoin) ────────────────────
  if (action === 'hash_password') {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Mot de passe manquant' });
    const hashed = await bcrypt.hash(password, 10);
    return res.status(200).json({ hashed });
  }

  return res.status(400).json({ error: 'Action non reconnue' });
};
