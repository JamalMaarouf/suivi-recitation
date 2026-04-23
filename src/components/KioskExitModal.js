import React, { useState, useRef, useEffect } from 'react';

// ══════════════════════════════════════════════════════════════════════
// POPUP DE SORTIE DU MODE KIOSQUE
// Demande le PIN à 4 chiffres défini dans GestionAssiduite (ecoles.pin_kiosque).
// Si correct, onSuccess() est appelé → App.js désactive le mode kiosque.
// Si incorrect 3 fois : message d'erreur mais on laisse réessayer
// (pas de blocage pour éviter de piéger le surveillant).
// ══════════════════════════════════════════════════════════════════════

export default function KioskExitModal({ isOpen, onClose, onValidate, lang }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef(null);

  // Focus auto sur l'input à l'ouverture
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setPin(''); setError(''); setAttempts(0); setChecking(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError(lang === 'ar' ? 'الرمز يجب أن يتكون من 4 أرقام' : 'Le PIN doit contenir 4 chiffres');
      return;
    }
    setChecking(true);
    setError('');
    const ok = await onValidate(pin);  // onValidate renvoie true/false
    setChecking(false);
    if (!ok) {
      setAttempts(a => a + 1);
      setPin('');
      setError(lang === 'ar' ? '❌ رمز خاطئ. حاول مرة أخرى.' : '❌ PIN incorrect. Réessaie.');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // Si ok, App.js a déjà fermé la popup via kioskMode=false
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 18,
          padding: 28, maxWidth: 380, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔓</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a' }}>
            {lang === 'ar' ? 'الخروج من وضع الكشك' : 'Quitter le mode kiosque'}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
            {lang === 'ar'
              ? 'أدخل الرمز المكوّن من 4 أرقام'
              : 'Saisis le PIN à 4 chiffres'}
          </div>
        </div>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="••••"
          style={{
            width: '100%', padding: '16px 12px',
            fontSize: 32, fontWeight: 800, letterSpacing: 12,
            borderRadius: 10, border: `2px solid ${error ? '#E24B4A' : '#e0e0d8'}`,
            background: '#f9f9f5', color: '#1a1a1a',
            fontFamily: 'monospace', textAlign: 'center', outline: 'none',
            boxSizing: 'border-box',
            marginBottom: error ? 8 : 16,
          }}
        />

        {error && (
          <div style={{
            padding: '8px 12px', background: '#FCEBEB',
            color: '#A32D2D', borderRadius: 8,
            fontSize: 12, fontWeight: 600, marginBottom: 16,
            textAlign: 'center',
          }}>
            {error}
            {attempts >= 3 && (
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                {lang === 'ar'
                  ? `عدد المحاولات: ${attempts}`
                  : `Tentatives : ${attempts}`}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: '12px', background: '#f5f5f0', color: '#666',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {lang === 'ar' ? 'إلغاء' : 'Annuler'}
          </button>
          <button onClick={handleSubmit} disabled={pin.length !== 4 || checking}
            style={{
              flex: 2, padding: '12px',
              background: (pin.length !== 4 || checking) ? '#ccc' : 'linear-gradient(135deg, #085041, #1D9E75)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: (pin.length !== 4 || checking) ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}>
            {checking
              ? '...'
              : (lang === 'ar' ? '🔓 تأكيد' : '🔓 Valider')}
          </button>
        </div>
      </div>
    </div>
  );
}
