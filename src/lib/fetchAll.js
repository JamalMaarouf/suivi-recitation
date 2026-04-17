// Helper de pagination automatique pour Supabase
// Remplace les .limit(5000) par un fetch paginé qui récupère TOUTES les lignes
// quelle que soit leur quantité, en pages de 1000 par défaut.
//
// Usage standard :
//   const vals = await fetchAll(
//     supabase.from('validations').select('*').eq('ecole_id', ecoleId).order('date_validation', { ascending: false })
//   );
//
// La fonction retourne directement un array (pas { data, error }).
// En cas d'erreur réseau sur une page, elle retourne ce qu'elle a pu récupérer
// + log le problème (pas d'exception pour ne pas casser l'UI).

const DEFAULT_PAGE_SIZE = 1000;
// Hard cap pour éviter une boucle infinie si Supabase renvoie 1000 en permanence
// à cause d'un bug/filtre cassé. 50 × 1000 = 50 000 lignes max par appel.
const MAX_PAGES = 50;

/**
 * Exécute une query Supabase et paginate automatiquement.
 * @param {Object} queryBuilder - Le QueryBuilder Supabase (sans .limit() ni .range() appliqué)
 * @param {Object} options
 * @param {number} options.pageSize - Taille de page (défaut 1000)
 * @param {number} options.maxRows - Limite max totale à charger (sécurité)
 * @returns {Promise<Array>} Toutes les lignes trouvées
 */
export async function fetchAll(queryBuilder, options = {}) {
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const maxRows = options.maxRows || (MAX_PAGES * pageSize);

  const all = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await queryBuilder.range(offset, offset + pageSize - 1);

    if (error) {
      console.warn('[fetchAll] error at page', page, error.message);
      // On retourne ce qu'on a eu, sans casser l'UI
      return all;
    }

    if (!data || data.length === 0) break;
    all.push(...data);

    // Si moins que pageSize retourné, c'est la dernière page
    if (data.length < pageSize) break;

    offset += pageSize;

    // Garde-fou : si on atteint la limite absolue, on s'arrête et on log
    if (all.length >= maxRows) {
      console.warn(`[fetchAll] Max rows reached (${maxRows}), stopping pagination`);
      break;
    }
  }

  return all;
}

/**
 * Version wrap-safe : même signature que les anciennes requêtes,
 * retourne { data, error } pour compatibilité avec le code existant qui
 * destructure le retour Supabase.
 *
 * Usage :
 *   const { data: vals } = await fetchAllWrap(
 *     supabase.from('validations').select('*').eq('ecole_id', id)
 *   );
 */
export async function fetchAllWrap(queryBuilder, options = {}) {
  try {
    const data = await fetchAll(queryBuilder, options);
    return { data, error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}
