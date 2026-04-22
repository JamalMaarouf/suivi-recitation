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
  const [numero, setNumero] = useState('');           // numéro en cours de frappe
  const [eleves, setEleves] = useState([]);
  const [presencesToday, setPresencesToday] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saisieLoading, setSaisieLoading] = useState(false);
  const [flash, setFlash] = useState(null);  // { type:'success'|'warning'|'error', nom, message } → gros écran de retour visuel

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

  // ─── Pavé numérique : ajouter un chiffre ──────────────────────
  const appendChiffre = (c) => {
    if (numero.length >= 10) return;  // limite raisonnable
    setNumero(numero + c);
  };
  const effacer = () => setNumero('');
  const retourArriere = () => setNumero(numero.slice(0, -1));

  // ─── Recherche de l'élève correspondant au numéro tapé ────────
  // On cherche d'abord l'égalité exacte, sinon le début du numéro.
  const eleveMatch = !numero.trim() ? null : (
    eleves.find(e => (e.eleve_id_ecole || '').trim() === numero.trim())
    || eleves.find(e => (e.eleve_id_ecole || '').trim().startsWith(numero.trim()))
  );

  // ─── Affichage d'un écran de retour visuel temporaire ────────
  const showFlash = (type, nom, message) => {
    setFlash({ type, nom, message });
    // On efface le numéro pour enchaîner l'élève suivant
    setNumero('');
    // Masque le flash au bout de 2.5 secondes
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
      // 23505 = contrainte UNIQUE (race condition possible)
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
      maxWidth: 520,
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

      {/* ─── Écran affichant le numéro tapé ─── */}
      <div style={{
        background: '#1a1a1a',
        color: '#fff',
        borderRadius: 16,
        padding: '22px 20px',
        marginBottom: 12,
        minHeight: 110,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6, textAlign: 'center' }}>
          {lang === 'ar' ? 'رقم الطالب' : 'Numéro élève'}
        </div>
        <div style={{
          fontSize: 42,
          fontWeight: 800,
          textAlign: 'center',
          letterSpacing: 3,
          minHeight: 48,
          color: numero ? '#1D9E75' : '#555',
          fontFamily: 'monospace',
        }}>
          {numero || '—'}
        </div>
      </div>

      {/* ─── Affichage de l'élève trouvé (ou non) ─── */}
      {numero.trim() === '' ? (
        <div style={{
          padding: '16px',
          textAlign: 'center',
          color: '#888',
          fontSize: 13,
          minHeight: 70,
        }}>
          {lang === 'ar' ? '👇 أدخل رقم تعريفك' : '👇 Tape ton numéro'}
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
          minHeight: 70,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {lang === 'ar' ? '❌ لا يوجد طالب بهذا الرقم' : '❌ Aucun élève avec ce numéro'}
        </div>
      ) : (
        <div style={{
          background: presencesToday.has(eleveMatch.id) ? '#E1F5EE' : '#fff',
          border: presencesToday.has(eleveMatch.id)
            ? '2px solid #1D9E75'
            : '2px solid #1D9E75',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            minWidth: 54, height: 54, padding: '0 10px', borderRadius: 12,
            background: '#1D9E75', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, flexShrink: 0,
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

      {/* ─── Pavé numérique ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginTop: 14,
      }}>
        {['1','2','3','4','5','6','7','8','9'].map(c => (
          <TouchButton key={c} onClick={() => appendChiffre(c)} variant="default">
            {c}
          </TouchButton>
        ))}
        <TouchButton onClick={effacer} variant="danger">
          {lang === 'ar' ? 'مسح' : 'Effacer'}
        </TouchButton>
        <TouchButton onClick={() => appendChiffre('0')} variant="default">
          0
        </TouchButton>
        <TouchButton onClick={retourArriere} variant="default">
          ⌫
        </TouchButton>
      </div>

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
            : (lang === 'ar' ? 'أدخل رقمك' : 'Tape ton numéro')
        }
      </button>

    </div>
  );
}

// ─── Bouton tactile gros format pour pavé numérique ────────────────
function TouchButton({ children, onClick, variant = 'default' }) {
  const bg = variant === 'danger' ? '#FCEBEB' : '#fff';
  const color = variant === 'danger' ? '#E24B4A' : '#1a1a1a';
  const border = variant === 'danger' ? '1px solid #E24B4A30' : '1px solid #e0e0d8';
  return (
    <button
      onClick={onClick}
      style={{
        height: 62,
        background: bg,
        color,
        border,
        borderRadius: 12,
        fontSize: variant === 'danger' ? 14 : 24,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'transform 0.08s, background 0.12s',
        userSelect: 'none',
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; e.currentTarget.style.background = variant === 'danger' ? '#F5D7D7' : '#f0f0ec'; }}
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
