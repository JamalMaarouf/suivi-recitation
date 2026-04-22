import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { t } from '../lib/i18n';

// ══════════════════════════════════════════════════════════════════════
// PAGE ASSIDUITÉ — الحضور
// Regroupe : Saisie rapide de présence + Dashboard de suivi
// Feature retour surveillant 22/04/2026 (sujet 1/5 : Absences élèves)
// ══════════════════════════════════════════════════════════════════════

export default function Assiduite({ user, navigate, goBack, lang, isMobile }) {
  const [onglet, setOnglet] = useState('saisie');  // 'saisie' | 'suivi'

  return (
    <div style={{ background: '#f5f5f0', minHeight: '100vh', paddingBottom: 80 }}>

      {/* ─── Header vert (cohérent avec pages d'action) ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #085041, #1D9E75)',
        color: '#fff',
        padding: isMobile ? '48px 16px 14px' : '24px 24px 16px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={() => goBack ? goBack() : navigate('dashboard')}
            style={{
              width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.2)',
              border: 'none', borderRadius: 10, padding: 0, flexShrink: 0,
              color: '#fff', fontSize: 18, cursor: 'pointer',
            }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
              {lang === 'ar' ? '📅 الحضور' : '📅 Assiduité'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {lang === 'ar' ? 'تسجيل و متابعة حضور الطلاب' : 'Saisie et suivi des présences'}
            </div>
          </div>
        </div>

        {/* ─── Onglets ─── */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[
            { k: 'saisie', label: lang === 'ar' ? '✍️ تسجيل' : '✍️ Saisie' },
            { k: 'suivi',  label: lang === 'ar' ? '📊 متابعة' : '📊 Suivi' },
          ].map(tab => {
            const active = onglet === tab.k;
            return (
              <button key={tab.k} onClick={() => setOnglet(tab.k)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: 10,
                  background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: active ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Contenu ─── */}
      {onglet === 'saisie' && <OngletSaisie user={user} lang={lang} />}
      {onglet === 'suivi'  && <OngletSuivi user={user} lang={lang} navigate={navigate} />}

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ONGLET SAISIE — l'élève arrive, tape son numéro, valide sa présence
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// ONGLET SAISIE — UX "kiosque" pour tablette murale / smartphone
//
// Pensé pour être posé à l'entrée de l'école : l'élève arrive, tape son
// numéro au pavé numérique tactile, son nom s'affiche, il valide.
// Retour visuel géant en cas de succès/doublon.
// ══════════════════════════════════════════════════════════════════════

function OngletSaisie({ user, lang }) {
  const { toast } = useToast();  // fix : toast n'est PAS la racine, il est dans { showToast, toast }
  const [idTape, setIdTape] = useState('');               // identifiant en cours de frappe (alphanumérique)
  const [clavierMode, setClavierMode] = useState('abc');  // 'abc' | 'num' | 'sym'
  const [eleves, setEleves] = useState([]);
  const [presencesToday, setPresencesToday] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saisieLoading, setSaisieLoading] = useState(false);
  const [flash, setFlash] = useState(null);  // { type:'success'|'warning'|'error', nom, message }

  const today = new Date().toISOString().slice(0, 10);

  // ─── Chargement initial ───────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    const [elevesRes, presRes] = await Promise.all([
      supabase.from('eleves')
        .select('id, prenom, nom, eleve_id_ecole, code_niveau')
        .eq('ecole_id', user.ecole_id)
        .order('eleve_id_ecole', { ascending: true })
        .limit(500),
      supabase.from('presences')
        .select('eleve_id')
        .eq('ecole_id', user.ecole_id)
        .eq('date_presence', today),
    ]);
    setEleves(elevesRes.data || []);
    setPresencesToday(new Set((presRes.data || []).map(p => p.eleve_id)));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ─── Clavier : ajouter un caractère (lettre, chiffre, symbole) ───
  const appendChar = (c) => {
    if (idTape.length >= 20) return;  // limite raisonnable
    setIdTape(idTape + c);
  };
  const effacer = () => setIdTape('');
  const retourArriere = () => setIdTape(idTape.slice(0, -1));

  // ─── Recherche de l'élève correspondant à l'ID tapé ─────────
  // Comparaison INSENSIBLE à la casse + aux espaces.
  // 1. Match exact en priorité. 2. Sinon, match "commence par".
  const idNormalise = idTape.trim().toLowerCase();
  const eleveMatch = !idNormalise ? null : (
    eleves.find(e => (e.eleve_id_ecole || '').trim().toLowerCase() === idNormalise)
    || eleves.find(e => (e.eleve_id_ecole || '').trim().toLowerCase().startsWith(idNormalise))
  );

  // ─── Affichage d'un écran de retour visuel temporaire ────────
  const showFlash = (type, nom, message) => {
    setFlash({ type, nom, message });
    setIdTape('');  // on efface pour enchaîner
    setTimeout(() => setFlash(null), 2500);
  };

  // ─── Enregistrement de la présence ────────────────────────────
  const enregistrerPresence = async () => {
    if (!eleveMatch) return;
    const dejaPresent = presencesToday.has(eleveMatch.id);
    const nomComplet = `${eleveMatch.prenom || ''} ${eleveMatch.nom || ''}`.trim();

    if (dejaPresent) {
      showFlash('warning', nomComplet, lang === 'ar'
        ? 'الحضور مسجل مسبقا اليوم'
        : 'Présence déjà enregistrée aujourd\'hui');
      return;
    }

    setSaisieLoading(true);
    const { error } = await supabase.from('presences').insert({
      eleve_id: eleveMatch.id,
      ecole_id: user.ecole_id,
      date_presence: today,
      saisi_par: user.id || null,
    });
    setSaisieLoading(false);

    if (error) {
      if (error.code === '23505') {
        setPresencesToday(prev => new Set([...prev, eleveMatch.id]));
        showFlash('warning', nomComplet, lang === 'ar'
          ? 'الحضور مسجل مسبقا اليوم'
          : 'Présence déjà enregistrée aujourd\'hui');
      } else {
        console.error('[enregistrerPresence]', error);
        showFlash('error', nomComplet, (lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      }
      return;
    }

    // Succès
    setPresencesToday(prev => new Set([...prev, eleveMatch.id]));
    showFlash('success', nomComplet, lang === 'ar'
      ? 'تم تسجيل الحضور'
      : 'Présence enregistrée');
  };

  // ─── Loading initial ──────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
      {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
    </div>;
  }

  // ─── Écran de retour visuel plein écran (2.5s) ────────────────
  if (flash) {
    const colors = {
      success: { bg: '#1D9E75', dark: '#085041', icon: '✅' },
      warning: { bg: '#EF9F27', dark: '#633806', icon: '⚠️' },
      error:   { bg: '#E24B4A', dark: '#7F1D1D', icon: '❌' },
    };
    const c = colors[flash.type];
    return (
      <div style={{
        minHeight: 'calc(100vh - 180px)',
        background: c.bg,
        color: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 30, textAlign: 'center',
        animation: 'flashIn 0.25s ease',
      }}>
        <style>{`
          @keyframes flashIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        `}</style>
        <div style={{ fontSize: 120, marginBottom: 20, lineHeight: 1 }}>{c.icon}</div>
        <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, maxWidth: 500 }}>
          {flash.nom}
        </div>
        <div style={{ fontSize: 20, opacity: 0.95, maxWidth: 500 }}>
          {flash.message}
        </div>
      </div>
    );
  }

  // ─── Interface principale (kiosque tactile) ───────────────────
  return (
    <div style={{
      padding: '14px 14px 30px',
      maxWidth: 560,
      margin: '0 auto',
    }}>

      {/* ─── Compteur du jour ─── */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        padding: '12px 16px',
        marginBottom: 14,
        border: '1px solid #e0e0d8',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: '#E1F5EE', color: '#085041',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>✓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#888' }}>
            {lang === 'ar' ? 'الحضور اليوم' : 'Présences aujourd\'hui'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>
            {presencesToday.size} <span style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>/ {eleves.length}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#888', textAlign: 'right' }}>
          {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
            weekday: 'long', day: '2-digit', month: 'short',
          })}
        </div>
      </div>

      {/* ─── Écran affichant l'ID tapé (vert foncé élégant) ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #0a3d30, #0f5d45)',
        color: '#fff',
        borderRadius: 16,
        padding: '22px 20px',
        marginBottom: 12,
        minHeight: 110,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, textAlign: 'center', letterSpacing: 1 }}>
          {lang === 'ar' ? 'رقم تعريف الطالب' : 'IDENTIFIANT ÉLÈVE'}
        </div>
        <div style={{
          fontSize: 38,
          fontWeight: 800,
          textAlign: 'center',
          letterSpacing: 2,
          minHeight: 48,
          color: idTape ? '#7FE3BC' : 'rgba(255,255,255,0.3)',
          fontFamily: 'monospace',
          wordBreak: 'break-all',
        }}>
          {idTape || '—'}
        </div>
      </div>

      {/* ─── Affichage de l'élève trouvé (ou non) ─── */}
      {idTape.trim() === '' ? (
        <div style={{
          padding: '12px',
          textAlign: 'center',
          color: '#888',
          fontSize: 13,
          minHeight: 60,
        }}>
          {lang === 'ar' ? '👇 أدخل رقم تعريفك' : '👇 Tape ton identifiant'}
        </div>
      ) : !eleveMatch ? (
        <div style={{
          background: '#FCEBEB',
          borderRadius: 12,
          padding: '14px',
          marginBottom: 4,
          textAlign: 'center',
          color: '#A32D2D',
          fontSize: 14,
          fontWeight: 600,
          border: '1px solid #E24B4A40',
          minHeight: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {lang === 'ar' ? '❌ لا يوجد طالب بهذا الرقم' : '❌ Aucun élève avec cet identifiant'}
        </div>
      ) : (
        <div style={{
          background: presencesToday.has(eleveMatch.id) ? '#E1F5EE' : '#fff',
          border: '2px solid #1D9E75',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            minWidth: 54, maxWidth: 120, height: 54, padding: '0 10px', borderRadius: 12,
            background: '#1D9E75', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, flexShrink: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {eleveMatch.eleve_id_ecole || '—'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
              {eleveMatch.prenom} {eleveMatch.nom}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              {eleveMatch.code_niveau || '—'}
              {presencesToday.has(eleveMatch.id) && (
                <span style={{ marginLeft: 8, color: '#1D9E75', fontWeight: 700 }}>
                  · ✓ {lang === 'ar' ? 'حاضر' : 'Déjà présent'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Sélecteur de mode clavier (ABC / 123 / .-_) ─── */}
      <div style={{
        display: 'flex', gap: 6,
        marginTop: 14, marginBottom: 8,
      }}>
        {[
          { k: 'abc', label: 'ABC' },
          { k: 'num', label: '123' },
          { k: 'sym', label: '.–_/' },
        ].map(m => {
          const active = clavierMode === m.k;
          return (
            <button key={m.k} onClick={() => setClavierMode(m.k)}
              style={{
                flex: 1,
                padding: '9px 10px',
                border: 'none',
                borderRadius: 10,
                background: active ? '#1D9E75' : '#fff',
                color: active ? '#fff' : '#666',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: active ? 'none' : '1px solid #e0e0d8',
              }}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ─── Clavier (selon mode) ─── */}
      {clavierMode === 'num' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['1','2','3','4','5','6','7','8','9'].map(c => (
            <TouchButton key={c} onClick={() => appendChar(c)}>{c}</TouchButton>
          ))}
          <TouchButton onClick={effacer} variant="danger">
            {lang === 'ar' ? 'مسح' : 'C'}
          </TouchButton>
          <TouchButton onClick={() => appendChar('0')}>0</TouchButton>
          <TouchButton onClick={retourArriere}>⌫</TouchButton>
        </div>
      )}

      {clavierMode === 'abc' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 5 }}>
            {['A','B','C','D','E','F','G'].map(c => (
              <TouchButton key={c} size="small" onClick={() => appendChar(c)}>{c}</TouchButton>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 5 }}>
            {['H','I','J','K','L','M','N'].map(c => (
              <TouchButton key={c} size="small" onClick={() => appendChar(c)}>{c}</TouchButton>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 5 }}>
            {['O','P','Q','R','S','T','U'].map(c => (
              <TouchButton key={c} size="small" onClick={() => appendChar(c)}>{c}</TouchButton>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
            {['V','W','X','Y','Z'].map(c => (
              <TouchButton key={c} size="small" onClick={() => appendChar(c)}>{c}</TouchButton>
            ))}
            <TouchButton size="small" onClick={retourArriere}>⌫</TouchButton>
            <TouchButton size="small" onClick={effacer} variant="danger">C</TouchButton>
          </div>
        </div>
      )}

      {clavierMode === 'sym' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <TouchButton onClick={() => appendChar('-')}>−</TouchButton>
          <TouchButton onClick={() => appendChar('.')}>.</TouchButton>
          <TouchButton onClick={() => appendChar('_')}>_</TouchButton>
          <TouchButton onClick={() => appendChar('/')}>/</TouchButton>
          <TouchButton onClick={() => appendChar(' ')}>␣</TouchButton>
          <TouchButton onClick={retourArriere}>⌫</TouchButton>
          <TouchButton onClick={effacer} variant="danger">
            {lang === 'ar' ? 'مسح' : 'C'}
          </TouchButton>
        </div>
      )}

      {/* ─── Bouton principal Valider ─── */}
      <button
        onClick={enregistrerPresence}
        disabled={!eleveMatch || saisieLoading}
        style={{
          width: '100%',
          marginTop: 14,
          padding: '22px',
          fontSize: 20,
          fontWeight: 800,
          background: !eleveMatch
            ? '#e0e0d8'
            : saisieLoading
              ? '#888'
              : 'linear-gradient(135deg, #085041, #1D9E75)',
          color: !eleveMatch ? '#999' : '#fff',
          border: 'none',
          borderRadius: 16,
          cursor: (!eleveMatch || saisieLoading) ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'transform 0.08s',
          boxShadow: !eleveMatch ? 'none' : '0 4px 14px rgba(29,158,117,0.3)',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {saisieLoading
          ? (lang === 'ar' ? '...' : '...')
          : eleveMatch
            ? (lang === 'ar' ? '✓ تسجيل الحضور' : '✓ Valider la présence')
            : (lang === 'ar' ? 'أدخل رقمك' : 'Tape ton identifiant')
        }
      </button>

    </div>
  );
}

// ─── Bouton tactile réutilisable (pavé) ──────────────────────────────
// variant : 'default' | 'danger'
// size    : 'default' | 'small' (pour les lettres en grille 7x4)
function TouchButton({ children, onClick, variant = 'default', size = 'default' }) {
  const isDanger = variant === 'danger';
  const isSmall = size === 'small';
  const bg = isDanger ? '#FCEBEB' : '#fff';
  const color = isDanger ? '#E24B4A' : '#1a1a1a';
  const border = isDanger ? '1px solid #E24B4A30' : '1px solid #e0e0d8';
  return (
    <button
      onClick={onClick}
      style={{
        height: isSmall ? 44 : 62,
        background: bg,
        color,
        border,
        borderRadius: isSmall ? 8 : 12,
        fontSize: isSmall ? 15 : (isDanger ? 14 : 24),
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'transform 0.08s, background 0.12s',
        userSelect: 'none',
        padding: 0,
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; e.currentTarget.style.background = isDanger ? '#F5D7D7' : '#f0f0ec'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = bg; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = bg; }}
    >
      {children}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ONGLET SUIVI — dashboard de suivi (à coder dans l'étape 4/7)
// ══════════════════════════════════════════════════════════════════════

function OngletSuivi({ user, lang, navigate }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
        {lang === 'ar' ? 'قيد التطوير' : 'En cours de développement'}
      </div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
        {lang === 'ar'
          ? 'لوحة متابعة الحضور — قريبا'
          : 'Dashboard de suivi des présences — bientôt disponible'}
      </div>
    </div>
  );
}
