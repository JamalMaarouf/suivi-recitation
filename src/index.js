import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// Register Service Worker for PWA — avec detection automatique des mises a jour
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('SW registered:', reg.scope);

        // Verifier toutes les 60 secondes s'il y a une mise a jour
        setInterval(() => { reg.update().catch(()=>{}); }, 60 * 1000);

        // Et aussi au retour de focus (utile PWA mobile)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(()=>{});
          }
        });

        // Si une nouvelle version est prete, on la demande et on recharge
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Une nouvelle version est prete — on l'active
              console.log('[SW] Nouvelle version detectee, activation...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Quand le SW change de controleur (nouvelle version active), on recharge
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          console.log('[SW] Controleur change, rechargement de la page');
          window.location.reload();
        });
      })
      .catch((err) => {
        console.log('SW registration failed:', err);
      });
  });
}
