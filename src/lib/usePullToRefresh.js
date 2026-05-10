// ═══════════════════════════════════════════════════════════════════════════
// usePullToRefresh — Phase 2 mobile (geste tactile classe mondiale)
// ═══════════════════════════════════════════════════════════════════════════
//
// Hook React custom qui implemente le geste pull-to-refresh natif des apps
// mobiles modernes (Twitter, Instagram, Mail, WhatsApp, etc.)
//
// L'utilisateur tire la page vers le bas depuis le haut. Au-dela d'un seuil,
// un indicateur visuel apparait. Au relachement, callback async appele.
//
// Usage simple :
//   const { pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd } =
//     usePullToRefresh(async () => await loadData());
//
//   return (
//     <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
//       <PullIndicator distance={pullDistance} isRefreshing={isRefreshing} />
//       {/* contenu */}
//     </div>
//   );
//
// SECURITES :
// - Ne se declenche que si scrollY === 0 (sinon scroll normal)
// - Threshold minimum 60px avant declenchement
// - Damping progressif au-dela de 80px (effet elastique naturel)
// - Disable pendant un refresh deja en cours
//
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react';

const PULL_THRESHOLD = 80;        // px : seuil de declenchement
const MAX_PULL_DISTANCE = 120;    // px : distance max apres damping
const DAMPING_FACTOR = 0.5;       // ratio : amorti au-dela du seuil

export function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(null);
  const isPulling = useRef(false);

  const onTouchStart = useCallback((e) => {
    // Ne demarrer que si on est tout en haut de la page
    if (window.scrollY > 0 || isRefreshing) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0].clientY;
    isPulling.current = false;
  }, [isRefreshing]);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY.current;

    // On tire vers le bas
    if (deltaY > 0 && window.scrollY === 0) {
      isPulling.current = true;
      // Damping progressif au-dela du seuil pour effet elastique naturel
      let distance;
      if (deltaY <= PULL_THRESHOLD) {
        distance = deltaY;
      } else {
        const overflow = deltaY - PULL_THRESHOLD;
        distance = PULL_THRESHOLD + (overflow * DAMPING_FACTOR);
      }
      distance = Math.min(distance, MAX_PULL_DISTANCE);
      setPullDistance(distance);
    } else {
      // On tire vers le haut ou on est sorti du top
      isPulling.current = false;
      setPullDistance(0);
    }
  }, [isRefreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!isPulling.current || isRefreshing) {
      setPullDistance(0);
      startY.current = null;
      return;
    }

    const shouldRefresh = pullDistance >= PULL_THRESHOLD;
    isPulling.current = false;
    startY.current = null;

    if (shouldRefresh && onRefresh) {
      setIsRefreshing(true);
      setPullDistance(60); // freeze au seuil pendant le refresh
      try {
        await onRefresh();
      } catch (err) {
        console.error('[usePullToRefresh] error:', err);
      }
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  return {
    pullDistance,
    isRefreshing,
    isThreshold: pullDistance >= PULL_THRESHOLD,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

// ─── Composant indicateur visuel ───────────────────────────────────────────
//
// Indicateur a placer juste au-dessus du contenu de la liste.
// Apparait quand l'utilisateur tire, indique l'etat (à tirer / à relacher /
// en cours) avec animation et icone.
//
export function PullToRefreshIndicator({ pullDistance, isRefreshing, isThreshold, lang='fr' }) {
  const opacity = Math.min(pullDistance / 60, 1);
  const rotate = Math.min((pullDistance / 80) * 180, 180);

  if (pullDistance === 0 && !isRefreshing) return null;

  const labelText = isRefreshing
    ? (lang==='ar' ? 'جاري التحديث...' : 'Actualisation...')
    : isThreshold
      ? (lang==='ar' ? 'حرّر للتحديث' : 'Relâcher pour actualiser')
      : (lang==='ar' ? 'اسحب للأسفل للتحديث' : 'Tirer pour actualiser');

  return (
    <div style={{
      height: pullDistance,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 6,
      opacity,
      transition: isRefreshing ? 'height 0.2s ease' : 'none',
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg,#1D9E75,#085041)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 16,
        boxShadow: '0 2px 8px rgba(8,80,65,0.25)',
        transition: 'transform 0.15s ease',
        transform: isRefreshing ? 'rotate(0deg)' : `rotate(${rotate}deg)`,
        animation: isRefreshing ? 'ptrSpin 0.8s linear infinite' : 'none',
      }}>
        {isRefreshing ? '⟳' : '↓'}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: isThreshold || isRefreshing ? '#085041' : '#888',
        transition: 'color 0.15s ease',
      }}>
        {labelText}
      </div>
      <style>{`@keyframes ptrSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
