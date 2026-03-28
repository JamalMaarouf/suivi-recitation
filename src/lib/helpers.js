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
export function calcPoints(tomonCumul, hizbsCompletsCount, validations) {
  const ptsTomon = tomonCumul * 10;
  const nbRoboe = Math.floor(tomonCumul / 2);
  const nbNisf = Math.floor(tomonCumul / 4);
  const ptsRoboe = nbRoboe * 25;
  const ptsNisf = nbNisf * 60;
  const ptsHizb = hizbsCompletsCount * 100;
  return {
    total: ptsTomon + ptsRoboe + ptsNisf + ptsHizb,
    ptsTomon,
    ptsRoboe,
    ptsNisf,
    ptsHizb,
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
    } else {
      tomonCumul += v.nombre_tomon;
    }
  }

  const pos = calcPosition(hizbDepart, tomonDepart, tomonCumul);
  const hizbBrut = (pos.tomon === 1 && tomonCumul > 0) ? pos.hizb - 1 : pos.hizb;
  const tous8Faits = pos.tomon === 1 && tomonCumul > 0;
  const hizbCompletValide = hizbsComplets.has(hizbBrut);

  const points = calcPoints(tomonCumul, hizbsComplets.size, validations);

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
