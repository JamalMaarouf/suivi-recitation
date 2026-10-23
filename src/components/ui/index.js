// ═══════════════════════════════════════════════════════════════════════
// Composants communs de la charte mobile (oct 2026).
// En-tete, bouton d'en-tete, recherche, filtres, tuile chiffre, ligne de liste,
// panneau d'actions (+ menu Exporter). Tous bilingues FR/AR (sens RTL gere).
// ═══════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, MoreVertical, Search, X, FileText, FileSpreadsheet, ChevronRight as Chevron } from 'lucide-react';
import { C, T, R, S, TOUCH, HEADER_BG, TONES, FONT } from './theme';

export { C, T, R, S, TOUCH, HEADER_BG, TONES, FONT };

const isAr = (lang) => lang === 'ar';

// ── Bouton d'en-tete (icone seule, 44 px) ──────────────────────────────
export function HeaderIconButton({ icon: Icon, label, onClick, disabled, children, active }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      style={{
        width: TOUCH, height: TOUCH, borderRadius: R.md, flexShrink: 0,
        background: active ? C.surface : C.onBrandGlass, color: active ? C.brand : C.onBrand,
        border: '1px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, padding: 0, fontFamily: 'inherit',
      }}>
      {Icon ? <Icon size={20} strokeWidth={2} /> : children}
    </button>
  );
}

