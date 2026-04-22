import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { t } from '../lib/i18n';

// ══════════════════════════════════════════════════════════════════════
// PAGE ASSIDUITÉ — الحضور
//
// DEUX INTERFACES DISTINCTES selon le support :
//
// 📱 MOBILE / TABLETTE  → mode KIOSQUE TACTILE
//    Clavier ABC/123/sym à l'écran, gros bouton Valider, flash plein écran
//    Cas d'usage : tablette murale à l'entrée, l'élève saisit lui-même
//
// 🖥️ ORDINATEUR         → interface CLASSIQUE style ListeNotes
//    Header standard + champ de recherche clavier + liste compacte
//    Cas d'usage : surveillant saisit à son bureau
//
// Feature retour surveillant 22/04/2026 (sujet 1/5 : Absences élèves)
// ══════════════════════════════════════════════════════════════════════

export default function Assiduite({ user, navigate, goBack, lang, isMobile }) {
  const [onglet, setOnglet] = useState('saisie');  // 'saisie' | 'suivi'

  // ─── Rendu MOBILE / TABLETTE : header vert plein largeur ──────
  if (isMobile) {
    return (
      <div style={{ background: '#f5f5f0', minHeight: '100vh', paddingBottom: 80 }}>
        <div style={{
          background: 'linear-gradient(135deg, #085041, #1D9E75)',
          color: '#fff',
          padding: '48px 16px 14px',
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

          {/* Onglets */}
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

        {onglet === 'saisie' && <SaisieKiosque user={user} lang={lang} />}
        {onglet === 'suivi'  && <SuiviPlaceholder lang={lang} />}
      </div>
    );
  }

  // ─── Rendu ORDINATEUR : header classique + onglets pilule ─────
  return (
    <div style={{ padding: '1.5rem', paddingBottom: 60, minHeight: 'auto' }}>

      {/* Header classique comme ListeNotes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
        <button onClick={() => goBack ? goBack() : navigate('dashboard')} className="back-link"></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>
            📅 {lang === 'ar' ? 'الحضور' : 'Assiduité'}
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {lang === 'ar' ? 'تسجيل و متابعة حضور الطلاب' : 'Saisie et suivi des présences'}
          </div>
        </div>
      </div>

      {/* Onglets en pilules (comme le sélecteur de période de ListeNotes) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {[
          { k: 'saisie', label: lang === 'ar' ? '✍️ تسجيل الحضور' : '✍️ Saisir présences' },
          { k: 'suivi',  label: lang === 'ar' ? '📊 متابعة'       : '📊 Suivi' },
        ].map(tab => {
          const active = onglet === tab.k;
          return (
            <button key={tab.k} onClick={() => setOnglet(tab.k)}
              style={{
                padding: '7px 16px', borderRadius: 20,
                border: `1px solid ${active ? '#1D9E75' : '#e0e0d8'}`,
                background: active ? '#E1F5EE' : '#fff',
                color: active ? '#085041' : '#666',
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {onglet === 'saisie' && <SaisieDesktop user={user} lang={lang} />}
      {onglet === 'suivi'  && <SuiviPlaceholder lang={lang} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// HOOK PARTAGÉ : charger élèves + présences du jour
// ══════════════════════════════════════════════════════════════════════
function useAssiduiteData(user) {
  const [eleves, setEleves] = useState([]);
  const [presencesToday, setPresencesToday] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

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

  return { eleves, presencesToday, setPresencesToday, loading, today, loadData };
}

// ══════════════════════════════════════════════════════════════════════
// ENREGISTREMENT (partagé desktop/mobile)
// Retourne { ok, alreadyPresent, error } pour que chaque UI adapte son feedback
// ══════════════════════════════════════════════════════════════════════
async function insertPresence({ eleveId, ecoleId, date, saisiPar }) {
  const { error } = await supabase.from('presences').insert({
    eleve_id: eleveId,
    ecole_id: ecoleId,
    date_presence: date,
    saisi_par: saisiPar || null,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, alreadyPresent: true, error: null };
    return { ok: false, alreadyPresent: false, error };
  }
  return { ok: true, alreadyPresent: false, error: null };
}

// ══════════════════════════════════════════════════════════════════════
// 📱 INTERFACE MOBILE / TABLETTE : KIOSQUE TACTILE
// ══════════════════════════════════════════════════════════════════════

function SaisieKiosque({ user, lang }) {
  const { eleves, presencesToday, setPresencesToday, loading, today } = useAssiduiteData(user);
  const [idTape, setIdTape] = useState('');
  const [clavierMode, setClavierMode] = useState('abc');
  const [saisieLoading, setSaisieLoading] = useState(false);
  const [flash, setFlash] = useState(null);

  const appendChar = (c) => { if (idTape.length < 20) setIdTape(idTape + c); };
  const effacer = () => setIdTape('');
  const retourArriere = () => setIdTape(idTape.slice(0, -1));

  const idNormalise = idTape.trim().toLowerCase();
  const eleveMatch = !idNormalise ? null : (
    eleves.find(e => (e.eleve_id_ecole || '').trim().toLowerCase() === idNormalise)
    || eleves.find(e => (e.eleve_id_ecole || '').trim().toLowerCase().startsWith(idNormalise))
  );

  const showFlash = (type, nom, message) => {
    setFlash({ type, nom, message });
    setIdTape('');
    setTimeout(() => setFlash(null), 2500);
  };

  const enregistrer = async () => {
    if (!eleveMatch) return;
    const nomComplet = `${eleveMatch.prenom || ''} ${eleveMatch.nom || ''}`.trim();
    if (presencesToday.has(eleveMatch.id)) {
      showFlash('warning', nomComplet, lang === 'ar' ? 'الحضور مسجل مسبقا اليوم' : 'Présence déjà enregistrée aujourd\'hui');
      return;
    }
    setSaisieLoading(true);
    const res = await insertPresence({ eleveId: eleveMatch.id, ecoleId: user.ecole_id, date: today, saisiPar: user.id });
    setSaisieLoading(false);
    if (res.alreadyPresent) {
      setPresencesToday(prev => new Set([...prev, eleveMatch.id]));
      showFlash('warning', nomComplet, lang === 'ar' ? 'الحضور مسجل مسبقا اليوم' : 'Présence déjà enregistrée aujourd\'hui');
      return;
    }
    if (res.error) {
      console.error('[Kiosque] Erreur insert:', res.error);
      showFlash('error', nomComplet, (lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + res.error.message);
      return;
    }
    setPresencesToday(prev => new Set([...prev, eleveMatch.id]));
    showFlash('success', nomComplet, lang === 'ar' ? 'تم تسجيل الحضور' : 'Présence enregistrée');
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}</div>;

  if (flash) {
    const colors = {
      success: { bg: '#1D9E75', icon: '✅' },
      warning: { bg: '#EF9F27', icon: '⚠️' },
      error:   { bg: '#E24B4A', icon: '❌' },
    };
    const c = colors[flash.type];
    return (
      <div style={{
        minHeight: 'calc(100vh - 180px)', background: c.bg, color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 30, textAlign: 'center', animation: 'flashIn 0.25s ease',
      }}>
        <style>{`@keyframes flashIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }`}</style>
        <div style={{ fontSize: 120, marginBottom: 20, lineHeight: 1 }}>{c.icon}</div>
        <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, maxWidth: 500 }}>{flash.nom}</div>
        <div style={{ fontSize: 20, opacity: 0.95, maxWidth: 500 }}>{flash.message}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 14px 30px', maxWidth: 560, margin: '0 auto' }}>

      {/* Compteur du jour */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '12px 16px', marginBottom: 14,
        border: '1px solid #e0e0d8', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: '#E1F5EE', color: '#085041',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>✓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#888' }}>{lang === 'ar' ? 'الحضور اليوم' : 'Présences aujourd\'hui'}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>
            {presencesToday.size} <span style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>/ {eleves.length}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#888', textAlign: 'right' }}>
          {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { weekday: 'long', day: '2-digit', month: 'short' })}
        </div>
      </div>

      {/* Écran vert foncé affichant l'ID tapé */}
      <div style={{
        background: 'linear-gradient(135deg, #0a3d30, #0f5d45)', color: '#fff',
        borderRadius: 16, padding: '22px 20px', marginBottom: 12, minHeight: 110,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, textAlign: 'center', letterSpacing: 1 }}>
          {lang === 'ar' ? 'رقم تعريف الطالب' : 'IDENTIFIANT ÉLÈVE'}
        </div>
        <div style={{
          fontSize: 38, fontWeight: 800, textAlign: 'center', letterSpacing: 2,
          minHeight: 48, color: idTape ? '#7FE3BC' : 'rgba(255,255,255,0.3)',
          fontFamily: 'monospace', wordBreak: 'break-all',
        }}>{idTape || '—'}</div>
      </div>

      {/* Résultat élève */}
      {idTape.trim() === '' ? (
        <div style={{ padding: 12, textAlign: 'center', color: '#888', fontSize: 13, minHeight: 60 }}>
          {lang === 'ar' ? '👇 أدخل رقم تعريفك' : '👇 Tape ton identifiant'}
        </div>
      ) : !eleveMatch ? (
        <div style={{
          background: '#FCEBEB', borderRadius: 12, padding: 14, marginBottom: 4,
          textAlign: 'center', color: '#A32D2D', fontSize: 14, fontWeight: 600,
          border: '1px solid #E24B4A40', minHeight: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {lang === 'ar' ? '❌ لا يوجد طالب بهذا الرقم' : '❌ Aucun élève avec cet identifiant'}
        </div>
      ) : (
        <div style={{
          background: presencesToday.has(eleveMatch.id) ? '#E1F5EE' : '#fff',
          border: '2px solid #1D9E75', borderRadius: 14, padding: '14px 16px',
          marginBottom: 4, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            minWidth: 54, maxWidth: 120, height: 54, padding: '0 10px', borderRadius: 12,
            background: '#1D9E75', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, flexShrink: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{eleveMatch.eleve_id_ecole || '—'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{eleveMatch.prenom} {eleveMatch.nom}</div>
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

      {/* Sélecteur mode clavier */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, marginBottom: 8 }}>
        {[
          { k: 'abc', label: 'ABC' },
          { k: 'num', label: '123' },
          { k: 'sym', label: '.–_/' },
        ].map(m => {
          const active = clavierMode === m.k;
          return (
            <button key={m.k} onClick={() => setClavierMode(m.k)}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10,
                background: active ? '#1D9E75' : '#fff',
                color: active ? '#fff' : '#666',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: active ? 'none' : '1px solid #e0e0d8',
              }}>{m.label}</button>
          );
        })}
      </div>

      {/* Claviers selon mode */}
      {clavierMode === 'num' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['1','2','3','4','5','6','7','8','9'].map(c => <TouchButton key={c} onClick={() => appendChar(c)}>{c}</TouchButton>)}
          <TouchButton onClick={effacer} variant="danger">{lang === 'ar' ? 'مسح' : 'C'}</TouchButton>
          <TouchButton onClick={() => appendChar('0')}>0</TouchButton>
          <TouchButton onClick={retourArriere}>⌫</TouchButton>
        </div>
      )}
      {clavierMode === 'abc' && (
        <div>
          {[['A','B','C','D','E','F','G'],['H','I','J','K','L','M','N'],['O','P','Q','R','S','T','U']].map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 5 }}>
              {row.map(c => <TouchButton key={c} size="small" onClick={() => appendChar(c)}>{c}</TouchButton>)}
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
            {['V','W','X','Y','Z'].map(c => <TouchButton key={c} size="small" onClick={() => appendChar(c)}>{c}</TouchButton>)}
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
          <TouchButton onClick={effacer} variant="danger">{lang === 'ar' ? 'مسح' : 'C'}</TouchButton>
        </div>
      )}

      {/* Bouton principal Valider */}
      <button onClick={enregistrer} disabled={!eleveMatch || saisieLoading}
        style={{
          width: '100%', marginTop: 14, padding: 22, fontSize: 20, fontWeight: 800,
          background: !eleveMatch ? '#e0e0d8' : saisieLoading ? '#888' : 'linear-gradient(135deg, #085041, #1D9E75)',
          color: !eleveMatch ? '#999' : '#fff', border: 'none', borderRadius: 16,
          cursor: (!eleveMatch || saisieLoading) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          transition: 'transform 0.08s', boxShadow: !eleveMatch ? 'none' : '0 4px 14px rgba(29,158,117,0.3)',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        {saisieLoading ? '...' : eleveMatch
          ? (lang === 'ar' ? '✓ تسجيل الحضور' : '✓ Valider la présence')
          : (lang === 'ar' ? 'أدخل رقمك' : 'Tape ton identifiant')}
      </button>
    </div>
  );
}

// Bouton tactile réutilisable
function TouchButton({ children, onClick, variant = 'default', size = 'default' }) {
  const isDanger = variant === 'danger';
  const isSmall = size === 'small';
  const bg = isDanger ? '#FCEBEB' : '#fff';
  const color = isDanger ? '#E24B4A' : '#1a1a1a';
  const border = isDanger ? '1px solid #E24B4A30' : '1px solid #e0e0d8';
  return (
    <button onClick={onClick}
      style={{
        height: isSmall ? 44 : 62, background: bg, color, border,
        borderRadius: isSmall ? 8 : 12,
        fontSize: isSmall ? 15 : (isDanger ? 14 : 24),
        fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'transform 0.08s, background 0.12s', userSelect: 'none', padding: 0,
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; e.currentTarget.style.background = isDanger ? '#F5D7D7' : '#f0f0ec'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = bg; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = bg; }}>
      {children}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 🖥️ INTERFACE ORDINATEUR : recherche clavier + liste compacte
// ══════════════════════════════════════════════════════════════════════

function SaisieDesktop({ user, lang }) {
  const { toast } = useToast();
  const { eleves, presencesToday, setPresencesToday, loading, today } = useAssiduiteData(user);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous'); // 'tous' | 'presents' | 'absents'
  const [saisieLoadingId, setSaisieLoadingId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { if (!loading && inputRef.current) inputRef.current.focus(); }, [loading]);

  // Filtre sur recherche + statut
  const r = recherche.trim().toLowerCase();
  const filtered = eleves.filter(e => {
    // Filtre texte
    if (r) {
      const num = (e.eleve_id_ecole || '').toLowerCase();
      const nom = `${e.prenom || ''} ${e.nom || ''}`.toLowerCase();
      if (!num.includes(r) && !nom.includes(r)) return false;
    }
    // Filtre statut
    const present = presencesToday.has(e.id);
    if (filtreStatut === 'presents' && !present) return false;
    if (filtreStatut === 'absents'  &&  present) return false;
    return true;
  });

  const validerPresence = async (eleve) => {
    if (presencesToday.has(eleve.id)) {
      toast.warning(lang === 'ar' ? '⚠️ الحضور مسجل مسبقا' : '⚠️ Présence déjà enregistrée');
      return;
    }
    setSaisieLoadingId(eleve.id);
    const res = await insertPresence({ eleveId: eleve.id, ecoleId: user.ecole_id, date: today, saisiPar: user.id });
    setSaisieLoadingId(null);
    if (res.alreadyPresent) {
      setPresencesToday(prev => new Set([...prev, eleve.id]));
      toast.warning(lang === 'ar' ? '⚠️ الحضور مسجل مسبقا' : '⚠️ Présence déjà enregistrée');
      return;
    }
    if (res.error) {
      console.error('[Desktop] Erreur insert:', res.error);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + res.error.message);
      return;
    }
    setPresencesToday(prev => new Set([...prev, eleve.id]));
    toast.success(lang === 'ar'
      ? `✅ تم تسجيل حضور ${eleve.prenom} ${eleve.nom}`
      : `✅ Présence enregistrée : ${eleve.prenom} ${eleve.nom}`);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}</div>;

  return (
    <div>

      {/* Barre de stats compacte */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatCard label={lang === 'ar' ? 'الحاضرون' : 'Présents'} value={presencesToday.size} color="#1D9E75" bg="#E1F5EE" />
        <StatCard label={lang === 'ar' ? 'الغائبون' : 'Absents'}  value={eleves.length - presencesToday.size} color="#E24B4A" bg="#FCEBEB" />
        <StatCard label={lang === 'ar' ? 'المجموع' : 'Total'}    value={eleves.length} color="#0C447C" bg="#E6F1FB" />
        <div style={{ flex: 1 }}></div>
        <div style={{
          alignSelf: 'center', padding: '8px 14px', background: '#f5f5f0',
          borderRadius: 8, fontSize: 12, color: '#666', fontWeight: 500,
        }}>
          📅 {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Recherche + filtre statut */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input ref={inputRef}
          type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder={lang === 'ar' ? '🔍 ابحث برقم أو اسم الطالب' : '🔍 Chercher par numéro ou nom'}
          style={{
            flex: '1 1 260px', padding: '10px 14px', fontSize: 14,
            borderRadius: 10, border: '1px solid #e0e0d8', background: '#fff',
            fontFamily: 'inherit', outline: 'none', minWidth: 200,
          }}/>
        {[
          { k: 'tous',     label: lang === 'ar' ? 'الكل' : 'Tous' },
          { k: 'absents',  label: lang === 'ar' ? 'الغائبون' : 'Absents' },
          { k: 'presents', label: lang === 'ar' ? 'الحاضرون' : 'Présents' },
        ].map(f => {
          const active = filtreStatut === f.k;
          return (
            <button key={f.k} onClick={() => setFiltreStatut(f.k)}
              style={{
                padding: '7px 14px', borderRadius: 20,
                border: `1px solid ${active ? '#378ADD' : '#e0e0d8'}`,
                background: active ? '#E6F1FB' : '#fff',
                color: active ? '#378ADD' : '#666',
                fontSize: 12, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{f.label}</button>
          );
        })}
      </div>

      {/* Liste des élèves */}
      {filtered.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', color: '#888',
          background: '#fff', borderRadius: 12, border: '1px dashed #ccc',
        }}>
          {r
            ? (lang === 'ar' ? '❌ لا يوجد طالب مطابق' : '❌ Aucun élève ne correspond')
            : (lang === 'ar' ? 'لا يوجد طلاب' : 'Aucun élève')}
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: 12, overflow: 'hidden',
          border: '1px solid #e0e0d8',
        }}>
          {filtered.map((eleve, idx) => {
            const present = presencesToday.has(eleve.id);
            const enCours = saisieLoadingId === eleve.id;
            return (
              <div key={eleve.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid #f0f0ec',
                background: present ? '#F7FDF9' : '#fff',
              }}>
                {/* Numéro */}
                <div style={{
                  minWidth: 60, padding: '6px 10px', borderRadius: 8,
                  background: present ? '#1D9E75' : '#E1F5EE',
                  color: present ? '#fff' : '#085041',
                  fontSize: 12, fontWeight: 700, textAlign: 'center',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{eleve.eleve_id_ecole || '—'}</div>

                {/* Nom + niveau */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                    {eleve.prenom} {eleve.nom}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {eleve.code_niveau || '—'}
                  </div>
                </div>

                {/* Statut + action */}
                {present ? (
                  <div style={{
                    padding: '6px 12px', background: '#E1F5EE', color: '#085041',
                    borderRadius: 8, fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>✓ {lang === 'ar' ? 'حاضر' : 'Présent'}</div>
                ) : (
                  <button disabled={enCours} onClick={() => validerPresence(eleve)}
                    style={{
                      padding: '7px 14px', background: enCours ? '#888' : '#1D9E75',
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontSize: 12, fontWeight: 700,
                      cursor: enCours ? 'wait' : 'pointer',
                      fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                    {enCours ? '...' : (lang === 'ar' ? '✓ تسجيل' : '✓ Valider')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Petite carte statistique pour le header desktop
function StatCard({ label, value, color, bg }) {
  return (
    <div style={{
      background: bg, padding: '10px 18px', borderRadius: 10,
      border: `1px solid ${color}25`, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    }}>
      <div style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// PLACEHOLDER onglet Suivi (étape 4/7)
// ══════════════════════════════════════════════════════════════════════
function SuiviPlaceholder({ lang }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#888' }}>
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
