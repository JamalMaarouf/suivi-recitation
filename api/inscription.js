// ═══════════════════════════════════════════════════════════════════════
// API : Inscription publique d'une nouvelle ecole + surveillant
// ═══════════════════════════════════════════════════════════════════════
//
// Cette API remplace le INSERT direct depuis le frontend pour ajouter :
// - Rate-limiting par IP (5/heure, 20/24h) base sur la table BDD
// - Hashage bcrypt du mot de passe (au lieu de stockage en clair)
// - Verification d'unicite de l'identifiant cote serveur
//
// Avant ce changement (mai 2026), le frontend appelait directement
// supabase.from('ecoles').insert() avec ANON_KEY -> aucune protection
// contre un script qui spammerait des creations d'ecoles fantomes.
//
// Architecture :
// 1. Frontend POST { nom, ville, telephone, email, prenom_surveillant,
//                    nom_surveillant, identifiant, mot_de_passe }
// 2. API verifie le rate-limit (count par IP sur 1h et 24h)
// 3. Si OK : verifie unicite identifiant, hash le mdp, INSERT ecole +
//    INSERT utilisateur, INSERT rate_limit (success=true)
// 4. Si KO : INSERT rate_limit (success=false), retourne 429
//
// Decisions Jamal (mai 2026) :
// - Q1=beta : 5/h + 20/24h (standard, anti-bot efficace)
// - Q2=a : IP uniquement (pas de CAPTCHA pour cette version)
// - Q3=i : stockage BDD (coherent avec stack)
// - Q4=b : message d'erreur avec canal de sortie (contact@tartily.com)
// ═══════════════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── Configuration rate-limit ─────────────────────────────────────────
const LIMIT_HOUR = 5;        // 5 inscriptions par IP par heure
const LIMIT_DAY = 20;        // 20 inscriptions par IP par 24h

// ── Configuration Cloudflare Turnstile (CAPTCHA invisible) ───────────
// Cloudflare verifie automatiquement si l'utilisateur est humain ou bot.
// Site Key (publique) est dans le frontend, Secret Key (privee) ici.
// Note : le domaine vercel.app n'est pas eligible cote Cloudflare Turnstile
// (politique de securite de CF). Donc on bypass le CAPTCHA en QA (tests
// internes) et on l'active uniquement sur tartily.com (Prod).
// Le rate-limit BDD continue de proteger les 2 environnements.
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// ── Utilities ────────────────────────────────────────────────────────

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Verifie un token Turnstile aupres de Cloudflare.
 * Retourne { success: true } si valide, sinon { success: false, error }.
 *
 * Si TURNSTILE_SECRET_KEY n'est pas configure (mode local/dev) OU si le
 * token est 'bypass' (envoye explicitement par QA), on retourne true.
 */
async function verifyTurnstileToken(token, ip) {
  // Mode bypass : QA ou local dev (pas de secret configure)
  if (!TURNSTILE_SECRET_KEY) {
    console.log('[inscription] Turnstile : pas de secret -> bypass');
    return { success: true, bypass: true };
  }

  // Mode bypass explicite (QA envoie 'bypass' car CAPTCHA inactif sur vercel.app)
  if (token === 'bypass') {
    console.log('[inscription] Turnstile : token bypass explicite (QA)');
    return { success: true, bypass: true };
  }

  if (!token) {
    return { success: false, error: 'missing_captcha_token' };
  }

  try {
    const body = new URLSearchParams();
    body.append('secret', TURNSTILE_SECRET_KEY);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    if (data.success === true) {
      return { success: true };
    }
    console.warn('[inscription] Turnstile rejected:', data['error-codes']);
    return { success: false, error: 'captcha_failed', codes: data['error-codes'] };
  } catch (err) {
    console.error('[inscription] Turnstile verification error:', err.message);
    // En cas d'erreur reseau Cloudflare, on REJETTE (fail-closed pour securite)
    return { success: false, error: 'captcha_verification_error' };
  }
}

// Fetch wrapper pour Supabase REST (utilise SERVICE_KEY qui bypass RLS)
async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const errMsg = (data && data.message) || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return data;
}

// Compte les inscriptions d'une IP sur une fenetre temporelle (en heures)
async function countAttemptsByIp(ip, windowHours) {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  // PostgREST : count via header
  const url = `/rate_limit_inscription?ip=eq.${encodeURIComponent(ip)}&created_at=gte.${encodeURIComponent(since)}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${url}`, {
    method: 'HEAD',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'count=exact',
    },
  });
  const contentRange = res.headers.get('content-range') || '0-0/0';
  const total = parseInt(contentRange.split('/')[1] || '0', 10);
  return total;
}

// Log une tentative (succes ou echec)
async function logAttempt(ip, success, ecoleId = null) {
  try {
    await supabaseFetch('/rate_limit_inscription', {
      method: 'POST',
      body: JSON.stringify({ ip, success, ecole_id: ecoleId }),
      prefer: 'return=minimal',
    });
  } catch (e) {
    // Log mais ne bloque pas l'inscription si le log echoue
    console.error('[inscription] logAttempt failed:', e.message);
  }
}

