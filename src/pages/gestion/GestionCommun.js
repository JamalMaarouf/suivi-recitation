import React from 'react';
import { getInitiales } from '../../lib/helpers';


export function Avatar({ prenom, nom, size = 28 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

// ─── SubTabs helper (E1a) ──────────────────────────────────────────
// Mini-tabs réutilisables pour découper un onglet en sous-vues
// (ex: Élèves → 📋 Liste / ➕ Ajouter).
// Charte : pilule arrondie, vert école si active, gris sinon, sobre.
export function SubTabs({ value, onChange, items, lang = 'fr' }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      marginBottom: '1.25rem',
      background: '#f5f5f0',
      borderRadius: 12,
      padding: 4,
      width: 'fit-content',
    }}>
      {items.map(item => {
        const active = value === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              border: 'none',
              background: active ? '#fff' : 'transparent',
              color: active ? '#085041' : '#666',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              transition: 'background 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span style={{
                background: active ? '#E1F5EE' : '#e8e8e0',
                color: active ? '#085041' : '#888',
                padding: '1px 8px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
              }}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
