// ═══════════════════════════════════════════════════════════════
// AUDIT LOG - Journalisation des actions sensibles
// ═══════════════════════════════════════════════════════════════
// Usage :
//   await logAudit(supabase, {
//     actor: user,                           // utilisateur qui fait l'action
//     action: 'suspendre_ecole',             // nom de l'action
//     target_type: 'ecole',
//     target_id: ecole.id,
//     target_label: ecole.nom,
//     metadata: { motif: 'Non paiement', ancien_statut: 'active' },
//   });
//
// Actions possibles (conventions) :
//   ecole : creer_ecole, suspendre_ecole, reactiver_ecole, supprimer_ecole
//   user  : impersonifier, reset_password_force, suspendre_user, supprimer_user
//   data  : import_masse, export_ecole
//   auth  : login_failed_repeated (depuis rate limiter)
// ═══════════════════════════════════════════════════════════════

/**
 * Journalise une action sensible.
 * @param {Object} supabase - client Supabase
 * @param {Object} params - paramètres du log
 * @returns {Promise<boolean>} true si enregistré, false si erreur (non bloquant)
 */
export async function logAudit(supabase, {
  actor,              // { id, role } — utilisateur qui fait l'action
  action,             // string : nom de l'action (snake_case)
  target_type,        // string : 'ecole' | 'eleve' | 'utilisateur' | etc.
  target_id,          // UUID : ID de l'entité concernée
  target_label,       // string : libellé lisible pour le journal
  metadata,           // object : infos contextuelles (ancien/nouveau état, motif, etc.)
}) {
  try {
    // IP / User-Agent : on essaie de récupérer côté client (utile pour les logs)
    let user_agent = null;
    if (typeof navigator !== 'undefined') {
      user_agent = navigator.userAgent?.slice(0, 255) || null;
    }

    const { error } = await supabase.from('audit_log').insert({
      actor_user_id: actor?.id || null,
      actor_role:    actor?.role || 'unknown',
      action:        action,
      target_type:   target_type || null,
      target_id:     target_id || null,
      target_label:  target_label || null,
      metadata:      metadata || null,
      ip_address:    null, // IP côté client non fiable, on laisse vide
      user_agent:    user_agent,
    });
    if (error) {
      console.warn('[auditLog] Erreur écriture log:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[auditLog] Exception:', e.message);
    return false;
  }
}

/**
 * Récupère les derniers logs d'audit (pour affichage dans le cockpit).
 * @param {Object} supabase
 * @param {Object} filters - { limit, actor_user_id, action, target_type, target_id }
 */
export async function fetchAuditLogs(supabase, filters = {}) {
  const { limit = 50, actor_user_id, action, target_type, target_id } = filters;
  let q = supabase
    .from('audit_log')
    .select('*, actor:actor_user_id(id,prenom,nom,role)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (actor_user_id) q = q.eq('actor_user_id', actor_user_id);
  if (action)        q = q.eq('action', action);
  if (target_type)   q = q.eq('target_type', target_type);
  if (target_id)     q = q.eq('target_id', target_id);

  const { data, error } = await q;
  if (error) {
    console.error('[auditLog] fetchAuditLogs erreur:', error);
    return [];
  }
  return data || [];
}
