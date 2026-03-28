export function calcPosition(hizbDepart, tomonDepart, totalTomonValides) {
  const tomonAbsoluDepart = (hizbDepart - 1) * 8 + (tomonDepart - 1);
  const tomonAbsoluActuel = tomonAbsoluDepart + totalTomonValides;
  const hizb = Math.floor(tomonAbsoluActuel / 8) + 1;
  const tomon = (tomonAbsoluActuel % 8) + 1;
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

export function isInactif(dateStr, jours = 14) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  return diff > jours;
}

export function getInitiales(prenom, nom) {
  return ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase();
}

// Calcule l'état complet d'un élève à partir de ses validations
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

  // Tomon validés dans le hizb actuel (pos.tomon - 1 car tomon est 1-based)
  const tomonDansHizbActuel = pos.tomon - 1;

  // Les 8 tomon du hizb actuel sont-ils tous faits ?
  // Si pos.tomon === 1 et tomonCumul > 0, c'est qu'on a débordé sur le hizb suivant
  const hizbEnCours = pos.tomon === 1 && tomonCumul > 0 ? pos.hizb - 1 : pos.hizb;
  const tous8Faits = pos.tomon === 1 && tomonCumul > 0;
  const tomonAffiche = tous8Faits ? 8 : tomonDansHizbActuel;

  // Le hizb en cours est-il validé complet ?
  const hizbCompletValide = hizbsComplets.has(hizbEnCours);

  // Peut-on enregistrer un nouveau tomon ?
  // Oui si : on n'a pas encore fait les 8 tomon OU si le hizb complet est déjà validé
  const peutEnregistrerTomon = !tous8Faits || hizbCompletValide;

  // Doit-on valider le hizb complet ?
  const enAttenteHizbComplet = tous8Faits && !hizbCompletValide;

  return {
    hizbEnCours,
    tomonActuel: pos.tomon,
    tomonDansHizbActuel: tomonAffiche,
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

  return { hizbsCompletsMois, tomonSemaine, recitationsMois };
}
