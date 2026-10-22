import { supabase } from './supabase';

// Suppression definitive d'un eleve (oct 2026) : logique unique partagee PC (Gestion)
// et mobile (ElevesMobile). Supprime les donnees liees (ordre important pour les FK),
// detache les objectifs, puis supprime l'eleve (soft-delete applique par le wrapper).
export const TABLES_LIEES_ELEVE = [
  'exceptions_recitation',
  'exceptions_hizb',
  'recitations_sourates',
  'validations',
  'apprentissages',
  'cotisations',
  'parent_eleve',
  'certificats_eleves',
  'points_eleves',
  'passages_niveaux',
  'resultats_examens',
];

export async function supprimerEleveDefinitivement(id) {
  const erreurs = [];
  for (const table of TABLES_LIEES_ELEVE) {
    try {
      const { error } = await supabase.from(table).delete().eq('eleve_id', id);
      if (error) erreurs.push(`${table}: ${error.message}`);
    } catch (e) {
      console.warn(`[supprimerEleve] ${table} ignorée:`, e.message);
    }
  }
  try { await supabase.from('objectifs_globaux').update({ eleve_id: null }).eq('eleve_id', id); }
  catch (e) { console.warn('[supprimerEleve] objectifs_globaux ignoré:', e); }
  const { error } = await supabase.from('eleves').delete().eq('id', id);
  if (erreurs.length > 0) console.warn('[supprimerEleve] Erreurs liées:', erreurs);
  return { error, erreurs };
}
