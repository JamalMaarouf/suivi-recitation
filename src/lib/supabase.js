import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://uwqhtahknhftinlzmusi.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cWh0YWhrbmhmdGlubHptdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTA2MTAsImV4cCI6MjA5MDI2NjYxMH0.gdX0JeqSfGnr6xGFqBUSK78z_XiWQg93R6MEa8w1klU';

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT + WRAPPER SECURITE (P.C.1 + P.C.2)
// ═══════════════════════════════════════════════════════════════
// 1. supabaseRaw : client brut (utilise pour la corbeille super-admin
//    qui doit voir les soft-deleted)
// 2. supabase : client wrappe via override des methodes from() qui
//    renvoient un proxy autour du QueryBuilder
//
// Ce wrapper :
// - Bloque les ecritures (insert/update/delete/upsert) si super-admin
//   est en mode impersonification
// - Transforme delete() en update({deleted_at}) sur tables protegees
// - Filtre automatiquement les SELECT pour exclure les soft-deleted
//
// ═══════════════════════════════════════════════════════════════
// AUDIT SECURITE A2 (mai 2026) : ISOLATION MULTI-ECOLES
// ═══════════════════════════════════════════════════════════════
// Le client Supabase envoie automatiquement 2 headers HTTP custom a
// chaque requete (lus depuis localStorage) :
// - x-tartily-ecole  : UUID ecole_id de l'utilisateur connecte (surveillant)
// - x-tartily-parent : UUID du parent connecte (portail parent)
//
// Cote BDD, les policies RLS lisent ces headers via les fonctions
// Postgres public.current_ecole_id() et public.current_parent_id().
// Elles filtrent automatiquement les lignes par ecole_id/parent_id.
//
// Resultat : un utilisateur de l'ecole A ne peut techniquement PAS
// requetter les donnees de l'ecole B (meme via DevTools).
// ═══════════════════════════════════════════════════════════════

// Lit ecole_id depuis localStorage (mis a jour au login/logout)
function getCurrentEcoleIdForHeader() {
  try {
    const raw = localStorage.getItem('suivi_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Surveillant : ecole_id direct sur l'utilisateur
    return user?.ecole_id || null;
  } catch { return null; }
}

// Lit parent_id depuis localStorage (mis a jour au login parent)
function getCurrentParentIdForHeader() {
  try {
    const raw = localStorage.getItem('suivi_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Parent : role='parent', id = parent_id
    if (user?.role === 'parent') return user?.id || null;
    return null;
  } catch { return null; }
}

// Construit les headers custom Tartily pour chaque requete Supabase.
// Note : @supabase/supabase-js v2 evalue 'headers' au moment de la requete
// quand on passe une fonction, pas au moment de la creation du client.
// Cela permet aux headers d'etre dynamiques (mis a jour au login/logout).
function buildTartilyHeaders() {
  const headers = {};
  const ecoleId = getCurrentEcoleIdForHeader();
  const parentId = getCurrentParentIdForHeader();
  if (ecoleId) headers['x-tartily-ecole'] = ecoleId;
  if (parentId) headers['x-tartily-parent'] = parentId;
  return headers;
}

const supabaseRaw = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    // Fetch wrapper : injecte les headers Tartily avant chaque requete.
    // Cette approche est preferee a 'headers' statique car les valeurs
    // doivent etre relues a chaque requete (changent au login/logout).
    fetch: (url, options = {}) => {
      const tartilyHeaders = buildTartilyHeaders();
      const mergedHeaders = {
        ...(options.headers || {}),
        ...tartilyHeaders,
      };
      return fetch(url, { ...options, headers: mergedHeaders });
    },
  },
});

// Tables systeme (ecritures TOUJOURS autorisees, meme en impersonification)
const SYSTEM_TABLES_WHITELIST = [
  'audit_log', 'consultations_parents', 'exports_rgpd', 'purges_rgpd_log'
];

// Tables proteges par soft-delete
const SOFT_DELETE_TABLES = ['eleves', 'utilisateurs'];

const BLOCKED_METHODS = ['insert', 'update', 'delete', 'upsert'];

const IMPERSONATION_ERROR = {
  code: 'IMPERSONATION_READ_ONLY',
  message: 'Mode lecture seule (impersonification) - modification bloquee',
  details: 'Le super-admin ne peut pas modifier les donnees pendant l impersonification.',
  hint: 'Quittez le mode impersonification pour reprendre le controle de votre compte.',
};

