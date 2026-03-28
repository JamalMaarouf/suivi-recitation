// calcPosition retourne le PROCHAIN tomon a reciter (usage interne)
// Ex: depart Hizb 1 T.1, 3 valides => prochain = T.4
export function calcPosition(hizbDepart, tomonDepart, totalTomonValides) {
  const indexDepart = (hizbDepart - 1) * 8 + (tomonDepart - 1);
  const indexActuel = indexDepart + totalTomonValides;
  const hizb = Math.floor(indexActuel / 8) + 1;
  const tomon = (indexActuel % 8) + 1;
  return { hizb: Math.min(hizb, 60), tomon };
}

// calcPositionAtteinte retourne le DERNIER tomon recite (pour affichage)
// Ex: depart Hizb 1 T.1, 3 valides => atteint = T.3 (pas T.4)
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
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateCourt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function isInactif(dateStr, jours = 14) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  return (new Date() - d) / (1000 * 60 * 60 * 24) > jours;
}

export function joursDepuis(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

export function getInitiales(prenom, nom) {
  return ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase();
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

  const hizbEnCours = (pos.tomon === 1 && tomonCumul > 0) ? pos.hizb - 1 : pos.hizb;
  const tous8Faits = pos.tomon === 1 && tomonCumul > 0;
  const tomonDansHizbActuel = tous8Faits ? 8 : pos.tomon - 1;
  const prochainTomon = tous8Faits ? null : pos.tomon;

  const hizbCompletValide = hizbsComplets.has(hizbEnCours);
  const enAttenteHizbComplet = tous8Faits && !hizbCompletValide;

  return {
    hizbEnCours,
    prochainTomon,
    tomonDansHizbActuel,
    tomonRestants: tous8Faits ? 0 : 8 - tomonDansHizbActuel,
    tous8Faits,
    hizbCompletValide,
    enAttenteHizbComplet,
    hizbsComplets,
    tomonCumul,
    positionReelle: pos
  };
}

export function calcStats(validations) {
  const maintenant = new Date();
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const debutSemaine = new Date(maintenant);
  debutSemaine.setDate(maintenant.getDate() - 7);

  const hizbsCompletsMois = validations.filter(v =>
    v.type_validation === 'hizb_complet' && new Date(v.date_validation) >= debutMois
  ).length;

  const tomonSemaine = validations.filter(v =>
    v.type_validation === 'tomon' && new Date(v.date_validation) >= debutSemaine
  ).reduce((s, v) => s + v.nombre_tomon, 0);

  const recitationsMois = validations.filter(v =>
    new Date(v.date_validation) >= debutMois
  ).length;

  const recitationsSemaine = validations.filter(v =>
    new Date(v.date_validation) >= debutSemaine
  ).length;

  return { hizbsCompletsMois, tomonSemaine, recitationsMois, recitationsSemaine };
}
