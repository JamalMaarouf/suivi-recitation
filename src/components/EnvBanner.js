// Bandeau visuel affiché en haut de l'app quand on est en environnement QA.
// Invisible en Production (pas de REACT_APP_ENV ou valeur différente de 'qa').
//
// Objectif : éviter que l'utilisateur confonde la QA et la Prod.
//
// Style : bandeau orange fixe en haut, avec emoji et message clair.

import React from 'react';

export default function EnvBanner() {
  const env = (process.env.REACT_APP_ENV || '').toLowerCase();

  // Si pas en QA, ne rien afficher
  if (env !== 'qa') return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100000,                   // au-dessus de tout (même les modals)
      background: '#EF9F27',            // orange franc
      color: '#1a1a1a',
      padding: '6px 12px',
      fontSize: 12,
      fontWeight: 700,
      textAlign: 'center',
      fontFamily: "'Tajawal', Arial, sans-serif",
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      letterSpacing: 0.3,
    }}>
      🧪 ENVIRONNEMENT DE TEST (QUALITY) — Les données ne sont pas réelles · Ne PAS utiliser en production
    </div>
  );
}
