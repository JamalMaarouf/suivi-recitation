// ═══════════════════════════════════════════════════════════════════════════
// StatsCard — Phase C-final / C4
// ═══════════════════════════════════════════════════════════════════════════
//
// Composant réutilisable pour les cartes statistiques de l'application.
// But : harmoniser visuellement les ~50+ cartes inline éparpillées dans
// l'app, et fournir une distinction claire entre cartes statiques (info)
// et cartes cliquables (filtre / drill-down).
//
// CHARTE FIXÉE (validée Jamal — 30 avril 2026) :
// - Style "plein" : fond coloré pâle + chiffre coloré (ADN visuel actuel)
// - Palette : 5 couleurs officielles (voir COLOR_PRESETS ci-dessous)
// - Cliquable signalé par cursor pointer + hover bordure (discret)
// - Carte active (filtre courant) : bordure pleine 2px de la couleur
//
// Usage minimal — carte statique :
//   <StatsCard label="Tomon récités" value={42} color="green" />
//
// Usage cliquable — carte filtre :
//   <StatsCard
//     label="À traiter"
//     value={12}
//     color="amber"
//     icon="⚠️"
//     onClick={() => setFiltre('a_traiter')}
//     active={filtre === 'a_traiter'}
//   />
//
// Usage avec couleur custom (si vraiment besoin hors palette) :
//   <StatsCard label="..." value={99} color="#9C27B0" bg="#F3E5F5" />
//
// Props :
//   - label    : string          Libellé sous la valeur                 requis
//   - value    : string|number   Valeur principale (chiffre, %, etc.)   requis
//   - color    : string          Couleur sémantique (preset) ou hex     défaut 'gray'
//                Presets : 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray'
//   - bg       : string          Fond custom (override preset)          optionnel
//   - icon     : string          Emoji optionnel au-dessus du chiffre   optionnel
//   - onClick  : () => void      Si fourni : carte devient cliquable    optionnel
//   - active   : boolean         Si true et onClick : bordure colorée   optionnel
//   - subtitle : string          Texte additionnel sous le label        optionnel
//
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';

// ─── Palette officielle (charte Jamal) ─────────────────────────────────────
const COLOR_PRESETS = {
  green:  { color: '#1D9E75', bg: '#E1F5EE' }, // succès, métier principal
  blue:   { color: '#378ADD', bg: '#E6F1FB' }, // info, neutre
  amber:  { color: '#EF9F27', bg: '#FAEEDA' }, // attention, à traiter
  red:    { color: '#E24B4A', bg: '#FCEBEB' }, // erreur, échec
  purple: { color: '#534AB7', bg: '#EEEDFE' }, // examens, secondaire
  gray:   { color: '#666666', bg: '#f5f5f0' }, // neutre par défaut
};

export default function StatsCard({
  label,
  value,
  color = 'gray',
  bg,
  icon,
  onClick,
  active = false,
  subtitle,
}) {
  // Résolution couleur : preset ou hex direct
  const preset = COLOR_PRESETS[color] || null;
  const finalColor = preset ? preset.color : color;
  const finalBg = bg || (preset ? preset.bg : '#f5f5f0');

  const isClickable = typeof onClick === 'function';

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      style={{
        background: finalBg,
        borderRadius: 12,
        padding: '14px 12px',
        textAlign: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        // Bordure 2px partout (pour éviter le shift de layout au survol/active)
        // - active : bordure pleine de la couleur
        // - cliquable non actif : bordure transparente (devient subtile au hover via CSS local)
        // - statique : bordure transparente
        border: active
          ? `2px solid ${finalColor}`
          : '2px solid transparent',
        transition: 'border-color 0.15s ease',
        userSelect: 'none',
        outline: 'none',
      }}
      onMouseEnter={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = `${finalColor}40`; // 25% opacity
      } : undefined}
      onMouseLeave={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = 'transparent';
      } : undefined}
      onFocus={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = `${finalColor}80`; // 50% opacity (focus visible)
      } : undefined}
      onBlur={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = 'transparent';
      } : undefined}
    >
      {icon && (
        <div style={{ fontSize: 14, marginBottom: 2, lineHeight: 1 }}>
          {icon}
        </div>
      )}
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        color: finalColor,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 11,
        color: finalColor,
        opacity: 0.85,
        marginTop: 4,
        fontWeight: 600,
      }}>
        {label}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 10,
          color: finalColor,
          opacity: 0.65,
          marginTop: 2,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
