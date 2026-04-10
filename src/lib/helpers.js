export function calcPosition(hizbDepart, tomonDepart, totalTomonValides) {
  const indexDepart = (hizbDepart - 1) * 8 + (tomonDepart - 1);
  const indexActuel = indexDepart + totalTomonValides;
  const hizb = Math.floor(indexActuel / 8) + 1;
  const tomon = (indexActuel % 8) + 1;
  return { hizb: Math.min(hizb, 60), tomon };
}

export function calcPositionAtteinte(hizbDepart, tomonDepart, totalTomonValides) {
  if (totalTomonValides === 0) return null;
  const indexDepart = (hizbDepart - 1) * 8 + (tomonDepart - 1);
  const indexAtteint = indexDepart + totalTomonValides - 1;
  const hizb = Math.floor(indexAtteint / 8) + 1;
  const tomon = (indexAtteint % 8) + 1;
  return { hizb: Math.min(hizb, 60), tomon };
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
export function calcPoints(tomonCumul, hizbsCompletsCount, validations, tomonAcquis=0, hizbAcquisComplets=0) {
  // tomonCumul = total Tomon (acquis + nouveaux)
  // hizbsCompletsCount = total Hizb complets (acquis + nouveaux)
  const ptsTomon = tomonCumul * 10;
  const nbRoboe = Math.floor(tomonCumul / 2);
  const nbNisf = Math.floor(tomonCumul / 4);
  const ptsRoboe = nbRoboe * 25;
  const ptsNisf = nbNisf * 60;
  const ptsHizb = hizbsCompletsCount * 100;

  // Points acquis antérieurs séparément (pour affichage informatif)
  const ptsAcquisTomon = tomonAcquis * 10;
  const ptsAcquisRoboe = Math.floor(tomonAcquis / 2) * 25;
  const ptsAcquisNisf = Math.floor(tomonAcquis / 4) * 60;
  const ptsAcquisHizb = hizbAcquisComplets * 100;
  const ptsAcquisTotal = ptsAcquisTomon + ptsAcquisRoboe + ptsAcquisNisf + ptsAcquisHizb;

  // Points gagnés depuis le début du suivi
  const tomonNouveaux = tomonCumul - tomonAcquis;
  const hizbNouveaux = hizbsCompletsCount - hizbAcquisComplets;
  const ptsSuiviTomon = tomonNouveaux * 10;
  const ptsSuiviRoboe = (Math.floor(tomonCumul / 2) - Math.floor(tomonAcquis / 2)) * 25;
  const ptsSuiviNisf = (Math.floor(tomonCumul / 4) - Math.floor(tomonAcquis / 4)) * 60;
  const ptsSuiviHizb = hizbNouveaux * 100;

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

export function calcEtatEleve(validations, hizbDepart, tomonDepart) {
  const valsChron = [...validations].sort((a, b) => new Date(a.date_validation) - new Date(b.date_validation));
  let tomonCumul = 0;
  const hizbsComplets = new Set();

  for (const v of valsChron) {
    if (v.type_validation === 'hizb_complet') {
      hizbsComplets.add(v.hizb_valide);
    } else if (v.nombre_tomon > 0) {
      tomonCumul += v.nombre_tomon;
    }
  }

  const pos = calcPosition(hizbDepart, tomonDepart, tomonCumul);
  const hizbBrut = (pos.tomon === 1 && tomonCumul > 0) ? pos.hizb - 1 : pos.hizb;
  const tous8Faits = pos.tomon === 1 && tomonCumul > 0;
  const hizbCompletValide = hizbsComplets.has(hizbBrut);

  // Acquis antérieurs : Tomon et Hizb complets déjà validés avant le début du suivi
  // hizb_depart=15, tomon_depart=3 → 14 Hizb complets + 2 Tomon déjà acquis
  const tomonAcquis = (hizbDepart - 1) * 8 + (tomonDepart - 1);
  const hizbAcquisComplets = hizbDepart - 1; // Hizb 1 à (hizbDepart-1) = complets
  // Points totaux = acquis antérieurs + nouveaux validés depuis le suivi
  const tomonTotal = tomonAcquis + tomonCumul;
  const hizbCompletsTotal = hizbAcquisComplets + hizbsComplets.size;
  const points = calcPoints(tomonTotal, hizbCompletsTotal, validations, tomonAcquis, hizbAcquisComplets);

  if (tous8Faits && hizbCompletValide) {
    return {
      hizbEnCours: hizbBrut + 1,
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
      positionReelle: pos
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
    positionReelle: pos
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
