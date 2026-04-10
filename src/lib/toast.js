import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Context ───────────────────────────────────────────────────────────────
export const ToastContext = createContext({ showToast: () => {} });

// ─── Hook ──────────────────────────────────────────────────────────────────
export const useToast = () => useContext(ToastContext);

// ─── Config visuelle ───────────────────────────────────────────────────────
const STYLES = {
  success: { bg: '#E1F5EE', border: '#1D9E75', color: '#085041', icon: '✅' },
  error:   { bg: '#FEE2E2', border: '#E24B4A', color: '#7F1D1D', icon: '❌' },
  warning: { bg: '#FAEEDA', border: '#EF9F27', color: '#633806', icon: '⚠️' },
  info:    { bg: '#E6F1FB', border: '#378ADD', color: '#0C447C', icon: 'ℹ️' },
};

// ─── Composant Toast individuel ────────────────────────────────────────────
function ToastItem({ toast, onRemove }) {
  const s = STYLES[toast.type] || STYLES.info;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: s.bg, border: `1.5px solid ${s.border}`,
        borderRadius: 12, padding: '12px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        minWidth: 260, maxWidth: 340,
        animation: 'toastIn 0.25s ease',
        cursor: 'pointer',
      }}
      onClick={() => onRemove(toast.id)}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
      <div style={{ flex: 1 }}>
        {toast.title && (
          <div style={{ fontWeight: 700, fontSize: 13, color: s.color, marginBottom: 2 }}>
            {toast.title}
          </div>
        )}
        <div style={{ fontSize: 13, color: s.color, lineHeight: 1.4 }}>
          {toast.message}
        </div>
      </div>
      <span style={{ fontSize: 16, color: s.border, opacity: 0.6, flexShrink: 0 }}>×</span>
    </div>
  );
}

// ─── Conteneur des toasts ──────────────────────────────────────────────────
export function ToastContainer({ toasts, onRemove, isMobile }) {
  if (toasts.length === 0) return null;
  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(${isMobile ? '20px' : '-20px'}) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: isMobile ? 90 : 'auto',
        top: isMobile ? 'auto' : 20,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem toast={t} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Provider ──────────────────────────────────────────────────────────────
export function ToastProvider({ children, isMobile }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, message, options = {}) => {
    const id = Date.now() + Math.random();
    const duration = options.duration ?? (type === 'error' ? 5000 : 3500);
    setToasts(prev => [...prev.slice(-4), { id, type, message, title: options.title }]);
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Raccourcis pratiques
  const toast = {
    success: (msg, opts) => showToast('success', msg, opts),
    error:   (msg, opts) => showToast('error',   msg, opts),
    warning: (msg, opts) => showToast('warning', msg, opts),
    info:    (msg, opts) => showToast('info',    msg, opts),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} isMobile={isMobile} />
    </ToastContext.Provider>
  );
}
