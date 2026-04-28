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
      .select('type_action, objet_id, points')
      .eq('ecole_id', ecole_id)
      .eq('actif', true);
    const b = {
      unites: { ...BAREME_DEFAUT },
      examens: {},
      ensembles: {},
      jalons: {},
    };
    (data || []).forEach(row => {
      if (!row.objet_id) {
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
    return { unites: { ...BAREME_DEFAUT }, examens: {}, ensembles: {}, jalons: {} };
  }
}

/**
 * Sauvegarde une entrée du barème (upsert).
 */
export async function saveBaremeItem(supabase, ecole_id, type_action, points, objet_id = null) {
  const row = { ecole_id, type_action, points: parseInt(points) || 0, actif: true };
  if (objet_id) row.objet_id = objet_id;
  await supabase.from('bareme_notes').upsert(row, {
    onConflict: objet_id ? 'ecole_id,type_action,objet_id' : 'ecole_id,type_action,objet_id',
  });
}

export function calcPoints(tomonCumul, hizbsCompletsCount, validations, tomonAcquis=0, hizbAcquisComplets=0, bareme=null) {
  const B = (bareme && bareme.unites) ? bareme.unites : (bareme || BAREME_DEFAUT);
  // tomonCumul = total Tomon (acquis + nouveaux)
  // hizbsCompletsCount = total Hizb complets (acquis + nouveaux)
  const ptsTomon = tomonCumul * B.tomon;
  const nbRoboe = Math.floor(tomonCumul / 2);
  const nbNisf = Math.floor(tomonCumul / 4);
  const ptsRoboe = nbRoboe * Math.round(B.tomon * 2.5);
  const ptsNisf = nbNisf * Math.round(B.tomon * 6);
  const ptsHizb = hizbsCompletsCount * B.hizb_complet;

  // Points acquis antérieurs séparément (pour affichage informatif)
  const ptsAcquisTomon = tomonAcquis * B.tomon;
  const ptsAcquisRoboe = Math.floor(tomonAcquis / 2) * Math.round(B.tomon * 2.5);
  const ptsAcquisNisf = Math.floor(tomonAcquis / 4) * Math.round(B.tomon * 6);
  const ptsAcquisHizb = hizbAcquisComplets * B.hizb_complet;
  const ptsAcquisTotal = ptsAcquisTomon + ptsAcquisRoboe + ptsAcquisNisf + ptsAcquisHizb;

  // Points gagnés depuis le début du suivi
  const tomonNouveaux = tomonCumul - tomonAcquis;
  const hizbNouveaux = hizbsCompletsCount - hizbAcquisComplets;
  const ptsSuiviTomon = tomonNouveaux * B.tomon;
  const ptsSuiviRoboe = (Math.floor(tomonCumul / 2) - Math.floor(tomonAcquis / 2)) * Math.round(B.tomon * 2.5);
  const ptsSuiviNisf = (Math.floor(tomonCumul / 4) - Math.floor(tomonAcquis / 4)) * Math.round(B.tomon * 6);
  const ptsSuiviHizb = hizbNouveaux * B.hizb_complet;

  return {
    total: ptsTomon + ptsRoboe + ptsNisf + ptsHizb,
    ptsTomon,
    ptsRoboe,
    ptsNisf,
    ptsHizb,
    ptsAcquisTotal,    // Points provenant des acquis antérieurs
    ptsDepuisSuivi: ptsSuiviTomon + ptsSuiviRoboe + ptsSuiviNisf + ptsSuiviHizb, // Gagnés depuis le suivi
    tomonAcquis,
    hizbAcquisComplets,
    details: { nbRoboe, nbNisf, nbHizb: hizbsCompletsCount }
  };
}

/**
 * Calcule l'état courant d'un élève (Hizb en cours, progression, points).
 * @param validations : liste des validations (tomon, hizb_complet, muraja...)
 * @param hizbDepart/tomonDepart : acquis avant suivi (0 = aucun)
 * @param sens : 'desc' (défaut) ou 'asc' — sens de progression du niveau
 */
export function calcEtatEleve(validations, hizbDepart, tomonDepart, sens = 'desc') {
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

  // Acquis antérieurs : nombre de tomons mémorisés avant l'arrivée à l'école
  // En desc : de Hizb 60 à Hizb (hizbD+1) complets, + (tomonD-1) dans Hizb hizbD
  // En asc  : de Hizb 1 à Hizb (hizbD-1) complets, + (tomonD-1) dans Hizb hizbD
  const tomonAcquis = sansAcquis ? 0 : (sens === 'asc' ? (hizbD - 1) * 8 + (tomonD - 1) : (60 - hizbD) * 8 + (tomonD - 1));
  const hizbAcquisComplets = sansAcquis ? 0 : (sens === 'asc' ? (hizbD - 1) : (60 - hizbD));
  // Points totaux = acquis antérieurs + nouveaux validés depuis le suivi
  const tomonTotal = tomonAcquis + tomonCumul;
  const hizbCompletsTotal = hizbAcquisComplets + hizbsComplets.size;
  const points = calcPoints(tomonTotal, hizbCompletsTotal, validations, tomonAcquis, hizbAcquisComplets);

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

export function scoreLabel(points) {
  if (points >= 3000) return { label: 'Excellence', color: '#EF9F27', bg: '#FAEEDA' };
  if (points >= 1500) return { label: 'Avancé', color: '#1D9E75', bg: '#E1F5EE' };
  if (points >= 600) return { label: 'Intermédiaire', color: '#378ADD', bg: '#E6F1FB' };
  if (points >= 200) return { label: 'Débutant+', color: '#888', bg: '#f0f0ec' };
  return { label: 'Débutant', color: '#bbb', bg: '#f9f9f6' };
}

// Calcul des badges automatiques
export function calcBadges(validations, etat) {
  const badges = [];
  const tomonCumul = etat.tomonCumul;
  const hizbsComplets = etat.hizbsComplets.size;

  if (tomonCumul >= 1) badges.push({ id: 'premier_tomon', icon: '🌱', label: 'Premier Tomon', desc: 'A récité son tout premier Tomon', color: '#1D9E75', bg: '#E1F5EE' });
  if (hizbsComplets >= 1) badges.push({ id: 'premier_hizb', icon: '📖', label: 'Premier Hizb', desc: 'A complété son premier Hizb', color: '#EF9F27', bg: '#FAEEDA' });
  if (hizbsComplets >= 5) badges.push({ id: 'cinq_hizb', icon: '🔥', label: '5 Hizb', desc: 'A complété 5 Hizb', color: '#E24B4A', bg: '#FCEBEB' });
  if (hizbsComplets >= 10) badges.push({ id: 'dix_hizb', icon: '⭐', label: '10 Hizb', desc: 'Maîtrise de 10 Hizb', color: '#534AB7', bg: '#EEEDFE' });
  if (hizbsComplets >= 30) badges.push({ id: 'moitie_coran', icon: '🌙', label: 'Mi-Coran', desc: 'A atteint la moitié du Coran', color: '#085041', bg: '#E1F5EE' });
  if (hizbsComplets >= 60) badges.push({ id: 'hafiz', icon: '👑', label: 'Hafiz', desc: 'A mémorisé le Coran complet', color: '#EF9F27', bg: '#FAEEDA' });
  if (tomonCumul >= 10) badges.push({ id: 'dix_tomon', icon: '💪', label: '10 Tomon', desc: 'A récité 10 Tomon au total', color: '#378ADD', bg: '#E6F1FB' });
  if (tomonCumul >= 40) badges.push({ id: 'quarante_tomon', icon: '🚀', label: '40 Tomon', desc: 'Mémorisé 5 Hizb en Tomon', color: '#D85A30', bg: '#FAECE7' });

  // Badge vitesse — a récité 6+ Tomon en une semaine
  const semaineDerniere = new Date(); semaineDerniere.setDate(semaineDerniere.getDate()-7);
  const tomonSemaine = validations.filter(v=>v.type_validation==='tomon'&&new Date(v.date_validation)>=semaineDerniere).reduce((s,v)=>s+v.nombre_tomon,0);
  if (tomonSemaine >= 6) badges.push({ id: 'semaine_record', icon: '⚡', label: 'Semaine record', desc: `${tomonSemaine} Tomon en 7 jours`, color: '#EF9F27', bg: '#FAEEDA' });

  // Streak 4 semaines
  const streak = calcStreakWeeks(validations);
  if (streak >= 4) badges.push({ id: 'streak_4', icon: '🔗', label: '4 semaines', desc: '4 semaines consécutives actives', color: '#534AB7', bg: '#EEEDFE' });

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
export async function verifierBlocageExamen(supabase, {
  eleve,
  ecole_id,
  validations,    // validations existantes (hizb)
  recitations,    // recitations_sourates existantes
}) {
  try {
    // Trouver le niveau_id depuis la table niveaux via code_niveau
    const { data: niveauData } = await supabase
      .from('niveaux')
      .select('id, type, code')
      .eq('ecole_id', ecole_id)
      .eq('code', eleve.code_niveau || '')
      .maybeSingle();

    if (!niveauData) return null;
    const niveauId   = niveauData.id;
    const niveauType = niveauData.type; // 'hizb' ou 'sourate'

    // Charger les examens bloquants pour ce niveau
    const { data: examens } = await supabase
      .from('examens')
      .select('id, nom, bloquant, score_minimum, type_contenu, contenu_ids')
      .eq('ecole_id', ecole_id)
      .eq('niveau_id', niveauId)
      .eq('bloquant', true)
      .order('ordre');

    if (!examens || examens.length === 0) return null;

    for (const examen of examens) {
      const ids = examen.contenu_ids || [];
      if (ids.length === 0) continue;

      let examTermine = false;

      if (niveauType === 'hizb') {
        // ── Niveau Hizb ──
        // ids = numéros de Hizb
        // L'examen se déclenche quand tous ces Hizb sont validés (hizb_complet)
        //
        // Note metier : l'application impose deja a l'utilisateur de cliquer
        // "Valider Hizb complet" apres avoir valide les 8 tomons d'un Hizb
        // (le bouton "Valider Tomon" du Hizb suivant n'est dispo qu'apres ce
        // clic explicite). Donc une ligne type='hizb_complet' existe forcement
        // en BDD pour chaque Hizb termine. Pas besoin de detecter via cumul
        // de tomons.
        const hizbComplets = new Set(
          (validations||[])
            .filter(v => v.type_validation === 'hizb_complet')
            .map(v => Number(v.hizb_valide))
        );
        examTermine = ids.every(h => hizbComplets.has(Number(h)));

      } else {
        // ── Niveau Sourate ──
        // ids = UUIDs des ensembles_sourates
        // L'examen se déclenche quand toutes les sourates de ces ensembles sont complètes

        // Charger les sourates des ensembles concernés
        const { data: ensembles } = await supabase
          .from('ensembles_sourates')
          .select('id, sourates_ids')
          .in('id', ids);

        if (!ensembles || ensembles.length === 0) continue;

        // Toutes les sourates de tous ces ensembles
        const toutesLesSourates = ensembles.flatMap(e => e.sourates_ids || []);

        // Sourates complètes de l'élève
        const souratesCompletes = new Set(
          (recitations||[])
            .filter(r => r.type_recitation === 'complete' || r.complete === true)
            .map(r => r.sourate_id)
        );

        examTermine = toutesLesSourates.length > 0 &&
          toutesLesSourates.every(sid => souratesCompletes.has(sid));
      }

      if (!examTermine) continue;

      // Vérifier si l'examen a déjà été réussi
      const { data: resultat } = await supabase
        .from('resultats_examens')
        .select('statut')
        .eq('examen_id', examen.id)
        .eq('eleve_id', eleve.id)
        .eq('statut', 'reussi')
        .maybeSingle();

      if (resultat) continue; // déjà réussi → pas de blocage

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
    const hizbDepart = eleve.hizb_depart || 1;
    for (let h = 1; h < hizbDepart; h++) hizbsComplets.add(h);
    const totalHizbComplets = hizbsComplets.size;

    // 4. Sourates complètes (depuis recitations)
    const souratesCompletes = new Set(
      (recitations || [])
        .filter(r => r.type_recitation === 'complete' || r.complete === true)
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
            .eq('statut', 'reussi').maybeSingle();
          jalonAtteint = !!resultatFinal;
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
              .eq('statut', 'reussi').maybeSingle();
            jalonAtteint = !!resultatFinal;
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
          .eq('statut', 'reussi').maybeSingle();
        jalonAtteint = !!resultat;
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
export function calcPointsPeriode(validations, dateDebut, dateFin, bareme=null, pointsEvenements=[]) {
  const B = (bareme && bareme.unites) ? bareme.unites : (bareme || BAREME_DEFAUT);
  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);
  fin.setHours(23, 59, 59, 999);

  // ── Validations (Tomon / Hizb) ──
  const vPeriode = validations.filter(v => {
    const d = new Date(v.date_validation);
    return d >= debut && d <= fin;
  });

  let tomonPeriode = 0;
  const hizbsCompletsPeriode = new Set();
  for (const v of vPeriode) {
    if (v.type_validation === 'hizb_complet') {
      hizbsCompletsPeriode.add(v.hizb_valide);
    } else if (v.nombre_tomon > 0) {
      tomonPeriode += v.nombre_tomon;
    }
  }

  const ptsTomon = tomonPeriode * B.tomon;
  const nbRoboe = Math.floor(tomonPeriode / 2);
  const nbNisf = Math.floor(tomonPeriode / 4);
  const ptsRoboe = nbRoboe * Math.round(B.tomon * 2.5);
  const ptsNisf = nbNisf * Math.round(B.tomon * 6);
  const ptsHizb = hizbsCompletsPeriode.size * B.hizb_complet;

  // ── Événements ponctuels (examens réussis, certificats, ensembles) ──
  const evtPeriode = (pointsEvenements || []).filter(e => {
    const d = new Date(e.date_event);
    return d >= debut && d <= fin;
  });
  const ptsExamens   = evtPeriode.filter(e=>e.type_event==='examen').reduce((s,e)=>s+e.points,0);
  const ptsCertificats = evtPeriode.filter(e=>e.type_event==='jalon').reduce((s,e)=>s+e.points,0);
  const ptsEnsembles = evtPeriode.filter(e=>e.type_event==='ensemble_sourates').reduce((s,e)=>s+e.points,0);

  const total = ptsTomon + ptsRoboe + ptsNisf + ptsHizb + ptsExamens + ptsCertificats + ptsEnsembles;

  return {
    total,
    ptsTomon, ptsRoboe, ptsNisf, ptsHizb,
    ptsExamens, ptsCertificats, ptsEnsembles,
    tomonPeriode,
    hizbsPeriode: hizbsCompletsPeriode.size,
    nbValidations: vPeriode.length,
    details: { nbRoboe, nbNisf, nbHizb: hizbsCompletsPeriode.size },
  };
}

/**
 * Enregistre un événement ponctuel de points (examen réussi, certificat, ensemble).
 * Ces points s'ajoutent aux points calculés depuis les validations.
 */
export async function enregistrerPointsEvenement(supabase, { eleve_id, ecole_id, type_event, objet_id, points, valide_par }) {
  if (!points || points <= 0) return;
  try {
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
 * @returns {Promise<string>} Le login unique trouve (ex: "54" ou "54-2")
 */
export async function genererLoginParentUnique(supabase, baseLogin) {
  // Import dynamique pour eviter dependance circulaire
  const { supabaseRaw } = await import('./supabase');

  const base = (baseLogin || '').trim();
  if (!base) throw new Error('baseLogin manquant');

  const candidates = [base];
  for (let i = 2; i <= 99; i++) candidates.push(`${base}-${i}`);

  for (const candidate of candidates) {
    // Utiliser supabaseRaw pour bypass le filtre auto deleted_at
    const { data, error } = await supabaseRaw.from('utilisateurs')
      .select('id')
      .eq('identifiant', candidate)
      .limit(1);
    if (error) {
      console.warn('[genererLoginParentUnique] select error:', error.message);
      continue;
    }
    if (!data || data.length === 0) {
      return candidate;
    }
  }

  throw new Error(`Impossible de generer un login unique pour ${base} apres 99 tentatives`);
}

