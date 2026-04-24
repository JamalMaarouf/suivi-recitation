// ══════════════════════════════════════════════════════════════════════
// HELPER EXPORT EXCEL
//
// Charge la lib XLSX (SheetJS) à la demande depuis un CDN pour éviter
// d'alourdir le bundle initial. Fonction utilitaire pour générer un
// fichier .xlsx à partir d'une liste de feuilles (1 par onglet).
//
// Usage :
//   await exportExcel('rapport.xlsx', [
//     { name: 'Stats', rows: [['Header1','Header2'], ['val1','val2']] },
//     { name: 'Détails', rows: [...] },
//   ]);
// ══════════════════════════════════════════════════════════════════════

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

/**
 * Exporte plusieurs feuilles en un seul fichier .xlsx.
 *
 * @param {string} filename - Nom du fichier (doit finir par .xlsx)
 * @param {Array<{name: string, rows: Array<Array>}>} sheets - Feuilles à créer
 *        Chaque feuille doit avoir un `name` (≤ 31 chars) et un tableau 2D `rows`
 *        La première ligne de `rows` est typiquement l'en-tête.
 * @param {Object} options - Options additionnelles
 * @param {Object<string, Array<number>>} [options.columnWidths] - Largeurs en chars
 *        par nom de feuille, ex: { 'Stats': [30, 15, 15] }
 */
export async function exportExcel(filename, sheets, options = {}) {
  if (!sheets || sheets.length === 0) {
    throw new Error('exportExcel: aucune feuille fournie');
  }
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows || []);
    // Largeurs de colonnes si fournies
    const widths = options.columnWidths?.[sheet.name];
    if (widths) {
      ws['!cols'] = widths.map(w => ({ wch: w }));
    } else if (sheet.rows && sheet.rows[0]) {
      // Auto : largeur raisonnable basée sur l'en-tête
      ws['!cols'] = sheet.rows[0].map(h => ({
        wch: Math.max(12, String(h || '').length + 2),
      }));
    }
    // Nom de feuille limité à 31 caractères par la spec XLSX
    const safeName = (sheet.name || 'Sheet').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });
  XLSX.writeFile(wb, filename);
}

/**
 * Exporte un tableau simple (1 feuille) en .xlsx.
 * Raccourci pour les cas les plus fréquents.
 *
 * @param {string} filename
 * @param {Array<Array>} rows - Tableau 2D, 1ère ligne = en-têtes
 * @param {string} [sheetName='Données']
 */
export async function exportExcelSimple(filename, rows, sheetName = 'Données') {
  return exportExcel(filename, [{ name: sheetName, rows }]);
}
