import React from 'react';

// ══════════════════════════════════════════════════════════════════════
// COMPOSANT <ExportButtons>
//
// Boutons d'export unifiés pour toute l'application.
// Gère PDF (rouge), Excel (vert), CSV (bleu) — ou n'importe quelle
// combinaison des trois.
//
// USAGE
// -----
// import ExportButtons from '../components/ExportButtons';
//
// <ExportButtons
//   onPDF={async () => await exportMyPDF()}
//   onExcel={async () => await exportMyExcel()}
//   onCSV={async () => await exportMyCSV()}  // optionnel
//   isMobile={isMobile}
//   lang={lang}
//   count={42}          // optionnel : affiche "42 élève(s) exporté(s)"
//   countLabel="élève"  // optionnel : singulier (le pluriel sera ajouté)
//   variant="default"   // 'default' (pleine largeur) | 'inline' (header)
//   disabled={loading}  // désactive tous les boutons
// />
//
// CONVENTIONS VISUELLES
// ---------------------
// - PDF   : fond rouge #E24B4A (alerte/impression officielle)
// - Excel : fond vert  #1D9E75 (données chiffrées, positif)
// - CSV   : fond bleu  #378ADD (format léger, interopérable)
//
// Les 3 boutons utilisent :
// - Texte blanc, font-weight 700
// - Border-radius 10
// - Mêmes paddings adaptatifs (mobile vs desktop)
// - Icônes stables : 📄 (PDF), 📊 (Excel), 📥 (CSV)
// ══════════════════════════════════════════════════════════════════════

const COLORS = {
  pdf:   { bg: '#E24B4A', bgHover: '#C63D3C' },
  excel: { bg: '#1D9E75', bgHover: '#158561' },
  csv:   { bg: '#378ADD', bgHover: '#2870BE' },
};

// Labels volontairement courts et universels : 'PDF', 'Excel', 'CSV'
// (demande UX de Jamal : simplifier pour le profil surveillant qui n'a
// pas besoin de phrases comme 'Exporter PDF' / 'تصدير PDF').
const LABELS = {
  fr: { pdf: 'PDF', excel: 'Excel', csv: 'CSV' },
  ar: { pdf: 'PDF', excel: 'Excel', csv: 'CSV' },
  en: { pdf: 'PDF', excel: 'Excel', csv: 'CSV' },
};

const COUNT_LABELS = {
  fr: { exported: 'exporté', plural: 's' },
  ar: { exported: 'مصدر',    plural: ''  },
  en: { exported: 'exported', plural: '' },
};

export default function ExportButtons({
  onPDF,
  onExcel,
  onCSV,
  isMobile = false,
  lang = 'fr',
  count = null,
  countLabel = null,
  variant = 'default',
  disabled = false,
  compact = false,  // 'compact' = labels courts (juste "PDF", "Excel", "CSV")
}) {
  const dict = LABELS[lang] || LABELS.fr;
  const labels = dict;  // plus de dict 'court' : tous les labels sont courts partout
  const countDict = COUNT_LABELS[lang] || COUNT_LABELS.fr;

  // Style commun base
  const baseButton = {
    padding: variant === 'inline' ? '7px 12px' : (isMobile ? '9px 14px' : '9px 16px'),
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: variant === 'inline' ? 12 : 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    opacity: disabled ? 0.6 : 1,
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  };

  const makeBtn = (type, icon, label, onClick) => {
    const c = COLORS[type];
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{ ...baseButton, background: c.bg }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = c.bgHover; }}
        onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = c.bg; }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </button>
    );
  };

  // Compteur de lignes exportées (optionnel)
  const countNode = (count !== null && count !== undefined && countLabel) ? (
    <div style={{
      alignSelf: 'center',
      fontSize: 11,
      color: '#888',
      fontStyle: 'italic',
      marginLeft: 4,
    }}>
      {count} {countLabel}{count > 1 ? countDict.plural : ''} {countDict.exported}{count > 1 ? countDict.plural : ''}
    </div>
  ) : null;

  // Variant 'inline' : plus compact, pour intégration dans un header
  const wrapperStyle = variant === 'inline'
    ? { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }
    : { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 };

  return (
    <div style={wrapperStyle}>
      {onPDF   && makeBtn('pdf',   '📄', labels.pdf,   onPDF)}
      {onExcel && makeBtn('excel', '📊', labels.excel, onExcel)}
      {onCSV   && makeBtn('csv',   '📥', labels.csv,   onCSV)}
      {countNode}
    </div>
  );
}
