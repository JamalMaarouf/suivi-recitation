// ═══════════════════════════════════════════════════════════════════════════
// haptic.js — Phase 2 Sprint 5 (haptic feedback subtil)
// ═══════════════════════════════════════════════════════════════════════════
//
// Helpers pour declencher des vibrations courtes sur les actions importantes.
// Utilise l'API Vibration du navigateur (navigator.vibrate).
//
// Disponibilite :
//   - ✅ Android + Chrome/Edge/Samsung Browser : OK
//   - ⚠️  iOS Safari : API absente, les appels sont silencieusement ignores
//        (pas d'erreur, pas de vibration - normal)
//   - ✅ Tous navigateurs desktop : API absente, ignoree
//
// PHILOSOPHIE (validation Jamal Sprint 5 = A "Minimum vital") :
//   L'haptic doit etre SUBTIL et RARE pour avoir de la valeur.
//   Trop d'haptic = vibration parasite agacante.
//   On l'utilise UNIQUEMENT sur 2-3 moments cles :
//   - Success : actions importantes (validation enregistree, eleve ajoute)
//   - Error : erreurs critiques (toast d'erreur)
//
// PAS de Light haptic partout (taps sur cartes etc.) = trop agacant.
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifie si l'API Vibration est disponible
 */
const isHapticSupported = () => {
  return typeof window !== 'undefined' && 'vibrate' in navigator;
};

/**
 * Vibration courte pour confirmer une action reussie (validation, sauvegarde)
 * Duree : 20ms (court, juste perceptible)
 */
export const hapticSuccess = () => {
  if (isHapticSupported()) {
    try {
      navigator.vibrate(20);
    } catch (e) { /* silencieux */ }
  }
};

/**
 * Vibration double distinctive pour signaler une erreur
 * Pattern : 50ms vibre, 50ms pause, 50ms vibre
 */
export const hapticError = () => {
  if (isHapticSupported()) {
    try {
      navigator.vibrate([50, 50, 50]);
    } catch (e) { /* silencieux */ }
  }
};

/**
 * Vibration tres courte pour les interactions legeres (selection, toggle)
 * Note : utiliser AVEC MODERATION (philosophie Minimum vital).
 */
export const hapticLight = () => {
  if (isHapticSupported()) {
    try {
      navigator.vibrate(10);
    } catch (e) { /* silencieux */ }
  }
};
