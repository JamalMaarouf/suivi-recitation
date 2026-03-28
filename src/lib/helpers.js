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

export function positionApresValidation(hizbDepart, tomonDepart, totalActuel, nombreNouveau) {
  return calcPosition(hizbDepart, tomonDepart, totalActuel + nombreNouveau);
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