// ── Handler principal ─────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS basique (Vercel gere normalement, mais on s'assure)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[inscription] Missing env vars SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ip = getClientIp(req);

  try {
    // ─── 1. Validation des champs requis ─────────────────────────────
    const {
      nom, ville, pays, telephone, email,
      prenom_surveillant, nom_surveillant, identifiant, mot_de_passe,
      cgu_accepted, privacy_accepted,
      captcha_token,
    } = req.body || {};

    if (!nom || !ville || !prenom_surveillant || !identifiant || !mot_de_passe) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    if (!cgu_accepted || !privacy_accepted) {
      return res.status(400).json({ error: 'legal_not_accepted' });
    }

    if (String(mot_de_passe).length < 6) {
      return res.status(400).json({ error: 'password_too_short' });
    }

    // ─── 2. Verification CAPTCHA (Cloudflare Turnstile) ──────────────
    // En Prod (tartily.com) : Turnstile fait sa magie et envoie un token.
    // En QA (vercel.app) : Turnstile n'est pas active -> token='bypass' -> OK.
    const captchaResult = await verifyTurnstileToken(captcha_token, ip);
    if (!captchaResult.success) {
      // Log la tentative (pour stats anti-bot)
      await logAttempt(ip, false);
      return res.status(403).json({
        error: captchaResult.error || 'captcha_failed',
      });
    }

    // ─── 3. Rate-limit check ─────────────────────────────────────────
    const [countHour, countDay] = await Promise.all([
      countAttemptsByIp(ip, 1),
      countAttemptsByIp(ip, 24),
    ]);

    if (countHour >= LIMIT_HOUR || countDay >= LIMIT_DAY) {
      // Log l'echec (utile pour stats anti-spam)
      await logAttempt(ip, false);
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        retryAfter: countHour >= LIMIT_HOUR ? 3600 : 86400,
      });
    }

    // ─── 3. Verification d'unicite de l'identifiant ──────────────────
    const existing = await supabaseFetch(
      `/utilisateurs?identifiant=eq.${encodeURIComponent(String(identifiant).trim())}&select=id`,
      { method: 'GET' }
    );
    if (Array.isArray(existing) && existing.length > 0) {
      await logAttempt(ip, false);
      return res.status(409).json({ error: 'identifiant_taken' });
    }

    // ─── 4. Hashage du mot de passe (bcrypt 10 rounds) ───────────────
    const hashedPassword = await bcrypt.hash(String(mot_de_passe), 10);

    // ─── 5. Generation code_acces (ECO-XXXXXX) ───────────────────────
    const code_acces = 'ECO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const acceptedAt = new Date().toISOString();

    // ─── 6. INSERT ecole (statut en_attente, validation par super-admin) ─
    const ecoles = await supabaseFetch('/ecoles', {
      method: 'POST',
      body: JSON.stringify({
        nom: String(nom).trim(),
        ville: String(ville).trim(),
        pays: pays || 'MA',
        telephone: telephone || null,
        email: email || null,
        code_acces,
        statut: 'en_attente',
        cgu_accepted_at: acceptedAt,
        cgu_version: '1.0',
        privacy_accepted_at: acceptedAt,
        privacy_version: '1.0',
      }),
    });

    if (!Array.isArray(ecoles) || ecoles.length === 0) {
      await logAttempt(ip, false);
      return res.status(500).json({ error: 'ecole_creation_failed' });
    }
    const ecole = ecoles[0];

    // ─── 7. INSERT utilisateur surveillant (statut en_attente) ───────
    try {
      await supabaseFetch('/utilisateurs', {
        method: 'POST',
        body: JSON.stringify({
          prenom: String(prenom_surveillant).trim(),
          nom: String(nom_surveillant || '').trim(),
          identifiant: String(identifiant).trim(),
          mot_de_passe: hashedPassword,
          role: 'surveillant',
          ecole_id: ecole.id,
          statut_compte: 'en_attente',
        }),
        prefer: 'return=minimal',
      });
    } catch (errUser) {
      // Rollback : supprimer l'ecole creee si l'utilisateur n'a pas pu etre cree
      try {
        await supabaseFetch(`/ecoles?id=eq.${ecole.id}`, {
          method: 'DELETE',
          prefer: 'return=minimal',
        });
      } catch (rollbackErr) {
        console.error('[inscription] Rollback failed:', rollbackErr.message);
      }
      await logAttempt(ip, false);
      throw errUser;
    }

    // ─── 8. Log de la tentative reussie ──────────────────────────────
    await logAttempt(ip, true, ecole.id);

    return res.status(200).json({
      success: true,
      ecole_id: ecole.id,
      code_acces,
    });
  } catch (err) {
    console.error('[inscription] Error:', err.message);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
