// ═══════════════════════════════════════════════════════════════════════════
// PageHeader — Phase C / Étape 15 + B8
// ═══════════════════════════════════════════════════════════════════════════
//
// Composant réutilisable pour le header des pages.
// But : harmoniser visuellement les ~44 pages du projet, supprimer la
// duplication de code header inline, et faciliter les futures évolutions.
//
// IMPORTANT — Mode desktop uniquement par défaut (Phase C).
// Le mobile garde son header gradient existant : il sera harmonisé dans
// une Phase E dédiée (mobile-only) après la Phase C.
// EXCEPTION : variant 'dark' couvre desktop ET mobile (cas TableauHonneur,
// gamification où l'unité visuelle est essentielle).
//
// 3 variants disponibles :
//
// ── variant='default' (par défaut) ─────────────────────
// Header classique sobre desktop : fond transparent, titre noir 20px.
// Usage : la plupart des pages métier (Certificats, Suivi Résultats, etc.)
//
// ── variant='hero' ──────────────────────────────────────
// Header "vitrine" : titre 22px <h1> sémantique, couleur verte école.
// Bouton retour customisé (carré blanc bordure). Pour les pages d'accueil
// d'un domaine (Dashboard Direction, futurs landing pages internes).
//
// ── variant='dark' ──────────────────────────────────────
// Header sticky avec backdrop-blur, fond noir transparent.
// Pour les pages "gamification" / "showcase" (Tableau Honneur).
// IMPORTANT : ce variant gère ses propres styles desktop+mobile,
// il faut donc passer 'isMobile' pour adapter quelques tailles.
//
// Usage minimal :
//   <PageHeader title="Certificats" icon="🏅" onBack={goBack} />
//
// Usage complet :
//   <PageHeader
//     title="Certificats"
//     titleAr="الشهادات"
//     icon="🏅"
//     subtitle="42 certificat(s)"
//     titleSuffix={<NiveauBadge .../>}
//     onBack={goBack}
//     actions={<ExportButtons .../>}
//     lang={lang}
//     variant="default"   // 'default' | 'hero' | 'dark'
//     isMobile={isMobile} // requis si variant='dark'
//   />
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
  variant = 'default',
  isMobile = false,
}) {
  // Choix du titre selon la langue (fallback FR)
  const displayTitle = (lang === 'ar' && titleAr) ? titleAr : title;

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT 'dark' — Sticky blur, fond noir, gamification (Tableau Honneur)
  // Couvre desktop ET mobile (cas particulier intentionnel).
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === 'dark') {
    return (
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(10,10,15,0.95)',
        padding: isMobile ? '48px 16px 14px' : '20px 16px 14px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onBack && (
            <button
              onClick={onBack}
              aria-label={t(lang, 'retour')}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#9FE1CB',
                fontSize: 18,
                cursor: 'pointer',
                minWidth: 38,
                flexShrink: 0,
              }}
            >
              ←
            </button>
          )}
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{
              fontSize: isMobile ? 16 : 20,
              fontWeight: 800,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {icon && <span>{icon} </span>}
              {displayTitle}
              {titleSuffix}
            </div>
            {subtitle && (
              <div style={{ fontSize: 11, color: '#5DCAA5', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT 'hero' — Page "vitrine" (Dashboard Direction)
  // Titre 22px <h1>, couleur verte école, bouton retour custom.
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === 'hero') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
          {onBack && (
            <button
              onClick={onBack}
              title={t(lang, 'retour')}
              style={{
                background: '#fff',
                border: '1px solid #e0e0d8',
                borderRadius: 10,
                padding: 0,
                width: 38,
                height: 38,
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#085041',
                flexShrink: 0,
              }}
            >
              ←
            </button>
          )}
          <div>
            <h1 style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#085041',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              lineHeight: 1.2,
            }}>
              {icon && <span>{icon}</span>}
              <span>{displayTitle}</span>
              {titleSuffix}
            </h1>
            {subtitle && (
              <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT 'default' — Header desktop classique (la majorité des pages)
  // ─────────────────────────────────────────────────────────────────────────
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
