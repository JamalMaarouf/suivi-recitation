// ═══════════════════════════════════════════════════════════════════
// SENS DE RÉCITATION
// ═══════════════════════════════════════════════════════════════════
// 'desc' (défaut historique) : Hizb 60 → Hizb 1 (Sourate An-Nas → Al-Fatiha)
// 'asc'                      : Hizb 1  → Hizb 60 (Sourate Al-Fatiha → An-Nas)
//
// Les fonctions acceptent toujours un sens optionnel (défaut 'desc').
// L'index interne 0 = Hizb 60 T.1 en desc, ou Hizb 1 T.1 en asc.
// Index max = 479 (60 Hizb × 8 tomons - 1)
// ═══════════════════════════════════════════════════════════════════

/**
 * Helper : un eleve est "actif" s'il n'est ni soft-deleted ni suspendu.
 * Utilise dans toutes les pages qui doivent exclure les eleves inactifs
 * (Express, Validation, RapportMensuel, DashboardDirection, etc.)
 *
 * Pour la liste Gestion -> Eleves, on n'utilise PAS ce filtre par defaut :
 * les suspendus sont visibles avec un badge pour permettre la reactivation.
 */
export function eleveActif(e) {
  return !!e && !e.suspendu_at && !e.deleted_at;
}

/**
 * Helper : un utilisateur (instituteur, parent, surveillant) est "actif"
 * s'il n'est ni soft-deleted ni suspendu. Identique a eleveActif mais pour
 * la table utilisateurs. Utilise pour les selecteurs d'instituteur referent,
 * les listes dans dashboards, et les crons (notifications email).
 */
export function utilisateurActif(u) {
  return !!u && !u.suspendu_at && !u.deleted_at;
}


/**
 * Résout le sens effectif à partir d'un niveau et de l'école.
 * Accepte un objet niveau (avec .sens_recitation) ou le sens directement.
 * Retourne 'desc' par défaut si rien n'est défini.
 */
export function resolveSens(niveau, ecole) {
  // Si on a reçu une string directement
  if (typeof niveau === 'string' && (niveau === 'desc' || niveau === 'asc')) return niveau;
  // Sinon on regarde niveau.sens_recitation, puis ecole.sens_recitation_defaut
  const fromNiveau = niveau && niveau.sens_recitation;
  if (fromNiveau === 'desc' || fromNiveau === 'asc') return fromNiveau;
  const fromEcole = ecole && ecole.sens_recitation_defaut;
  if (fromEcole === 'desc' || fromEcole === 'asc') return fromEcole;
  return 'desc';
}

/**
 * Convertit une position (hizb, tomon) en index interne [0..479]
 * selon le sens.
 * - desc : Hizb 60 T.1 = 0,  Hizb 1 T.8 = 479
 * - asc  : Hizb 1 T.1  = 0,  Hizb 60 T.8 = 479
 */
export function positionToIndex(hizb, tomon, sens = 'desc') {
  const h = Math.max(1, Math.min(60, hizb || 1));
  const t = Math.max(1, Math.min(8, tomon || 1));
  if (sens === 'asc') return (h - 1) * 8 + (t - 1);
  return (60 - h) * 8 + (t - 1);
}

/**
 * Inverse de positionToIndex : convertit un index en {hizb, tomon}.
 */
export function indexToPosition(index, sens = 'desc') {
  const idx = Math.max(0, Math.min(479, index));
  const hizbIndex = Math.floor(idx / 8);
  const tomon = (idx % 8) + 1;
  const hizb = sens === 'asc' ? hizbIndex + 1 : Math.max(1, 60 - hizbIndex);
  return { hizb, tomon };
}

/**
 * Trouve le sens de récitation à appliquer pour un élève.
 * Priorité : niveau.sens_recitation → ecole.sens_recitation_defaut → 'desc'
 *
 * @param eleve   { code_niveau, ... } l'élève
 * @param niveaux liste des niveaux de l'école (avec code et sens_recitation)
 * @param ecole   objet école avec sens_recitation_defaut (optionnel)
 * @returns 'desc' | 'asc'
 */
export function getSensForEleve(eleve, niveaux, ecole) {
  if (!eleve) return 'desc';
  const n = (niveaux || []).find(x => x.code === eleve.code_niveau);
  const fromNiveau = n && n.sens_recitation;
  if (fromNiveau === 'desc' || fromNiveau === 'asc') return fromNiveau;
  const fromEcole = ecole && ecole.sens_recitation_defaut;
  if (fromEcole === 'desc' || fromEcole === 'asc') return fromEcole;
  return 'desc';
}

/**
 * BUG-FIX MULTI-BLOCS (mai 2026) — Calcule les Hizbs acquis avant l'arrivee
 * de l'eleve a l'ecole, en tenant compte de la STRUCTURE EN BLOCS du niveau.
 *
 * PROBLEME RESOLU :
 * Avant ce fix, le code utilisait une logique mono-bloc (boucle 1->hizbDep
 * ou 60->hizbDep selon un 'sens global' du niveau). Pour un niveau multi-blocs
 * comme AH1 (4 blocs avec sens differents par bloc), ca produisait des
 * resultats faux : eleve hizb_depart=21 affichait 39 Hizbs acquis au lieu
 * de 35, et son bloc 3 montrait 9/15 au lieu de 5/15.
 *
 * SOLUTION :
 * 1. Identifier dans QUEL bloc se trouve hizbDepart
 * 2. Marquer comme acquis : TOUS les Hizbs des blocs PRECEDENTS
 * 3. Marquer comme acquis : dans le bloc courant, les Hizbs avant hizbDepart
 *    selon le SENS DU BLOC (pas le sens global de l'eleve)
 *
 * RETROCOMPATIBILITE :
 * - Si programmeNiveau est null/vide -> fallback sur l'ancienne logique
 *   (calcul lineaire 1->hizbDep ou 60->hizbDep selon sens global)
 * - Si le programme n'a qu'un seul bloc -> equivalent fonctionnel a l'ancien
 *   comportement (un seul bloc = mono-bloc)
 * - Si hizb_depart est null/0 -> retourne Set vide (eleve demarre de zero)
 *
 * @param eleve : objet eleve avec hizb_depart
 * @param programmeNiveau : tableau des lignes table 'programmes' (avec
 *                         bloc_numero, bloc_sens, reference_id, ordre)
 * @param sensGlobal : 'asc' ou 'desc' — sens global du niveau (fallback)
 * @returns Set des numeros de Hizb consideres comme acquis avant arrivee
 */
export function calcHizbsAcquisAvantArrivee(eleve, programmeNiveau, sensGlobal = 'desc') {
  const hizbsAcquis = new Set();
  if (!eleve) return hizbsAcquis;

  const hizbDep = eleve.hizb_depart;
  // Cas "demarre de zero" : aucun acquis
  if (!hizbDep || hizbDep <= 0) return hizbsAcquis;

  // FALLBACK : pas de programme defini -> ancienne logique mono-bloc lineaire
  // (preserve la compatibilite pour les niveaux sans programme structure)
  if (!programmeNiveau || programmeNiveau.length === 0) {
    if (sensGlobal === 'asc') {
      for (let h = 1; h < hizbDep; h++) hizbsAcquis.add(h);
    } else {
      for (let h = 60; h > hizbDep; h--) hizbsAcquis.add(h);
    }
    return hizbsAcquis;
  }

  // Verifier que le programme est de type 'hizb' (sinon pas de calcul de blocs)
  const firstType = programmeNiveau[0]?.type_contenu;
  if (firstType && firstType !== 'hizb') {
    // Pour les niveaux 'sourate', on ne gere pas les blocs ici
    if (sensGlobal === 'asc') {
      for (let h = 1; h < hizbDep; h++) hizbsAcquis.add(h);
    } else {
      for (let h = 60; h > hizbDep; h--) hizbsAcquis.add(h);
    }
    return hizbsAcquis;
  }

  // ─── LOGIQUE MULTI-BLOCS ───
  // 1. Regrouper le programme par bloc_numero
  const blocsMap = new Map();
  for (const ligne of programmeNiveau) {
    const numBloc = ligne.bloc_numero || 1;
    if (!blocsMap.has(numBloc)) {
      blocsMap.set(numBloc, {
        numero: numBloc,
        sens: ligne.bloc_sens || 'asc',
        hizbs: [],
      });
    }
    const hizb = parseInt(ligne.reference_id);
    if (!isNaN(hizb)) blocsMap.get(numBloc).hizbs.push(hizb);
  }

  // 2. Trier les blocs par numero d'ordre dans le parcours pedagogique
  // BUG-FIX MONO-BLOC (mai 2026) : pour les niveaux MONO-bloc (un seul bloc),
  // on ignore bloc_sens (qui peut etre desaligne avec le sens reel du niveau
  // tel qu'affiche dans l'UI) et on utilise sensGlobal a la place.
  // Pour les multi-blocs, on respecte bien le sens propre de chaque bloc.
  const estMonoBloc = blocsMap.size === 1;
  const blocs = Array.from(blocsMap.values())
    .sort((a, b) => a.numero - b.numero)
    .map(bloc => {
      // Si mono-bloc : utiliser sensGlobal (= sens du niveau dans l'UI)
      // Si multi-blocs : utiliser le sens propre du bloc
      const sensEffectif = estMonoBloc ? sensGlobal : bloc.sens;
      return {
        ...bloc,
        sens: sensEffectif,  // on remplace pour coherence des consommateurs
        // Trier les Hizb DANS le bloc selon le sens effectif
        hizbsTries: [...bloc.hizbs].sort((a, b) =>
          sensEffectif === 'asc' ? a - b : b - a
        ),
      };
    });

  // 3. Trouver dans quel bloc se trouve hizbDepart
  const blocCourantIdx = blocs.findIndex(b => b.hizbs.includes(hizbDep));

  if (blocCourantIdx === -1) {
    // hizbDepart n'est dans aucun bloc -> fallback ancienne logique
    if (sensGlobal === 'asc') {
      for (let h = 1; h < hizbDep; h++) hizbsAcquis.add(h);
    } else {
      for (let h = 60; h > hizbDep; h--) hizbsAcquis.add(h);
    }
    return hizbsAcquis;
  }

  // 4. Marquer comme acquis : tous les Hizbs des blocs PRECEDENTS
  for (let i = 0; i < blocCourantIdx; i++) {
    for (const h of blocs[i].hizbs) hizbsAcquis.add(h);
  }

  // 5. Dans le bloc courant, marquer les Hizbs avant hizbDepart selon le sens DU BLOC
  const blocCourant = blocs[blocCourantIdx];
  for (const h of blocCourant.hizbsTries) {
    if (h === hizbDep) break;  // on s'arrete des qu'on atteint le hizb de depart
    hizbsAcquis.add(h);
  }

  return hizbsAcquis;
}

/**
 * BUG-FIX MULTI-BLOCS (mai 2026) — Compte les tomons acquis avant l'arrivee
 * en utilisant la logique multi-blocs corrigee.
 *
 * Calcule : nombre de Hizbs acquis × 8 + (tomonDepart - 1)
 * Le tomonDepart represente la position DANS le hizb actuel (le hizb en cours).
 *
 * Utilise par calcEtatEleve pour calculer les points/totaux.
 */
export function calcTomonAcquisAvantArrivee(eleve, programmeNiveau, sensGlobal = 'desc') {
  if (!eleve) return 0;
  const hizbDep = eleve.hizb_depart;
  if (!hizbDep || hizbDep <= 0) return 0;
  const tomonD = eleve.tomon_depart || 1;
  const hizbsAcquis = calcHizbsAcquisAvantArrivee(eleve, programmeNiveau, sensGlobal);
  // tomonAcquis = (Hizbs complets acquis * 8 tomons par Hizb) + tomons faits dans le Hizb en cours
  return hizbsAcquis.size * 8 + (tomonD - 1);
}

/**
 * Calcule la position courante (prochain tomon à valider) d'un élève.
 * @param hizbDepart/tomonDepart : position de départ (acquis avant l'école)
 * @param totalTomonValides : nombre de tomons validés depuis l'arrivée
 * @param sens : 'desc' (défaut) ou 'asc'
 * @returns { hizb, tomon }
 */
export function calcPosition(hizbDepart, tomonDepart, totalTomonValides, sens = 'desc') {
  // Valeur par défaut du départ selon le sens
  const defaultHizb = sens === 'asc' ? 1 : 60;
  const hizbD = (hizbDepart === 0 || hizbDepart === null || hizbDepart === undefined) ? defaultHizb : hizbDepart;
  const tomonD = (tomonDepart === 0 || tomonDepart === null || tomonDepart === undefined) ? 1 : tomonDepart;
  const indexDepart = positionToIndex(hizbD, tomonD, sens);
  const indexActuel = indexDepart + (totalTomonValides || 0);
  return indexToPosition(indexActuel, sens);
}

/**
 * Dernière position atteinte (dernier tomon validé).
 * Retourne null si aucun tomon n'a encore été validé.
 */
export function calcPositionAtteinte(hizbDepart, tomonDepart, totalTomonValides, sens = 'desc') {
  if (!totalTomonValides || totalTomonValides === 0) return null;
  const defaultHizb = sens === 'asc' ? 1 : 60;
  const hizbD = (hizbDepart === 0 || hizbDepart === null || hizbDepart === undefined) ? defaultHizb : hizbDepart;
  const tomonD = (tomonDepart === 0 || tomonDepart === null || tomonDepart === undefined) ? 1 : tomonDepart;
  const indexDepart = positionToIndex(hizbD, tomonD, sens);
  const indexAtteint = indexDepart + totalTomonValides - 1;
  return indexToPosition(indexAtteint, sens);
}

export function calcUnite(tomon) {
  if (tomon === 1 || tomon === 2) return 'Roboe 1';
  if (tomon === 3 || tomon === 4) return 'Nisf 1';
  if (tomon === 5 || tomon === 6) return 'Roboe 2';
  if (tomon === 7 || tomon === 8) return 'Nisf 2';
  return '';
}

