// Bandeau global de statut réseau
// Détecte les coupures WiFi/4G et affiche un indicateur visuel
// Affiche aussi le nombre d'opérations en attente de synchronisation

import React, { useState, useEffect } from 'react';
import { subscribe, pendingCount } from './offlineQueue';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
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
  const [pending, setPending] = useState(0);

  // Suivre le nombre d'opérations en attente
  useEffect(() => {
    pendingCount().then(setPending);
    return subscribe(setPending);
  }, []);

  // Rien à afficher si en ligne, jamais coupé, et rien en queue
  if (isOnline && !wasOffline && pending === 0) return null;

  const isReconnected = isOnline && wasOffline;

  const labels = {
    fr: {
      offline: 'Hors ligne — Les saisies seront synchronisées au retour',
      reconnected: 'Connexion rétablie',
      pending: (n) => `${n} en attente de synchronisation`,
    },
    ar: {
      offline: 'غير متصل — ستتم المزامنة عند عودة الاتصال',
      reconnected: 'تم استعادة الاتصال',
      pending: (n) => `${n} في انتظار المزامنة`,
    },
    en: {
      offline: 'Offline — Entries will sync when connection returns',
      reconnected: 'Connection restored',
      pending: (n) => `${n} pending sync`,
    },
  };
  const t = labels[lang] || labels.fr;

  // Détermine le contenu et la couleur
  let content, bg;
  if (!isOnline) {
    bg = '#E24B4A'; // rouge
    content = pending > 0
      ? `🔴 ${t.offline} · ${t.pending(pending)}`
      : `🔴 ${t.offline}`;
  } else if (pending > 0) {
    bg = '#EF9F27'; // orange (sync en cours)
    content = `🔄 ${t.pending(pending)}`;
  } else {
    bg = '#1D9E75'; // vert (reconnecté)
    content = `✅ ${t.reconnected}`;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      background: bg,
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
      {content}
    </div>
  );
}