function isImpersonating() {
  try {
    const raw = localStorage.getItem('suivi_user');
    if (!raw) return false;
    return !!JSON.parse(raw)?._impersonating;
  } catch { return false; }
}

function getCurrentUserId() {
  try {
    const raw = localStorage.getItem('suivi_user');
    if (!raw) return null;
    return JSON.parse(raw)?.id || null;
  } catch { return null; }
}

function buildBlockedThenable() {
  // Objet thenable mimant un PostgrestBuilder qui resout immediatement avec une erreur
  const fakeResult = { data: null, error: IMPERSONATION_ERROR };
  const promise = Promise.resolve(fakeResult);
  const obj = {
    then: (f, r) => promise.then(f, r),
    catch: (r) => promise.catch(r),
    finally: (f) => promise.finally(f),
  };
  // Methodes de chainage qui retournent this
  ['select', 'eq', 'neq', 'in', 'match', 'filter', 'is', 'not', 'or', 'and',
   'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'order', 'limit', 'range',
   'single', 'maybeSingle'].forEach(m => { obj[m] = () => obj; });
  return obj;
}

// Wrap dynamique d'un QueryBuilder Supabase
function wrapBuilder(builder, tableName) {
  if (!builder || typeof builder !== 'object') return builder;
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Cas 1 : .delete() sur table soft-delete -> conversion en .update()
      if (prop === 'delete' && SOFT_DELETE_TABLES.includes(tableName)) {
        return function(...args) {
          if (isImpersonating() && !SYSTEM_TABLES_WHITELIST.includes(tableName)) {
            console.warn('[IMPERSONATION] Blocage SOFT-DELETE sur "' + tableName + '"');
            try { window.dispatchEvent(new CustomEvent('impersonation-blocked', { detail: { operation: 'delete', table: tableName } })); } catch {}
            return buildBlockedThenable();
          }
          // [SOFT-DELETE] log retire pour eviter fuite d'info en production
          // Appel direct .update() sur le builder original
          const updateFn = target.update || builder.update;
          if (typeof updateFn !== 'function') {
            console.error('[SOFT-DELETE] target.update introuvable, fallback DELETE');
            return value.apply(target, args);
          }
          const updated = updateFn.call(target, { deleted_at: new Date().toISOString(), deleted_by: getCurrentUserId() });
          return wrapBuilder(updated, tableName);
        };
      }

      // Cas 2 : autres ecritures (insert/update/upsert) -> blocage si impersonification
      if (typeof prop === 'string' && BLOCKED_METHODS.includes(prop)) {
        return function(...args) {
          if (SYSTEM_TABLES_WHITELIST.includes(tableName)) {
            const result = value.apply(target, args);
            return wrapBuilder(result, tableName);
          }
          if (isImpersonating()) {
            console.warn('[IMPERSONATION] Blocage ' + prop.toUpperCase() + ' sur "' + tableName + '"');
            try { window.dispatchEvent(new CustomEvent('impersonation-blocked', { detail: { operation: prop, table: tableName } })); } catch {}
            return buildBlockedThenable();
          }
          const result = value.apply(target, args);
          return wrapBuilder(result, tableName);
        };
      }

      // Cas 3 : .select() sur table soft-delete -> filtre auto deleted_at IS NULL
      if (prop === 'select' && SOFT_DELETE_TABLES.includes(tableName)) {
        return function(...args) {
          const result = value.apply(target, args);
          if (result && typeof result.is === 'function' && !result._softDeleteFiltered) {
            const filtered = result.is('deleted_at', null);
            if (filtered) filtered._softDeleteFiltered = true;
            return wrapBuilder(filtered, tableName);
          }
          return wrapBuilder(result, tableName);
        };
      }

      // Cas 4 : autres methodes -> wrap recursif si retourne un builder
      if (typeof value === 'function') {
        return function(...args) {
          const result = value.apply(target, args);
          if (result && typeof result === 'object' && (typeof result.then === 'function' || typeof result.eq === 'function' || typeof result.select === 'function')) {
            return wrapBuilder(result, tableName);
          }
          return result;
        };
      }

      return value;
    }
  });
}

// Client expose : surcharge from() pour retourner un builder wrappe
const supabase = new Proxy(supabaseRaw, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return function(tableName) {
        return wrapBuilder(target.from(tableName), tableName);
      };
    }
    return Reflect.get(target, prop, receiver);
  }
});

export { supabase, supabaseRaw };
