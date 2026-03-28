// Position actuelle = départ + tomon validés
// Ex: départ Hizb 1 T.1, 0 validés → position Hizb 1 T.1 (premier tomon à réciter)
// Ex: départ Hizb 1 T.1, 1 validé → position Hizb 1 T.2 (deuxième tomon à réciter)
export function calcPosition(hizbDepart, tomonDepart, totalTomonValides) {
  const indexDepart = (hizbDepart - 1) * 8 + (tomonDepart - 1);
  const indexActuel = indexDepart + totalTomonValides;
  const hizb = Math.floor(indexActuel / 8) + 1;
  const tomon = (indexActuel % 8) + 1;
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

  // Position = prochain tomon à réciter
  const pos = calcPosition(hizbDepart, tomonDepart, tomonCumul);

  // Hizb en cours et tomon déjà validés dans ce hizb
  // pos.tomon = prochain tomon à réciter (1-based)
  // donc tomon déjà faits dans ce hizb = pos.tomon - 1
  const hizbEnCours = (pos.tomon === 1 && tomonCumul > 0) ? pos.hizb - 1 : pos.hizb;
  const tous8Faits = pos.tomon === 1 && tomonCumul > 0;

  // Tomon déjà validés dans le hizb en cours (0 à 8)
  const tomonDansHizbActuel = tous8Faits ? 8 : pos.tomon - 1;

  // Prochain tomon à réciter dans le hizb en cours (1 à 8)
  const prochainTomon = tous8Faits ? null : pos.tomon;

  const hizbCompletValide = hizbsComplets.has(hizbEnCours);
  const enAttenteHizbComplet = tous8Faits && !hizbCompletValide;

  return {
    hizbEnCours,
    prochainTomon,        // numéro du prochain tomon à réciter (1-8), null si tous faits
    tomonDansHizbActuel,  // combien de tomon déjà validés dans ce hizb (0-8)
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