export function formatDate(dateStr) {
  if (!dateStr) return 'Jamais';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateCourt(dateStr) {
  if (!dateStr) return 'Jamais';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function isInactif(dateStr, jours = 14) {
  if (!dateStr) return true;
  return (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24) > jours;
}

export function joursDepuis(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

export function getInitiales(prenom, nom) {
  return ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase();
}

// Calcul des points
// 10 pts par Tomon
// 25 pts bonus par Roboe (2 Tomon)
// 60 pts bonus par Nisf (4 Tomon)
// 100 pts bonus par Hizb complet validé

// ══════════════════════════════════════════════════════════════════
// BARÈME DYNAMIQUE — points paramétrables par l'école
// ══════════════════════════════════════════════════════════════════

export const BAREME_DEFAUT = {
  tomon: 0,
  hizb_complet: 0,
  sourate: 0,
  examen: 0,
  certificat: 0,
  muraja_tomon: 0,
  muraja_hizb: 0,
  // oct 2026 : muraja collective des sourates (avant : 20 / 5 codes en dur)
  muraja_sourate: 0,
  muraja_sequence: 0,
  sequence_sourate: 0, // oct 2026 : sequence de sourate (memorisation), parametrable dans le bareme
};

/**
 * Charge le barème depuis Supabase pour une école.
 * Retourne :
 *   bareme.unites   = { tomon, hizb_complet, sourate, muraja_tomon, muraja_hizb }
 *   bareme.examens  = { [examen_id]: points }
 *   bareme.ensembles= { [ensemble_id]: points }
 *   bareme.jalons   = { [jalon_id]: points }
 */
export async function loadBareme(supabase, ecole_id) {
  try {
    const { data } = await supabase
      .from('bareme_notes')
      .select('type_action, objet_id, sourate_id, points')
      .eq('ecole_id', ecole_id)
      .eq('actif', true);
    const b = {
      unites: { ...BAREME_DEFAUT },
      examens: {},
      ensembles: {},
      jalons: {},
      // Nouveau Mode 3 (mai 2026) : notes par sourate dans un ensemble
      // Format : sourates_dans_ensemble[ensemble_id][sourate_id] = points
      sourates_dans_ensemble: {},
    };
    (data || []).forEach(row => {
      if (row.type_action === 'sourate_dans_ensemble' && row.objet_id && row.sourate_id) {
        if (!b.sourates_dans_ensemble[row.objet_id]) b.sourates_dans_ensemble[row.objet_id] = {};
        b.sourates_dans_ensemble[row.objet_id][row.sourate_id] = row.points;
      } else if (!row.objet_id) {
        b.unites[row.type_action] = row.points;
      } else if (row.type_action === 'examen') {
        b.examens[row.objet_id] = row.points;
      } else if (row.type_action === 'ensemble_sourates') {
        b.ensembles[row.objet_id] = row.points;
      } else if (row.type_action === 'jalon') {
        b.jalons[row.objet_id] = row.points;
      }
    });
    return b;
  } catch (e) {
    return { unites: { ...BAREME_DEFAUT }, examens: {}, ensembles: {}, jalons: {}, sourates_dans_ensemble: {} };
  }
}

/**
 * Sauvegarde une entree du bareme.
 * Utilise DELETE + INSERT (pas UPSERT) car les index partiels ne sont
 * pas supportes par 'ON CONFLICT' via l'API Supabase JS.
 *
 * @param sourate_id : pour 'sourate_dans_ensemble', l'id de la sourate
 * @param groupe_factorisation : optionnel, identifiant de groupe factorise
 * @returns { data, error }
 */
export async function saveBaremeItem(supabase, ecole_id, type_action, points, objet_id = null, sourate_id = null, groupe_factorisation = null) {
  // 1. DELETE des entrees existantes pour cette cle
  let deleteQuery = supabase
    .from('bareme_notes')
    .delete()
    .eq('ecole_id', ecole_id)
    .eq('type_action', type_action)
    .eq('actif', true);
  if (objet_id) {
    deleteQuery = deleteQuery.eq('objet_id', objet_id);
  } else {
    deleteQuery = deleteQuery.is('objet_id', null);
  }
  if (type_action === 'sourate_dans_ensemble' && sourate_id) {
    deleteQuery = deleteQuery.eq('sourate_id', sourate_id);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) return { data: null, error: deleteError };

  // 2. INSERT
  const row = { ecole_id, type_action, points: parseInt(points) || 0, actif: true };
  if (objet_id) row.objet_id = objet_id;
  if (sourate_id) row.sourate_id = sourate_id;
  if (groupe_factorisation) row.groupe_factorisation = groupe_factorisation;
  const { data, error } = await supabase.from('bareme_notes').insert(row);
  return { data, error };
}

/**
 * Sauvegarde BULK de plusieurs criteres en une seule operation.
 * Beaucoup plus rapide que d'appeler saveBaremeItem N fois.
 *
 * Strategie :
 * 1. DELETE en bulk : supprime toutes les lignes en conflit potentiel d'un coup
 * 2. INSERT en bulk : insere toutes les nouvelles lignes en une requete
 *
 * @param items : tableau de { type_action, points, objet_id, sourate_id, groupe_factorisation }
 * @returns { saved, errors }
 */
export async function saveBaremeItemsBulk(supabase, ecole_id, items) {
  if (!items || items.length === 0) return { saved: 0, errors: [] };
  const errors = [];

  // 1. DELETE en bulk groupe par type_action
  // (on ne peut pas mettre tous les types dans 1 seul DELETE car les conditions diffèrent)
  const parType = {};
  items.forEach(it => {
    if (!parType[it.type_action]) parType[it.type_action] = [];
    parType[it.type_action].push(it);
  });

  for (const [type_action, group] of Object.entries(parType)) {
    if (type_action === 'sourate_dans_ensemble') {
      // DELETE des combinaisons (objet_id, sourate_id) pour ce type
      // Strategie : DELETE par objet_id, puis sourate_id specifique
      const objetIds = [...new Set(group.map(g => g.objet_id).filter(Boolean))];
      if (objetIds.length > 0) {
        const sourateIds = group.map(g => g.sourate_id).filter(Boolean);
        const { error: delErr } = await supabase
          .from('bareme_notes')
          .delete()
          .eq('ecole_id', ecole_id)
          .eq('type_action', 'sourate_dans_ensemble')
          .eq('actif', true)
          .in('objet_id', objetIds)
          .in('sourate_id', sourateIds);
        if (delErr) errors.push(`DELETE sourate_dans_ensemble: ${delErr.message}`);
      }
    } else {
      // DELETE par objet_id (ou null)
      const avecObjet = group.filter(g => g.objet_id).map(g => g.objet_id);
      const sansObjet = group.filter(g => !g.objet_id);

      if (avecObjet.length > 0) {
        const { error: delErr } = await supabase
          .from('bareme_notes')
          .delete()
          .eq('ecole_id', ecole_id)
          .eq('type_action', type_action)
          .eq('actif', true)
          .in('objet_id', avecObjet);
        if (delErr) errors.push(`DELETE ${type_action}: ${delErr.message}`);
      }
      if (sansObjet.length > 0) {
        const { error: delErr } = await supabase
          .from('bareme_notes')
          .delete()
          .eq('ecole_id', ecole_id)
          .eq('type_action', type_action)
          .eq('actif', true)
          .is('objet_id', null);
        if (delErr) errors.push(`DELETE ${type_action} (sans objet): ${delErr.message}`);
      }
    }
  }

  // 2. INSERT en bulk
  const rows = items.map(it => {
    const r = {
      ecole_id,
      type_action: it.type_action,
      points: parseInt(it.points) || 0,
      actif: true,
    };
    if (it.objet_id) r.objet_id = it.objet_id;
    if (it.sourate_id) r.sourate_id = it.sourate_id;
    if (it.groupe_factorisation) r.groupe_factorisation = it.groupe_factorisation;
    return r;
  });

  const { error: insErr } = await supabase.from('bareme_notes').insert(rows);
  if (insErr) {
    errors.push(`INSERT bulk: ${insErr.message}`);
    return { saved: 0, errors };
  }

  return { saved: rows.length, errors };
}

/**
 * Calcule les points pour une sourate recitee selon la priorite :
 *   1. Mode 3 (sourate_dans_ensemble) si paramete pour cette sourate
 *   2. Mode 1 (sourate complete generique) sinon
 *
 * @param sourate_id : id de la sourate recitee
 * @param bareme : objet bareme charge via loadBareme
 * @param ensembles : tableau des ensembles_sourates avec sourates_ids
 * @param typeRecitation : 'complete' ou 'sequence'
 * @returns { points, source }
 */
/**
 * FIX (oct 2026) : convention unique des sourates acquises avant le suivi.
 * eleves.sourates_acquises = N = les N premieres sourates du Coran dans le sens du niveau
 * (desc : 114, 113, ... ; asc : 1, 2, ...) — meme convention que AcquisSelector et les
 * verifications de blocage. Retourne l'ensemble des NUMEROS acquis.
 */
export function numerosSouratesAcquises(nbAcquises, sens = 'desc') {
  const n = Math.max(0, Math.min(114, parseInt(nbAcquises) || 0));
  const set = new Set();
  for (let i = 0; i < n; i++) set.add(sens === 'asc' ? i + 1 : 114 - i);
  return set;
}

/**
 * FIX (oct 2026) : liste ordonnee des sourates d'un eleve = programme du niveau s'il existe
 * (sinon les 114), triee selon le sens. `toutes` = objets {numero, ...}.
 */
export function ordonnerSouratesProgramme(toutes, programmeNumeros, sens = 'desc') {
  const prog = programmeNumeros && programmeNumeros.size > 0 ? programmeNumeros : null;
  return [...(toutes || [])]
    .filter(s => !prog || prog.has(s.numero))
    .sort((a, b) => sens === 'asc' ? a.numero - b.numero : b.numero - a.numero);
}

export function calculerPointsSourate(sourate_id, bareme, ensembles, typeRecitation = 'complete') {
  // Pour les sequences, on garde la logique simple
  if (typeRecitation !== 'complete') {
    return {
      points: bareme?.unites?.sequence_sourate || 0,
      source: 'base',
    };
  }

  // Mode 3 : chercher une note specifique pour cette sourate dans un ensemble
  const sde = bareme?.sourates_dans_ensemble || {};
  for (const ens of (ensembles || [])) {
    if (!ens.sourates_ids || !ens.sourates_ids.includes(sourate_id)) continue;
    const noteSpec = sde[ens.id]?.[sourate_id];
    if (typeof noteSpec === 'number') {
      return { points: noteSpec, source: 'sourate_dans_ensemble', ensemble_id: ens.id };
    }
  }

  // Fallback Mode 1 : sourate complete generique
  return {
    points: bareme?.unites?.sourate || 0,
    source: 'base',
  };
}

/**
 * Points d'UNE validation selon le bareme (memes regles que calcPointsPeriode).
 * Source unique pour les affichages ligne a ligne / courbes (oct 2026) : remplace
 * les anciennes formules codees en dur (bonus Roba +25 / Nisf +60, 10/100/30 pts).
 * Accepte un bareme complet (avec .unites) ou plat. Les ensembles valides ne
 * rapportent rien ici (leur bonus depend de bareme.ensembles, voir calcPointsPeriode).
 */
export function ptsValidation(v, bareme) {
  const B = (bareme && bareme.unites) ? bareme.unites : (bareme || BAREME_DEFAUT);
  if (!v) return 0;
  switch (v.type_validation) {
    case 'hizb_complet': return B.hizb_complet || 0;
    case 'tomon_muraja': return (v.nombre_tomon || 0) * (B.muraja_tomon || 0);
    case 'hizb_muraja':  return B.muraja_hizb || 0;
    case 'ensemble_valide': return (bareme && bareme.ensembles && v.ensemble_id) ? (bareme.ensembles[v.ensemble_id] || 0) : 0;
    default: return (v.nombre_tomon || 0) * (B.tomon || 0);
  }
}

export function calcPoints(tomonCumul, hizbsCompletsCount, validations, tomonAcquis=0, hizbAcquisComplets=0, bareme=null) {
  const B = (bareme && bareme.unites) ? bareme.unites : (bareme || BAREME_DEFAUT);
  // BUG-FIX BAREME (mai 2026)
  // Avant : 4 unites comptees (Tomon + Roba × 2.5 + Nisf × 6 + Hizb).
  //         Les coefficients (×2.5, ×6) etaient hardcodes et n'avaient pas
  //         de sens metier dans le modele actuel ou seuls les types
  //         configures dans Gestion -> Notes existent.
  // Apres : 2 unites uniquement (Tomon + Hizb), chacune valorisee selon
  //         le bareme parametre par l'ecole. Les concepts Roba'/Nisf
  //         disparaissent completement du calcul de points.
  // Impact : tous les totaux de points des eleves vont diminuer (suppression
  //          des bonus Roba/Nisf). Le tableau d'honneur et les classements
  //          seront automatiquement rejoues. Decision validee par Jamal.

  // tomonCumul = total Tomon (acquis + nouveaux)
  // hizbsCompletsCount = total Hizb complets (acquis + nouveaux)
  const ptsTomon = tomonCumul * B.tomon;
  const ptsHizb = hizbsCompletsCount * B.hizb_complet;

  // Points acquis antérieurs séparément (pour affichage informatif)
  const ptsAcquisTomon = tomonAcquis * B.tomon;
  const ptsAcquisHizb = hizbAcquisComplets * B.hizb_complet;
  const ptsAcquisTotal = ptsAcquisTomon + ptsAcquisHizb;

  // Points gagnés depuis le début du suivi
  const tomonNouveaux = tomonCumul - tomonAcquis;
  const hizbNouveaux = hizbsCompletsCount - hizbAcquisComplets;
  const ptsSuiviTomon = tomonNouveaux * B.tomon;
  const ptsSuiviHizb = hizbNouveaux * B.hizb_complet;

  return {
    total: ptsTomon + ptsHizb,
    ptsTomon,
    ptsHizb,
    // Compat retrocompatible : ces champs existent toujours pour eviter de
    // casser les consommateurs qui les lisent. Ils valent 0 desormais.
    ptsRoboe: 0,
    ptsNisf: 0,
    ptsAcquisTotal,    // Points provenant des acquis antérieurs
    ptsDepuisSuivi: ptsSuiviTomon + ptsSuiviHizb, // Gagnés depuis le suivi
    tomonAcquis,
    hizbAcquisComplets,
    details: { nbRoboe: 0, nbNisf: 0, nbHizb: hizbsCompletsCount }
  };
}

/**
 * Calcule l'état courant d'un élève (Hizb en cours, progression, points).
 * @param validations : liste des validations (tomon, hizb_complet, muraja...)
 * @param hizbDepart/tomonDepart : acquis avant suivi (0 = aucun)
 * @param sens : 'desc' (défaut) ou 'asc' — sens de progression du niveau
 * @param eleve : (optionnel) objet eleve complet pour calcul multi-blocs
 * @param programmeNiveau : (optionnel) tableau des lignes table 'programmes'
 *                          du niveau de l'eleve. Si fourni avec eleve, active
 *                          la logique multi-blocs corrigee.
 */
/**
 * FIX (oct 2026) : passage de niveau "repartir" -> la progression (position, hizbs/sourates
 * faits, blocages, certificats) ne compte que ce qui a ete fait DEPUIS le debut du niveau
 * (eleves.debut_niveau_at). Les points deja gagnes restent comptes dans les totaux.
 * Sans debut_niveau_at (cas general), rien n'est filtre.
 */
export function depuisDebutNiveau(rows, eleve, champ = 'date_validation') {
  const debut = eleve && eleve.debut_niveau_at ? new Date(eleve.debut_niveau_at) : null;
  if (!debut || isNaN(debut)) return rows || [];
  // Audit final (oct 2026) : date_validation est un TIMESTAMP sans fuseau (valeur UTC) ; relue
  // sans « Z », JS la prenait en heure locale (Maroc UTC+1) -> les recitations de la 1re heure
  // apres un passage « repartir » etaient ignorees. On la lit donc comme UTC.
  const lireDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v))
    ? new Date(v.replace(' ', 'T') + 'Z') : new Date(v);
  return (rows || []).filter(r => !r[champ] || lireDate(r[champ]) >= debut);
}

export function calcEtatEleve(validationsToutes, hizbDepart, tomonDepart, sens = 'desc', eleve = null, programmeNiveau = null, bareme = null) {
  const validations = depuisDebutNiveau(validationsToutes, eleve);
  // BUG-FIX POINTS FICHE ELEVE (oct 2026) : nouveau param `bareme` optionnel.
  // Avant : calcPoints etait appele sans bareme -> toujours 0 pts sur la
  //         fiche eleve (BAREME_DEFAUT a tomon=0, hizb_complet=0).
  //         Le menu Notes affichait correctement les points (via
  //         calcPointsPeriode fixee en sep 2026) mais pas la fiche.
  // Apres : si bareme passe, les points sont calcules correctement.
  //         Si bareme non passe (appelants sans barème dispo = ElevesInactifs),
  //         comportement identique a avant = 0 pts (retrocompat totale).
  // Note : accepte barème complet (avec .unites) ou objet plat {tomon, hizb_complet, ...}
  //        grace a la logique de calcPoints ligne 533.
  // Valeurs par défaut selon le sens
  const defaultHizb = sens === 'asc' ? 1 : 60;
  const hizbD = (hizbDepart === 0 || hizbDepart === null || hizbDepart === undefined) ? defaultHizb : hizbDepart;
  const tomonD = (tomonDepart === 0 || tomonDepart === null || tomonDepart === undefined) ? 1 : tomonDepart;
  // sansAcquis : l'élève démarre de zéro (aucun hizb mémorisé avant)
  const sansAcquis = (hizbDepart === 0 || hizbDepart === null || hizbDepart === undefined);

  const valsChron = [...validations].sort((a, b) => new Date(a.date_validation) - new Date(b.date_validation));
  let tomonCumul = 0;
  const hizbsComplets = new Set();

  for (const v of valsChron) {
    if (v.type_validation === 'hizb_complet') {
      hizbsComplets.add(v.hizb_valide);
    } else if (v.type_validation === 'tomon' && v.nombre_tomon > 0) {
      // On compte UNIQUEMENT les validations type='tomon' dans la progression.
      // Les type='tomon_muraja' et 'hizb_muraja' sont des révisions, pas de la
      // nouvelle mémorisation — elles ne font pas avancer le hizb en cours.
      tomonCumul += v.nombre_tomon;
    }
  }

  const pos = calcPosition(hizbD, tomonD, tomonCumul, sens);
  // hizbBrut = le Hizb EN COURS (celui dont on vient de finir les 8 tomons)
  // En desc : hizb courant = pos.hizb + 1 (car on est déjà passé au suivant décroissant)
  // En asc  : hizb courant = pos.hizb - 1 (car on est déjà passé au suivant croissant)
  const tous8Faits = pos.tomon === 1 && tomonCumul > 0;
  const hizbBrut = tous8Faits
    ? (sens === 'asc' ? pos.hizb - 1 : pos.hizb + 1)
    : pos.hizb;
  const hizbCompletValide = hizbsComplets.has(hizbBrut);

  // BUG-FIX MULTI-BLOCS (mai 2026)
  // Si on a l'eleve + programmeNiveau, on utilise la nouvelle logique correcte
  // qui tient compte de la structure en blocs (sens different par bloc).
  // Sinon, on retombe sur l'ancienne logique mono-bloc lineaire (retrocompatible).
  let tomonAcquis, hizbAcquisComplets;
  if (!sansAcquis && eleve && programmeNiveau && programmeNiveau.length > 0) {
    // Nouvelle logique multi-blocs
    const hizbsAcquisSet = calcHizbsAcquisAvantArrivee(eleve, programmeNiveau, sens);
    hizbAcquisComplets = hizbsAcquisSet.size;
    tomonAcquis = hizbAcquisComplets * 8 + (tomonD - 1);
  } else if (!sansAcquis) {
    // Ancienne logique mono-bloc (fallback retrocompatible)
    // En desc : de Hizb 60 à Hizb (hizbD+1) complets, + (tomonD-1) dans Hizb hizbD
    // En asc  : de Hizb 1 à Hizb (hizbD-1) complets, + (tomonD-1) dans Hizb hizbD
    tomonAcquis = (sens === 'asc' ? (hizbD - 1) * 8 + (tomonD - 1) : (60 - hizbD) * 8 + (tomonD - 1));
    hizbAcquisComplets = (sens === 'asc' ? (hizbD - 1) : (60 - hizbD));
  } else {
    tomonAcquis = 0;
    hizbAcquisComplets = 0;
  }
  // Points totaux = acquis antérieurs + nouveaux validés depuis le suivi
  const tomonTotal = tomonAcquis + tomonCumul;
  const hizbCompletsTotal = hizbAcquisComplets + hizbsComplets.size;
  // BUG-FIX POINTS (oct 2026) : passer `bareme` a calcPoints pour avoir
  // les vrais points au lieu de 0. Si bareme est null, calcPoints utilise
  // BAREME_DEFAUT (comportement identique a avant).
  const points = calcPoints(tomonTotal, hizbCompletsTotal, validations, tomonAcquis, hizbAcquisComplets, bareme);

  if (tous8Faits && hizbCompletValide) {
    // Hizb complet validé → passer au hizb SUIVANT selon le sens
    const prochainHizb = sens === 'asc'
      ? Math.min(60, hizbBrut + 1)
      : Math.max(1, hizbBrut - 1);
    return {
      hizbEnCours: prochainHizb,
      prochainTomon: 1,
      tomonDansHizbActuel: 0,
      tomonRestants: 8,
      tous8Faits: false,
      hizbCompletValide: false,
      enAttenteHizbComplet: false,
      hizbsComplets,
      tomonCumul,
      tomonTotal,
      tomonAcquis,
      hizbAcquisComplets,
      points,
      positionReelle: pos,
      sens
    };
  }

  const tomonDansHizbActuel = tous8Faits ? 8 : pos.tomon - 1;
  const enAttenteHizbComplet = tous8Faits && !hizbCompletValide;

  return {
    hizbEnCours: hizbBrut,
    prochainTomon: tous8Faits ? null : pos.tomon,
    tomonDansHizbActuel,
    tomonRestants: tous8Faits ? 0 : 8 - tomonDansHizbActuel,
    tous8Faits,
    hizbCompletValide,
    enAttenteHizbComplet,
    hizbsComplets,
    tomonCumul,
    tomonTotal,
    tomonAcquis,
    hizbAcquisComplets,
    points,
    positionReelle: pos,
    sens
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// calcEtatEleveAvecBlocs — wrapper pour la progression multi-blocs
// ═══════════════════════════════════════════════════════════════════════════
//
// PRINCIPE DIRECTEUR (validation Jamal) :
//   Les recitations des eleves appartenant aux niveaux avec blocs doivent
//   respecter la chronologie des blocs ainsi que leur sens de recitation.
//
// COMPORTEMENT :
//   - Niveau monobloc OU sans programme : retourne calcEtatEleve directement
//     (zero changement de comportement, retrocompatibilite totale)
//   - Niveau multi-blocs :
//     1. Calcule la liste hizbsFaits = hizbs_acquis ∪ hizbsComplets (validations)
//     2. Determine le bloc actuel selon les Hizbs deja faits
//     3. Si l'eleve est AU MILIEU d'un Hizb (tomons partiels < 8) : garde le
//        Hizb actuellement en cours, prochainTomon, etc.
//     4. Si l'eleve DEBUTE un nouveau Hizb (tomonCumul=0 ou hizb_complet
//        valide juste avant) : recalcule hizbEnCours = premier Hizb non acquis
//        dans le bloc actuel selon son SENS PROPRE.
//
// COHERENCE :
//   La validation utilisera le hizbEnCours retourne par cette fonction,
//   donc l'enregistrement BDD sera coherent avec l'affichage.
// ═══════════════════════════════════════════════════════════════════════════
export function calcEtatEleveAvecBlocs(validations, eleve, programmeNiveau, sens = 'desc', bareme = null) {
  // BUG-FIX POINTS FICHE ELEVE (oct 2026) : nouveau param `bareme` optionnel.
  // Transmis a calcEtatEleve pour avoir les vrais points.
  // Si non passe, comportement identique a avant (points = 0 via BAREME_DEFAUT).

  // Etape 1 : calcEtatEleve standard (toujours fait pour tomonCumul, points, etc.)
  // BUG-FIX MULTI-BLOCS : on passe eleve + programmeNiveau pour que le calcul
  // des tomons/hizbs acquis utilise la logique multi-blocs corrigee
  // (au lieu de la boucle lineaire 1->hizbDep / 60->hizbDep).
  validations = depuisDebutNiveau(validations, eleve); // FIX (oct 2026) : passage de niveau
  const etatBrut = calcEtatEleve(
    validations || [],
    eleve?.hizb_depart || 0,
    eleve?.tomon_depart || 0,
    sens,
    eleve,
    programmeNiveau,
    bareme   // NEW oct 2026
  );

  // Etape 2 : detecter si multi-blocs (sinon retour direct)
  if (!programmeNiveau || programmeNiveau.length === 0) return etatBrut;
  const blocsUniques = new Set(programmeNiveau.map(p => p.bloc_numero || 1));
  if (blocsUniques.size <= 1) return etatBrut;

  // Etape 3 : calculer hizbsFaits (acquis + valides pendant le suivi)
  const hizbsFaits = new Set(etatBrut.hizbsComplets || []);
  if (Array.isArray(eleve?.hizbs_acquis) && eleve.hizbs_acquis.length > 0) {
    for (const h of eleve.hizbs_acquis) hizbsFaits.add(h);
  }
  // Note : pas de fallback hizb_depart en multi-blocs (cf. principe "ne pas inventer")

  // Etape 4 : calcBlocProgression pour determiner bloc actuel et sens
  const prog = calcBlocProgression(programmeNiveau, hizbsFaits, etatBrut.hizbEnCours);
  if (!prog || prog.estMonoBloc || !prog.blocActuel) return etatBrut;

  // Etape 5 : determiner le Hizb que l'eleve doit reciter MAINTENANT selon le bloc
  // C'est le premier Hizb non present dans hizbsFaits, en parcourant les blocs
  // dans l'ordre, chaque bloc dans son sens propre.
  const { hizb: hizbCibleSelonBloc } = prochainHizbDansBloc(prog);
  if (!hizbCibleSelonBloc) {
    // Tous les Hizbs des blocs sont termines -> rien a faire de plus
    return { ...etatBrut, _blocActuel: { numero: prog.blocActuel.numero, nom: prog.blocActuel.nom, sens: prog.blocActuel.sens } };
  }

  // Etape 6 : compter les tomons deja valides SUR ce Hizb-cible specifique
  // (Cas typique : l'eleve a valide 3 tomons sur le Hizb 42. On veut prochainTomon=4.)
  let tomonsSurHizbCible = 0;
  for (const v of (validations || [])) {
    if (v.type_validation === 'tomon' && (v.hizb_validation === hizbCibleSelonBloc || v.hizb === hizbCibleSelonBloc)) {
      const n = parseInt(v.nombre_tomon) || 1;
      tomonsSurHizbCible += n;
    }
  }
  // Bornes : 0 a 8 (au-dela = Hizb deja complet, ce qui aurait du etre detecte par hizbsFaits)
  tomonsSurHizbCible = Math.max(0, Math.min(8, tomonsSurHizbCible));

  // Etape 7 : construire l'etat coherent
  const tous8Faits = tomonsSurHizbCible >= 8;
  // hizbsComplets de calcEtatEleve est un Set (pas un Array), utiliser .has() pas .includes()
  const hizbCompletValide = etatBrut.hizbsComplets instanceof Set
    ? etatBrut.hizbsComplets.has(hizbCibleSelonBloc)
    : Array.isArray(etatBrut.hizbsComplets) && etatBrut.hizbsComplets.includes(hizbCibleSelonBloc);

  return {
    ...etatBrut,
    hizbEnCours: hizbCibleSelonBloc,
    prochainTomon: tous8Faits ? null : (tomonsSurHizbCible + 1),
    tomonDansHizbActuel: tomonsSurHizbCible,
    tomonRestants: tous8Faits ? 0 : (8 - tomonsSurHizbCible),
    tous8Faits,
    hizbCompletValide,
    enAttenteHizbComplet: tous8Faits && !hizbCompletValide,
    _ajusteParBloc: etatBrut.hizbEnCours !== hizbCibleSelonBloc,
    _blocActuel: { numero: prog.blocActuel.numero, nom: prog.blocActuel.nom, sens: prog.blocActuel.sens },
  };
}

export function calcStats(validations) {
  const maintenant = new Date();
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const debutSemaine = new Date(maintenant);
  debutSemaine.setDate(maintenant.getDate() - 7);

  return {
    hizbsCompletsMois: validations.filter(v => v.type_validation === 'hizb_complet' && new Date(v.date_validation) >= debutMois).length,
    tomonSemaine: validations.filter(v => v.type_validation === 'tomon' && new Date(v.date_validation) >= debutSemaine).reduce((s, v) => s + v.nombre_tomon, 0),
    recitationsMois: validations.filter(v => new Date(v.date_validation) >= debutMois).length,
    recitationsSemaine: validations.filter(v => new Date(v.date_validation) >= debutSemaine).length,
  };
}

export function scoreLabel(points, lang) {
  // oct 2026 : libelle traduit en arabe (il restait en francais dans l'interface arabe)
  const ar = lang === 'ar';
  if (points >= 3000) return { label: ar ? 'ممتاز' : 'Excellence', color: '#EF9F27', bg: '#FAEEDA' };
  if (points >= 1500) return { label: ar ? 'متقدم' : 'Avancé', color: '#1D9E75', bg: '#E1F5EE' };
  if (points >= 600) return { label: ar ? 'متوسط' : 'Intermédiaire', color: '#378ADD', bg: '#E6F1FB' };
  if (points >= 200) return { label: ar ? 'مبتدئ+' : 'Débutant+', color: '#888', bg: '#f0f0ec' };
  return { label: ar ? 'مبتدئ' : 'Débutant', color: '#bbb', bg: '#f9f9f6' };
}

// Calcul des badges automatiques
export function calcBadges(validations, etat, lang = 'fr') {
  const badges = [];
  const tomonCumul = etat.tomonCumul;
  const hizbsComplets = etat.hizbsComplets.size;
  const isAr = lang === 'ar';

  if (tomonCumul >= 1) badges.push({ id: 'premier_tomon', icon: '🌱',
    label: isAr ? 'أول ثُمن' : 'Premier Tomon',
    desc: isAr ? 'استظهر أول ثُمن له' : 'A récité son tout premier Tomon',
    color: '#1D9E75', bg: '#E1F5EE' });
  if (hizbsComplets >= 1) badges.push({ id: 'premier_hizb', icon: '📖',
    label: isAr ? 'أول حزب' : 'Premier Hizb',
    desc: isAr ? 'أكمل أول حزب له' : 'A complété son premier Hizb',
    color: '#EF9F27', bg: '#FAEEDA' });
  if (hizbsComplets >= 5) badges.push({ id: 'cinq_hizb', icon: '🔥',
    label: isAr ? '5 أحزاب' : '5 Hizb',
    desc: isAr ? 'أكمل 5 أحزاب' : 'A complété 5 Hizb',
    color: '#E24B4A', bg: '#FCEBEB' });
  if (hizbsComplets >= 10) badges.push({ id: 'dix_hizb', icon: '⭐',
    label: isAr ? '10 أحزاب' : '10 Hizb',
    desc: isAr ? 'إتقان 10 أحزاب' : 'Maîtrise de 10 Hizb',
    color: '#534AB7', bg: '#EEEDFE' });
  if (hizbsComplets >= 30) badges.push({ id: 'moitie_coran', icon: '🌙',
    label: isAr ? 'نصف القرآن' : 'Mi-Coran',
    desc: isAr ? 'بلغ نصف القرآن' : 'A atteint la moitié du Coran',
    color: '#085041', bg: '#E1F5EE' });
  if (hizbsComplets >= 60) badges.push({ id: 'hafiz', icon: '👑',
    label: isAr ? 'حافظ' : 'Hafiz',
    desc: isAr ? 'حفظ القرآن كاملاً' : 'A mémorisé le Coran complet',
    color: '#EF9F27', bg: '#FAEEDA' });
  if (tomonCumul >= 10) badges.push({ id: 'dix_tomon', icon: '💪',
    label: isAr ? '10 أثمان' : '10 Tomon',
    desc: isAr ? 'استظهر 10 أثمان' : 'A récité 10 Tomon au total',
    color: '#378ADD', bg: '#E6F1FB' });
  if (tomonCumul >= 40) badges.push({ id: 'quarante_tomon', icon: '🚀',
    label: isAr ? '40 ثُمن' : '40 Tomon',
    desc: isAr ? 'حفظ 5 أحزاب بالأثمان' : 'Mémorisé 5 Hizb en Tomon',
    color: '#D85A30', bg: '#FAECE7' });

  // Badge vitesse — a récité 6+ Tomon en une semaine
  const semaineDerniere = new Date(); semaineDerniere.setDate(semaineDerniere.getDate()-7);
  const tomonSemaine = validations.filter(v=>v.type_validation==='tomon'&&new Date(v.date_validation)>=semaineDerniere).reduce((s,v)=>s+v.nombre_tomon,0);
  if (tomonSemaine >= 6) badges.push({ id: 'semaine_record', icon: '⚡',
    label: isAr ? 'أسبوع قياسي' : 'Semaine record',
    desc: isAr ? `${tomonSemaine} ثُمن في 7 أيام` : `${tomonSemaine} Tomon en 7 jours`,
    color: '#EF9F27', bg: '#FAEEDA' });

  // Streak 4 semaines
  const streak = calcStreakWeeks(validations);
  if (streak >= 4) badges.push({ id: 'streak_4', icon: '🔗',
    label: isAr ? '4 أسابيع' : '4 semaines',
    desc: isAr ? '4 أسابيع متتالية نشطة' : '4 semaines consécutives actives',
    color: '#534AB7', bg: '#EEEDFE' });

  return badges;
}

function calcStreakWeeks(validations) {
  if (!validations.length) return 0;
  const weeks = new Set(validations.map(v => {
    const d = new Date(v.date_validation);
    const start = new Date(d.getFullYear(), 0, 1);
    return `${d.getFullYear()}-${Math.floor((d-start)/(7*24*60*60*1000))}`;
  }));
  const sorted = [...weeks].sort().reverse();
  let streak = 1;
  for (let i = 0; i < sorted.length-1; i++) {
    const [y1,w1]=sorted[i].split('-').map(Number);
    const [y2,w2]=sorted[i+1].split('-').map(Number);
    if((y1-y2)*52+(w1-w2)===1) streak++;
    else break;
  }
  return streak;
}

// Message de motivation après validation
export function motivationMsg(nombreTomon, etat, isHizbComplet) {
  if (isHizbComplet) return { msg: `Mashallah ! Hizb ${etat.hizbEnCours} complet validé ! 🎉`, color: '#EF9F27' };
  if (etat.tomonRestants === 0 || etat.enAttenteHizbComplet) return { msg: 'Excellent ! Les 8 Tomon sont complets — validez le Hizb entier !', color: '#1D9E75' };
  if (nombreTomon >= 4) return { msg: `Exceptionnel ! ${nombreTomon} Tomon d'un coup — Barakallah ! 🚀`, color: '#534AB7' };
  if (nombreTomon === 3) return { msg: `Très bien ! ${nombreTomon} Tomon validés — continuez ainsi ! ⭐`, color: '#1D9E75' };
  if (etat.tomonRestants <= 2) return { msg: `Encore ${etat.tomonRestants} Tomon pour finir le Hizb ${etat.hizbEnCours} ! 💪`, color: '#EF9F27' };
  return { msg: `Bien ! Tomon validé — prochain : T.${etat.prochainTomon} du Hizb ${etat.hizbEnCours}`, color: '#1D9E75' };
}

// Vitesse de progression (Tomon/semaine moyenne)
export function calcVitesse(validations) {
  const tVals = validations.filter(v => v.type_validation === 'tomon');
  if (tVals.length === 0) return { moyenne: 0, tendance: 'neutre' };
  const sorted = [...tVals].sort((a,b) => new Date(a.date_validation)-new Date(b.date_validation));
  const debut = new Date(sorted[0].date_validation);
  const fin = new Date(sorted[sorted.length-1].date_validation);
  const semaines = Math.max(1, (fin-debut)/(7*24*60*60*1000));
  const total = tVals.reduce((s,v) => s+v.nombre_tomon, 0);
  const moyenne = total/semaines;

  // Tendance : comparer dernières 2 semaines vs 2 semaines avant
  const now = new Date();
  const s1 = new Date(now); s1.setDate(now.getDate()-7);
  const s2 = new Date(now); s2.setDate(now.getDate()-14);
  const recente = tVals.filter(v=>new Date(v.date_validation)>=s1).reduce((s,v)=>s+v.nombre_tomon,0);
  const precedente = tVals.filter(v=>new Date(v.date_validation)>=s2&&new Date(v.date_validation)<s1).reduce((s,v)=>s+v.nombre_tomon,0);
  const tendance = recente > precedente ? 'hausse' : recente < precedente ? 'baisse' : 'stable';
  return { moyenne: Math.round(moyenne*10)/10, tendance, recente, precedente };
}


// Normalize niveau to display in current language
export function niveauTraduit(niveau, lang, tFn) {
  const deb = ['Débutant','Beginner','مبتدئ','debutant','beginner'];
  const mid = ['Intermédiaire','Intermediate','متوسط','intermediaire','intermediate'];
  const adv = ['Avancé','Advanced','متقدم','avance','advanced'];
  if (deb.some(v => niveau?.toLowerCase() === v.toLowerCase())) return tFn(lang, 'debutant');
  if (mid.some(v => niveau?.toLowerCase() === v.toLowerCase())) return tFn(lang, 'intermediaire');
  if (adv.some(v => niveau?.toLowerCase() === v.toLowerCase())) return tFn(lang, 'avance');
  return niveau || '—';
}

// ══════════════════════════════════════════════════════════════════
// PHASE 4 — Vérification des blocages d'examen
// ══════════════════════════════════════════════════════════════════

/**
 * Vérifie si un élève est bloqué par un examen avant de continuer.
 * Retourne null si pas de blocage, ou l'objet examen requis.
 *
 * Logique :
 * - Pour Hizb : l'élève vient-il de finir le dernier Hizb d'un bloc ?
 * - Pour Sourate : l'élève vient-il de finir la dernière sourate d'un bloc ?
 * Dans les deux cas, on vérifie aussi qu'il n'a pas déjà réussi l'examen.
 */
// PERF (oct 2026) : parametres du blocage (niveau, examens bloquants, programme, ensembles, liste
// des sourates) gardes 60 s en memoire par client Supabase. Ils changent rarement ; les resultats
// d'examens, eux, sont toujours relus. Dans le cas courant (aucun examen atteint), la verification
// ne fait alors plus aucun appel reseau.
const CACHE_BLOCAGE_TTL = 60 * 1000;
const cacheBlocageParClient = new WeakMap();
async function memoBlocage(supabase, cle, charger) {
  let m = cacheBlocageParClient.get(supabase);
  if (!m) { m = new Map(); cacheBlocageParClient.set(supabase, m); }
  const e = m.get(cle);
  if (e && Date.now() - e.t < CACHE_BLOCAGE_TTL) return e.v;
  const v = await charger();
  if (v && v.ok) m.set(cle, { t: Date.now(), v });
  return v;
}
export function viderCacheBlocage(supabase) { if (supabase) cacheBlocageParClient.delete(supabase); }

export async function verifierBlocageExamen(supabase, {
  eleve,
  ecole_id,
  validations,    // validations existantes (hizb)
  recitations,    // recitations_sourates existantes
}) {
  // FIX (oct 2026) : seulement ce qui a ete fait depuis le debut du niveau actuel
  validations = depuisDebutNiveau(validations, eleve);
  recitations = depuisDebutNiveau(recitations, eleve);
  try {
    // Niveau (via code_niveau), puis examens bloquants + programme du niveau en parallele (memorises)
    const params = await memoBlocage(supabase, `niv|${ecole_id}|${eleve.code_niveau || ''}`, async () => {
      const { data: niv, error: errN } = await supabase
        .from('niveaux')
        .select('id, type, code, sens_recitation')
        .eq('ecole_id', ecole_id)
        .eq('code', eleve.code_niveau || '')
        .maybeSingle();
      if (errN) return { ok: false };
      if (!niv) return { ok: true, niveauData: null };
      const [rEx, rPg] = await Promise.all([
        supabase.from('examens')
          .select('id, nom, bloquant, score_minimum, type_contenu, contenu_ids, actif')
          .eq('ecole_id', ecole_id)
          .eq('niveau_id', niv.id)
          .eq('bloquant', true)
          .order('ordre'),
        niv.type === 'hizb'
          ? Promise.resolve(supabase.from('programmes')
              .select('reference_id, ordre, bloc_numero, bloc_nom, bloc_sens, type_contenu')
              .eq('niveau_id', niv.id).eq('ecole_id', ecole_id).order('ordre')).catch(() => ({ data: [], error: true }))
          : Promise.resolve({ data: [] }),
      ]);
      if (rEx.error) return { ok: false };
      // Un examen desactive ne bloque plus (comme pour les ensembles)
      return { ok: !rPg.error, niveauData: niv, examens: (rEx.data || []).filter(x => x.actif !== false), prog: rPg.data || [] };
    });
    const niveauData = params && params.niveauData;
    if (!niveauData) return null;
    const niveauType = niveauData.type; // 'hizb' ou 'sourate'
    const examens = params.examens;
    if (!examens || examens.length === 0) return null;

    // Examens dont tout le contenu est fait (dans l'ordre) ; les resultats sont lus ensuite en 1 requete
    const examensTermines = [];
    for (const examen of examens) {
      const ids = examen.contenu_ids || [];
      if (ids.length === 0) continue;

      let examTermine = false;

      if (niveauType === 'hizb') {
        // ── Niveau Hizb ──
        // ids = numéros de Hizb
        // L'examen se déclenche quand tous ces Hizb sont valides (hizb_complet)
        //
        // Note metier : l'application impose deja a l'utilisateur de cliquer
        // "Valider Hizb complet" apres avoir valide les 8 tomons d'un Hizb
        // (le bouton "Valider Tomon" du Hizb suivant n'est dispo qu'apres ce
        // clic explicite). Donc une ligne type='hizb_complet' existe forcement
        // en BDD pour chaque Hizb termine pendant le suivi.
        const hizbComplets = new Set(
          (validations||[])
            .filter(v => v.type_validation === 'hizb_complet')
            .map(v => Number(v.hizb_valide))
        );

        // ─── BUG-FIX (oct 2026) : prendre en compte les hizbs acquis AVANT le suivi ─────
        // Symetrique au traitement sourates ligne ~1019.
        // Sans cela, un eleve avec hizb_depart au milieu (ex: Hizb 57) ne pourra
        // jamais declencher les examens couvrant les hizbs au-dela de son depart
        // (les hizbs 58-60 sont acquis d'office, pas en BDD).
        //
        // Convention metier (cf. calcEtatEleve ligne 635) :
        //   - En desc : hizb_depart = N -> hizbs N+1 a 60 sont acquis d'office
        //   - En asc  : hizb_depart = N -> hizbs 1 a N-1 sont acquis d'office
        //   - hizbs_acquis = tableau explicite de hizbs acquis supplementaires
        const sensNiveau = niveauData.sens_recitation || 'desc';
        const hd = parseInt(eleve?.hizb_depart) || 0;
        const acquisAvantSuivi = new Set(); // Hizb acquis avant le suivi (pour la regle « examen couvert »)
        if (hd > 0) {
          // Audit final (oct 2026) : tenir compte des BLOCS du programme (meme calcul que la fiche,
          // calcHizbsAcquisAvantArrivee). Avant : tous les Hizb au-dela du depart en ligne droite ->
          // dans un niveau a plusieurs blocs, un examen se declenchait apres un seul Hizb.
          // Sans programme, la fonction applique exactement l'ancienne regle en ligne droite.
          const progExam = params.prog || [];
          for (const h of calcHizbsAcquisAvantArrivee({ ...eleve, hizb_depart: hd }, progExam, sensNiveau)) { hizbComplets.add(Number(h)); acquisAvantSuivi.add(Number(h)); }
        }
        if (Array.isArray(eleve?.hizbs_acquis)) {
          for (const h of eleve.hizbs_acquis) {
            const n = Number(h);
            if (!isNaN(n)) { hizbComplets.add(n); acquisAvantSuivi.add(n); }
          }
        }

        examTermine = ids.every(h => hizbComplets.has(Number(h)));
        // Regle validee par Jamal (23/10) : un examen ENTIEREMENT couvert par les acquis d'avant le
        // suivi ne bloque pas ; l'eleve ne sera bloque qu'au prochain examen (Hizb recites pendant le suivi).
        if (examTermine && ids.every(h => acquisAvantSuivi.has(Number(h)))) continue;

      } else {
        // ── Niveau Sourate ──
        // ids = UUIDs des ensembles_sourates
        // L'examen se déclenche quand toutes les sourates de ces ensembles sont complètes

        // Charger les sourates des ensembles concernés
        const ensRes = await memoBlocage(supabase, `ens|${ecole_id}|${[...ids].map(String).sort().join(',')}`, async () => {
          const { data, error } = await supabase
            .from('ensembles_sourates')
            .select('id, sourates_ids')
            .in('id', ids);
          return { ok: !error, data: data || null };
        });
        const ensembles = ensRes && ensRes.data;

        if (!ensembles || ensembles.length === 0) continue;

        // Toutes les sourates de tous ces ensembles
        const toutesLesSourates = ensembles.flatMap(e => e.sourates_ids || []);

        // Sourates complètes de l'élève (depuis validations explicites)
        const souratesCompletes = new Set(
          (recitations||[])
            .filter(r => (r.type_recitation === 'complete' || r.complete === true) && !r.is_muraja) // FIX (oct 2026) : muraja exclue
            .map(r => r.sourate_id)
        );

        // ─── AJOUT : prendre en compte les sourates acquises ANTERIEUREMENT ─────
        // sourates_acquises = nombre N = les N premieres sourates (en sens du niveau)
        // sont considerees deja maitrisees AVANT le suivi.
        // Sans cela, un eleve avec acquis prealables ne pourra jamais declencher
        // le blocage (le compteur de recitations en BDD n'atteindra jamais le total).
        const nbAcquises = eleve?.sourates_acquises || 0;
        const souratesAcquisesAvant = new Set(); // pour la regle « examen couvert par les acquis »
        if (nbAcquises > 0) {
          try {
            // Charger les 114 sourates de la BDD triees selon le sens du niveau
            const sensNiveau = niveauData.sens_recitation || 'desc';
            const sourRes = await memoBlocage(supabase, `sour|${sensNiveau}`, async () => {
              const { data, error } = await supabase
                .from('sourates')
                .select('id, numero')
                .order('numero', { ascending: sensNiveau === 'asc' });
              return { ok: !error, data: data || null };
            });
            const souratesData = sourRes && sourRes.data;
            if (souratesData && souratesData.length > 0) {
              // Les N premieres dans cet ordre = acquises avant le suivi
              const idsAcquis = souratesData.slice(0, nbAcquises).map(s => s.id);
              for (const sId of idsAcquis) { souratesCompletes.add(sId); souratesAcquisesAvant.add(sId); }
            }
          } catch (e) {
            console.warn('[verifierBlocageExamen] echec ajout sourates_acquises:', e);
          }
        }

        examTermine = toutesLesSourates.length > 0 &&
          toutesLesSourates.every(sid => souratesCompletes.has(sid));
        // Meme regle (23/10) : examen entierement couvert par les sourates acquises avant le suivi -> pas de blocage
        if (examTermine && toutesLesSourates.every(sid => souratesAcquisesAvant.has(sid))) continue;
      }

      if (!examTermine) continue;
      examensTermines.push(examen);
    }

    if (examensTermines.length === 0) return null; // cas courant : aucun appel reseau supplementaire

    // Examens deja reussis par l'eleve (une seule requete pour tous les examens termines)
    const { data: reussis } = await supabase
      .from('resultats_examens')
      .select('examen_id')
      .eq('eleve_id', eleve.id)
      .eq('statut', 'reussi')
      .in('examen_id', examensTermines.map(x => x.id));
    const dejaReussis = new Set((reussis || []).map(r => String(r.examen_id)));

    for (const examen of examensTermines) {
      if (dejaReussis.has(String(examen.id))) continue; // déjà réussi → pas de blocage
      // 🔒 Blocage actif !
      return {
        examen,
        type: niveauType,
        message_fr: `🔒 Examen requis avant de continuer : "${examen.nom}"`,
        message_ar: `🔒 الامتحان مطلوب قبل المتابعة: "${examen.nom}"`,
      };
    }

    return null; // aucun blocage
  } catch (err) {
    console.error('verifierBlocageExamen error:', err);
    return null;
  }
}

/**
 * Verifie si l'eleve a termine la derniere sourate d'un ensemble
 * et que cet ensemble n'a pas encore ete valide.
 *
 * Retourne les ensembles 'completes mais non valides' avec info :
 * - ensemble : { id, nom, niveau_id, sourates_ids }
 * - examen : si l'ensemble est dans un examen bloquant non encore reussi (Cas A)
 *            sinon null (Cas B - validation simple par le surveillant)
 *
 * @returns Array de blocages (ou tableau vide si aucun)
 */
export async function verifierBlocageEnsemble(supabase, { eleve_id, ecole_id, niveau_id, niveau_type }) {
  try {
    // Ne s'applique qu'aux niveaux recitant en sourates
    if (niveau_type !== 'sourate') return [];

    // PERF (oct 2026) : parametres du niveau (ensembles, examens, sens) memorises 60 s ;
    // les donnees de l'eleve sont relues a chaque fois, en une seule vague parallele.
    // (Avant : 8 lectures l'une apres l'autre, 2 a 3 s sur telephone.)
    const params = await memoBlocage(supabase, `ens-niv|${ecole_id}|${niveau_id}`, async () => {
      const [rEns, rEx, rNiv] = await Promise.all([
        supabase.from('ensembles_sourates')
          .select('id, nom, niveau_id, sourates_ids, ordre')
          .eq('ecole_id', ecole_id)
          .eq('niveau_id', niveau_id)
          .order('ordre'),
        supabase.from('examens')
          .select('id, nom, contenu_ids, bloquant, niveau_id, score_minimum, type_contenu, actif')
          .eq('ecole_id', ecole_id)
          .eq('niveau_id', niveau_id)
          .eq('actif', true),
        supabase.from('niveaux').select('sens_recitation').eq('id', niveau_id).maybeSingle(),
      ]);
      if (rEns.error) return { ok: false };
      return { ok: !rEx.error && !rNiv.error, ensembles: rEns.data || [], examens: rEx.data || [], sens: rNiv.data?.sens_recitation || 'desc' };
    });
    const ensembles = params && params.ensembles;
    if (!ensembles || ensembles.length === 0) return [];
    const examens = params.examens || [];

    // Donnees de l'eleve (une seule vague)
    const [rRec, rEl, rVal, rRes] = await Promise.all([
      supabase.from('recitations_sourates')
        .select('sourate_id, type_recitation, is_muraja, date_validation')
        .eq('eleve_id', eleve_id)
        .eq('type_recitation', 'complete'),
      supabase.from('eleves').select('*').eq('id', eleve_id).maybeSingle(),
      supabase.from('validations').select('ensemble_id').eq('eleve_id', eleve_id).eq('type_validation', 'ensemble_valide'),
      supabase.from('resultats_examens').select('examen_id, statut').eq('eleve_id', eleve_id),
    ]);
    const eleveDebut = (rEl && rEl.data) || null;
    // FIX (oct 2026) : la muraja (revision) ne valide pas un ensemble ; et seulement ce qui a ete
    // fait depuis le debut du niveau actuel (passage de niveau "repartir")
    const recitationsMemo = depuisDebutNiveau(((rRec && rRec.data) || []).filter(r => !r.is_muraja), eleveDebut);
    const souratesRecitees = new Set(recitationsMemo.map(r => r.sourate_id));

    // Sourates acquises ANTERIEUREMENT (les N premieres dans le sens du niveau)
    const souratesAcquisesAvant = new Set();
    const nbAcquises = eleveDebut?.sourates_acquises || 0;
    if (nbAcquises > 0) {
      try {
        const sourRes = await memoBlocage(supabase, `sour|${params.sens}`, async () => {
          const { data, error } = await supabase.from('sourates').select('id, numero')
            .order('numero', { ascending: params.sens === 'asc' });
          return { ok: !error, data: data || null };
        });
        const souratesData = sourRes && sourRes.data;
        if (souratesData && souratesData.length > 0) {
          for (const sr of souratesData.slice(0, nbAcquises)) { souratesRecitees.add(sr.id); souratesAcquisesAvant.add(sr.id); }
        }
      } catch (e) {
        console.warn('[verifierBlocageEnsemble] echec ajout sourates_acquises:', e);
      }
    }

    const ensemblesValides = new Set(((rVal && rVal.data) || []).map(v => v.ensemble_id));
    const examensReussis = new Set(((rRes && rRes.data) || []).filter(r => r.statut === 'reussi').map(r => r.examen_id));

    // Pour chaque ensemble : toutes ses sourates faites ET non encore valide
    const blocages = [];
    for (const ens of ensembles) {
      if (!ens.sourates_ids || ens.sourates_ids.length === 0) continue;
      if (ensemblesValides.has(ens.id)) continue; // deja valide -> pas de blocage

      // Toutes les sourates recitees ?
      const toutes = ens.sourates_ids.every(sId => souratesRecitees.has(sId));
      if (!toutes) continue;

      // Regle validee par Jamal (26/10) : un ensemble ENTIEREMENT couvert par les acquis d'avant
      // le suivi est considere comme deja valide (pas de blocage, pas d'examen) — meme regle que
      // pour les examens.
      if (ens.sourates_ids.every(sId => souratesAcquisesAvant.has(sId))) continue;

      // Cas A : ensemble lie a un examen bloquant non encore reussi
      const examenLie = examens.find(ex =>
        ex.bloquant
        && (ex.contenu_ids || []).includes(ens.id)
        && !examensReussis.has(ex.id)
      );

      blocages.push({
        ensemble: ens,
        examen: examenLie || null,  // null si Cas B
        cas: examenLie ? 'A' : 'B',
      });
    }

    return blocages;
  } catch (err) {
    console.error('verifierBlocageEnsemble error:', err);
    return [];
  }
}

/**
 * Valide un ensemble pour un eleve (Cas B uniquement).
 * Insere une ligne dans validations avec type='ensemble_valide'.
 * @returns { data, error }
 */
export async function validerEnsemble(supabase, { eleve_id, ecole_id, ensemble_id, valide_par }) {
  // FIX (oct 2026) : idempotent -> un double appui ne cree pas 2 validations (bonus compte 2 fois)
  try {
    const { data: deja } = await supabase.from('validations').select('id')
      .eq('eleve_id', eleve_id).eq('ensemble_id', ensemble_id).eq('type_validation', 'ensemble_valide').limit(1);
    if (deja && deja.length > 0) return { data: deja, error: null, deja: true };
  } catch (e) { /* on tente l'insertion */ }
  const { data, error } = await supabase
    .from('validations')
    .insert({
      eleve_id, ecole_id, valide_par, ensemble_id,
      type_validation: 'ensemble_valide',
      nombre_tomon: 0, // requis non-null par schema
      date_validation: new Date().toISOString(),
    });
  return { data, error };
}

// ── HELPERS NIVEAUX DYNAMIQUES ─────────────────────────────────
// Cache des niveaux chargé une fois depuis Supabase
let _niveauxCache = null;

export async function getNiveauxDynamiques(supabase, ecole_id) {
  if (_niveauxCache) return _niveauxCache;
  const { data } = await supabase
    .from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id', ecole_id).order('ordre');
  _niveauxCache = data || [];
  return _niveauxCache;
}

export function clearNiveauxCache() {
  _niveauxCache = null;
}

// Vérifier si un code_niveau correspond à un niveau sourate (dynamique)
export function isSourateNiveauDyn(code_niveau, niveaux) {
  // Codes historiques toujours considérés sourate
  if (['5B','5A','2M'].includes(code_niveau)) return true;
  if (!niveaux || niveaux.length === 0) return false;
  return niveaux.some(n => n.code === code_niveau && n.type === 'sourate');
}

// Obtenir la couleur d'un niveau dynamiquement
export function getCouleurNiveau(code_niveau, niveaux) {
  if (!niveaux || niveaux.length === 0) {
    const fallback = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'};
    return fallback[code_niveau] || '#888';
  }
  return niveaux.find(n => n.code === code_niveau)?.couleur || '#888';
}

// ══════════════════════════════════════════════════════════════════
// CERTIFICATS — Détection automatique après validation
// ══════════════════════════════════════════════════════════════════

/**
 * Vérifie si l'élève a atteint un jalon et crée le certificat si pas encore existant.
 * Appelé après chaque validation hizb_complet ou recitation sourate complete.
 * Retourne la liste des nouveaux certificats créés (pour afficher une notification).
 */
export async function verifierEtCreerCertificats(supabase, {
  eleve,
  ecole_id,
  valide_par,
  validations,       // validations hizb existantes
  recitations,       // recitations_sourates existantes
}) {
  try {
    // 1. Charger les jalons actifs de l'école
    const { data: jalons } = await supabase
      .from('jalons')
      .select('*')
      .eq('ecole_id', ecole_id)
      .eq('actif', true);

    if (!jalons || jalons.length === 0) return [];

    // 2. Charger les certificats déjà obtenus par cet élève
    const { data: certsExistants } = await supabase
      .from('certificats_eleves')
      .select('jalon_id')
      .eq('eleve_id', eleve.id);

    const jalonsDejaObtenus = new Set((certsExistants || []).map(c => c.jalon_id));

    // 3. Calcul des hizb complétés (depuis validations)
    const hizbsComplets = new Set(
      (validations || [])
        .filter(v => v.type_validation === 'hizb_complet')
        .map(v => v.hizb_valide)
    );
    // Inclure les hizb acquis antérieurs
    // FIX (oct 2026) : avant, toujours Hizb 1..(hizb_depart-1) quel que soit le sens.
    // En sens 'desc' (60 -> 1), un eleve demarrant au Hizb 58 recevait les Hizb 1 a 57
    // -> certificats de hizb attribues a tort. Meme convention que verifierBlocageExamen.
    let sensCert = 'desc';
    let progCert = [];
    try {
      const { data: nvC } = await supabase.from('niveaux').select('id, sens_recitation')
        .eq('ecole_id', ecole_id).eq('code', eleve.code_niveau || '').maybeSingle();
      // Audit final (oct 2026) : programme du niveau pour compter les acquis par BLOCS (comme la fiche)
      if (nvC && nvC.id) {
        try {
          const { data: pg } = await supabase.from('programmes')
            .select('reference_id, ordre, bloc_numero, bloc_nom, bloc_sens, type_contenu')
            .eq('niveau_id', nvC.id).eq('ecole_id', ecole_id).order('ordre');
          progCert = pg || [];
        } catch (e) { progCert = []; }
      }
      if (nvC && nvC.sens_recitation) sensCert = nvC.sens_recitation;
      else {
        const { data: ecC } = await supabase.from('ecoles').select('sens_recitation_defaut').eq('id', ecole_id).maybeSingle();
        if (ecC && ecC.sens_recitation_defaut) sensCert = ecC.sens_recitation_defaut;
      }
    } catch (e) { /* on garde 'desc' */ }
    const hizbDepart = parseInt(eleve.hizb_depart) || 0;
    if (hizbDepart > 0) {
      // Sans programme : meme regle en ligne droite qu'avant (calcHizbsAcquisAvantArrivee)
      for (const h of calcHizbsAcquisAvantArrivee({ ...eleve, hizb_depart: hizbDepart }, progCert, sensCert)) hizbsComplets.add(Number(h));
    }
    if (Array.isArray(eleve.hizbs_acquis)) {
      for (const h of eleve.hizbs_acquis) { const n = Number(h); if (!isNaN(n)) hizbsComplets.add(n); }
    }
    const totalHizbComplets = hizbsComplets.size;

    // 4. Sourates complètes (depuis recitations)
    const souratesCompletes = new Set(
      (recitations || [])
        .filter(r => (r.type_recitation === 'complete' || r.complete === true) && !r.is_muraja) // FIX (oct 2026) : muraja exclue
        .map(r => r.sourate_id)
    );

    const nouveauxCerts = [];

    for (const jalon of jalons) {
      // Déjà obtenu → skip
      if (jalonsDejaObtenus.has(jalon.id)) continue;

      let jalonAtteint = false;

      const conditionObtention = jalon.condition_obtention || 'cumul';

      if (jalon.type_jalon === 'hizb') {
        // ── Étape 1 : vérifier le cumul progressif ──
        const requiredHizb = jalon.hizb_ids || [];
        const cumulOK = requiredHizb.length > 0 && requiredHizb.every(h => hizbsComplets.has(Number(h)));

        if (!cumulOK) {
          jalonAtteint = false; // prérequis pas remplis
        } else if (conditionObtention === 'cumul_puis_examen' && jalon.examen_final_id) {
          // ── Étape 2 : vérifier que l'examen final est réussi ──
          const { data: resultatFinal } = await supabase
            .from('resultats_examens').select('id')
            .eq('eleve_id', eleve.id)
            .eq('examen_id', jalon.examen_final_id)
            .eq('statut', 'reussi').limit(1);
          jalonAtteint = !!(resultatFinal && resultatFinal.length); // FIX (oct 2026) : robuste aux doublons
        } else {
          // condition='cumul' — le cumul suffit
          jalonAtteint = cumulOK;
        }

      } else if (jalon.type_jalon === 'ensemble_sourates' && jalon.ensemble_id) {
        const { data: ensemble } = await supabase
          .from('ensembles_sourates').select('sourates_ids')
          .eq('id', jalon.ensemble_id).maybeSingle();

        if (ensemble && ensemble.sourates_ids && ensemble.sourates_ids.length > 0) {
          // ── Étape 1 : vérifier le cumul progressif ──
          const cumulOK = ensemble.sourates_ids.every(sid => souratesCompletes.has(sid));

          if (!cumulOK) {
            jalonAtteint = false;
          } else if (conditionObtention === 'cumul_puis_examen' && jalon.examen_final_id) {
            // ── Étape 2 : vérifier que l'examen final est réussi ──
            const { data: resultatFinal } = await supabase
              .from('resultats_examens').select('id')
              .eq('eleve_id', eleve.id)
              .eq('examen_id', jalon.examen_final_id)
              .eq('statut', 'reussi').limit(1);
            jalonAtteint = !!(resultatFinal && resultatFinal.length); // FIX (oct 2026) : robuste aux doublons
          } else {
            jalonAtteint = cumulOK;
          }
        }

      } else if (jalon.type_jalon === 'examen' && jalon.examen_id) {
        // Jalon déclenché directement par réussite d'examen (sans cumul requis)
        const { data: resultat } = await supabase
          .from('resultats_examens').select('id')
          .eq('eleve_id', eleve.id)
          .eq('examen_id', jalon.examen_id)
          .eq('statut', 'reussi').limit(1);
        jalonAtteint = !!(resultat && resultat.length); // FIX (oct 2026) : robuste aux doublons
      }

      if (!jalonAtteint) continue;

      // Créer le certificat (structure BDD reelle)
      // Stratégie : titre=nom français, description=nom arabe quand existant
      const payload = {
        eleve_id: eleve.id,
        ecole_id,
        jalon_id: jalon.id,
        titre: jalon.nom,
        description: jalon.nom_ar || null,
        type_certificat: 'jalon',
        date_emission: new Date().toISOString().split('T')[0], // date type, pas timestamptz
        cree_par: valide_par || null,
      };
      const { data: inserted, error } = await supabase.from('certificats_eleves').insert(payload).select().single();
      if (error) {
        console.warn('[verifierEtCreerCertificats] insert:', error.message);
        continue;
      }
      // Pour compatibilite avec le reste du code, on expose nom_certificat dans l'objet retourne
      nouveauxCerts.push({
        ...inserted,
        nom_certificat: inserted.titre,
        nom_certificat_ar: inserted.description,
        jalon,
      });

      // Créditer les points du jalon si barème configuré
      try {
        const bareme = await loadBareme(supabase, ecole_id);
        const ptsJalon = bareme.jalons?.[jalon.id] || 0;
        if (ptsJalon > 0) {
          await supabase.from('points_eleves').insert({
            eleve_id: eleve.id, ecole_id,
            type_event: 'jalon', objet_id: jalon.id,
            points: ptsJalon, date_event: new Date().toISOString(),
            valide_par: valide_par || null,
          });
        }
      } catch(e) { console.error('points jalon error:', e); }
    }

    return nouveauxCerts;
  } catch (err) {
    console.error('verifierEtCreerCertificats error:', err);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════
// CERTIFICATS FIN DE BLOC — Étape D
// ══════════════════════════════════════════════════════════════════
/**
 * Détecte automatiquement si l'élève vient de terminer un bloc pédagogique
 * de son niveau et crée les certificats manquants.
 *
 * Principe :
 *   - Charge le programme du niveau de l'élève (avec ses blocs)
 *   - Si le niveau est en multi-blocs uniquement
 *   - Pour chaque bloc dont tous les Hizb sont maintenant validés
 *     ET qui n'a pas encore de certificat émis
 *     → création automatique d'un certificat
 *
 * La distinction avec les jalons classiques :
 *   - jalon_id = null (ce n'est pas un jalon configuré par l'école)
 *   - metadata marquée type='bloc' (dans le nom pour l'instant, futur : colonne dédiée)
 *
 * @returns Array des certificats nouvellement créés
 */
export async function verifierEtCreerCertificatsBlocs(supabase, {
  eleve,
  ecole_id,
  valide_par,
  validations,
  niveauxList, // optionnel : la liste des niveaux (évite une requête)
}) {
  try {
    // 1. Trouver le niveau de l'élève
    let niveauEleve = (niveauxList || []).find(n => n.code === eleve.code_niveau);
    if (!niveauEleve) {
      const { data: niveauxAll } = await supabase.from('niveaux')
        .select('id, code, sens_recitation')
        .eq('ecole_id', ecole_id);
      niveauEleve = (niveauxAll || []).find(n => n.code === eleve.code_niveau);
    }
    if (!niveauEleve) return [];

    // 2. Charger le programme du niveau
    const { data: progData } = await supabase.from('programmes')
      .select('reference_id, ordre, bloc_numero, bloc_nom, bloc_sens, type_contenu')
      .eq('niveau_id', niveauEleve.id)
      .eq('ecole_id', ecole_id)
      .order('ordre');

    if (!progData || progData.length === 0) return [];

    // 3. Vérifier qu'on est en multi-blocs (sinon pas de certificat de bloc)
    const distinctBlocs = new Set(progData.map(p => p.bloc_numero || 1));
    if (distinctBlocs.size <= 1) return []; // mono-bloc = pas applicable

    // 4. Calculer les Hizb validés (complets + acquis antérieurs)
    const hizbsValides = new Set(
      (validations || [])
        .filter(v => v.type_validation === 'hizb_complet')
        .map(v => v.hizb_valide)
    );
    const sens = niveauEleve.sens_recitation || 'desc';
    const hizbDep = eleve.hizb_depart;
    if (hizbDep && hizbDep > 0) {
      if (sens === 'asc') {
        for (let h = 1; h < hizbDep; h++) hizbsValides.add(h);
      } else {
        for (let h = 60; h > hizbDep; h--) hizbsValides.add(h);
      }
    }

    // 5. Grouper par bloc et identifier ceux qui sont terminés
    const blocsMap = new Map();
    for (const ligne of progData) {
      const n = ligne.bloc_numero || 1;
      if (!blocsMap.has(n)) {
        blocsMap.set(n, {
          numero: n,
          nom: ligne.bloc_nom || null,
          hizbs: [],
        });
      }
      const h = parseInt(ligne.reference_id);
      if (!isNaN(h)) blocsMap.get(n).hizbs.push(h);
    }
    const blocsList = Array.from(blocsMap.values()).sort((a,b) => a.numero - b.numero);

    // 6. Charger les certificats existants pour ce niveau (éviter doublons)
    // Convention : on marque les certificats de bloc avec un nom préfixé
    // 'Bloc N - <niveau>' pour pouvoir les retrouver
    const { data: certsExistants } = await supabase.from('certificats_eleves')
      .select('titre')
      .eq('eleve_id', eleve.id)
      .eq('ecole_id', ecole_id);
    const nomsDejaEmis = new Set((certsExistants || []).map(c => c.titre));

    const nouveauxCerts = [];
    for (const bloc of blocsList) {
      // Bloc terminé si tous ses Hizb sont validés
      const estTermine = bloc.hizbs.length > 0 && bloc.hizbs.every(h => hizbsValides.has(h));
      if (!estTermine) continue;

      // Nom du certificat = convention explicite
      const nomBloc = bloc.nom || `Bloc ${bloc.numero}`;
      const nomCertificat = `${nomBloc} — ${niveauEleve.code}`;
      const nomCertificatAr = bloc.nom
        ? `${bloc.nom} — ${niveauEleve.code}`
        : `البلوك ${bloc.numero} — ${niveauEleve.code}`;

      // Déjà émis ? skip
      if (nomsDejaEmis.has(nomCertificat)) continue;

      // Créer le certificat (structure BDD reelle)
      const payload = {
        eleve_id: eleve.id,
        ecole_id,
        jalon_id: null, // pas un jalon configuré, c'est un certificat de bloc
        titre: nomCertificat,
        description: nomCertificatAr,
        type_certificat: 'bloc',
        date_emission: new Date().toISOString().split('T')[0],
        cree_par: valide_par || null,
      };
      const { data: inserted, error } = await supabase.from('certificats_eleves').insert(payload).select().single();
      if (!error && inserted) {
        nouveauxCerts.push({
          ...inserted,
          nom_certificat: inserted.titre,
          nom_certificat_ar: inserted.description,
          bloc,
        });
        nomsDejaEmis.add(nomCertificat); // éviter double-insertion dans cette même boucle
      } else if (error) {
        console.warn('[verifierEtCreerCertificatsBlocs] insert:', error.message);
      }
    }

    return nouveauxCerts;
  } catch (err) {
    console.error('verifierEtCreerCertificatsBlocs error:', err);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════
// CERTIFICATS POST-EXAMEN — Source D (Etape 8)
// ══════════════════════════════════════════════════════════════════
/**
 * Crée automatiquement un certificat dans certificats_eleves chaque fois
 * qu'un examen est reussi (statut='reussi'), s'il n'existe pas deja.
 *
 * Distinction avec verifierEtCreerCertificats (Sources A/B/C) :
 *   - Source A/B/C : creation conditionnee par un jalon configure dans Gestion
 *   - Source D     : creation AUTOMATIQUE pour TOUS les examens reussis,
 *                    meme sans jalon configure. Garantit que toutes les
 *                    ecoles ont une trace dans Liste Certificats.
 *
 * Anti-doublon :
 *   - Stocke examen_id et resultat_examen_id en metadata (champ dedie)
 *   - Verifie avant insert qu'aucun certificat de meme couple
 *     (eleve_id, examen_id) n'existe deja
 *
 * Format du nom : reprend le nom de l'examen tel qu'il est configure
 * (cohérent avec le PDF actuel).
 *
 * @returns Array des certificats nouvellement crees
 */
export async function verifierEtCreerCertificatsExamens(supabase, {
  eleve,
  ecole_id,
  valide_par,
}) {
  try {
    // 1. Charger tous les examens reussis de l'eleve
    const { data: resultats } = await supabase
      .from('resultats_examens')
      .select('id, examen_id, statut, date_examen, score')
      .eq('eleve_id', eleve.id)
      .eq('ecole_id', ecole_id)
      .eq('statut', 'reussi');
    if (!resultats || resultats.length === 0) return [];

    // 2. Charger les details des examens concernes
    const examenIds = resultats.map(r => r.examen_id);
    const { data: examens } = await supabase
      .from('examens')
      .select('id, nom, score_minimum')
      .in('id', examenIds);
    const examensMap = {};
    for (const ex of (examens || [])) examensMap[ex.id] = ex;

    // 3. Charger les certificats existants pour ces examens (anti-doublon)
    // On utilise jalon_id IS NULL + un marqueur metadata pour distinguer
    // les certificats post-examen automatiques.
    const { data: certsExistants } = await supabase
      .from('certificats_eleves')
      .select('id, examen_id_source')
      .eq('eleve_id', eleve.id)
      .is('jalon_id', null)
      .not('examen_id_source', 'is', null);

    const examensDejaCertifies = new Set(
      (certsExistants || []).map(c => c.examen_id_source).filter(Boolean)
    );
    // Anti-doublon (oct 2026) : un examen deja couvert par une etape (jalon actif de type
    // examen) recoit le certificat de l'etape -> pas de second certificat automatique.
    try {
      const { data: jalonsExamen } = await supabase.from('jalons')
        .select('examen_id').eq('ecole_id', ecole_id).eq('actif', true).eq('type_jalon', 'examen');
      (jalonsExamen || []).forEach(j => { if (j.examen_id) examensDejaCertifies.add(j.examen_id); });
    } catch (e) { /* sans jalons : comportement inchange */ }

    const nouveauxCerts = [];

    // 4. Pour chaque examen reussi sans certificat -> creer
    for (const resultat of resultats) {
      const examen = examensMap[resultat.examen_id];
      if (!examen) continue;
      if (examensDejaCertifies.has(resultat.examen_id)) continue;

      const dateIso = resultat.date_examen
        ? new Date(resultat.date_examen).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const payload = {
        eleve_id: eleve.id,
        ecole_id,
        jalon_id: null, // Pas un jalon configure
        titre: examen.nom,
        description: null, // Table examens n'a pas de nom_ar
        type_certificat: 'examen_auto',
        date_emission: dateIso,
        cree_par: valide_par || null,
        examen_id_source: resultat.examen_id,
        resultat_examen_id_source: resultat.id,
      };
      const { data: inserted, error } = await supabase
        .from('certificats_eleves').insert(payload).select().single();
      if (error) {
        console.warn('[verifierEtCreerCertificatsExamens] insert:', error.message);
        continue;
      }
      // Pour compatibilite avec le code existant qui attend nom_certificat
      nouveauxCerts.push({
        ...inserted,
        nom_certificat: inserted.titre,
        nom_certificat_ar: inserted.description,
        examen,
      });
    }

    return nouveauxCerts;
  } catch (err) {
    console.error('verifierEtCreerCertificatsExamens error:', err);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════
// NOTES PAR PÉRIODE — calcul des points sur une plage de dates
// ══════════════════════════════════════════════════════════════════

/**
 * Calcule les points gagnés par un élève sur une période donnée.
 * N'inclut PAS les acquis antérieurs — uniquement les validations dans la plage.
 */
/**
 * Calcule les points d'un eleve sur une periode donnee.
 *
 * MAJOR-FIX BAREME (sep 2026) : la fonction ne comptait que Tomon/Hizb
 * de la table 'validations' et les points_eleves des examens.
 * Elle IGNORAIT :
 * - Recitations de sourates (table 'recitations_sourates')
 * - Muraja Tomon/Hizb (types 'tomon_muraja' / 'hizb_muraja' dans validations)
 * - Bonus ensembles complets (type 'ensemble_valide' dans validations)
 * - Certificats obtenus (table 'certificats_eleves')
 *
 * Consequence : eleves recitant en sourates (niveaux 5A/5B/2M) affichaient
 * 0 points partout (menu Notes, tableau d'honneur), alors qu'ils recitaient
 * activement. Bug remonte par Jamal + surveillant general fin aout 2026.
 *
 * @param validations : lignes de la table 'validations' pour l'eleve
 * @param dateDebut, dateFin : bornes temporelles inclusives
 * @param bareme : objet du barème (unites, examens, ensembles, jalons)
 * @param pointsEvenements : lignes de 'points_eleves' pour l'eleve
 * @param recitationsSourates : lignes de 'recitations_sourates' (NEW sep 2026)
 * @param certificats : lignes de 'certificats_eleves' (NEW sep 2026)
 */
export function calcPointsPeriode(validations, dateDebut, dateFin, bareme=null, pointsEvenements=[], recitationsSourates=[], certificats=[]) {
  const B = (bareme && bareme.unites) ? bareme.unites : (bareme || BAREME_DEFAUT);
  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);
  fin.setHours(23, 59, 59, 999);

  // ── Filtre commun par periode ──
  const inPeriode = (d) => {
    const dt = new Date(d);
    return dt >= debut && dt <= fin;
  };

  // ── 1. Validations Tomon / Hizb / Muraja / Ensemble ──
  const vPeriode = validations.filter(v => inPeriode(v.date_validation));

  let tomonPeriode = 0;
  let muraTomonPeriode = 0;
  let muraHizbPeriode = 0;
  const hizbsCompletsPeriode = new Set();
  const ensemblesValidesPeriode = []; // ids

  for (const v of vPeriode) {
    if (v.type_validation === 'hizb_complet') {
      hizbsCompletsPeriode.add(v.hizb_valide);
    } else if (v.type_validation === 'tomon_muraja') {
      if (v.nombre_tomon > 0) muraTomonPeriode += v.nombre_tomon;
    } else if (v.type_validation === 'hizb_muraja') {
      muraHizbPeriode += 1;
    } else if (v.type_validation === 'ensemble_valide') {
      if (v.ensemble_id) ensemblesValidesPeriode.push(v.ensemble_id);
    } else if (v.nombre_tomon > 0) {
      // Par defaut : type_validation='tomon' ou absent + nombre_tomon > 0
      tomonPeriode += v.nombre_tomon;
    }
  }

  const ptsTomon = tomonPeriode * (B.tomon || 0);
  const ptsHizb = hizbsCompletsPeriode.size * (B.hizb_complet || 0);
  const ptsMuraTomon = muraTomonPeriode * (B.muraja_tomon || 0);
  const ptsMuraHizb = muraHizbPeriode * (B.muraja_hizb || 0);

  // Bonus ensemble complet : lookup dans bareme.ensembles[ensemble_id]
  const baremeEnsembles = (bareme && bareme.ensembles) || {};
  let ptsBonusEnsembles = 0;
  for (const eid of ensemblesValidesPeriode) {
    ptsBonusEnsembles += (baremeEnsembles[eid] || 0);
  }

  // ── 2. Recitations de sourates (points deja stockes en BDD) ──
  // La colonne 'points' est pre-calculee par calculerPointsSourate au moment
  // de la validation. Il suffit de sommer.
  const recPeriode = (recitationsSourates || []).filter(r => inPeriode(r.date_validation));
  const ptsSourates = recPeriode.reduce((s, r) => s + (Number(r.points) || 0), 0);
  const nbSouratesCompletes = recPeriode.filter(r => r.type_recitation === 'complete' && !r.is_muraja).length;
  const nbSouratesMuraja = recPeriode.filter(r => r.is_muraja).length;

  // ── 3. Certificats obtenus dans la periode ──
  const baremeJalons = (bareme && bareme.jalons) || {};
  const certifPeriode = (certificats || []).filter(c => inPeriode(c.date_obtention || c.created_at));
  let ptsCertificats = 0;
  for (const c of certifPeriode) {
    // Chaque certificat correspond a un jalon (colonne jalon_id)
    ptsCertificats += (baremeJalons[c.jalon_id] || 0);
  }

  // ── 4. Evenements ponctuels historiques (compat retro) ──
  // Certaines ecoles pourraient avoir des points_eleves historiques.
  // On garde pour ne pas casser la retrocompat.
  const evtPeriode = (pointsEvenements || []).filter(e => inPeriode(e.date_event));
  const ptsExamens = evtPeriode.filter(e => e.type_event === 'examen').reduce((s, e) => s + (Number(e.points) || 0), 0);
  // Note : on NE compte PAS ici les type_event='jalon' ou 'ensemble_sourates'
  // pour eviter le double-comptage (deja compte en 3. et via ensemblesValides).
  // Historiquement personne n'enregistrait ces types dans points_eleves donc
  // aucun risque de regression.

  const total = ptsTomon + ptsHizb + ptsMuraTomon + ptsMuraHizb + ptsBonusEnsembles
              + ptsSourates + ptsCertificats + ptsExamens;

  return {
    total,
    // Points par categorie (utile pour affichage detaille)
    ptsTomon, ptsHizb,
    ptsMuraTomon, ptsMuraHizb,
    ptsBonusEnsembles,
    ptsSourates,
    ptsCertificats, ptsExamens,
    // Compat retro : anciens champs conserves
    ptsRoboe: 0, ptsNisf: 0,
    ptsEnsembles: ptsBonusEnsembles, // alias historique
    // Compteurs bruts
    tomonPeriode,
    hizbsPeriode: hizbsCompletsPeriode.size,
    muraTomonPeriode, muraHizbPeriode,
    nbSouratesCompletes, nbSouratesMuraja,
    nbCertificats: certifPeriode.length,
    nbEnsemblesComplets: ensemblesValidesPeriode.length,
    nbValidations: vPeriode.length,
    details: { nbRoboe: 0, nbNisf: 0, nbHizb: hizbsCompletsPeriode.size },
  };
}

/**
 * Enregistre un événement ponctuel de points (examen réussi, certificat, ensemble).
 * Ces points s'ajoutent aux points calculés depuis les validations.
 */
export async function enregistrerPointsEvenement(supabase, { eleve_id, ecole_id, type_event, objet_id, points, valide_par }) {
  if (!points || points <= 0) return;
  try {
    // FIX (oct 2026) : idempotent pour un meme evenement (ex. examen re-enregistre ou
    // double clic) -> les points d'un examen ne sont credites qu'une fois.
    if (objet_id) {
      const { data: deja } = await supabase.from('points_eleves').select('id')
        .eq('eleve_id', eleve_id).eq('type_event', type_event).eq('objet_id', objet_id).limit(1);
      if (deja && deja.length > 0) return;
    }
    await supabase.from('points_eleves').insert({
      eleve_id, ecole_id, type_event, objet_id,
      points, date_event: new Date().toISOString(),
      valide_par: valide_par || null,
    });
  } catch(e) {
    console.error('enregistrerPointsEvenement error:', e);
  }
}

/**
 * Retourne les points pour les périodes prédéfinies (semaine, mois, trimestre).
 */
export function calcPointsToutes(validations) {
  const now = new Date();

  const debutSemaine = new Date(now);
  debutSemaine.setDate(now.getDate() - 7);

  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

  const debutTrimestre = new Date(now);
  debutTrimestre.setMonth(now.getMonth() - 3);
  debutTrimestre.setDate(1);

  return {
    semaine: calcPointsPeriode(validations, debutSemaine, now),
    mois: calcPointsPeriode(validations, debutMois, now),
    trimestre: calcPointsPeriode(validations, debutTrimestre, now),
  };
}

// ═══════════════════════════════════════════════════════════════════
// calcBlocProgression — progression d'un élève par blocs pédagogiques
// ═══════════════════════════════════════════════════════════════════
//
// But : déterminer dans quel bloc l'élève se trouve actuellement et
// combien il a validé dans chaque bloc, en se basant sur :
//   - les Hizb validés (ses validations + ses acquis antérieurs)
//   - la configuration des blocs du niveau (table programmes)
//
// Entrées :
//   - programme : lignes de la table programmes pour ce niveau, avec
//                 leurs colonnes bloc_numero, bloc_nom, bloc_sens et
//                 reference_id (le hizb)
//   - hizbsValides : Set de numéros de Hizb considérés comme "faits"
//                   (complets + acquis antérieurs)
//   - hizbEnCours : numéro du Hizb actuellement en cours (optionnel,
//                   utilisé pour décider du bloc actif si plusieurs
//                   blocs contiennent ce Hizb)
//
// Retour :
//   - null si programme vide ou type sourate
//   - { blocs: [...], blocActuelIdx, blocsTerminesCount, progressionTotale }
//     où chaque bloc = {
//       numero, nom, sens, hizbs (triés), hizbsValides (count),
//       total (count), estTermine, estEnCours, hizbsValidesSet
//     }
//
// Rétrocompatibilité :
//   - Si tous les programmes ont bloc_numero=1, on retourne 1 seul bloc
//     qui englobe tout le programme (comportement effectif identique
//     à avant : pas de découpage)
// ═══════════════════════════════════════════════════════════════════
export function calcBlocProgression(programme, hizbsValidesInput, hizbEnCours = null) {
  if (!programme || programme.length === 0) return null;

  // Cette fonction ne s'applique qu'aux niveaux type 'hizb'
  const firstType = programme[0]?.type_contenu;
  if (firstType && firstType !== 'hizb') return null;

  // hizbsValides peut être un Set ou un tableau
  const hizbsValidesSet = hizbsValidesInput instanceof Set
    ? hizbsValidesInput
    : new Set(hizbsValidesInput || []);

  // Regrouper le programme par bloc_numero
  const blocsMap = new Map();
  for (const ligne of programme) {
    const numBloc = ligne.bloc_numero || 1;
    if (!blocsMap.has(numBloc)) {
      blocsMap.set(numBloc, {
        numero: numBloc,
        nom: ligne.bloc_nom || null,
        sens: ligne.bloc_sens || 'asc',
        hizbs: [],
        ordreMin: ligne.ordre || 9999,
      });
    }
    const hizb = parseInt(ligne.reference_id);
    if (!isNaN(hizb)) {
      blocsMap.get(numBloc).hizbs.push(hizb);
      if ((ligne.ordre || 9999) < blocsMap.get(numBloc).ordreMin) {
        blocsMap.get(numBloc).ordreMin = ligne.ordre || 9999;
      }
    }
  }

  // Trier les blocs par ordre d'apparition (le bloc 1 = premier dans le parcours)
  const blocs = Array.from(blocsMap.values())
    .sort((a, b) => a.numero - b.numero)
    .map(bloc => {
      // Trier les Hizb DANS le bloc selon son sens
      const hizbsTries = [...bloc.hizbs].sort((a, b) =>
        bloc.sens === 'asc' ? a - b : b - a
      );
      // Compter les Hizb validés dans ce bloc
      const hizbsValidesDuBloc = hizbsTries.filter(h => hizbsValidesSet.has(h));
      return {
        numero: bloc.numero,
        nom: bloc.nom,
        sens: bloc.sens,
        hizbs: hizbsTries,
        hizbsValidesSet: new Set(hizbsValidesDuBloc),
        hizbsValidesCount: hizbsValidesDuBloc.length,
        total: hizbsTries.length,
        estTermine: hizbsValidesDuBloc.length === hizbsTries.length && hizbsTries.length > 0,
        estEnCours: false, // calculé ensuite
      };
    });

  // Déterminer le bloc actuel : premier bloc non terminé
  let blocActuelIdx = blocs.findIndex(b => !b.estTermine);
  if (blocActuelIdx === -1) {
    // Tous les blocs sont terminés -> on pointe sur le dernier
    blocActuelIdx = blocs.length - 1;
  }
  if (blocs[blocActuelIdx]) {
    blocs[blocActuelIdx].estEnCours = true;
  }

  // Si un hizbEnCours est fourni et qu'il appartient à un bloc spécifique,
  // on peut préférer ce bloc-là (utile pour cas tordus)
  if (hizbEnCours) {
    const idxFromCurrent = blocs.findIndex(b => b.hizbs.includes(hizbEnCours) && !b.estTermine);
    if (idxFromCurrent !== -1 && idxFromCurrent !== blocActuelIdx) {
      // On fait confiance au hizbEnCours calculé par calcEtatEleve
      blocs[blocActuelIdx].estEnCours = false;
      blocActuelIdx = idxFromCurrent;
      blocs[blocActuelIdx].estEnCours = true;
    }
  }

  const blocsTerminesCount = blocs.filter(b => b.estTermine).length;
  const totalHizb = blocs.reduce((s, b) => s + b.total, 0);
  const totalValides = blocs.reduce((s, b) => s + b.hizbsValidesCount, 0);

  return {
    blocs,
    blocActuelIdx,
    blocActuel: blocs[blocActuelIdx] || null,
    blocsTerminesCount,
    totalBlocs: blocs.length,
    progressionTotale: { valides: totalValides, total: totalHizb },
    // Indique si le programme est en 1 seul bloc (comportement classique)
    estMonoBloc: blocs.length === 1,
  };
}

// ═══════════════════════════════════════════════════════════════════
// prochainHizbDansBloc — donne le prochain Hizb à réciter en tenant
// compte des blocs pédagogiques
// ═══════════════════════════════════════════════════════════════════
//
// Logique :
//   1. On regarde le bloc actuel de l'élève (premier non terminé)
//   2. Dans ce bloc, on trouve le premier Hizb non validé, selon le
//      sens du bloc (asc/desc)
//   3. Si le bloc est terminé, on passe au bloc suivant
//   4. Si tous les blocs sont terminés, on retourne null
//
// Rétrocompatibilité : si monobloc, comportement = ancien
//   (premier Hizb non validé dans le sens du niveau)
//
// Retourne : { hizb: number | null, bloc: blocObj | null }
// ═══════════════════════════════════════════════════════════════════
export function prochainHizbDansBloc(progression) {
  if (!progression || !progression.blocs || progression.blocs.length === 0) {
    return { hizb: null, bloc: null };
  }
  // Chercher dans chaque bloc dans l'ordre, le premier Hizb non validé
  for (const bloc of progression.blocs) {
    if (bloc.estTermine) continue;
    // Hizbs du bloc sont déjà triés selon le sens du bloc
    const prochainHizb = bloc.hizbs.find(h => !bloc.hizbsValidesSet.has(h));
    if (prochainHizb !== undefined) {
      return { hizb: prochainHizb, bloc };
    }
  }
  return { hizb: null, bloc: null };
}

// ══════════════════════════════════════════════════════════════════
// LOGIN PARENT UNIQUE (Option E - Etape 11b corrigée)
// ══════════════════════════════════════════════════════════════════
/**
 * Genere un login parent unique au niveau global de l'app.
 *
 * Strategie (Option E validee avec Jamal) :
 *   1. Essayer le login simple (eleve_id_ecole). Le plus user-friendly.
 *   2. Si pris, suffixer avec un compteur : "-2", "-3", etc.
 *   3. Filet de securite : jusqu'a "-99" puis throw error.
 *
 * NOTE TECHNIQUE :
 *   Le wrapper supabase.js applique un filtre IMMUABLE
 *   .is('deleted_at', null) sur les SELECT des tables soft-delete.
 *   Aucune condition tautologique cote applicatif ne peut l'annuler.
 *   La SEULE solution : utiliser supabaseRaw (client non wrappe) pour
 *   voir TOUS les enregistrements (actifs + soft-deletes).
 *
 *   On accepte ici que ce helper passe par le client brut car c'est
 *   un check d'integrite technique (verification d'unicite contrainte
 *   BDD) et non une lecture metier.
 *
 * @param supabase Client Supabase (NON UTILISE - on utilise supabaseRaw)
 * @param baseLogin Le login souhaite (ex: "54")
 * @param ecoleId  Ecole du parent : si elle a un code_login, il prefixe le login ("TQW-54")
 * @returns {Promise<string>} Le login unique trouve (ex: "TQW-54" ou "TQW-54-2")
 */
// Code court de l'ecole (ex : "TQW") servant de prefixe aux logins parents.
// Memoise par ecole. Colonne absente / non renseignee -> '' (comportement d'avant).
const _codesLoginEcole = new Map();
export async function codeLoginEcole(ecoleId) {
  if (!ecoleId) return '';
  if (_codesLoginEcole.has(ecoleId)) return _codesLoginEcole.get(ecoleId);
  let code = '';
  try {
    const { supabaseRaw } = await import('./supabase');
    const { data, error } = await supabaseRaw.from('ecoles').select('code_login').eq('id', ecoleId).maybeSingle();
    if (!error) code = ((data && data.code_login) || '').toString().trim().toUpperCase();
  } catch (e) { code = ''; }
  _codesLoginEcole.set(ecoleId, code);
  return code;
}

export async function genererLoginParentUnique(supabase, baseLogin, ecoleId) {
  // Import dynamique pour eviter dependance circulaire
  const { supabaseRaw } = await import('./supabase');

  let base = (baseLogin || '').trim();
  if (!base) throw new Error('baseLogin manquant');

  // Securite (oct 2026) : prefixe de l'ecole (ex : "TQW-74A") -> deux ecoles ne
  // peuvent jamais produire le meme login, meme avec les memes numeros d'eleves.
  const code = await codeLoginEcole(ecoleId);
  if (code && !base.toUpperCase().startsWith(code + '-')) base = `${code}-${base}`;

  // PERF (mai 2026) : 1 seule requete au lieu de N sequentielles.
  // Avant : on faisait jusqu'a 99 SELECT en serie (1 par candidat) ->
  //         latence cumulative pouvant atteindre plusieurs secondes
  //         sur connexion lente, ce qui faisait paraitre la creation
  //         d'eleve plus lente que celle d'instituteur.
  // Apres : 1 SELECT 'identifiant IN (...)' qui ramene en bloc tous les
  //         logins deja pris parmi les candidats, puis on trouve le
  //         premier libre en memoire (O(1) lookup avec Set).
  const candidates = [base];
  for (let i = 2; i <= 99; i++) candidates.push(`${base}-${i}`);

  // Utiliser supabaseRaw pour bypass le filtre auto deleted_at
  const { data, error } = await supabaseRaw.from('utilisateurs')
    .select('identifiant')
    .in('identifiant', candidates);

  if (error) {
    console.error('[genererLoginParentUnique] erreur SELECT:', error.message);
    throw new Error('Erreur lecture utilisateurs: ' + error.message);
  }

  const taken = new Set((data || []).map(row => row.identifiant));
  for (const candidate of candidates) {
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error(`Impossible de generer un login unique pour ${base} apres 99 tentatives`);
}

// ══════════════════════════════════════════════════════════════════
// ANNEES SCOLAIRES + PERIODES (Etape 14 - Refonte conceptuelle)
// ══════════════════════════════════════════════════════════════════
/**
 * Charge l'annee scolaire ACTIVE de l'ecole avec ses periodes.
 * Q2=A : 1 seule annee active a la fois (contrainte BDD).
 *
 * Tri des periodes (Etape 14 v2) :
 *   1. Par TYPE (granularite) : trimestre -> semestre -> annee -> libre
 *   2. Puis par date_debut ASC (chronologique dans chaque groupe)
 *
 * Cette logique s'applique automatiquement a toutes les ecoles
 * peu importe leur decoupage (3T, 4T, 2S, mix, etc.)
 *
 * @returns {Promise<{annee: object|null, periodes: Array}>}
 */
export async function loadAnneeActiveAvecPeriodes(supabase, ecole_id) {
  const fallback = { annee: null, periodes: [] };
  if (!ecole_id) return fallback;
  try {
    // 1. Trouver l'annee active
    const { data: annee, error: errA } = await supabase.from('annees_scolaires')
      .select('*')
      .eq('ecole_id', ecole_id)
      .eq('statut', 'active')
      .maybeSingle();
    if (errA) {
      console.warn('[loadAnneeActiveAvecPeriodes] erreur annee:', errA.message);
      return fallback;
    }
    if (!annee) return fallback;

    // 2. Charger ses periodes
    const { data: periodes, error: errP } = await supabase.from('periodes_notes')
      .select('id, nom, nom_ar, date_debut, date_fin, type, actif, annee_scolaire_id')
      .eq('annee_scolaire_id', annee.id)
      .eq('actif', true);
    if (errP) {
      console.warn('[loadAnneeActiveAvecPeriodes] erreur periodes:', errP.message);
      return { annee, periodes: [] };
    }

    // 3. Tri par granularite puis chronologie (Etape 14 v2)
    const ORDRE_TYPE = { trimestre: 1, semestre: 2, annee: 3, libre: 4 };
    const sorted = (periodes || []).slice().sort((a, b) => {
      const typeA = ORDRE_TYPE[a.type || 'libre'] || 5;
      const typeB = ORDRE_TYPE[b.type || 'libre'] || 5;
      if (typeA !== typeB) return typeA - typeB;
      return (a.date_debut || '').localeCompare(b.date_debut || '');
    });
    return { annee, periodes: sorted };
  } catch (e) {
    console.error('[loadAnneeActiveAvecPeriodes] error:', e);
    return fallback;
  }
}

/**
 * Charge les periodes scolaires actives d'une ecole (TOUTES les annees).
 * Utile pour les pages qui ont besoin de toutes les periodes (ex: TableauHonneur).
 *
 * Q4 : Pour les selecteurs des pages d'analyse (Onglet Absences, Assiduite),
 * utiliser plutot loadAnneeActiveAvecPeriodes + filtrer les types !== 'libre'.
 *
 * @returns {Promise<{trimestres: Array, semestres: Array, annees: Array, libres: Array, all: Array}>}
 */
export async function loadPeriodesScolaires(supabase, ecole_id) {
  const fallback = { trimestres: [], semestres: [], annees: [], libres: [], all: [] };
  if (!ecole_id) return fallback;
  try {
    const { data, error } = await supabase.from('periodes_notes')
      .select('id, nom, nom_ar, date_debut, date_fin, type, actif, annee_scolaire_id')
      .eq('ecole_id', ecole_id)
      .eq('actif', true)
      .order('date_debut', { ascending: true });
    if (error) {
      console.warn('[loadPeriodesScolaires]', error.message);
      return fallback;
    }
    const list = data || [];
    return {
      trimestres: list.filter(p => p.type === 'trimestre'),
      semestres:  list.filter(p => p.type === 'semestre'),
      annees:     list.filter(p => p.type === 'annee'),
      libres:     list.filter(p => !p.type || p.type === 'libre'),
      all: list,
    };
  } catch (e) {
    console.error('[loadPeriodesScolaires] error:', e);
    return fallback;
  }
}

/**
 * Format court d'une periode scolaire pour affichage compact :
 * "T1" ou "T1 (sept-nov)" selon le contexte
 */
export function formatPeriodeCourte(periode, lang='fr', withDates=true) {
  if (!periode) return '';
  const nom = lang === 'ar' ? (periode.nom_ar || periode.nom) : (periode.nom || periode.nom_ar);
  if (!withDates || !periode.date_debut || !periode.date_fin) return nom;
  const formatMois = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { month: 'short' });
  };
  return `${nom} (${formatMois(periode.date_debut)}-${formatMois(periode.date_fin)})`;
}

/**
 * Detecte la periode "en cours" parmi un sous-ensemble (typee).
 * Logique :
 *   1. Si une periode du type cible contient today -> celle-la
 *   2. Sinon la prochaine future la plus proche
 *   3. Sinon la plus recente passee
 *
 * @param {Array} periodes - liste des periodes filtrees par type
 * @returns {Object|null} la periode en cours/proche, ou null si aucune
 */
export function detecterPeriodeEnCours(periodes) {
  if (!periodes || periodes.length === 0) return null;
  const today = new Date();
  // 1. Periode contenant today
  const courante = periodes.find(p => {
    const d1 = new Date(p.date_debut);
    const d2 = new Date(p.date_fin);
    return d1 <= today && today <= d2;
  });
  if (courante) return courante;
  // 2. Prochaine future
  const futures = periodes.filter(p => new Date(p.date_debut) > today);
  if (futures.length > 0) {
    return futures.sort((a,b) => new Date(a.date_debut) - new Date(b.date_debut))[0];
  }
  // 3. Plus recente passee
  const passees = periodes.filter(p => new Date(p.date_fin) < today);
  if (passees.length > 0) {
    return passees.sort((a,b) => new Date(b.date_fin) - new Date(a.date_fin))[0];
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// formatContenuExamen — Helper réutilisable B5 (refonte certificat)
// ─────────────────────────────────────────────────────────────────────────────
//
// Retourne un libellé lisible décrivant le contenu d'un examen (Hizb ou Sourates)
// pour affichage sur le certificat ou dans une UI d'édition (B3).
//
// Format adopté (validation Jamal — B5) :
//   • Hizb (1 seul)        → "Hizb 60"           / "الحزب 60"
//   • Hizb (2-3, contigus) → "Hizb 60 → 58"      / "من الحزب 60 إلى الحزب 58"
//   • Hizb (2-3, épars)    → "Hizb 60, 55, 30"   / "الأحزاب: 60، 55، 30"
//   • Hizb (4+, contigus)  → "5 Hizb (60 → 56)"  / "5 أحزاب (من 60 إلى 56)"
//   • Hizb (4+, épars)     → "5 Hizb (60, 55, ...)" / "5 أحزاب"
//   • Ensemble sourates    → "Juz 'Amma (37 sourates)" / "جزء عمّ (37 سورة)"
//
// Fallback : si pas de contenu_ids ou type inconnu, retourne null (caller doit gérer).
//
// Usage :
//   const contenu = await formatContenuExamen(supabase, examen, niveau, lang);
//   if (contenu) afficher(contenu);
//
// Paramètres :
//   - supabase : client Supabase (uniquement utilisé pour le cas 'sourate', pour
//                charger ensembles_sourates.nom). Peut être null si déjà résolu.
//   - examen : { type_contenu, contenu_ids, ecole_id }
//   - niveau : { type } (optionnel, fallback sur examen.type_contenu)
//   - lang : 'fr' ou 'ar'
//
// Retour : string ou null
//
export async function formatContenuExamen(supabase, examen, niveau, lang = 'fr') {
  if (!examen) return null;
  const ids = examen.contenu_ids || [];
  if (!Array.isArray(ids) || ids.length === 0) return null;

  const isAr = lang === 'ar';
  const type = examen.type_contenu || niveau?.type;

  // ── Cas 1 : niveau Hizb ───────────────────────────────────────────────────
  if (type === 'hizb') {
    const nums = ids.map(n => Number(n)).filter(n => !isNaN(n));
    if (nums.length === 0) return null;

    // Détecter contiguïté (sens descendant ou ascendant)
    const sorted = [...nums].sort((a, b) => b - a); // tri desc
    const isContigDesc = sorted.every((n, i) => i === 0 || sorted[i - 1] - n === 1);
    const sortedAsc = [...nums].sort((a, b) => a - b);
    const isContigAsc = sortedAsc.every((n, i) => i === 0 || sortedAsc[i] - sortedAsc[i - 1] === 1);
    const isContig = isContigDesc || isContigAsc;

    // 1 seul Hizb
    if (nums.length === 1) {
      return isAr ? `الحزب ${nums[0]}` : `Hizb ${nums[0]}`;
    }

    // 2-3 Hizb
    if (nums.length <= 3) {
      if (isContig) {
        const seq = isContigDesc ? sorted : sortedAsc;
        return isAr
          ? `من الحزب ${seq[0]} إلى الحزب ${seq[seq.length - 1]}`
          : `Hizb ${seq[0]} → ${seq[seq.length - 1]}`;
      }
      // Épars : liste compacte
      const list = sorted.join(isAr ? '، ' : ', ');
      return isAr ? `الأحزاب: ${list}` : `Hizb ${list}`;
    }

    // 4+ Hizb
    if (isContig) {
      const seq = isContigDesc ? sorted : sortedAsc;
      return isAr
        ? `${nums.length} أحزاب (من ${seq[0]} إلى ${seq[seq.length - 1]})`
        : `${nums.length} Hizb (${seq[0]} → ${seq[seq.length - 1]})`;
    }
    return isAr ? `${nums.length} أحزاب` : `${nums.length} Hizb`;
  }

  // ── Cas 2 : niveau Sourate (ensembles_sourates) ───────────────────────────
  if (type === 'sourate') {
    if (!supabase) return null;
    try {
      const { data: ensembles } = await supabase
        .from('ensembles_sourates')
        .select('id, nom, sourates_ids')
        .in('id', ids);
      if (!ensembles || ensembles.length === 0) return null;

      // Si un seul ensemble : "Nom (X sourates)"
      if (ensembles.length === 1) {
        const e = ensembles[0];
        const nbSourates = Array.isArray(e.sourates_ids) ? e.sourates_ids.length : 0;
        if (nbSourates > 0) {
          return isAr
            ? `${e.nom} (${nbSourates} سورة)`
            : `${e.nom} (${nbSourates} sourates)`;
        }
        return e.nom;
      }

      // Plusieurs ensembles : noms joints + total sourates
      const noms = ensembles.map(e => e.nom).join(isAr ? '، ' : ', ');
      const totalSourates = ensembles.reduce(
        (sum, e) => sum + (Array.isArray(e.sourates_ids) ? e.sourates_ids.length : 0),
        0
      );
      if (totalSourates > 0) {
        return isAr
          ? `${noms} (${totalSourates} سورة)`
          : `${noms} (${totalSourates} sourates)`;
      }
      return noms;
    } catch (err) {
      console.error('formatContenuExamen sourate error:', err);
      return null;
    }
  }

  // Type inconnu
  return null;
}

