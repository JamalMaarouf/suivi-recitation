// ═══════════════════════════════════════════════════════════════════════════
// StatsBreakdown — Phase C-final / C5
// ═══════════════════════════════════════════════════════════════════════════
//
// Composant spécialisé pour le pattern "segmentation d'une population".
// Pattern inspiré du menu الأولياء (SuiviParents) — validation Jamal.
//
// Structure visuelle (3 niveaux d'information) :
//   1. Carte "hero" : le TOTAL (vert école sombre, blanc dessus, plus large)
//   2. Cartes catégorielles : segments (vert/orange/rouge sémaphore)
//   3. Carte "outlier" optionnelle : sous-catégorie atypique (gris léger)
//   + Barre de progression segmentée + légende
//
// QUAND UTILISER ce composant :
// ✅ La page segmente une POPULATION (parents, élèves, paiements...)
// ✅ Il existe un TOTAL qui unifie les segments
// ✅ Chaque segment représente un état/catégorie de la même chose
//
// QUAND NE PAS UTILISER :
// ❌ KPIs hétérogènes (tomon + hizb + jours actifs) → utiliser StatsCard simple
// ❌ Filtres sur des données différentes → StatsCard simple
// ❌ Pas de notion de total/100% → StatsCard simple
//
// Usage typique (cliquable) :
//   <StatsBreakdown
//     total={{ value: 15, label: 'Total parents', activeKey: filtre, key: 'tous',
//              onClick: () => setFiltre('tous') }}
//     segments={[
//       { key: 'actif',     value: 4, label: 'Actifs',     color: 'green',
//         emoji: '🟢', onClick: () => setFiltre('actif') },
//       { key: 'peu_actif', value: 0, label: 'Peu actifs', color: 'amber',
//         emoji: '🟡', onClick: () => setFiltre('peu_actif') },
//       { key: 'inactif',   value: 0, label: 'Inactifs',   color: 'red',
//         emoji: '🔴', onClick: () => setFiltre('inactif') },
//     ]}
//     outlier={{ key: 'jamais', value: 11, label: 'Jamais venus',
//                onClick: () => setFiltre('jamais') }}
//     activeKey={filtreStatut}
//     progress={{
//       label: '📊 Répartition des parents',
//       caption: '4 / 15 parent(s) au moins vu(s) une fois',
//       countedKeys: ['actif', 'peu_actif'], // segments compris dans le ratio
//     }}
//     lang={lang}
//     isMobile={isMobile}
//   />
//
// Le composant gère AUTOMATIQUEMENT :
//   - largeur de la carte hero (40% desktop, 100% mobile sur ligne dédiée)
//   - bordure active sur la carte sélectionnée (active = activeKey === card.key)
//   - barre de progression calculée à partir des segments + outlier
//   - cliquabilité (cursor + hover) si onClick fourni
//   - accessibilité (role/tabIndex/keyboard)
//
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';

// ─── Palette officielle (alignée sur StatsCard) ────────────────────────────
const COLOR_PRESETS = {
  green:  { color: '#1D9E75', bg: '#E1F5EE', bar: '#1D9E75' },
  blue:   { color: '#378ADD', bg: '#E6F1FB', bar: '#378ADD' },
  amber:  { color: '#EF9F27', bg: '#FAEEDA', bar: '#EF9F27' },
  red:    { color: '#E24B4A', bg: '#FCEBEB', bar: '#E24B4A' },
  purple: { color: '#534AB7', bg: '#EEEDFE', bar: '#534AB7' },
  gray:   { color: '#888888', bg: '#f5f5f0', bar: '#aaa' },
};

// ─── Couleurs hero — VERT ÉCOLE (validation Jamal Q3=B) ────────────────────
const HERO_BG = '#085041';      // Vert école sombre
const HERO_TEXT = '#ffffff';
const HERO_ACCENT = '#5DCAA5';  // Vert clair pour le label/sous-titre

// ─── Helpers ───────────────────────────────────────────────────────────────
function resolveColor(c) {
  return COLOR_PRESETS[c] || { color: c, bg: '#f5f5f0', bar: c };
}

// ─── Sous-composant : carte segment (catégorielle ou outlier) ──────────────
function SegmentCard({ segment, active, isMobile, isOutlier = false }) {
  const { color, bg } = resolveColor(segment.color || (isOutlier ? 'gray' : 'gray'));
  const isClickable = typeof segment.onClick === 'function';

  return (
    <div
      onClick={isClickable ? segment.onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          segment.onClick();
        }
      } : undefined}
      style={{
        background: bg,
        borderRadius: 12,
        padding: isMobile ? '10px 8px' : '14px 12px',
        textAlign: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        border: active
          ? `2px solid ${color}`
          : '2px solid transparent',
        transition: 'border-color 0.15s ease',
        userSelect: 'none',
        outline: 'none',
        opacity: isOutlier && segment.value === 0 ? 0.5 : 1,
      }}
      onMouseEnter={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = `${color}40`;
      } : undefined}
      onMouseLeave={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = 'transparent';
      } : undefined}
      onFocus={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = `${color}80`;
      } : undefined}
      onBlur={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = 'transparent';
      } : undefined}
    >
      {segment.emoji && (
        <div style={{ fontSize: 14, marginBottom: 2, lineHeight: 1 }}>
          {segment.emoji}
        </div>
      )}
      <div style={{
        fontSize: isMobile ? 20 : 24,
        fontWeight: 800,
        color,
        lineHeight: 1.1,
      }}>
        {segment.value}
      </div>
      <div style={{
        fontSize: 11,
        color,
        opacity: 0.85,
        marginTop: 4,
        fontWeight: 600,
      }}>
        {segment.label}
      </div>
    </div>
  );
}

