import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { t } from '../lib/i18n';
import KioskExitModal from '../components/KioskExitModal';
import ConfirmModal from '../components/ConfirmModal';

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

export default function Assiduite({ user, navigate, goBack, lang, isMobile, kioskMode, enterKiosk, exitKiosk }) {
  const [onglet, setOnglet] = useState('saisie');  // 'saisie' | 'suivi'
  const [showExitModal, setShowExitModal] = useState(false);  // popup PIN de sortie kiosque
  // Modal generique pour info/confirmation (remplace window.confirm et alert
  // qui sont laids et pas coherents avec le design de l'app).
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmLabel: null, cancelLabel: null, confirmColor: null, hideCancel: false });
  const closeModal = () => setModal(m => ({ ...m, isOpen: false }));

  // Active le kiosque APRES vérification qu'un PIN est bien configuré.
  // Sans PIN, on ne peut pas sortir → on bloque l'activation avec un message.
  const askActivateKiosk = async () => {
    if (!user?.ecole_id) return;
    const { data } = await supabase.from('ecoles')
      .select('pin_kiosque')
      .eq('id', user.ecole_id)
      .maybeSingle();
    if (!data?.pin_kiosque) {
      // Pas de PIN configure : modal d'info avec bouton unique 'Compris'
      setModal({
        isOpen: true,
        title: lang === 'ar' ? '⚠️ الرمز غير محدد' : '⚠️ PIN non défini',
        message: lang === 'ar'
          ? 'يجب أولاً تعريف رمز الكشك في : الإعدادات ← الحضور ← قسم رمز وضع الكشك'
          : 'Tu dois d\'abord définir un PIN dans : Paramètres → Assiduité → section PIN mode kiosque',
        onConfirm: () => { closeModal(); navigate('gestion_assiduite'); },
        confirmLabel: lang === 'ar' ? '📝 الذهاب إلى الإعدادات' : '📝 Aller aux paramètres',
        cancelLabel: lang === 'ar' ? 'إغلاق' : 'Fermer',
        confirmColor: '#1D9E75',
      });
      return;
    }
    // PIN configure : modal de confirmation avant activation
    setModal({
      isOpen: true,
      title: lang === 'ar' ? '🔒 تفعيل وضع الكشك' : '🔒 Activer le mode kiosque',
      message: lang === 'ar'
        ? 'سيتم قفل الوصول إلى القوائم الأخرى (المالية، الإدارة...). للخروج ستحتاج إلى إدخال الرمز. هل تريد المتابعة؟'
        : 'L\'accès aux autres menus (Finance, Gestion...) sera verrouillé. Pour sortir, il faudra saisir le PIN. Continuer ?',
      onConfirm: () => { closeModal(); enterKiosk(); },
      confirmLabel: lang === 'ar' ? '🔒 تفعيل' : '🔒 Activer',
      cancelLabel: lang === 'ar' ? 'إلغاء' : 'Annuler',
      confirmColor: '#EF9F27',
    });
  };

  const handleExitValidate = async (pin) => {
    return await exitKiosk(pin);  // retourne true/false
  };

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
            {!kioskMode && (
              <button onClick={() => goBack ? goBack() : navigate('dashboard')}
                style={{
                  width: 38, height: 38,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none', borderRadius: 10, padding: 0, flexShrink: 0,
                  color: '#fff', fontSize: 18, cursor: 'pointer',
                }}>←</button>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
                {lang === 'ar' ? '📅 الحضور' : '📅 Assiduité'}
                {kioskMode && (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 700,
                    background: 'rgba(255,255,255,0.25)', padding: '2px 8px',
                    borderRadius: 10, verticalAlign: 'middle',
                  }}>🔒 {lang === 'ar' ? 'كشك' : 'KIOSQUE'}</span>
                )}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                {lang === 'ar' ? 'تسجيل و متابعة حضور الطلاب' : 'Saisie et suivi des présences'}
              </div>
            </div>
            {/* Bouton kiosque */}
            {kioskMode ? (
              <button onClick={() => setShowExitModal(true)}
                style={{
                  padding: '8px 12px',
                  background: '#EF9F27', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  flexShrink: 0, fontFamily: 'inherit',
                }}>🔓</button>
            ) : (
              <button onClick={() => askActivateKiosk()}
                title={lang === 'ar' ? 'تفعيل وضع الكشك' : 'Activer mode kiosque'}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.2)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  flexShrink: 0, fontFamily: 'inherit',
                }}>🔒</button>
            )}
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
        {onglet === 'suivi'  && <SuiviPlaceholder lang={lang} user={user} isMobile={true} />}

        {/* Popup PIN de sortie kiosque (mobile) */}
        <KioskExitModal
          isOpen={showExitModal}
          onClose={() => setShowExitModal(false)}
          onValidate={handleExitValidate}
          lang={lang}
        />

        {/* Modal generique (info / confirmation) */}
        <ConfirmModal
          isOpen={modal.isOpen}
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm || closeModal}
          onCancel={closeModal}
          confirmLabel={modal.confirmLabel}
          cancelLabel={modal.cancelLabel}
          confirmColor={modal.confirmColor}
          lang={lang}
        />
      </div>
    );
  }

  // ─── Rendu ORDINATEUR : header classique + onglets pilule ─────
  return (
    <div style={{ padding: '1.5rem', paddingBottom: 60, minHeight: 'auto' }}>

      {/* Header classique comme ListeNotes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
        {!kioskMode && (
          <button onClick={() => goBack ? goBack() : navigate('dashboard')} className="back-link"></button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            📅 {lang === 'ar' ? 'الحضور' : 'Assiduité'}
            {kioskMode && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: '#FAEEDA', color: '#633806',
                padding: '3px 10px', borderRadius: 12,
                border: '1px solid #EF9F2750',
              }}>🔒 {lang === 'ar' ? 'وضع الكشك مفعل' : 'Mode kiosque activé'}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {lang === 'ar' ? 'تسجيل و متابعة حضور الطلاب' : 'Saisie et suivi des présences'}
          </div>
        </div>
        {/* Bouton kiosque */}
        {kioskMode ? (
          <button onClick={() => setShowExitModal(true)}
            style={{
              padding: '8px 16px',
              background: '#EF9F27', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0,
            }}>
            🔓 {lang === 'ar' ? 'خروج' : 'Quitter kiosque'}
          </button>
        ) : (
          <button onClick={askActivateKiosk}
            title={lang === 'ar' ? 'تفعيل وضع الكشك' : 'Activer mode kiosque'}
            style={{
              padding: '8px 14px',
              background: '#fff', color: '#085041',
              border: '1px solid #1D9E7540', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0,
            }}>
            🔒 {lang === 'ar' ? 'وضع الكشك' : 'Mode kiosque'}
          </button>
        )}
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
      {onglet === 'suivi'  && <SuiviPlaceholder lang={lang} user={user} />}

      {/* Popup PIN de sortie kiosque (desktop) */}
      <KioskExitModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onValidate={handleExitValidate}
        lang={lang}
      />

      {/* Modal generique (info / confirmation) */}
      <ConfirmModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm || closeModal}
        onCancel={closeModal}
        confirmLabel={modal.confirmLabel}
        cancelLabel={modal.cancelLabel}
        confirmColor={modal.confirmColor}
        lang={lang}
      />
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

  // Date d'aujourd'hui au format YYYY-MM-DD en HEURE LOCALE
  // (pas toISOString() qui convertit en UTC et décale d'un jour selon le fuseau)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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

