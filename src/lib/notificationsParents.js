import { supabase } from './supabase';

// ══════════════════════════════════════════════════════════════════════
// HELPER CENTRAL — NOTIFICATIONS PARENTS
//
// Architecture :
//   1. Toute notification est ENREGISTREE en base (in-app visible)
//   2. Si parent a un email + preference 'canal_email' activee
//      -> L'envoi email sera fait par le cron /api/notifications-email
//      -> Ce helper NE fait PAS l'envoi direct (async, non bloquant)
//
// 3 types supportes :
//   - 'hizb_complet'     -> Quand un enfant valide un Hizb
//   - 'certificat_obtenu'-> Quand un enfant obtient un certificat
//   - 'inactivite_alerte'-> Cron quotidien, enfants inactifs > 14j
//
// Les notifications sont STOCKEES bilingues (fr + ar). L'affichage
// selectionne selon la langue du parent.
//
// Usage :
//   import { notifierParents } from './notificationsParents';
//   await notifierParents({
//     type: 'hizb_complet',
//     eleve: { id, prenom, nom, ecole_id },
//     donnees: { hizb_num: 25, date: '2026-04-24' }
//   });
// ══════════════════════════════════════════════════════════════════════

/**
 * Crée une notification pour TOUS les parents liés à un élève.
 *
 * Cette fonction :
 *   1. Recherche tous les parents de l'élève via parent_eleve
 *   2. Pour chaque parent, vérifie ses préférences
 *   3. Si le type de notif est activé, crée une ligne dans notifications_parents
 *   4. L'envoi email suivra (cron séparé, non bloquant)
 *
 * @param {Object} params
 * @param {string} params.type - 'hizb_complet' | 'certificat_obtenu' | 'inactivite_alerte'
 * @param {Object} params.eleve - { id, prenom, nom, ecole_id }
 * @param {Object} params.donnees - payload JSON spécifique au type
 * @returns {Promise<{ success: boolean, count: number, error?: string }>}
 */
export async function notifierParents({ type, eleve, donnees = {} }) {
  if (!type || !eleve?.id || !eleve?.ecole_id) {
    console.warn('[notifierParents] paramètres manquants', { type, eleve });
    return { success: false, count: 0, error: 'parametres_manquants' };
  }

  try {
    // ─── 1. Récupérer les parents liés à cet élève ────────────
    const { data: liaisons, error: errLink } = await supabase
      .from('parent_eleve')
      .select('parent_id')
      .eq('eleve_id', eleve.id);

    if (errLink) throw errLink;
    if (!liaisons || liaisons.length === 0) {
      return { success: true, count: 0, error: 'aucun_parent' };
    }

    const parentIds = liaisons.map(l => l.parent_id);

    // ─── 2. Récupérer les préférences des parents en une requête ──
    const { data: prefs } = await supabase
      .from('preferences_notifications')
      .select('*')
      .in('user_id', parentIds);

    const prefsMap = {};
    (prefs || []).forEach(p => { prefsMap[p.user_id] = p; });

    // ─── 3. Filtrer selon les préférences (défaut = tout activé) ──
    const prefKey = {
      'hizb_complet': 'notif_hizb_complet',
      'certificat_obtenu': 'notif_certificat',
      'inactivite_alerte': 'notif_inactivite',
    }[type];

    const parentsOptIn = parentIds.filter(pid => {
      const p = prefsMap[pid];
      if (!p) return true; // pas de préférences -> défaut ON
      return p[prefKey] !== false;
    });

    if (parentsOptIn.length === 0) {
      return { success: true, count: 0, error: 'tous_opt_out' };
    }

    // ─── 4. Générer titre + corps bilingues selon le type ───────
    const content = generateContent(type, eleve, donnees);

    // ─── 5. Créer les notifications (1 par parent) ─────────────
    const rows = parentsOptIn.map(pid => ({
      parent_id: pid,
      eleve_id: eleve.id,
      ecole_id: eleve.ecole_id,
      type,
      titre_fr: content.titre_fr,
      titre_ar: content.titre_ar,
      corps_fr: content.corps_fr,
      corps_ar: content.corps_ar,
      donnees,
      lue: false,
      email_envoye: false,
    }));

    const { error: errInsert } = await supabase
      .from('notifications_parents')
      .insert(rows);

    if (errInsert) throw errInsert;

    return { success: true, count: rows.length };
  } catch (err) {
    console.error('[notifierParents] erreur', err);
    return { success: false, count: 0, error: err.message || 'erreur_inconnue' };
  }
}