// ─── Sous-composant : carte hero (Total) ───────────────────────────────────
function HeroCard({ total, active, isMobile }) {
  const isClickable = typeof total.onClick === 'function';

  return (
    <div
      onClick={isClickable ? total.onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          total.onClick();
        }
      } : undefined}
      style={{
        background: HERO_BG,
        color: HERO_TEXT,
        borderRadius: 14,
        padding: isMobile ? '14px 12px' : '20px 16px',
        textAlign: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        border: active
          ? `2px solid ${HERO_ACCENT}`
          : '2px solid transparent',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        userSelect: 'none',
        outline: 'none',
        boxShadow: '0 1px 3px rgba(8,80,65,0.15)',
        // hauteur min pour que la hero respire un peu plus que les segments
        minHeight: isMobile ? 90 : 110,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onMouseEnter={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = `${HERO_ACCENT}80`;
      } : undefined}
      onMouseLeave={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = 'transparent';
      } : undefined}
      onFocus={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = HERO_ACCENT;
      } : undefined}
      onBlur={isClickable && !active ? (e) => {
        e.currentTarget.style.borderColor = 'transparent';
      } : undefined}
    >
      {total.emoji && (
        <div style={{ fontSize: 18, marginBottom: 4, lineHeight: 1 }}>
          {total.emoji}
        </div>
      )}
      <div style={{
        fontSize: isMobile ? 26 : 32,
        fontWeight: 800,
        lineHeight: 1.05,
      }}>
        {total.value}
      </div>
      <div style={{
        fontSize: isMobile ? 11 : 12,
        color: HERO_ACCENT,
        opacity: 0.95,
        marginTop: 6,
        fontWeight: 600,
        letterSpacing: 0.3,
      }}>
        {total.label}
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────
export default function StatsBreakdown({
  total,           // { value, label, emoji?, key?, onClick? }
  segments = [],   // [{ key, value, label, color, emoji?, onClick? }]
  outlier = null,  // { key, value, label, emoji?, onClick? } — optionnel
  activeKey = null,
  progress = null, // { label, caption, countedKeys: [], showWhenZero?: false }
  lang = 'fr',
  isMobile = false,
}) {

  // ─── Layout ─────────────────────────────────────────────────────────────
  // Desktop : Hero | Segments... | Outlier(opt)
  //   Hero prend 1.4fr, chaque segment 1fr, outlier 0.9fr
  // Mobile : Hero pleine largeur, puis grille 2 colonnes pour les segments
  // ─────────────────────────────────────────────────────────────────────────

  const nbSegments = segments.length;
  const hasOutlier = outlier && outlier.value !== undefined;

  let gridTemplate;
  if (isMobile) {
    // Hero pleine largeur sur sa propre ligne, puis 2 colonnes
    gridTemplate = '1fr';
  } else {
    // Desktop : hero (1.4) + segments (1 chacun) + outlier optionnel (0.9)
    const cols = ['1.4fr', ...Array(nbSegments).fill('1fr')];
    if (hasOutlier) cols.push('0.9fr');
    gridTemplate = cols.join(' ');
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {/* ── Cartes ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        gap: 10,
        marginBottom: 12,
      }}>
        {/* Hero */}
        <HeroCard total={total} active={activeKey === total.key} isMobile={isMobile} />

        {/* Segments + outlier — sur mobile dans une grille 2 colonnes */}
        {isMobile ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}>
            {segments.map((s) => (
              <SegmentCard
                key={s.key}
                segment={s}
                active={activeKey === s.key}
                isMobile={isMobile}
              />
            ))}
            {hasOutlier && (
              <SegmentCard
                segment={{ ...outlier, color: outlier.color || 'gray' }}
                active={activeKey === outlier.key}
                isMobile={isMobile}
                isOutlier
              />
            )}
          </div>
        ) : (
          <>
            {segments.map((s) => (
              <SegmentCard
                key={s.key}
                segment={s}
                active={activeKey === s.key}
                isMobile={isMobile}
              />
            ))}
            {hasOutlier && (
              <SegmentCard
                segment={{ ...outlier, color: outlier.color || 'gray' }}
                active={activeKey === outlier.key}
                isMobile={isMobile}
                isOutlier
              />
            )}
          </>
        )}
      </div>

      {/* ── Barre de progression ── */}
      {progress && total.value > 0 && (
        <div style={{
          background: '#fff',
          borderRadius: 10,
          padding: 12,
          border: '1px solid #e0e0d8',
        }}>
          {progress.label && (
            <div style={{
              fontSize: 11,
              color: '#888',
              fontWeight: 600,
              marginBottom: 6,
            }}>
              {progress.label}
            </div>
          )}
          <div style={{
            height: 14,
            background: '#f0f0ec',
            borderRadius: 999,
            overflow: 'hidden',
            display: 'flex',
          }}>
            {/* Segments empilés visuellement dans la barre */}
            {segments.map((s) => {
              if (s.value <= 0) return null;
              const pct = (s.value / total.value) * 100;
              const { bar } = resolveColor(s.color);
              return (
                <div key={s.key}
                  title={`${s.value} ${s.label}`}
                  style={{
                    width: `${pct}%`,
                    background: bar,
                  }} />
              );
            })}
            {/* Outlier en dernier (gris léger) */}
            {hasOutlier && outlier.value > 0 && (
              <div title={`${outlier.value} ${outlier.label}`}
                style={{
                  width: `${(outlier.value / total.value) * 100}%`,
                  background: '#aaa',
                }} />
            )}
          </div>
          {progress.caption && (
            <div style={{
              fontSize: 10,
              color: '#666',
              marginTop: 6,
              textAlign: 'center',
            }}>
              {progress.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
