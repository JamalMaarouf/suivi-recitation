// API d'authentification sécurisée avec bcryptjs
// Remplace la comparaison mot_de_passe en clair dans Login.js

const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── RATE LIMITING LOGIN ──────────────────────────────────────────
// 5 tentatives échouées / 15 minutes par combinaison IP + identifiant
// Stockage en mémoire du container serverless (Vercel warm start conserve la Map)
// Pour un usage multi-container, passer à Supabase ou Upstash — pour l'échelle
// actuelle (<10 écoles × quelques logins/jour), la mémoire suffit largement.
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const rateLimitStore = new Map(); // key -> { count, firstAttempt, blockedUntil }

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function rateLimitKey(ip, identifiant) {
  return `${ip}:${(identifiant || '').toLowerCase().trim()}`;
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Nettoyage occasionnel pour éviter la fuite mémoire (1% de chance par appel)
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.blockedUntil && v.blockedUntil < now) rateLimitStore.delete(k);
      else if (!v.blockedUntil && now - v.firstAttempt > WINDOW_MS) rateLimitStore.delete(k);
    }
  }

  if (!entry) return { blocked: false, remaining: MAX_ATTEMPTS };

  // Si bloqué et fenêtre pas expirée
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return { blocked: true, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  // Fenêtre expirée → reset
  if (now - entry.firstAttempt > WINDOW_MS) {
    rateLimitStore.delete(key);
    return { blocked: false, remaining: MAX_ATTEMPTS };
  }

  return { blocked: false, remaining: Math.max(0, MAX_ATTEMPTS - entry.count) };
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, firstAttempt: now, blockedUntil: null });
    return;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + WINDOW_MS;
  }
}

function clearRateLimit(key) {
  rateLimitStore.delete(key);
}

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

    // Rate limit check AVANT toute requête DB
    const ip = getClientIp(req);
    const rlKey = rateLimitKey(ip, identifiant);
    const rlState = checkRateLimit(rlKey);

    if (rlState.blocked) {
      res.setHeader('Retry-After', String(rlState.retryAfter));
      return res.status(429).json({
        error: 'too_many_attempts',
        retryAfter: rlState.retryAfter, // secondes
        message: `Trop de tentatives. Réessayez dans ${Math.ceil(rlState.retryAfter / 60)} minute(s).`,
      });
    }

    // Chercher l'utilisateur par identifiant
    const users = await query('utilisateurs', { identifiant: identifiant.trim() },
      '*,ecole:ecole_id(id,nom,ville,statut)');

    if (!users || users.length === 0) {
      recordFailedAttempt(rlKey);
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    const user = users[0];

    // SOFT-DELETE : un utilisateur supprime ne peut plus se connecter
    if (user.deleted_at) {
      recordFailedAttempt(rlKey);
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    // Vérification statut compte (on ne compte PAS ces cas dans le rate limit —
    // le compte existe et le mot de passe n'a pas encore été testé)
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
      recordFailedAttempt(rlKey);
      const after = checkRateLimit(rlKey);
      const remaining = after.blocked ? 0 : after.remaining;
      return res.status(401).json({
        error: 'Identifiant ou mot de passe incorrect',
        remaining, // tentatives restantes avant blocage (pour UX côté client)
      });
    }

    // Succès → on clear le compteur pour cette combinaison
    clearRateLimit(rlKey);

    // Mise à jour derniere_connexion (pour le cockpit SuperAdmin)
    // Non bloquant : si ça échoue le login continue normalement
    try {
      await update('utilisateurs', user.id, { derniere_connexion: new Date().toISOString() });
    } catch (e) { /* non bloquant */ }

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

    // SOFT-DELETE : un utilisateur supprime ne peut plus changer son MDP
    if (user.deleted_at) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

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