// ─── KpiCard : carte KPI cliquable et élégante pour le dashboard Suivi ──────
// Features : hover + active visuel, hint en sous-titre, mode 'big' pour le KPI phare
function KpiCard({ label, value, hint, color, bg, onClick, active, big }) {
  const clickable = typeof onClick === 'function';
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        background: active ? color : bg,
        padding: big ? '14px 18px' : '12px 16px',
        borderRadius: 12,
        border: `1.5px solid ${active ? color : color + '30'}`,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.08s, box-shadow 0.15s, background 0.15s',
        boxShadow: active ? `0 4px 14px ${color}40` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        minWidth: 0,
        position: 'relative',
      }}
      onMouseEnter={e => { if (clickable && !active) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 10px ${color}25`; } }}
      onMouseLeave={e => { if (clickable && !active) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } }}
    >
      <div style={{
        fontSize: 11,
        color: active ? '#fff' : '#666',
        fontWeight: 600,
        opacity: active ? 0.9 : 1,
        marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: big ? 32 : 26,
        fontWeight: 800,
        color: active ? '#fff' : color,
        lineHeight: 1.1,
      }}>{value}</div>
      {hint && (
        <div style={{
          fontSize: 10,
          color: active ? '#fff' : '#888',
          opacity: active ? 0.85 : 1,
          marginTop: 3,
        }}>{hint}</div>
      )}
      {clickable && !active && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          fontSize: 10, color: color, opacity: 0.5,
        }}>👆</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ONGLET SUIVI — dashboard de suivi des présences
//
// Affiche les stats d'assiduité par élève sur une période donnée.
// Calcul : pour chaque jour de la période qui tombe sur un jour souhaité
// de l'élève, on verifie si une presence existe. Les jours non travailles
// (jours_non_travailles de l'ecole) sont exclus du calcul.
// ══════════════════════════════════════════════════════════════════════
function SuiviPlaceholder({ lang, user, isMobile }) {
  return <OngletSuivi lang={lang} user={user} isMobile={isMobile} />;
}

function OngletSuivi({ lang, user, isMobile }) {
  const [loading, setLoading] = useState(true);
  const [eleves, setEleves] = useState([]);
  const [presences, setPresences] = useState([]);         // toutes les presences sur la periode
  const [joursNonTravailles, setJoursNonTravailles] = useState([]); // periodes fériées/vacances
  const [niveaux, setNiveaux] = useState([]);
  // Seuils d'assiduité chargés depuis la table ecoles (paramétrables par école)
  // Défauts 80/100 si jamais rien n'est lu (compatibilité avec écoles créées avant l'étape 5)
  const [SEUIL_RISQUE, setSEUIL_RISQUE] = useState(80);
  const [SEUIL_PARFAIT, setSEUIL_PARFAIT] = useState(100);

  // Filtres
  const [periode, setPeriode] = useState('mois');         // 'semaine'|'mois'|'trimestre'|'semestre'|'annee'|'custom'
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [recherche, setRecherche] = useState('');
  const [eleveDetail, setEleveDetail] = useState(null);   // id de l'élève dont on montre le détail
  const [filtreKpi, setFiltreKpi] = useState(null);       // null | 'risque' | 'parfait' — filtre actif depuis un clic KPI

  // ─── Calcul des bornes de la periode ─────────────────────────
  const { debut, fin } = calcBornesPeriode(periode, dateDebut, dateFin);

  // ─── Chargement initial des elèves + niveaux + jours non travailles + seuils ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [elevesRes, niveauxRes, jntRes, ecoleRes] = await Promise.all([
        supabase.from('eleves')
          .select('id, prenom, nom, eleve_id_ecole, code_niveau, jours_souhaites')
          .eq('ecole_id', user.ecole_id)
          .order('nom'),
        supabase.from('niveaux')
          .select('code, nom')
          .eq('ecole_id', user.ecole_id)
          .order('ordre'),
        supabase.from('jours_non_travailles')
          .select('date_debut, date_fin, label')
          .eq('ecole_id', user.ecole_id),
        supabase.from('ecoles')
          .select('seuil_assiduite_risque, seuil_assiduite_parfait')
          .eq('id', user.ecole_id)
          .maybeSingle(),
      ]);
      setEleves(elevesRes.data || []);
      setNiveaux(niveauxRes.data || []);
      setJoursNonTravailles(jntRes.data || []);
      // Seuils : si renseignés dans la base, on les utilise, sinon on garde les défauts 80/100
      if (ecoleRes.data) {
        if (typeof ecoleRes.data.seuil_assiduite_risque === 'number') {
          setSEUIL_RISQUE(ecoleRes.data.seuil_assiduite_risque);
        }
        if (typeof ecoleRes.data.seuil_assiduite_parfait === 'number') {
          setSEUIL_PARFAIT(ecoleRes.data.seuil_assiduite_parfait);
        }
      }
      setLoading(false);
    };
    load();
  }, [user.ecole_id]);

  // ─── Chargement des presences pour la periode ────────────────
  useEffect(() => {
    if (!debut || !fin) return;
    const loadPres = async () => {
      const { data } = await supabase.from('presences')
        .select('eleve_id, date_presence')
        .eq('ecole_id', user.ecole_id)
        .gte('date_presence', debut)
        .lte('date_presence', fin);
      setPresences(data || []);
    };
    loadPres();
  }, [user.ecole_id, debut, fin]);

  // ─── Calcul des stats par elève ─────────────────────────────
  // Pour chaque eleve : nb seances attendues, nb presences, nb absences, liste des dates absences
  const statsParEleve = React.useMemo(() => {
    if (!debut || !fin) return {};
    const result = {};
    // Construction de l'ensemble des dates non travaillees (YYYY-MM-DD)
    const datesNonTravailles = new Set();
    // Helper pour ISO local (fix fuseau horaire)
    const toIsoLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    joursNonTravailles.forEach(p => {
      const d1 = new Date(p.date_debut);
      const d2 = new Date(p.date_fin);
      for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
        datesNonTravailles.add(toIsoLocal(d));
      }
    });
    // Regrouper les presences par eleve
    const presParEleve = {};
    presences.forEach(p => {
      if (!presParEleve[p.eleve_id]) presParEleve[p.eleve_id] = new Set();
      presParEleve[p.eleve_id].add(p.date_presence);
    });
    // Pour chaque eleve, iterer sur chaque jour de la periode
    const d1 = new Date(debut);
    const d2 = new Date(fin);
    eleves.forEach(e => {
      const jours = Array.isArray(e.jours_souhaites) ? e.jours_souhaites : [false, false, false, false, false, false, false];
      const aDesJours = jours.some(j => j === true);
      const presEleve = presParEleve[e.id] || new Set();
      let attendues = 0, presentes = 0;
      const datesAbsences = [];
      // Helper local qui utilise les composants LOCAUX (évite le bug fuseau horaire UTC)
      const isoLocal = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };
      if (aDesJours) {
        for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
          const iso = isoLocal(d);
          if (datesNonTravailles.has(iso)) continue;  // jour ferie
          // getDay() : 0=Dim, 1=Lun, 2=Mar, 3=Mer, 4=Jeu, 5=Ven, 6=Sam
          // jours_souhaites ordre : [Sam, Dim, Lun, Mar, Mer, Jeu, Ven]
          const mapDayToIdx = [1, 2, 3, 4, 5, 6, 0]; // Dim→1, Lun→2, ..., Sam→0
          const idx = mapDayToIdx[d.getDay()];
          if (!jours[idx]) continue;  // pas un jour souhaite pour cet eleve
          attendues++;
          if (presEleve.has(iso)) presentes++;
          else datesAbsences.push(iso);
        }
      }
      result[e.id] = {
        aDesJours,
        attendues,
        presentes,
        absences: attendues - presentes,
        taux: attendues > 0 ? Math.round((presentes / attendues) * 100) : null,
        datesAbsences,
      };
    });
    return result;
  }, [eleves, presences, joursNonTravailles, debut, fin]);

  // ─── Stats globales ───────────────────────────────────────────
  // Inclut : totaux de séances + compteurs d'élèves par catégorie d'assiduité
  // Seuils lus depuis la table ecoles (paramétrage école) ou défauts 80/100
  const globalStats = React.useMemo(() => {
    let attendues = 0, presentes = 0;
    let nbRisque = 0, nbParfaits = 0, nbSansJours = 0, nbAvecJours = 0;
    Object.values(statsParEleve).forEach(s => {
      attendues += s.attendues;
      presentes += s.presentes;
      if (!s.aDesJours) {
        nbSansJours++;
      } else {
        nbAvecJours++;
        // Un élève "à risque" est un élève avec des jours déclarés ET un taux < seuil
        if (s.taux !== null && s.taux < SEUIL_RISQUE) nbRisque++;
        // Un élève "parfait" a un taux de 100% (et au moins 1 séance attendue)
        if (s.taux !== null && s.taux >= SEUIL_PARFAIT && s.attendues > 0) nbParfaits++;
      }
    });
    return {
      attendues, presentes,
      absences: attendues - presentes,
      taux: attendues > 0 ? Math.round((presentes / attendues) * 100) : 0,
      nbRisque, nbParfaits, nbSansJours, nbAvecJours,
    };
  }, [statsParEleve, SEUIL_RISQUE, SEUIL_PARFAIT]);

  // ─── Filtre + tri des elèves ─────────────────────────────────
  const r = recherche.trim().toLowerCase();
  const filtered = eleves.filter(e => {
    if (filtreNiveau && e.code_niveau !== filtreNiveau) return false;
    if (r) {
      const num = (e.eleve_id_ecole || '').toLowerCase();
      const nom = `${e.prenom || ''} ${e.nom || ''}`.toLowerCase();
      if (!num.includes(r) && !nom.includes(r)) return false;
    }
    // Filtre KPI : si un KPI est cliqué, on filtre la liste en conséquence
    if (filtreKpi) {
      const s = statsParEleve[e.id];
      if (!s) return false;
      if (filtreKpi === 'risque') {
        // Élèves avec jours déclarés ET taux < seuil
        if (!s.aDesJours || s.taux === null || s.taux >= SEUIL_RISQUE) return false;
      }
      if (filtreKpi === 'parfait') {
        // Élèves avec jours déclarés ET taux = 100% ET au moins 1 séance
        if (!s.aDesJours || s.taux === null || s.taux < SEUIL_PARFAIT || s.attendues === 0) return false;
      }
      if (filtreKpi === 'absences') {
        // Élèves ayant au moins 1 absence
        if (!s.aDesJours || s.absences === 0) return false;
      }
    }
    return true;
  }).sort((a, b) => {
    const sa = statsParEleve[a.id] || { absences: 0, aDesJours: false };
    const sb = statsParEleve[b.id] || { absences: 0, aDesJours: false };
    // Les eleves sans jours declares sont en bas
    if (!sa.aDesJours && sb.aDesJours) return 1;
    if (sa.aDesJours && !sb.aDesJours) return -1;
    // Ensuite par nombre d'absences décroissant
    return sb.absences - sa.absences;
  });

  const PERIODES = [
    { id: 'semaine',   label: lang === 'ar' ? 'الأسبوع'      : 'Semaine' },
    { id: 'mois',      label: lang === 'ar' ? 'الشهر'         : 'Mois' },
    { id: 'trimestre', label: lang === 'ar' ? 'الفصل (3 أشهر)': 'Trimestre' },
    { id: 'semestre',  label: lang === 'ar' ? 'النصف (6 أشهر)': 'Semestre' },
    { id: 'annee',     label: lang === 'ar' ? 'السنة'         : 'Année' },
    { id: 'custom',    label: lang === 'ar' ? 'فترة محددة'    : 'Personnalisée' },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}</div>;

  return (
    <div style={{ padding: isMobile ? '14px' : 0 }}>

      {/* Sélecteur période */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {PERIODES.map(p => {
          const active = periode === p.id;
          return (
            <button key={p.id} onClick={() => setPeriode(p.id)}
              style={{
                padding: isMobile ? '7px 12px' : '6px 14px',
                borderRadius: 20,
                border: `1px solid ${active ? '#1D9E75' : '#e0e0d8'}`,
                background: active ? '#E1F5EE' : '#fff',
                color: active ? '#085041' : '#888',
                fontSize: isMobile ? 11 : 12,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{p.label}</button>
          );
        })}
      </div>

      {/* Dates personnalisees */}
      {periode === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 13 }} />
          <span style={{ alignSelf: 'center', color: '#888' }}>→</span>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 13 }} />
        </div>
      )}

      {/* Affichage de la période calculée */}
      <div style={{ fontSize: 11, color: '#888', marginBottom: 14 }}>
        {debut && fin ? (
          lang === 'ar'
            ? `من ${formatDateAr(debut)} إلى ${formatDateAr(fin)}`
            : `Du ${formatDateFr(debut)} au ${formatDateFr(fin)}`
        ) : (
          lang === 'ar' ? 'اختر فترة' : 'Choisir une période'
        )}
      </div>

      {/* ─── KPIs globaux (cliquables) ─── */}
      {/* Mobile : grille fixe 2x2 (meilleure visibilité sur petit écran).
          Desktop : auto-fit avec minmax pour s'adapter à la largeur. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: isMobile ? 8 : 10,
        marginBottom: 14,
      }}>

        {/* KPI 1 : Taux global — non cliquable, gros chiffre */}
        <KpiCard
          label={lang === 'ar' ? 'نسبة الحضور' : 'Taux de présence'}
          value={`${globalStats.taux}%`}
          hint={lang === 'ar'
            ? `${globalStats.presentes}/${globalStats.attendues} حصة`
            : `${globalStats.presentes}/${globalStats.attendues} séances`}
          color="#534AB7" bg="#EDE9FE"
          big={true}
        />

        {/* KPI 2 : Élèves à risque — cliquable */}
        <KpiCard
          label={lang === 'ar' ? `طلاب في خطر (<${SEUIL_RISQUE}%)` : `À risque (<${SEUIL_RISQUE}%)`}
          value={globalStats.nbRisque}
          hint={lang === 'ar' ? 'يحتاجون متابعة' : 'À suivre de près'}
          color="#E24B4A" bg="#FCEBEB"
          active={filtreKpi === 'risque'}
          onClick={() => setFiltreKpi(filtreKpi === 'risque' ? null : 'risque')}
        />

        {/* KPI 3 : Absences cumulées — cliquable (même à 0 pour feedback UX) */}
        <KpiCard
          label={lang === 'ar' ? 'الغيابات' : 'Absences'}
          value={globalStats.absences}
          hint={lang === 'ar'
            ? `من ${globalStats.attendues} حصة متوقعة`
            : `sur ${globalStats.attendues} séances attendues`}
          color="#EF9F27" bg="#FAEEDA"
          active={filtreKpi === 'absences'}
          onClick={() => setFiltreKpi(filtreKpi === 'absences' ? null : 'absences')}
        />

        {/* KPI 4 : Élèves parfaits — cliquable (même à 0 pour feedback UX) */}
        <KpiCard
          label={lang === 'ar' ? 'المواظبة التامة' : 'Assiduité parfaite'}
          value={globalStats.nbParfaits}
          hint={lang === 'ar' ? '100% حضور' : '100% de présence'}
          color="#1D9E75" bg="#E1F5EE"
          active={filtreKpi === 'parfait'}
          onClick={() => setFiltreKpi(filtreKpi === 'parfait' ? null : 'parfait')}
        />
      </div>

      {/* Filtres (recherche + niveau) — placés AVANT la bannière filtre KPI
          pour que la bannière soit collée à la liste qui en découle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder={lang === 'ar' ? '🔍 ابحث طالب' : '🔍 Chercher un élève'}
          style={{ flex: '1 1 240px', padding: '9px 13px', fontSize: 13, borderRadius: 8, border: '1px solid #e0e0d8', fontFamily: 'inherit', outline: 'none' }} />
        <select value={filtreNiveau} onChange={e => setFiltreNiveau(e.target.value)}
          style={{ padding: '9px 13px', fontSize: 13, borderRadius: 8, border: '1px solid #e0e0d8', fontFamily: 'inherit', background: '#fff' }}>
          <option value="">{lang === 'ar' ? 'جميع المستويات' : 'Tous les niveaux'}</option>
          {niveaux.map(n => <option key={n.code} value={n.code}>{n.nom || n.code}</option>)}
        </select>
      </div>

      {/* Bannière filtre KPI actif (s'affiche uniquement si un KPI est cliqué)
          Placée juste au-dessus de la liste, avec marginBottom:0 pour etre collee */}
      {filtreKpi && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', marginBottom: 0,
          background: '#E6F1FB', border: '1px solid #378ADD30',
          borderRadius: '10px 10px 0 0', borderBottom: 'none',
          fontSize: 13, color: '#0C447C',
        }}>
          <span style={{ fontSize: 16 }}>🔎</span>
          <div style={{ flex: 1 }}>
            <strong>
              {filtreKpi === 'risque'   && (lang === 'ar' ? `عرض الطلاب في خطر (<${SEUIL_RISQUE}%)`  : `Filtré : élèves à risque (<${SEUIL_RISQUE}%)`)}
              {filtreKpi === 'absences' && (lang === 'ar' ? 'عرض الطلاب الذين لديهم غيابات'         : 'Filtré : élèves ayant au moins une absence')}
              {filtreKpi === 'parfait'  && (lang === 'ar' ? 'عرض الطلاب بمواظبة تامة'                : 'Filtré : élèves avec assiduité parfaite')}
            </strong>
            <span style={{ marginLeft: 8, color: '#666' }}>
              · {filtered.length} {lang === 'ar' ? 'طالب' : 'élève(s)'}
            </span>
          </div>
          <button onClick={() => setFiltreKpi(null)}
            style={{
              padding: '4px 12px', background: '#fff', color: '#0C447C',
              border: '1px solid #378ADD40', borderRadius: 6,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ✕ {lang === 'ar' ? 'إزالة' : 'Effacer'}
          </button>
        </div>
      )}

      {/* Liste élèves — collée à la bannière filtre KPI si elle est affichée */}
      {filtered.length === 0 ? (
        <div style={{
          padding: 30, textAlign: 'center', color: '#888',
          background: '#fff',
          borderRadius: filtreKpi ? '0 0 12px 12px' : 12,
          border: '1px dashed #ccc',
        }}>
          {filtreKpi === 'parfait' ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💪</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                {lang === 'ar'
                  ? 'لا يوجد طلاب بمواظبة تامة بعد'
                  : 'Aucun élève avec une assiduité parfaite pour le moment'}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {lang === 'ar'
                  ? 'استمروا في تشجيعهم !'
                  : 'Continuez à les encourager !'}
              </div>
            </>
          ) : filtreKpi === 'risque' ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                {lang === 'ar'
                  ? 'لا يوجد طلاب في خطر'
                  : 'Aucun élève à risque'}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {lang === 'ar' ? 'أحسنت !' : 'Bravo !'}
              </div>
            </>
          ) : filtreKpi === 'absences' ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👌</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                {lang === 'ar'
                  ? 'لا يوجد طلاب غائبون'
                  : 'Aucun élève absent'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14 }}>
              {lang === 'ar' ? 'لا يوجد طلاب' : 'Aucun élève'}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: '#fff',
          borderRadius: filtreKpi ? '0 0 12px 12px' : 12,
          overflow: 'hidden',
          border: '1px solid #e0e0d8',
          borderTop: filtreKpi ? '1px solid #378ADD30' : '1px solid #e0e0d8',
        }}>
          {filtered.map((e, idx) => {
            const s = statsParEleve[e.id] || { aDesJours: false, attendues: 0, presentes: 0, absences: 0, taux: null, datesAbsences: [] };
            const isOpen = eleveDetail === e.id;
            // Couleur basee sur le taux
            let statutColor = '#888', statutBg = '#f5f5f0', statutLabel = '—';
            if (!s.aDesJours) {
              statutColor = '#888'; statutBg = '#f5f5f0';
              statutLabel = lang === 'ar' ? '⚠️ لا أيام' : '⚠️ Aucun jour';
            } else if (s.taux === null || s.attendues === 0) {
              statutColor = '#888'; statutBg = '#f5f5f0';
              statutLabel = lang === 'ar' ? '—' : '—';
            } else if (s.taux >= 95) {
              statutColor = '#1D9E75'; statutBg = '#E1F5EE';
              statutLabel = `${s.taux}%`;
            } else if (s.taux >= 80) {
              statutColor = '#EF9F27'; statutBg = '#FAEEDA';
              statutLabel = `${s.taux}%`;
            } else {
              statutColor = '#E24B4A'; statutBg = '#FCEBEB';
              statutLabel = `${s.taux}%`;
            }
            return (
              <div key={e.id}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  borderBottom: idx === filtered.length - 1 && !isOpen ? 'none' : '1px solid #f0f0ec',
                  cursor: s.datesAbsences.length > 0 ? 'pointer' : 'default',
                }}
                  onClick={() => s.datesAbsences.length > 0 && setEleveDetail(isOpen ? null : e.id)}>
                  {/* Numéro */}
                  <div style={{
                    minWidth: 60, padding: '6px 10px', borderRadius: 8,
                    background: '#E1F5EE', color: '#085041',
                    fontSize: 12, fontWeight: 700, textAlign: 'center',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.eleve_id_ecole || '—'}</div>
                  {/* Nom */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {e.code_niveau || '—'}
                      {s.aDesJours && (
                        <span style={{ marginLeft: 8 }}>
                          · {s.presentes}/{s.attendues} {lang === 'ar' ? 'حصة' : 'séances'}
                          {s.absences > 0 && (
                            <span style={{ color: '#E24B4A', fontWeight: 700 }}>
                              {' · '}{s.absences} {lang === 'ar' ? 'غياب' : 'abs.'}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Statut */}
                  <div style={{
                    padding: '6px 12px', background: statutBg, color: statutColor,
                    borderRadius: 8, fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>{statutLabel}</div>
                  {/* Flèche si cliquable */}
                  {s.datesAbsences.length > 0 && (
                    <div style={{ fontSize: 11, color: '#888', flexShrink: 0, width: 14 }}>
                      {isOpen ? '▲' : '▼'}
                    </div>
                  )}
                </div>
                {/* Détail des dates d'absence */}
                {isOpen && (
                  <div style={{
                    padding: '10px 14px 12px 86px', background: '#FCEBEB22',
                    borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid #f0f0ec',
                  }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6, fontWeight: 600 }}>
                      {lang === 'ar' ? 'أيام الغياب:' : 'Jours d\'absence :'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {s.datesAbsences.map(d => (
                        <div key={d} style={{
                          padding: '4px 10px', background: '#FCEBEB', color: '#A32D2D',
                          borderRadius: 6, fontSize: 11, fontWeight: 600,
                        }}>
                          {lang === 'ar' ? formatDateAr(d) : formatDateFr(d)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers : calcul des bornes de période + formats de date
// ──────────────────────────────────────────────────────────────────

function calcBornesPeriode(periode, customDebut, customFin) {
  const today = new Date();
  // FIX fuseau horaire : ne pas utiliser .toISOString() car il convertit en UTC
  // et décale la date d'un jour en arrière si on est dans un fuseau GMT+X.
  // On construit la date YYYY-MM-DD en utilisant les composants LOCAUX.
  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  if (periode === 'custom') {
    return {
      debut: customDebut || null,
      fin:   customFin   || null,
    };
  }
  if (periode === 'semaine') {
    const d = new Date(today);
    // Debut de semaine = samedi (semaine marocaine)
    const jourSemaine = d.getDay();                  // 0=Dim, 6=Sam
    const diffAuSamedi = (jourSemaine + 1) % 7;      // Combien de jours depuis le dernier samedi
    d.setDate(d.getDate() - diffAuSamedi);
    return { debut: iso(d), fin: iso(today) };
  }
  if (periode === 'mois') {
    const debut = new Date(today.getFullYear(), today.getMonth(), 1);
    return { debut: iso(debut), fin: iso(today) };
  }
  if (periode === 'trimestre') {
    const debut = new Date(today);
    debut.setMonth(debut.getMonth() - 3);
    return { debut: iso(debut), fin: iso(today) };
  }
  if (periode === 'semestre') {
    const debut = new Date(today);
    debut.setMonth(debut.getMonth() - 6);
    return { debut: iso(debut), fin: iso(today) };
  }
  if (periode === 'annee') {
    const debut = new Date(today.getFullYear(), 0, 1);
    return { debut: iso(debut), fin: iso(today) };
  }
  return { debut: null, fin: null };
}

function formatDateFr(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateAr(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-MA', { day: '2-digit', month: 'short', year: 'numeric' });
}
