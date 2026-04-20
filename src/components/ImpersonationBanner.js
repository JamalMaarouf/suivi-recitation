// Bandeau affiché en permanence quand un super admin est en mode
// "impersonification" (consultation d'une école comme si il était
// son surveillant).
//
// Objectif : il ne faut JAMAIS oublier qu'on n'est pas réellement
// l'utilisateur affiché, et on doit pouvoir sortir du mode en 1 clic.

import React from 'react';

export default function ImpersonationBanner({ user, onStop }) {
  if (!user || !user._impersonating) return null;

  const originalLabel = user._impersonating.originalLabel || 'Super admin';
  const ecoleLabel = user._impersonating.ecoleNom || 'une école';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 99999,                  // juste sous EnvBanner (100000)
      background: '#B91C1C',          // rouge foncé
      color: '#fff',
      padding: '8px 16px',
      fontSize: 13,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      fontFamily: "'Tajawal', Arial, sans-serif",
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          MODE IMPERSONIFICATION — vous consultez <strong>{ecoleLabel}</strong> (lecture seule)
        </span>
      </div>
      <button onClick={onStop}
        style={{
          padding: '5px 12px',
          background: '#fff',
          color: '#B91C1C',
          border: 'none',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
        ← Revenir au cockpit ({originalLabel})
      </button>
    </div>
  );
}
