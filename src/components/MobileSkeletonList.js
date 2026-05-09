// ═══════════════════════════════════════════════════════════════════════════
// MobileSkeletonList — Phase 2 mobile (skeleton loaders généralisés)
// ═══════════════════════════════════════════════════════════════════════════
//
// Composant réutilisable pour afficher un skeleton de liste pendant le
// chargement, à la place du classique "..." ou "⏳ Chargement...".
//
// Améliore la perception de performance : l'utilisateur voit la STRUCTURE
// de la page immédiatement, le contenu apparaît ensuite.
//
// Variants disponibles selon le type de contenu :
//   - 'card-with-avatar' : carte avec avatar circulaire à gauche
//                          (ElevesMobile, ListeCertificats, ListeNotes)
//   - 'card-simple'      : carte avec lignes de texte simples
//                          (GestionExamens, items génériques)
//   - 'card-with-tabs'   : carte large avec un header + zones internes
//                          (FicheEleve, page de détail)
//   - 'card-stat'        : carte avec stats/scores (Dashboard sections)
//
// Usage :
//   {loading ? <MobileSkeletonList type="card-with-avatar" count={6} /> : <Liste />}
//
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';

export default function MobileSkeletonList({
  type = 'card-with-avatar',
  count = 6,
  padding = '0 12px',
}) {
  const items = Array.from({ length: count }, (_, i) => i);

  // Animation pulse réutilisable (CSS)
  const animation = 'mobileSkelPulse 1.2s ease-in-out infinite';

  return (
    <div style={{ padding }}>
      <style>{`
        @keyframes mobileSkelPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {items.map(i => (
        <SkelItem key={i} type={type} animation={animation} delay={i * 0.05} />
      ))}
    </div>
  );
}

// ─── Variant card-with-avatar ───────────────────────────────────────────────
// Avatar rond à gauche, 2 lignes de texte au milieu, valeur à droite
function SkelItem({ type, animation, delay }) {
  const baseStyle = {
    background: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    border: '0.5px solid #e0e0d8',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    animation,
    animationDelay: `${delay}s`,
  };

  const block = (props) => ({
    background: '#e5e5df',
    borderRadius: 4,
    ...props,
  });

  if (type === 'card-with-avatar') {
    return (
      <div style={baseStyle}>
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: '#e5e5df', flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={block({ width: '60%', height: 14, marginBottom: 6 })} />
          <div style={block({ width: '40%', height: 11 })} />
        </div>
        <div style={block({ width: 50, height: 24, flexShrink: 0 })} />
      </div>
    );
  }

  if (type === 'card-simple') {
    return (
      <div style={baseStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={block({ width: '70%', height: 15, marginBottom: 8 })} />
          <div style={block({ width: '50%', height: 11, marginBottom: 6 })} />
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={block({ width: 50, height: 16, borderRadius: 12 })} />
            <div style={block({ width: 70, height: 16, borderRadius: 12 })} />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'card-with-tabs') {
    return (
      <div style={{
        background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
        border: '0.5px solid #e0e0d8', animation, animationDelay: `${delay}s`,
      }}>
        <div style={block({ width: '50%', height: 16, marginBottom: 12 })} />
        <div style={block({ width: '90%', height: 10, marginBottom: 6 })} />
        <div style={block({ width: '85%', height: 10, marginBottom: 6 })} />
        <div style={block({ width: '70%', height: 10 })} />
      </div>
    );
  }

  if (type === 'card-stat') {
    return (
      <div style={{
        background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
        border: '0.5px solid #e0e0d8', textAlign: 'center',
        animation, animationDelay: `${delay}s`,
      }}>
        <div style={block({ width: 60, height: 28, margin: '0 auto 6px' })} />
        <div style={block({ width: 80, height: 11, margin: '0 auto' })} />
      </div>
    );
  }

  // Fallback : card-with-avatar
  return (
    <div style={baseStyle}>
      <div style={block({ width: 46, height: 46, borderRadius: '50%', flexShrink: 0 })} />
      <div style={{ flex: 1 }}>
        <div style={block({ width: '60%', height: 14, marginBottom: 6 })} />
        <div style={block({ width: '40%', height: 11 })} />
      </div>
    </div>
  );
}
