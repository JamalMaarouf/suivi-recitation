// Bandeau global de statut réseau
// Détecte les coupures WiFi/4G et affiche un indicateur visuel
// Affiche aussi le nombre d'opérations en attente de synchronisation

import React, { useState, useEffect } from 'react';
import { subscribe, pendingCount, failedOps, retryFailed, abandonFailed, syncPending } from './offlineQueue';
import { supabase } from './supabase';

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
  // FIX (oct 2026) : saisies refusees a la synchronisation (avant : supprimees sans prevenir)
  const [refusees, setRefusees] = useState([]);
  const [ouvert, setOuvert] = useState(false);

  // Suivre le nombre d'opérations en attente
  useEffect(() => {
    const maj = (n) => { setPending(n); failedOps().then(setRefusees); };
    pendingCount().then(maj);
    return subscribe(maj);
  }, []);

  const libelleOp = (op) => {
    const p = op.payload || {};
    const quoi = op.table === 'validations'
      ? (p.type_validation === 'hizb_complet' ? (lang==='ar'?'حزب كامل':'Hizb complet') : `${p.nombre_tomon || ''} ${lang==='ar'?'ثمن':'tomon'}`)
      : op.table === 'recitations_sourates' ? (lang==='ar'?'سورة':'Sourate')
      : op.table;
    const quand = p.date_validation || p.date_debut || p.date_event || p.date_presence;
    const d = quand ? new Date(quand).toLocaleString(lang==='ar'?'ar-MA':'fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    return `${quoi}${d ? ' · ' + d : ''}`;
  };

  if (refusees.length > 0) {
    return (
      <div style={{position:'fixed', top:0, left:0, right:0, zIndex:10000, background:'#E24B4A', color:'#fff',
        fontFamily:"'Tajawal',Arial,sans-serif", fontSize:13, boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
        <div onClick={()=>setOuvert(o=>!o)} style={{padding:'8px 12px', textAlign:'center', fontWeight:700, cursor:'pointer'}}>
          ⚠️ {lang==='ar'
            ? `${refusees.length} تسجيل لم يُحفظ — اضغط للتفاصيل`
            : `${refusees.length} saisie(s) non enregistrée(s) — appuyer pour voir`}
        </div>
        {ouvert && (
          <div style={{background:'#fff', color:'#333', maxHeight:'50vh', overflowY:'auto', padding:'8px 12px'}}>
            {refusees.map(op => (
              <div key={op.id} style={{display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'0.5px solid #eee'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:600}}>{libelleOp(op)}</div>
                  <div style={{fontSize:11, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{op.last_error || ''}</div>
                </div>
                <button onClick={async()=>{ await retryFailed(op.id); await syncPending(supabase); failedOps().then(setRefusees); }}
                  style={{padding:'6px 10px', background:'#1D9E75', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  {lang==='ar'?'إعادة':'Réessayer'}
                </button>
                <button onClick={async()=>{
                    if (!window.confirm(lang==='ar'?'حذف هذا التسجيل نهائيا؟':'Abandonner définitivement cette saisie ?')) return;
                    await abandonFailed(op.id); failedOps().then(setRefusees);
                  }}
                  style={{padding:'6px 10px', background:'#f5f5f0', color:'#E24B4A', border:'1px solid #E24B4A40', borderRadius:6, fontSize:12, cursor:'pointer'}}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

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

