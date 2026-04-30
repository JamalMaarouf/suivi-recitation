// ═══════════════════════════════════════════════════════════════════════════
// PageHeader — Phase C / Étape 15 + B8
// ═══════════════════════════════════════════════════════════════════════════
//
// Composant réutilisable pour le header de TOUTES les pages desktop.
// But : harmoniser visuellement les ~44 pages du projet, supprimer la
// duplication de code header inline, et faciliter les futures évolutions.
//
// IMPORTANT — Mode desktop uniquement (Phase C).
// Le mobile garde son header gradient existant : il sera harmonisé dans
// une Phase E dédiée (mobile-only) après la Phase C.
//
// Usage minimal :
//   <PageHeader title="Liste des certificats" icon="🏅" onBack={goBack} />
//
// Usage complet :
//   <PageHeader
//     title="Liste des certificats"
//     titleAr="قائمة الشهادات"
//     icon="🏅"
//     subtitle="42 certificat(s)"
//     onBack={goBack}
//     actions={<ExportButtons .../>}
//     lang={lang}
//   />
//
// Props :
//   - title       : string (FR par défaut)                            requis
//   - titleAr     : string (utilisé si lang === 'ar', fallback = title)  optionnel
//   - icon        : string (emoji ou caractère)                       optionnel
//   - titleSuffix : ReactNode (badge, chip, etc. à côté du titre)     optionnel
//   - subtitle    : string (compteur, contexte, etc.)                 optionnel
//   - onBack      : () => void  (navigation retour)                   optionnel
//   - actions     : ReactNode (boutons, badges, etc. à droite)        optionnel
//   - lang        : 'fr' | 'ar' | 'en' (default 'fr')                 optionnel
//
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import { t } from '../lib/i18n';

export default function PageHeader({
  title,
  titleAr,
  icon,
  titleSuffix,
  subtitle,
  onBack,
  actions,
  lang = 'fr',
}) {
  // Choix du titre selon la langue (fallback FR)
  const displayTitle = (lang === 'ar' && titleAr) ? titleAr : title;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: '1.25rem',
    }}>
      {/* Bouton Retour — uniquement si onBack fourni */}
      {onBack && (
        <button
          onClick={onBack}
          className="back-link"
          aria-label={t(lang, 'retour')}
          style={{ marginBottom: 0, flexShrink: 0 }}
        >
          {t(lang, 'retour')}
        </button>
      )}

      {/* Bloc titre + sous-titre — flex:1 pour pousser les actions à droite */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          lineHeight: 1.2,
        }}>
          {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
          <span>{displayTitle}</span>
          {titleSuffix}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 12,
            color: '#888',
            marginTop: 2,
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Actions à droite (boutons d'export, etc.) */}
      {actions && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          {actions}
        </div>
      )}
    </div>
  );
}