// ══════════════════════════════════════════════════════════════════════
// GENERATEUR DE CONTENU BILINGUE (fr + ar)
// ══════════════════════════════════════════════════════════════════════
function generateContent(type, eleve, donnees) {
  const prenom = eleve.prenom || '';
  const nom = eleve.nom || '';
  const fullName = `${prenom} ${nom}`.trim();

  switch (type) {
    case 'hizb_complet':
      return {
        titre_fr: `🎉 ${fullName} a validé un Hizb !`,
        titre_ar: `🎉 ${fullName} حفظ حزبا !`,
        corps_fr: `Félicitations ! Votre enfant vient de valider le Hizb ${donnees.hizb_num || ''}. Mabrouk !`,
        corps_ar: `مبارك ! إبنكم / ابنتكم حفظ الحزب ${donnees.hizb_num || ''} بنجاح.`,
      };

    case 'certificat_obtenu':
      return {
        titre_fr: `🏅 ${fullName} a obtenu un certificat !`,
        titre_ar: `🏅 ${fullName} حصل على شهادة !`,
        corps_fr: `Bravo ! Votre enfant a obtenu le certificat "${donnees.certificat_nom || ''}". Vous pouvez le consulter dans son portail.`,
        corps_ar: `تهانينا ! حصل إبنكم / ابنتكم على شهادة "${donnees.certificat_nom || ''}". يمكنكم الاطلاع عليها في البوابة.`,
      };

    case 'inactivite_alerte':
      return {
        titre_fr: `⚠️ ${fullName} n'a pas récité depuis ${donnees.jours_inactifs || '?'} jours`,
        titre_ar: `⚠️ ${fullName} لم يسمع منذ ${donnees.jours_inactifs || '?'} يوما`,
        corps_fr: `Nous n'avons enregistré aucune récitation depuis ${donnees.jours_inactifs || '?'} jours. Encouragez-le à reprendre !`,
        corps_ar: `لم نسجل أي استظهار منذ ${donnees.jours_inactifs || '?'} يوما. شجعوه على الاستمرار !`,
      };

    default:
      return {
        titre_fr: 'Nouvelle notification',
        titre_ar: 'إشعار جديد',
        corps_fr: '',
        corps_ar: '',
      };
  }
}

// ══════════════════════════════════════════════════════════════════════
// LECTURE CÔTÉ PARENT — fetch + marquer comme lues
// ══════════════════════════════════════════════════════════════════════

/**
 * Récupère les N dernières notifications d'un parent.
 */
export async function fetchNotificationsParent(parentId, limit = 20) {
  if (!parentId) return { data: [], nonLues: 0 };

  const { data, error } = await supabase
    .from('notifications_parents')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fetchNotificationsParent]', error);
    return { data: [], nonLues: 0 };
  }

  const nonLues = (data || []).filter(n => !n.lue).length;
  return { data: data || [], nonLues };
}

/**
 * Marque toutes les notifications non lues d'un parent comme lues.
 */
export async function marquerToutesLues(parentId) {
  if (!parentId) return { success: false };
  const { error } = await supabase
    .from('notifications_parents')
    .update({ lue: true, read_at: new Date().toISOString() })
    .eq('parent_id', parentId)
    .eq('lue', false);

  return { success: !error };
}

/**
 * Marque une notification spécifique comme lue.
 */
export async function marquerLue(notifId) {
  if (!notifId) return { success: false };
  const { error } = await supabase
    .from('notifications_parents')
    .update({ lue: true, read_at: new Date().toISOString() })
    .eq('id', notifId);

  return { success: !error };
}

// ══════════════════════════════════════════════════════════════════════
// PREFERENCES — chargement et mise à jour
// ══════════════════════════════════════════════════════════════════════

/**
 * Charge les préférences d'un user. Retourne les défauts si aucune ligne.
 */
export async function fetchPreferences(userId) {
  if (!userId) return null;

  const { data } = await supabase
    .from('preferences_notifications')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (data) return data;

  // Defaults si pas de ligne
  return {
    user_id: userId,
    notif_hizb_complet: true,
    notif_certificat: true,
    notif_inactivite: true,
    canal_email: true,
  };
}

/**
 * Upsert des préférences d'un user.
 */
export async function updatePreferences(userId, prefs) {
  if (!userId) return { success: false };

  const { error } = await supabase
    .from('preferences_notifications')
    .upsert({
      user_id: userId,
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  return { success: !error, error: error?.message };
}
