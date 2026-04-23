// ══════════════════════════════════════════════════════════════════════
// HELPER TRACKING VISITES PARENTS
// Pattern : 1 ligne par (parent_id, eleve_id, date_visite).
// Au 2e appel dans la journée, on UPDATE pour :
//   - ajouter l'onglet à l'array s'il n'y est pas
//   - incrémenter nb_consultations
// ══════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';

/**
 * Enregistre une visite du parent sur la fiche de son enfant.
 * Non bloquant : silencieux en cas d'erreur (tracking ne doit jamais
 * casser l'expérience utilisateur).
 *
 * @param {string} parentId - UUID du parent (utilisateurs.id)
 * @param {string} eleveId  - UUID de l'enfant consulté
 * @param {string} ecoleId  - UUID de l'école
 * @param {string} onglet   - nom de l'onglet consulté ('progression', 'recitations', 'cours'...)
 */
export async function trackParentVisite(parentId, eleveId, ecoleId, onglet) {
  if (!parentId || !eleveId || !ecoleId) return;  // garde-fous silencieux

  try {
    // Date du jour en heure LOCALE (pas UTC pour éviter décalage fuseau)
    const now = new Date();
    const dateVisite = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const heureStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // 1. Chercher une ligne existante pour aujourd'hui
    const { data: existing } = await supabase
      .from('parents_visites')
      .select('id, onglets_visites, nb_consultations')
      .eq('parent_id', parentId)
      .eq('eleve_id', eleveId)
      .eq('date_visite', dateVisite)
      .maybeSingle();

    if (existing) {
      // UPDATE : ajouter onglet si absent + incrémenter compteur
      const ongletsArray = Array.isArray(existing.onglets_visites) ? existing.onglets_visites : [];
      const onglets = onglet && !ongletsArray.includes(onglet)
        ? [...ongletsArray, onglet]
        : ongletsArray;
      await supabase
        .from('parents_visites')
        .update({
          onglets_visites: onglets,
          nb_consultations: (existing.nb_consultations || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // INSERT : nouvelle visite du jour
      await supabase
        .from('parents_visites')
        .insert({
          parent_id: parentId,
          eleve_id: eleveId,
          ecole_id: ecoleId,
          date_visite: dateVisite,
          onglets_visites: onglet ? [onglet] : [],
          premiere_heure: heureStr,
          nb_consultations: 1,
        });
    }
  } catch (err) {
    // Silencieux : on ne doit pas casser l'UX du parent pour un log raté
    console.warn('[trackParentVisite] erreur non bloquante :', err?.message);
  }
}

/**
 * Récupère la date de la dernière visite d'un parent à son enfant.
 * Utilisé pour afficher "Dernière visite : il y a X jours" dans le portail.
 *
 * @param {string} parentId
 * @param {string} eleveId
 * @returns {Promise<{date: string, joursEcoules: number} | null>}
 */
export async function getDerniereVisiteParent(parentId, eleveId) {
  if (!parentId || !eleveId) return null;
  try {
    // Exclure la visite du jour en cours pour que "dernière visite" soit
    // bien dans le passé (sinon on dit toujours "aujourd'hui" dès qu'il vient)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('parents_visites')
      .select('date_visite')
      .eq('parent_id', parentId)
      .eq('eleve_id', eleveId)
      .lt('date_visite', today)  // strictement avant aujourd'hui
      .order('date_visite', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const dateVisite = new Date(data.date_visite + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const joursEcoules = Math.floor((todayDate - dateVisite) / (1000 * 60 * 60 * 24));

    return { date: data.date_visite, joursEcoules };
  } catch (err) {
    console.warn('[getDerniereVisiteParent] erreur :', err?.message);
    return null;
  }
}
