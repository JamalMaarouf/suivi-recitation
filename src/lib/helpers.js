// Position = hizb_depart + tomon_depart + tomon validés
// Tomon 1 du Hizb 1 = position de départ, le premier tomon validé amène à T.2
export function calcPosition(hizbDepart, tomonDepart, totalTomonValides) {
  // On convertit en index absolu 0-based
  const indexDepart = (hizbDepart - 1) * 8 + (tomonDepart - 1);
  // Chaque tomon validé avance d'un cran
  const indexActuel = indexDepart + totalTomonValides;
  const hizb = Math.floor(indexActuel / 8) + 1;
  const tomon = (indexActuel % 8) + 1;
  return { hizb: Math.min(hizb, 60), tomon };
}

// Retourne la position APRÈS avoir validé N tomon depuis la position actuelle
export function positionApres(hizbDepart, tomonDepart, tomonCumulActuel, nombreNouveaux) {
  return calcPosition(hizbDepart, tomonDepart, tomonCumulActuel + nombreNouveaux);
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
  const now = new Date();
  return (now - d) / (1000 * 60 * 60 * 24) > jours;
}

export function joursDepuis(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

export function getInitiales(prenom, nom) {
  return ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase();
}

// Calcule l'état complet d'un élève
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

  // Position actuelle = départ + cumul des tomon validés
  const pos = calcPosition(hizbDepart, tomonDepart, tomonCumul);

  // Tomon validés dans le hizb en cours
  // pos.tomon représente le PROCHAIN tomon à réciter (1-based)
  // donc les tomon déjà faits dans ce hizb = pos.tomon - 1
  const tomonDansHizbActuel = pos.tomon - 1;

  // Tous les 8 tomon du hizb actuel sont-ils faits ?
  // Oui si pos.tomon === 1 ET tomonCumul > 0 (on a débordé sur hizb suivant)
  const hizbEnCours = (pos.tomon === 1 && tomonCumul > 0) ? pos.hizb - 1 : pos.hizb;
  const tous8Faits = pos.tomon === 1 && tomonCumul > 0;
  const tomonAffiche = tous8Faits ? 8 : tomonDansHizbActuel;

  const hizbCompletValide = hizbsComplets.has(hizbEnCours);
  const enAttenteHizbComplet = tous8Faits && !hizbCompletValide;
  const peutEnregistrerTomon = !tous8Faits || hizbCompletValide;

  // Tomon restants dans le hizb actuel
  const tomonRestants = tous8Faits ? 0 : 8 - tomonDansHizbActuel;

  return {
    hizbEnCours,
    tomonActuel: pos.tomon,
    tomonDansHizbActuel: tomonAffiche,
    tomonRestants,
    tous8Faits,
    hizbCompletValide,
    enAttenteHizbComplet,
    peutEnregistrerTomon,
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
