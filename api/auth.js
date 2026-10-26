// API d'authentification sécurisée avec bcryptjs
// Remplace la comparaison mot_de_passe en clair dans Login.js

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

// ── LIMITE PAR ADRESSE IP (oct 2026) ────────────────────────────
// Complement de la limite IP+identifiant ci-dessus : bloque quelqu'un qui essaie
// beaucoup d'identifiants differents depuis la meme adresse. Stockee en base
// (table connexions_echouees) pour tenir entre les instances serverless.
// Seuil large : une mosquee partage souvent une seule adresse wifi.
// Table absente ou erreur -> on laisse passer (jamais bloquer un login legitime).
const IP_MAX_ECHECS = 30;
async function echecsRecentsIp(ip) {
  try {
    const depuis = new Date(Date.now() - WINDOW_MS).toISOString();
    const params = new URLSearchParams({ select: 'id', ip: `eq.${ip}`, created_at: `gte.${depuis}` });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/connexions_echouees?${params}`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'count=exact',
      },
    });
    if (!res.ok) return 0;
    const cr = res.headers.get('content-range') || '';
    const total = parseInt(cr.split('/')[1], 10);
    return Number.isFinite(total) ? total : 0;
  } catch (e) { return 0; }
}
async function noterEchecIp(ip) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/connexions_echouees`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ ip }),
    });
    // Menage occasionnel (lignes de plus d'un jour)
    if (Math.random() < 0.02) {
      const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      await fetch(`${SUPABASE_URL}/rest/v1/connexions_echouees?created_at=lt.${encodeURIComponent(hier)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
      });
    }
  } catch (e) { /* non bloquant */ }
}

// Mot de passe initial d'un parent ? (jamais connecte = stocke en clair, ou egal au
// mot de passe par defaut de son ecole / au defaut historique 'parent2024')
function estMdpInitialParent(user, motDePasseTape) {
  if (!user || user.role !== 'parent') return false;
  const stocke = user.mot_de_passe || '';
  if (stocke && !stocke.startsWith('$2')) return true;
  const defautEcole = (user.ecole && user.ecole.mdp_defaut_parents) || '';
  return motDePasseTape === 'parent2024' || (!!defautEcole && motDePasseTape === defautEcole);
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

// ── SESSION SIGNEE (oct 2026) ──────────────────────────────────────
// Le serveur signe (HS256, secret JWT du projet Supabase) l'ecole, le parent et le statut
// super-admin de l'utilisateur. La base lit ces informations dans la signature (impossible
// a falsifier depuis le navigateur) au lieu des en-tetes x-tartily-*.
// Sans SUPABASE_JWT_SECRET configure : aucun jeton, comportement identique a avant.
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const JWT_DUREE_S = 30 * 24 * 3600; // 30 jours, renouvele automatiquement par l'app

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signerJeton(user) {
  if (!JWT_SECRET) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: 'anon',               // memes droits Postgres qu'aujourd'hui (cle anon)
    tartily: 1,
    sub: user.id,
    user_role: user.role,
    ecole_id: user.role === 'super_admin' ? null : (user.ecole_id || null),
    parent_id: user.role === 'parent' ? user.id : null,
    super_admin: user.role === 'super_admin',
    iat: now,
    exp: now + JWT_DUREE_S,
  };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest());
  return header + '.' + body + '.' + sig;
}
function verifierJeton(token) {
  if (!JWT_SECRET || !token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const attendu = b64url(crypto.createHmac('sha256', JWT_SECRET).update(parts[0] + '.' + parts[1]).digest());
  const a = Buffer.from(attendu), b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
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

    // Limite globale par adresse IP (essais sur de nombreux identifiants)
    if (await echecsRecentsIp(ip) >= IP_MAX_ECHECS) {
      res.setHeader('Retry-After', String(WINDOW_MS / 1000));
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: WINDOW_MS / 1000 });
    }

    // Chercher l'utilisateur par identifiant
    const SELECT_LOGIN = '*,ecole:ecole_id(id,nom,ville,statut,mdp_defaut_parents)';
    let users = await query('utilisateurs', { identifiant: identifiant.trim() }, SELECT_LOGIN);

    // Saisie sans majuscules sur telephone ("tqw-74a" pour "TQW-74A") : repli insensible
    // a la casse, accepte seulement s'il designe UN seul compte.
    if ((!Array.isArray(users) || users.length === 0) && /^[\p{L}\p{N}._@-]+$/u.test(identifiant.trim())) {
      try {
        const params = new URLSearchParams({ select: SELECT_LOGIN, identifiant: `ilike.${identifiant.trim().replace(/[\\%_]/g, m => '\\' + m)}`, limit: '2' });
        const r = await fetch(`${SUPABASE_URL}/rest/v1/utilisateurs?${params}`, {
          headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
        });
        const cand = await r.json();
        if (Array.isArray(cand) && cand.length === 1) users = cand;
      } catch (e) { /* repli non bloquant */ }
    }

    if (!Array.isArray(users) || users.length === 0) {
      recordFailedAttempt(rlKey);
      await noterEchecIp(ip);
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    const user = users[0];

    // SOFT-DELETE : un utilisateur supprime ne peut plus se connecter
    if (user.deleted_at) {
      recordFailedAttempt(rlKey);
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    // SUSPENSION (Etape 7) : un instituteur/parent suspendu ne peut plus se connecter
    if (user.suspendu_at) {
      recordFailedAttempt(rlKey);
      return res.status(403).json({ error: 'compte_suspendu' });
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
      // Migration silencieuse vers le hash — sauf pour un parent qui doit d'abord
      // choisir son mot de passe (il sera hashe a ce moment-la).
      if (passwordOk && !estMdpInitialParent(user, mot_de_passe)) {
        const hashed = await bcrypt.hash(mot_de_passe, 10);
        await update('utilisateurs', user.id, { mot_de_passe: hashed });
      }
    }

    if (!passwordOk) {
      recordFailedAttempt(rlKey);
      await noterEchecIp(ip);
      const after = checkRateLimit(rlKey);
      const remaining = after.blocked ? 0 : after.remaining;
      return res.status(401).json({
        error: 'Identifiant ou mot de passe incorrect',
        remaining, // tentatives restantes avant blocage (pour UX côté client)
      });
    }

    // Succès → on clear le compteur pour cette combinaison
    clearRateLimit(rlKey);

    // Securite (oct 2026) : un parent encore sur son mot de passe initial (commun a
    // l'ecole) doit d'abord choisir le sien. Pas de session tant que ce n'est pas fait :
    // le client affiche l'ecran de choix, appelle change_password puis se reconnecte.
    if (estMdpInitialParent(user, mot_de_passe)) {
      return res.status(200).json({ changement_mdp_requis: true, user_id: user.id, identifiant: user.identifiant });
    }

    // Mise à jour derniere_connexion (pour le cockpit SuperAdmin)
    // Non bloquant : si ça échoue le login continue normalement
    try {
      await update('utilisateurs', user.id, { derniere_connexion: new Date().toISOString() });
    } catch (e) { /* non bloquant */ }

    // Retourner l'utilisateur sans le mot de passe
    const { mot_de_passe: _, ...safeUser } = user;
    if (safeUser.ecole) { const { mdp_defaut_parents: _d, ...ecoleSure } = safeUser.ecole; safeUser.ecole = ecoleSure; }
    return res.status(200).json({ user: safeUser, token: signerJeton(user) });
  }

  // ── CAPACITES / RENOUVELLEMENT DE SESSION (oct 2026) ─────────────
  if (action === 'capabilities') {
    return res.status(200).json({ jwt: !!JWT_SECRET });
  }
  if (action === 'refresh') {
    const payload = verifierJeton((req.body || {}).token);
    if (!payload) return res.status(401).json({ error: 'session_invalide' });
    const users = await query('utilisateurs', { id: payload.sub });
    const u = users && users[0];
    if (!u || u.deleted_at || u.suspendu_at || u.statut_compte === 'suspendu' || u.statut_compte === 'en_attente') {
      return res.status(401).json({ error: 'session_invalide' });
    }
    return res.status(200).json({ token: signerJeton(u) });
  }

  // ── CHANGE PASSWORD ──────────────────────────────────────────────
  if (action === 'change_password') {
    const { user_id, old_password, new_password } = req.body || {};
    if (!user_id || !old_password || !new_password) {
      return res.status(400).json({ error: 'Champs manquants' });
    }
    // securite (oct 2026) : meme limite de tentatives que le login
    const rlKeyPwd = rateLimitKey(getClientIp(req), 'pwd:' + user_id);
    const rlPwd = checkRateLimit(rlKeyPwd);
    if (rlPwd.blocked) {
      res.setHeader('Retry-After', String(rlPwd.retryAfter));
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: rlPwd.retryAfter });
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

    // SUSPENSION (Etape 7) : un utilisateur suspendu ne peut plus changer son MDP
    if (user.suspendu_at) {
      return res.status(403).json({ error: 'compte_suspendu' });
    }

    // Vérifier l'ancien mot de passe
    let oldOk = false;
    if (user.mot_de_passe && user.mot_de_passe.startsWith('$2')) {
      oldOk = await bcrypt.compare(old_password, user.mot_de_passe);
    } else {
      oldOk = (user.mot_de_passe === old_password);
    }

    if (!oldOk) {
      recordFailedAttempt(rlKeyPwd);
      return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
    }
    clearRateLimit(rlKeyPwd);

    // Le nouveau mot de passe doit etre different de l'ancien (et, pour un parent,
    // du mot de passe initial commun de l'ecole).
    if (new_password === old_password) {
      return res.status(400).json({ error: 'mdp_identique' });
    }
    if (user.role === 'parent') {
      let defautEcole = '';
      try {
        const ec = await query('ecoles', { id: user.ecole_id }, 'mdp_defaut_parents');
        defautEcole = (Array.isArray(ec) && ec[0] && ec[0].mdp_defaut_parents) || '';
      } catch (e) { /* */ }
      if (new_password === 'parent2024' || (defautEcole && new_password === defautEcole)) {
        return res.status(400).json({ error: 'mdp_identique' });
      }
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await update('utilisateurs', user.id, { mot_de_passe: hashed });
    return res.status(200).json({ success: true });
  }

  // ── CHANGE EMAIL (oct 2026) ──────────────────────────────────────
  // Avant : le portail parent ecrivait l'email directement depuis le navigateur.
  // Maintenant : verifie le mot de passe actuel cote serveur (meme limite de tentatives que le login).
  if (action === 'change_email') {
    const { user_id, password } = req.body || {};
    const email = (req.body?.email || '').trim() || null;
    if (!user_id || !password) {
      return res.status(400).json({ error: 'Champs manquants' });
    }
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ error: 'email_invalide' });
    }

    const ip = getClientIp(req);
    const rlKey = rateLimitKey(ip, 'email:' + user_id);
    const rlState = checkRateLimit(rlKey);
    if (rlState.blocked) {
      res.setHeader('Retry-After', String(rlState.retryAfter));
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: rlState.retryAfter });
    }

    const users = await query('utilisateurs', { id: user_id });
    if (!users || users.length === 0 || users[0].deleted_at) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    const user = users[0];
    if (user.suspendu_at) {
      return res.status(403).json({ error: 'compte_suspendu' });
    }

    let pwdOk = false;
    if (user.mot_de_passe && user.mot_de_passe.startsWith('$2')) {
      pwdOk = await bcrypt.compare(password, user.mot_de_passe);
    } else {
      pwdOk = (user.mot_de_passe === password);
    }
    if (!pwdOk) {
      recordFailedAttempt(rlKey);
      return res.status(401).json({ error: 'mot_de_passe_incorrect' });
    }
    clearRateLimit(rlKey);

    const ok = await update('utilisateurs', user.id, { email });
    if (!ok) return res.status(500).json({ error: 'Erreur de sauvegarde' });
    return res.status(200).json({ success: true, email });
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

// Exposition pour les tests unitaires (sans effet sur l'API)
module.exports._jeton = { signerJeton, verifierJeton };
