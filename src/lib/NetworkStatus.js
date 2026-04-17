// Bandeau global de statut réseau
// Détecte les coupures WiFi/4G et affiche un indicateur visuel
// Aucun impact sur les requêtes — purement informatif

import React, { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // wasOffline reste true 3 secondes pour afficher "Connexion rétablie ✅"
      setTimeout(() => setWasOffline(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}

// ─── Bandeau visuel ──────────────────────────────────────────────
export function NetworkBanner({ lang = 'fr' }) {
  const { isOnline, wasOffline } = useNetworkStatus();

  // Rien à afficher si en ligne et jamais coupé
  if (isOnline && !wasOffline) return null;

  const isReconnected = isOnline && wasOffline;

  const labels = {
    fr: {
      offline: 'Hors ligne — Vérifiez votre connexion',
      reconnected: 'Connexion rétablie',
    },
    ar: {
      offline: 'غير متصل — تحقق من اتصالك',
      reconnected: 'تم استعادة الاتصال',
    },
    en: {
      offline: 'Offline — Check your connection',
      reconnected: 'Connection restored',
    },
  };
  const t = labels[lang] || labels.fr;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      background: isReconnected ? '#1D9E75' : '#E24B4A',
      color: '#fff',
      textAlign: 'center',
      padding: '8px 12px',
      fontSize: 13,
      fontWeight: 600,
      zIndex: 10000,
      fontFamily: "'Tajawal',Arial,sans-serif",
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      animation: 'networkSlide 0.3s ease',
    }}>
      <style>{`
        @keyframes networkSlide {
          from { transform: translateY(-100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
      {isReconnected ? `✅ ${t.reconnected}` : `🔴 ${t.offline}`}
    </div>
  );
}
