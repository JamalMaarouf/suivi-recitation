// Helpers pour le mode impersonification (super admin "voit comme" un surveillant).
//
// Le super admin peut consulter l'interface d'une école comme si il était
// son surveillant. Pendant cette session, il ne doit PAS pouvoir modifier
// les données (mode lecture seule).

/**
 * Vérifie si l'utilisateur courant est en mode impersonification.
 */
export function isImpersonating(user) {
  return !!(user && user._impersonating);
}

/**
 * Vérifie si l'utilisateur peut écrire (modifier / créer / supprimer).
 * Retourne false si il est en mode impersonification.
 */
export function canWrite(user) {
  return !isImpersonating(user);
}

/**
 * Bloque une action d'écriture et affiche un message si l'utilisateur
 * est en mode impersonification. À utiliser en début de fonction :
 *
 *   const handleSave = () => {
 *     if (blockIfImpersonating(user, toast)) return;
 *     ... (code normal) ...
 *   };
 *
 * Retourne true si l'action doit être bloquée, false sinon.
 */
export function blockIfImpersonating(user, toast) {
  if (!isImpersonating(user)) return false;
  const msg = '🔒 Mode impersonification — action en lecture seule. Revenez au cockpit pour modifier.';
  if (toast && typeof toast === 'function') {
    toast(msg);
  } else if (typeof window !== 'undefined' && window.alert) {
    // fallback si pas de toast
    window.alert(msg);
  }
  return true;
}