// ── En-tete de page mobile ─────────────────────────────────────────────
// title, subtitle, icon (composant Lucide), onBack, actions (noeuds), children (lignes
// supplementaires : onglets, recherche, filtres) ; sticky, fond marque, texte blanc.
export function MobileHeader({ title, subtitle, icon: Icon, onBack, actions, children, lang = 'fr', sticky = true }) {
  const Back = isAr(lang) ? ChevronRight : ChevronLeft;
  return (
    <header style={{
      background: HEADER_BG, color: C.onBrand,
      padding: `calc(44px + env(safe-area-inset-top, 0px)) ${S.lg}px ${S.md}px`,
      position: sticky ? 'sticky' : 'relative', top: 0, zIndex: 100,
      // Pleine largeur : annule le padding 1rem de <main className="main-content-mobile">
      margin: '-16px -16px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm + 2, minHeight: TOUCH }}>
        {onBack && <HeaderIconButton icon={Back} label={isAr(lang) ? 'رجوع' : 'Retour'} onClick={onBack} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: 0, fontSize: T.lg + 1, fontWeight: 700, lineHeight: 1.2, color: C.onBrand,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {Icon && <Icon size={19} strokeWidth={2.2} style={{ flexShrink: 0, opacity: 0.9 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          </h1>
          {subtitle && <div style={{ fontSize: T.xs, color: C.onBrandMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>{actions}</div>}
      </div>
      {children && <div style={{ marginTop: S.md, display: 'grid', gap: S.sm }}>{children}</div>}
    </header>
  );
}

// ── Champ de recherche (blanc, lisible sur l'en-tete ou la page) ────────
export function SearchField({ value, onChange, placeholder, lang = 'fr', id }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: S.sm, background: C.surface, borderRadius: R.md,
      padding: `0 ${S.md}px`, height: TOUCH, border: `1px solid ${C.line}`,
    }}>
      <Search size={18} color={C.muted} style={{ flexShrink: 0 }} />
      <input id={id} type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        dir={isAr(lang) ? 'rtl' : 'ltr'}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: T.md, color: C.text, fontFamily: 'inherit' }} />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label={isAr(lang) ? 'مسح' : 'Effacer'}
          style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer', color: C.muted, display: 'flex' }}>
          <X size={16} />
        </button>
      ) : null}
    </label>
  );
}

// ── Filtres en pastilles ───────────────────────────────────────────────
// options: [{ value, label }] ; onBrand = true quand place dans l'en-tete
export function FilterChips({ options, value, onChange, onBrand = false }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
      {options.map(o => {
        const on = o.value === value;
        const style = onBrand
          ? { background: on ? C.surface : C.onBrandGlass, color: on ? C.brand : C.onBrand, border: '1px solid rgba(255,255,255,0.22)' }
          : { background: on ? C.brand : C.surface, color: on ? C.onBrand : C.text, border: `1px solid ${on ? C.brand : C.line}` };
        return (
          <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
            style={{ ...style, flexShrink: 0, height: 34, padding: `0 ${S.md + 2}px`, borderRadius: R.pill, fontSize: T.sm,
              fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Tuile chiffre ──────────────────────────────────────────────────────
// tone : neutral | brand | good | warn | crit | gold | info ; la couleur ne porte que sur le chiffre.
export function KpiTile({ value, label, tone = 'neutral', icon: Icon, hint, onClick }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined}
      style={{ background: t.bg, border: `1px solid ${C.line}`, borderRadius: R.md, padding: `${S.md}px ${S.md}px`,
        minWidth: 0, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: T.xxl, fontWeight: 700, color: t.fg, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        {Icon && <Icon size={18} color={t.accent} style={{ flexShrink: 0, opacity: 0.85 }} />}
      </div>
      <div style={{ fontSize: T.xs, color: C.muted, marginTop: 4, lineHeight: 1.3 }}>{label}</div>
      {hint && <div style={{ fontSize: T.xs - 1, color: C.muted, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export function KpiGrid({ children, cols = 2 }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: S.sm }}>{children}</div>;
}

// ── Ligne de liste ─────────────────────────────────────────────────────
export function ListRow({ leading, title, subtitle, meta, value, valueLabel, valueTone = 'brand', onClick, onMore, lang = 'fr' }) {
  const t = TONES[valueTone] || TONES.brand;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: S.md, background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: R.md, padding: `${S.sm + 2}px ${S.md}px`, minHeight: 56 }}>
      <div onClick={onClick} role={onClick ? 'button' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: S.md, flex: 1, minWidth: 0, cursor: onClick ? 'pointer' : 'default' }}>
        {leading}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && <div style={{ fontSize: T.xs, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          {meta && <div style={{ marginTop: 4 }}>{meta}</div>}
        </div>
        {value !== undefined && value !== null && (
          <div style={{ textAlign: isAr(lang) ? 'left' : 'right', flexShrink: 0 }}>
            <div style={{ fontSize: T.lg, fontWeight: 700, color: t.fg, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            {valueLabel && <div style={{ fontSize: T.xs - 1, color: C.muted }}>{valueLabel}</div>}
          </div>
        )}
      </div>
      {onMore && (
        <button type="button" onClick={onMore} aria-label={isAr(lang) ? 'خيارات' : 'Options'}
          style={{ width: TOUCH, height: TOUCH, marginInlineEnd: -S.sm, border: 'none', background: 'transparent', borderRadius: R.md,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted, flexShrink: 0 }}>
          <MoreVertical size={20} />
        </button>
      )}
    </div>
  );
}

// ── Avatar initiales ───────────────────────────────────────────────────
export function Avatar({ prenom, nom, color = C.brand, size = 40 }) {
  const ini = ((prenom || '?')[0] + (nom || '')[0] || '').toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color + '1A', color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.36 }}>{ini}</div>
  );
}

// ── Pastille de niveau (seul usage des couleurs de niveau) ─────────────
export function LevelBadge({ code, color = C.muted }) {
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: R.pill, fontSize: T.xs - 1, fontWeight: 700,
      background: color + '1A', color }}>{code || '?'}</span>
  );
}

// ── Panneau d'actions (monte du bas) ───────────────────────────────────
// actions: [{ label, icon, onClick, danger, disabled }]
export function ActionSheet({ open, onClose, title, actions = [], lang = 'fr' }) {
  if (!open) return null;
  // Rendu dans <body> : sinon, ouvert depuis l'en-tete (z-index 100), le panneau passait sous la barre du bas.
  const panneau = (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,16,0.45)', zIndex: 3000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={title}
        dir={isAr(lang) ? 'rtl' : 'ltr'}
        style={{ width: '100%', maxWidth: 520, background: C.surface, borderRadius: `${R.md + 6}px ${R.md + 6}px 0 0`,
          padding: `${S.sm}px ${S.lg}px calc(${S.lg}px + env(safe-area-inset-bottom, 0px))`, fontFamily: FONT }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.line, margin: '6px auto 10px' }} />
        {title && <div style={{ fontSize: T.sm, fontWeight: 700, color: C.muted, margin: `0 0 ${S.sm}px`, letterSpacing: '.02em' }}>{title}</div>}
        <div style={{ display: 'grid', gap: 2 }}>
          {actions.filter(Boolean).map((a, i) => {
            const Icon = a.icon;
            return (
              <button key={i} type="button" disabled={a.disabled}
                onClick={() => { onClose && onClose(); a.onClick && a.onClick(); }}
                style={{ display: 'flex', alignItems: 'center', gap: S.md, minHeight: 52, padding: `0 ${S.sm}px`, border: 'none',
                  background: 'transparent', borderRadius: R.sm, cursor: a.disabled ? 'default' : 'pointer', opacity: a.disabled ? 0.45 : 1,
                  color: a.danger ? C.crit : C.text, fontSize: T.md, fontWeight: 500, fontFamily: 'inherit', textAlign: 'start' }}>
                {Icon && <Icon size={20} color={a.danger ? C.crit : C.brand} />}
                <span style={{ flex: 1 }}>{a.label}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose}
          style={{ width: '100%', height: TOUCH + 4, marginTop: S.sm, border: `1px solid ${C.line}`, borderRadius: R.md,
            background: C.bg, color: C.text, fontSize: T.md, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {isAr(lang) ? 'إلغاء' : 'Annuler'}
        </button>
      </div>
    </div>
  );
  return typeof document !== 'undefined' && document.body ? createPortal(panneau, document.body) : panneau;
}

// ── Bouton « ⋯ » d'en-tete qui ouvre un panneau d'actions (exports, etc.) ─
export function HeaderMenu({ actions = [], lang = 'fr', title, label }) {
  const [open, setOpen] = useState(false);
  const visibles = actions.filter(Boolean);
  if (visibles.length === 0) return null;
  return (
    <>
      <HeaderIconButton icon={MoreVertical} label={label || (isAr(lang) ? 'خيارات' : 'Plus d\'actions')} onClick={() => setOpen(true)} />
      <ActionSheet open={open} onClose={() => setOpen(false)} title={title} actions={visibles} lang={lang} />
    </>
  );
}

// Actions d'export pretes a l'emploi pour HeaderMenu
export function actionsExport({ onPDF, onExcel, lang = 'fr', disabled = false }) {
  return [
    onPDF && { label: isAr(lang) ? 'تصدير PDF' : 'Exporter en PDF', icon: FileText, onClick: onPDF, disabled },
    onExcel && { label: isAr(lang) ? 'تصدير Excel' : 'Exporter en Excel', icon: FileSpreadsheet, onClick: onExcel, disabled },
  ];
}

// ── Titre de section ───────────────────────────────────────────────────
export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: S.sm, margin: `${S.lg}px 0 ${S.sm}px` }}>
      <h2 style={{ margin: 0, fontSize: T.xs, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: C.muted }}>{children}</h2>
      {action}
    </div>
  );
}

// ── Etat vide ──────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div style={{ textAlign: 'center', padding: `${S.xl * 2}px ${S.lg}px`, color: C.muted }}>
      {Icon && <Icon size={36} color={C.brand2} style={{ opacity: 0.8 }} />}
      {title && <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginTop: S.md }}>{title}</div>}
      {text && <div style={{ fontSize: T.sm, marginTop: 4 }}>{text}</div>}
      {action && <div style={{ marginTop: S.lg }}>{action}</div>}
    </div>
  );
}

export { Chevron };
