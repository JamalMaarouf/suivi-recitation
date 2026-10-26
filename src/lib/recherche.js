// Recherche tolerante (oct 2026) — une seule regle pour toute l'application.
// Avant : chaque ecran comparait le texte brut -> « 74a » ne trouvait pas « 74A »,
// « احمد » ne trouvait pas « أحمد », un espace en trop ou un ordre different
// (« Alami Youssef ») ne trouvait rien.
//
// normaliserRecherche : minuscules, sans accents latins, sans harakat ni tatweel,
// أ/إ/آ/ٱ -> ا, ى/ئ -> ي, ؤ -> و, ة -> ه, chiffres arabes-indiens -> 0-9, espaces reduits.
export function normaliserRecherche(texte) {
  if (texte === null || texte === undefined) return '';
  return String(texte)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\s+/g, ' ')
    .trim();
}

// Vrai si chaque mot de la recherche se trouve dans l'un des champs (ordre libre).
// Recherche vide -> vrai.
export function correspondRecherche(recherche, ...champs) {
  const q = normaliserRecherche(recherche);
  if (!q) return true;
  const texte = normaliserRecherche(champs.filter(v => v !== null && v !== undefined && v !== '').join(' '));
  return q.split(' ').every(mot => texte.includes(mot));
}
