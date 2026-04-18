import React from 'react';

/**
 * Bouton retour uniforme pour toute l'app (PC + mobile).
 *
 * Usage:
 *   <BackButton onClick={() => goBack()} lang={lang} />
 *
 * Props:
 * - onClick: fonction à exécuter au clic
 * - lang: 'fr' | 'ar' | 'en' (pour le texte "Retour" et le sens de la flèche)
 * - variant: 'light' (fond clair, texte foncé) par défaut - utilisé sur PC et sur
 *            pages sans header coloré
 *            'onDark' (fond semi-transparent, texte blanc) - utilisé dans les
 *            headers colorés mobile
 * - iconOnly: true pour afficher uniquement la flèche (compact, mobile header)
 * - style: overrides optionnels
 */
export default function BackButton({ onClick, lang = 'fr', variant = 'light', iconOnly = false, style = {} }) {
  const isRtl = lang === 'ar';
  const arrow = isRtl ? '→' : '←';
  const label = lang === 'ar' ? 'رجوع' : (lang === 'en' ? 'Back' : 'Retour');

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: iconOnly ? 0 : 8,
    cursor: 'pointer',
    border: 'none',
    fontFamily: "'Tajawal', Arial, sans-serif",
    fontWeight: 600,
    flexShrink: 0,
    transition: 'all 0.15s',
    flexDirection: isRtl ? 'row-reverse' : 'row',
  };

  let variantStyle;
  if (variant === 'onDark') {
    // Pour headers colorés (mobile surtout) — toujours lisible sur fond vert/bleu/violet/etc.
    variantStyle = iconOnly ? {
      background: 'rgba(255,255,255,0.22)',
      color: '#fff',
      fontSize: 20,
      width: 38,
      height: 38,
      borderRadius: 10,
      padding: 0,
      border: '1px solid rgba(255,255,255,0.25)',
    } : {
      background: 'rgba(255,255,255,0.22)',
      color: '#fff',
      fontSize: 13,
      padding: '8px 14px',
      borderRadius: 20,
      border: '1px solid rgba(255,255,255,0.25)',
    };
  } else {
    // light : fond clair, toujours lisible sur fond blanc/beige
    variantStyle = iconOnly ? {
      background: '#f5f5f0',
      color: '#374151',
      fontSize: 18,
      width: 38,
      height: 38,
      borderRadius: 10,
      padding: 0,
      border: '1px solid #e0e0d8',
    } : {
      background: '#f5f5f0',
      color: '#374151',
      fontSize: 13,
      padding: '8px 14px',
      borderRadius: 20,
      border: '1px solid #e0e0d8',
    };
  }

  return (
    <button
      onClick={onClick}
      style={{ ...baseStyle, ...variantStyle, ...style }}
      aria-label={label}
    >
      <span style={{ fontSize: iconOnly ? 20 : 15, lineHeight: 1 }}>{arrow}</span>
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
