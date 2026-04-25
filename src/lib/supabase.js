import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://uwqhtahknhftinlzmusi.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cWh0YWhrbmhmdGlubHptdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTA2MTAsImV4cCI6MjA5MDI2NjYxMH0.gdX0JeqSfGnr6xGFqBUSK78z_XiWQg93R6MEa8w1klU';

// ═══════════════════════════════════════════════════════════════
// WRAPPER ANTI-IMPERSONIFICATION (P.C.1 - Mode lecture seule)
// ═══════════════════════════════════════════════════════════════
// Le super-admin peut "voir comme" un surveillant via le mode
// impersonification. Pendant cette session, il ne doit PAS pouvoir
// modifier les donnees de l'ecole visitee.
//
// Ce wrapper intercepte TOUTES les operations d'ecriture
// (insert/update/delete/upsert) et les bloque si l'utilisateur
// courant est en mode impersonification.
//
// Avantage : un seul point de blocage au lieu de 26 pages a modifier.
// ═══════════════════════════════════════════════════════════════

const _rawClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function isCurrentUserImpersonating() {
  try {
    const raw = localStorage.getItem('suivi_user');
    if (!raw) return false;
    const user = JSON.parse(raw);
    return !!(user && user._impersonating);
  } catch {
    return false;
  }
}

const IMPERSONATION_ERROR = {
  code: 'IMPERSONATION_READ_ONLY',
  message: 'Mode lecture seule (impersonification) - modification bloquee',
  details: 'Le super-admin ne peut pas modifier les donnees pendant l impersonification.',
  hint: 'Quittez le mode impersonification pour reprendre le controle de votre compte.',
};

function wrapQueryBuilder(queryBuilder, tableName) {
  if (!queryBuilder || typeof queryBuilder !== 'object') return queryBuilder;
  const blockedMethods = ['insert', 'update', 'delete', 'upsert'];
  // Tables systeme qui doivent rester accessibles en ecriture meme en
  // mode impersonification (audit, tracking interne, exports RGPD, etc.)
  // Sans ca on perdrait la tracabilite des actions du super-admin.
  const SYSTEM_TABLES_WHITELIST = [
    'audit_log',           // tracage technique des actions
    'consultations_parents', // tracking parent (auto)
    'exports_rgpd',        // historique exports (lecture seule = rien a inserer normalement)
    'purges_rgpd_log',     // logs de purge
  ];
  // Tables proteges par soft-delete : delete() devient update({deleted_at,deleted_by})
  const SOFT_DELETE_TABLES = ['eleves', 'utilisateurs'];
  return new Proxy(queryBuilder, {
    get(target, prop) {
      const value = target[prop];
      // Interception SELECT : filtrer automatiquement les soft-deleted
      if (prop === 'select' && SOFT_DELETE_TABLES.includes(tableName)) {
        return function(...args) {
          const result = value.apply(target, args);
          // Ajouter automatiquement .is('deleted_at', null) sur le query
          // sauf si l'appelant a deja un filtre explicite sur deleted_at
          // (cas de la page de restauration des elements supprimes)
          if (result && typeof result.is === 'function') {
            // Marqueur sur l'objet pour ne pas double-filtrer
            if (!result._softDeleteFiltered) {
              const filtered = result.is('deleted_at', null);
              if (filtered) filtered._softDeleteFiltered = true;
              return wrapQueryBuilder(filtered, tableName);
            }
          }
          return wrapQueryBuilder(result, tableName);
        };
      }
      // Interception SOFT-DELETE : transforme .delete() en .update({deleted_at})
      if (prop === 'delete' && SOFT_DELETE_TABLES.includes(tableName)) {
        return function(...args) {
          // Skip blocage impersonification : ce sera gere apres
          if (isCurrentUserImpersonating() && !SYSTEM_TABLES_WHITELIST.includes(tableName)) {
            console.warn('[IMPERSONATION] Blocage SOFT-DELETE sur table "' + tableName + '"');
            try {
              window.dispatchEvent(new CustomEvent('impersonation-blocked', {
                detail: { operation: 'delete', table: tableName }
              }));
            } catch {}
            const fakeResult = { data: null, error: IMPERSONATION_ERROR };
            return { select(){return this;}, single(){return Promise.resolve(fakeResult);}, maybeSingle(){return Promise.resolve(fakeResult);}, then(f,r){return Promise.resolve(fakeResult).then(f,r);}, catch(r){return Promise.resolve(fakeResult).catch(r);}, finally(f){return Promise.resolve(fakeResult).finally(f);}, eq(){return this;}, neq(){return this;}, in(){return this;}, match(){return this;}, filter(){return this;} };
          }
          // SOFT-DELETE : remplacer par UPDATE
          let deletedBy = null;
          try {
            const raw = localStorage.getItem('suivi_user');
            if (raw) deletedBy = JSON.parse(raw)?.id || null;
          } catch {}
          console.log('[SOFT-DELETE] table "' + tableName + '" -> UPDATE deleted_at');
          const result = target.update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy });
          return wrapQueryBuilder(result, tableName);
        };
      }
      if (typeof prop === 'string' && blockedMethods.includes(prop)) {
        return function(...args) {
          // Skip blocage pour tables systeme
          if (SYSTEM_TABLES_WHITELIST.includes(tableName)) {
            const result = value.apply(target, args);
            return wrapQueryBuilder(result, tableName);
          }
          if (isCurrentUserImpersonating()) {
            console.warn('[IMPERSONATION] Blocage ' + prop.toUpperCase() + ' sur table "' + tableName + '"');
            // Dispatch un event custom pour qu'un composant React puisse afficher un toast
            try {
              window.dispatchEvent(new CustomEvent('impersonation-blocked', {
                detail: { operation: prop, table: tableName }
              }));
            } catch {}
            const fakeResult = { data: null, error: IMPERSONATION_ERROR };
            const blockedChain = {
              select() { return this; },
              single() { return Promise.resolve(fakeResult); },
              maybeSingle() { return Promise.resolve(fakeResult); },
              then(onFulfilled, onRejected) { return Promise.resolve(fakeResult).then(onFulfilled, onRejected); },
              catch(onRejected) { return Promise.resolve(fakeResult).catch(onRejected); },
              finally(onFinally) { return Promise.resolve(fakeResult).finally(onFinally); },
              eq() { return this; }, neq() { return this; }, in() { return this; },
              match() { return this; }, filter() { return this; },
            };
            return blockedChain;
          }
          const result = value.apply(target, args);
          return wrapQueryBuilder(result, tableName);
        };
      }
      if (typeof value === 'function') {
        return function(...args) {
          const result = value.apply(target, args);
          if (result && typeof result === 'object' && (typeof result.then === 'function' || typeof result.insert === 'function' || typeof result.select === 'function')) {
            return wrapQueryBuilder(result, tableName);
          }
          return result;
        };
      }
      return value;
    }
  });
}

export const supabase = new Proxy(_rawClient, {
  get(target, prop) {
    if (prop === 'from') {
      return function(tableName) {
        const queryBuilder = target.from(tableName);
        return wrapQueryBuilder(queryBuilder, tableName);
      };
    }
    return target[prop];
  }
});

export const supabaseRaw = _rawClient;
