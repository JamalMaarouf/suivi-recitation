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
  // Cible de la saisie : 'eleves' (par defaut) ou 'instituteurs'
  // Permet d'enregistrer les presences des 2 populations sur le meme kiosque.
  const [cible, setCible] = useState('eleves');
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

        {onglet === 'saisie' && (
          <>
            {/* Selecteur Eleves / Instituteurs (kiosque uniquement) */}
            <div style={{
              display: 'flex', gap: 6, padding: '10px 14px 0',
            }}>
              {[
                { k: 'eleves',       label: lang === 'ar' ? '👨‍🎓 الطلاب'   : '👨‍🎓 Élèves',       color: '#085041' },
                { k: 'instituteurs', label: lang === 'ar' ? '👨‍🏫 الأساتذة' : '👨‍🏫 Instituteurs', color: '#534AB7' },
              ].map(c => {
                const active = cible === c.k;
                return (
                  <button key={c.k} onClick={() => setCible(c.k)}
                    style={{
                      flex: 1, padding: '10px 12px',
                      borderRadius: 10,
                      background: active ? c.color : '#fff',
                      color: active ? '#fff' : c.color,
                      fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${c.color}${active ? '' : '30'}`,
                      boxShadow: active ? `0 2px 8px ${c.color}40` : 'none',
                      transition: 'all 0.15s',
                    }}>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <SaisieKiosque user={user} lang={lang} cible={cible} />
          </>
        )}
        {onglet === 'suivi'  && <SuiviPlaceholder lang={lang} user={user} isMobile={true} cible={cible} setCible={setCible} />}

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

      {onglet === 'saisie' && (
        <>
          {/* Selecteur Eleves / Instituteurs (kiosque uniquement) */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap',
          }}>
            {[
              { k: 'eleves',       label: lang === 'ar' ? '👨‍🎓 الطلاب'   : '👨‍🎓 Élèves',       color: '#085041', bg: '#E1F5EE' },
              { k: 'instituteurs', label: lang === 'ar' ? '👨‍🏫 الأساتذة' : '👨‍🏫 Instituteurs', color: '#534AB7', bg: '#EDE9FE' },
            ].map(c => {
              const active = cible === c.k;
              return (
                <button key={c.k} onClick={() => setCible(c.k)}
                  style={{
                    padding: '10px 20px', borderRadius: 10,
                    border: `1.5px solid ${active ? c.color : '#e0e0d8'}`,
                    background: active ? c.bg : '#fff',
                    color: active ? c.color : '#666',
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: active ? `0 2px 6px ${c.color}25` : 'none',
                    transition: 'all 0.15s',
                  }}>
                  {c.label}
                </button>
              );
            })}
          </div>
          <SaisieDesktop user={user} lang={lang} cible={cible} />
        </>
      )}
      {onglet === 'suivi'  && <SuiviPlaceholder lang={lang} user={user} cible={cible} setCible={setCible} />}

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
// Hook partagé : charge les "sujets" (élèves ou instituteurs) + leurs
// présences du jour selon le paramètre cible.
// cible = 'eleves' (defaut) : table eleves + table presences
// cible = 'instituteurs'     : table utilisateurs (role=instituteur) + table seances_instituteurs
function useAssiduiteData(user, cible = 'eleves') {
  // On garde le nom 'eleves' pour la rétrocompatibilité mais ça contient
  // des élèves OU des instituteurs selon la cible.
  const [eleves, setEleves] = useState([]);
  const [presencesToday, setPresencesToday] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Date d'aujourd'hui au format YYYY-MM-DD en HEURE LOCALE
  // (pas toISOString() qui convertit en UTC et décale d'un jour selon le fuseau)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const loadData = async () => {
    setLoading(true);
    if (cible === 'instituteurs') {
      // Charger instituteurs + séances du jour
      const [instRes, seancesRes] = await Promise.all([
        supabase.from('utilisateurs')
          .select('id, prenom, nom, instituteur_id_ecole')
          .eq('ecole_id', user.ecole_id)
          .eq('role', 'instituteur')
          .order('instituteur_id_ecole', { ascending: true })
          .limit(500),
        supabase.from('seances_instituteurs')
          .select('instituteur_id')
          .eq('ecole_id', user.ecole_id)
          .eq('date_seance', today),
      ]);
      // On normalise le format pour avoir un 'eleve_id_ecole' utilisable par l'UI
      // existante (le kiosque cherche sur cette colonne). On alimente aussi
      // 'code_niveau' à vide pour ne pas casser l'affichage.
      const normalized = (instRes.data || []).map(i => ({
        id: i.id,
        prenom: i.prenom,
        nom: i.nom,
        eleve_id_ecole: i.instituteur_id_ecole || '',  // clé de recherche unique
        code_niveau: '',  // pas de niveau pour les instituteurs
      }));
      setEleves(normalized);
      setPresencesToday(new Set((seancesRes.data || []).map(s => s.instituteur_id)));
    } else {
      // Par défaut : élèves + présences
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
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [cible]);

  return { eleves, presencesToday, setPresencesToday, loading, today, loadData };
}

// ══════════════════════════════════════════════════════════════════════
// ENREGISTREMENT (partagé desktop/mobile)
// Retourne { ok, alreadyPresent, error } pour que chaque UI adapte son feedback
// cible = 'eleves' → table presences, colonne eleve_id
// cible = 'instituteurs' → table seances_instituteurs, colonne instituteur_id
// ══════════════════════════════════════════════════════════════════════
async function insertPresence({ eleveId, ecoleId, date, saisiPar, cible = 'eleves' }) {
  if (cible === 'instituteurs') {
    const { error } = await supabase.from('seances_instituteurs').insert({
      instituteur_id: eleveId,   // eleveId ici = id de l'instituteur
      ecole_id: ecoleId,
      date_seance: date,
      saisi_par: saisiPar || null,
    });
    if (error) {
      if (error.code === '23505') return { ok: false, alreadyPresent: true, error: null };
      return { ok: false, alreadyPresent: false, error };
    }
    return { ok: true, alreadyPresent: false, error: null };
  }
  // Par défaut : élèves
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

function SaisieKiosque({ user, lang, cible = 'eleves' }) {
  const { eleves, presencesToday, setPresencesToday, loading, today } = useAssiduiteData(user, cible);
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
    const res = await insertPresence({ eleveId: eleveMatch.id, ecoleId: user.ecole_id, date: today, saisiPar: user.id, cible });
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
    showFlash('success', nomComplet, cible === 'instituteurs'
      ? (lang === 'ar' ? 'تم تسجيل الحصة' : 'Séance enregistrée')
      : (lang === 'ar' ? 'تم تسجيل الحضور' : 'Présence enregistrée'));
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
          {cible === 'instituteurs'
            ? (lang === 'ar' ? 'رقم تعريف الأستاذ' : 'IDENTIFIANT INSTITUTEUR')
            : (lang === 'ar' ? 'رقم تعريف الطالب' : 'IDENTIFIANT ÉLÈVE')}
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
          {cible === 'instituteurs'
            ? (lang === 'ar' ? '❌ لا يوجد أستاذ بهذا الرقم' : '❌ Aucun instituteur avec cet identifiant')
            : (lang === 'ar' ? '❌ لا يوجد طالب بهذا الرقم' : '❌ Aucun élève avec cet identifiant')}
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
              {cible === 'instituteurs'
                ? (lang === 'ar' ? 'أستاذ' : 'Instituteur')
                : (eleveMatch.code_niveau || '—')}
              {presencesToday.has(eleveMatch.id) && (
                <span style={{ marginLeft: 8, color: '#1D9E75', fontWeight: 700 }}>
                  · ✓ {cible === 'instituteurs'
                    ? (lang === 'ar' ? 'حصة مسجلة' : 'Séance enregistrée')
                    : (lang === 'ar' ? 'حاضر' : 'Déjà présent')}
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

function SaisieDesktop({ user, lang, cible = 'eleves' }) {
  const { toast } = useToast();
  const { eleves, presencesToday, setPresencesToday, loading, today } = useAssiduiteData(user, cible);
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
    const res = await insertPresence({ eleveId: eleve.id, ecoleId: user.ecole_id, date: today, saisiPar: user.id, cible });
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
    if (cible === 'instituteurs') {
      toast.success(lang === 'ar'
        ? `✅ تم تسجيل حصة ${eleve.prenom} ${eleve.nom}`
        : `✅ Séance enregistrée : ${eleve.prenom} ${eleve.nom}`);
    } else {
      toast.success(lang === 'ar'
        ? `✅ تم تسجيل حضور ${eleve.prenom} ${eleve.nom}`
        : `✅ Présence enregistrée : ${eleve.prenom} ${eleve.nom}`);
    }
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
          placeholder={cible === 'instituteurs'
            ? (lang === 'ar' ? '🔍 ابحث برقم أو اسم الأستاذ' : '🔍 Chercher par numéro ou nom d\'instituteur')
            : (lang === 'ar' ? '🔍 ابحث برقم أو اسم الطالب' : '🔍 Chercher par numéro ou nom')}
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
            ? (cible === 'instituteurs'
                ? (lang === 'ar' ? '❌ لا يوجد أستاذ مطابق' : '❌ Aucun instituteur ne correspond')
                : (lang === 'ar' ? '❌ لا يوجد طالب مطابق' : '❌ Aucun élève ne correspond'))
            : (cible === 'instituteurs'
                ? (lang === 'ar' ? 'لا يوجد أساتذة' : 'Aucun instituteur')
                : (lang === 'ar' ? 'لا يوجد طلاب' : 'Aucun élève'))}
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
function SuiviPlaceholder({ lang, user, isMobile, cible, setCible }) {
  // Sélecteur [Eleves] / [Instituteurs] + dispatch vers le bon Onglet
  // Le sélecteur est affiché dans les 2 cas (onglet ouvert sur eleves
  // par defaut, le surveillant peut switcher pour voir les seances
  // des instituteurs).
  return (
    <div>
      {/* Selecteur cible — memes couleurs que dans la Saisie */}
      <div style={{
        display: 'flex', gap: 8,
        marginBottom: isMobile ? 12 : 14,
        padding: isMobile ? '10px 14px 0' : 0,
        flexWrap: 'wrap',
      }}>
        {[
          { k: 'eleves',       label: lang === 'ar' ? '👨‍🎓 الطلاب'   : '👨‍🎓 Élèves',       color: '#085041', bg: '#E1F5EE' },
          { k: 'instituteurs', label: lang === 'ar' ? '👨‍🏫 الأساتذة' : '👨‍🏫 Instituteurs', color: '#534AB7', bg: '#EDE9FE' },
        ].map(c => {
          const active = cible === c.k;
          return (
            <button key={c.k} onClick={() => setCible(c.k)}
              style={{
                flex: isMobile ? 1 : '0 1 auto',
                padding: isMobile ? '10px 12px' : '10px 20px',
                borderRadius: 10,
                border: `1.5px solid ${active ? c.color : '#e0e0d8'}`,
                background: active ? c.bg : '#fff',
                color: active ? c.color : '#666',
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? `0 2px 6px ${c.color}25` : 'none',
                transition: 'all 0.15s',
              }}>{c.label}</button>
          );
        })}
      </div>
      {cible === 'instituteurs'
        ? <OngletSuiviInstituteurs lang={lang} user={user} isMobile={isMobile} />
        : <OngletSuivi lang={lang} user={user} isMobile={isMobile} />}
    </div>
  );
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

// ══════════════════════════════════════════════════════════════════════
// ONGLET SUIVI INSTITUTEURS — dashboard séances + validation + paiement
//
// Affiche un tableau : lignes = instituteurs, colonnes = jours ouvrés
// de la période choisie, cellules = statut (validé / en attente / vide).
// Actions groupées : valider toute une ligne, toute une colonne, ou tout.
// Totaux par instituteur : nb séances × tarif = montant dû.
// ══════════════════════════════════════════════════════════════════════

function OngletSuiviInstituteurs({ lang, user, isMobile }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [instituteurs, setInstituteurs] = useState([]);
  const [seances, setSeances] = useState([]);  // toutes les seances de la periode
  const [joursNonTravailles, setJoursNonTravailles] = useState([]);
  const [modeTarif, setModeTarif] = useState(null);
  const [tarifEcole, setTarifEcole] = useState(null);

  // Filtres
  const [periode, setPeriode] = useState('mois');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  // Popup de details calendrier d'un instituteur (mode cartes)
  const [detailsInst, setDetailsInst] = useState(null);  // objet instituteur ou null
  // Popup de paiement d'un instituteur (bouton 💸)
  const [paiementInst, setPaiementInst] = useState(null);

  const { debut, fin } = calcBornesPeriode(periode, dateDebut, dateFin);

  // Helper ISO local (fix fuseau horaire)
  const isoLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  // ─── Chargement initial ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [instRes, jntRes, ecoleRes] = await Promise.all([
        supabase.from('utilisateurs')
          .select('id, prenom, nom, instituteur_id_ecole, tarif_seance')
          .eq('ecole_id', user.ecole_id)
          .eq('role', 'instituteur')
          .order('nom'),
        supabase.from('jours_non_travailles')
          .select('date_debut, date_fin')
          .eq('ecole_id', user.ecole_id),
        supabase.from('ecoles')
          .select('mode_tarif_instituteur, tarif_seance_ecole')
          .eq('id', user.ecole_id)
          .maybeSingle(),
      ]);
      setInstituteurs(instRes.data || []);
      setJoursNonTravailles(jntRes.data || []);
      if (ecoleRes.data) {
        setModeTarif(ecoleRes.data.mode_tarif_instituteur || null);
        setTarifEcole(ecoleRes.data.tarif_seance_ecole);
      }
      setLoading(false);
    };
    load();
  }, [user.ecole_id]);

  // ─── Chargement séances sur la période ─────────────────────
  const loadSeances = async () => {
    if (!debut || !fin) return;
    const { data } = await supabase.from('seances_instituteurs')
      .select('id, instituteur_id, date_seance, valide, paye')
      .eq('ecole_id', user.ecole_id)
      .gte('date_seance', debut)
      .lte('date_seance', fin);
    setSeances(data || []);
  };
  useEffect(() => { loadSeances(); /* eslint-disable-next-line */ }, [user.ecole_id, debut, fin]);

  // ─── Calcul des jours ouvrés de la période (exclure fériés) ─
  const joursOuvres = React.useMemo(() => {
    if (!debut || !fin) return [];
    const datesNT = new Set();
    joursNonTravailles.forEach(p => {
      const d1 = new Date(p.date_debut);
      const d2 = new Date(p.date_fin);
      for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
        datesNT.add(isoLocal(d));
      }
    });
    const dates = [];
    const d1 = new Date(debut);
    const d2 = new Date(fin);
    for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
      const iso = isoLocal(d);
      if (datesNT.has(iso)) continue;  // jour non travaille
      dates.push(iso);
    }
    return dates;
  }, [debut, fin, joursNonTravailles]);

  // ─── Map seances : instituteurId → { date → seance } ──────
  const seancesParInst = React.useMemo(() => {
    const m = {};
    seances.forEach(s => {
      if (!m[s.instituteur_id]) m[s.instituteur_id] = {};
      m[s.instituteur_id][s.date_seance] = s;
    });
    return m;
  }, [seances]);

  // ─── Tarif effectif d'un instituteur ───────────────────────
  const tarifInst = (inst) => {
    if (modeTarif === 'individuel') return inst.tarif_seance || 0;
    if (modeTarif === 'ecole') return tarifEcole || 0;
    return 0;
  };

  // ─── Stats par instituteur ────────────────────────────────
  const statsInst = React.useMemo(() => {
    const result = {};
    instituteurs.forEach(i => {
      const seancesI = seancesParInst[i.id] || {};
      const arr = Object.values(seancesI);
      const total = arr.length;
      const valides = arr.filter(s => s.valide).length;
      const payees = arr.filter(s => s.paye).length;
      const tarif = tarifInst(i);
      result[i.id] = {
        total,
        valides,
        enAttente: total - valides,
        payees,
        aPayer: valides - payees,  // validées non encore payées
        tarif,
        montantDu: (valides - payees) * tarif,
      };
    });
    return result;
    // eslint-disable-next-line
  }, [instituteurs, seancesParInst, modeTarif, tarifEcole]);

  // ─── Actions : valider une ligne / colonne / tout ─────────
  // Logique : valider = passer valide=true (et saisir valide_par + valide_le)
  // sur toutes les seances non encore validees concernees.
  const doValidate = async (seanceIds) => {
    if (seanceIds.length === 0) return;
    const { error } = await supabase.from('seances_instituteurs')
      .update({ valide: true, valide_par: user.id || null, valide_le: new Date().toISOString() })
      .in('id', seanceIds);
    if (error) {
      console.error('[doValidate]', error);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    toast.success(lang === 'ar'
      ? `✅ تم التحقق من ${seanceIds.length} حصة`
      : `✅ ${seanceIds.length} séance${seanceIds.length > 1 ? 's' : ''} validée${seanceIds.length > 1 ? 's' : ''}`);
    loadSeances();
  };

  const validerLigne = (instituteurId) => {
    const toValidate = (seances || [])
      .filter(s => s.instituteur_id === instituteurId && !s.valide)
      .map(s => s.id);
    doValidate(toValidate);
  };

  const validerColonne = (date) => {
    const toValidate = (seances || [])
      .filter(s => s.date_seance === date && !s.valide)
      .map(s => s.id);
    doValidate(toValidate);
  };

  const validerTout = () => {
    const toValidate = (seances || [])
      .filter(s => !s.valide)
      .map(s => s.id);
    doValidate(toValidate);
  };

  // ─── Toggle d'une cellule individuelle ─────────────────────
  // Clic sur une cellule → si séance existe : toggle validation.
  // Pas de création/suppression (le surveillant doit passer par la saisie).
  const toggleSeance = async (seance) => {
    if (!seance) return;
    if (seance.paye) {
      toast.warning(lang === 'ar' ? '⚠️ الحصة مدفوعة، لا يمكن التعديل' : '⚠️ Séance déjà payée, non modifiable');
      return;
    }
    const { error } = await supabase.from('seances_instituteurs')
      .update({
        valide: !seance.valide,
        valide_par: !seance.valide ? (user.id || null) : null,
        valide_le: !seance.valide ? new Date().toISOString() : null,
      })
      .eq('id', seance.id);
    if (error) {
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    loadSeances();
  };

  // ─── Paiement d'un instituteur ─────────────────────────────
  // Couplage lâche avec Finance :
  // 1. Crée une dépense catégorie 'salaire' (= ce que fait Finance)
  // 2. Marque les séances concernées comme payées (paye=true + paiement_id)
  // Si l'user modifie le montant dans la modale, on conserve quand même le lien
  // avec les séances (le paiement_id permet de retrouver ce lien).
  const handlePayer = async ({ montant, description, dateDepense, seancesIds }) => {
    if (!paiementInst) return { ok: false, error: 'No instituteur' };
    // 1. Créer la dépense Finance
    const { data: dep, error: depError } = await supabase.from('depenses').insert({
      montant: parseFloat(montant),
      ecole_id: user.ecole_id,
      date_depense: dateDepense,
      categorie: 'salaire',
      beneficiaire_id: paiementInst.id,
      description: description || `Paiement ${seancesIds.length} séance(s)`,
      created_by: user.id,
    }).select('id').maybeSingle();
    if (depError) {
      console.error('[handlePayer] depense error:', depError);
      return { ok: false, error: depError.message };
    }
    // 2. Marquer les séances comme payées avec le lien paiement_id
    if (seancesIds.length > 0) {
      const { error: seanceError } = await supabase.from('seances_instituteurs')
        .update({ paye: true, paiement_id: dep?.id || null })
        .in('id', seancesIds);
      if (seanceError) {
        console.error('[handlePayer] seances update error:', seanceError);
        // La dépense est créée mais les séances ne sont pas marquées → état cohérent mais à corriger manuellement
        return { ok: false, error: seanceError.message, depId: dep?.id };
      }
    }
    toast.success(lang === 'ar'
      ? `✅ تم تسجيل دفع ${montant} د. لـ ${paiementInst.prenom} ${paiementInst.nom}`
      : `✅ Paiement de ${montant} DH enregistré pour ${paiementInst.prenom} ${paiementInst.nom}`);
    setPaiementInst(null);
    loadSeances();
    return { ok: true };
  };

  const PERIODES = [
    { id: 'semaine',   label: lang === 'ar' ? 'الأسبوع'       : 'Semaine' },
    { id: 'mois',      label: lang === 'ar' ? 'الشهر'          : 'Mois' },
    { id: 'trimestre', label: lang === 'ar' ? 'الفصل (3 أشهر)' : 'Trimestre' },
    { id: 'semestre',  label: lang === 'ar' ? 'النصف (6 أشهر)' : 'Semestre' },
    { id: 'annee',     label: lang === 'ar' ? 'السنة'          : 'Année' },
    { id: 'custom',    label: lang === 'ar' ? 'فترة محددة'     : 'Personnalisée' },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}</div>;

  // ─── Alerte si mode tarif pas configuré ────────────────────
  if (!modeTarif) {
    return (
      <div style={{ padding: isMobile ? 14 : 0 }}>
        <div style={{
          background: '#FAEEDA', border: '1px solid #EF9F2740',
          borderRadius: 12, padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#633806', marginBottom: 6 }}>
            {lang === 'ar' ? 'التعرفات غير محددة' : 'Tarifs non configurés'}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
            {lang === 'ar'
              ? 'يجب تحديد نمط التعرفة قبل عرض المبالغ المستحقة'
              : 'Tu dois configurer le mode de tarification avant de voir les montants dus'}
          </div>
        </div>
      </div>
    );
  }

  // ─── Totaux globaux ────────────────────────────────────────
  const totalSeances = seances.length;
  const totalValides = seances.filter(s => s.valide).length;
  const totalEnAttente = totalSeances - totalValides;
  const totalMontantDu = Object.values(statsInst).reduce((sum, s) => sum + s.montantDu, 0);

  return (
    <div style={{ padding: isMobile ? 14 : 0 }}>

      {/* Sélecteur période */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {PERIODES.map(p => {
          const active = periode === p.id;
          return (
            <button key={p.id} onClick={() => setPeriode(p.id)}
              style={{
                padding: isMobile ? '7px 12px' : '6px 14px',
                borderRadius: 20,
                border: `1px solid ${active ? '#534AB7' : '#e0e0d8'}`,
                background: active ? '#EDE9FE' : '#fff',
                color: active ? '#534AB7' : '#888',
                fontSize: isMobile ? 11 : 12, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{p.label}</button>
          );
        })}
      </div>

      {/* Dates custom */}
      {periode === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 13 }} />
          <span style={{ alignSelf: 'center', color: '#888' }}>→</span>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 13 }} />
        </div>
      )}

      {/* Période calculée */}
      <div style={{ fontSize: 11, color: '#888', marginBottom: 14 }}>
        {debut && fin
          ? (lang === 'ar'
              ? `من ${formatDateAr(debut)} إلى ${formatDateAr(fin)}`
              : `Du ${formatDateFr(debut)} au ${formatDateFr(fin)}`)
          : (lang === 'ar' ? 'اختر فترة' : 'Choisir une période')}
      </div>

      {/* KPIs globaux */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: isMobile ? 8 : 10, marginBottom: 14,
      }}>
        <StatCard label={lang === 'ar' ? 'الحصص المسجلة' : 'Séances enregistrées'} value={totalSeances} color="#534AB7" bg="#EDE9FE" />
        <StatCard label={lang === 'ar' ? 'تم التحقق منها' : 'Validées'} value={totalValides} color="#1D9E75" bg="#E1F5EE" />
        <StatCard label={lang === 'ar' ? 'في انتظار التحقق' : 'En attente'} value={totalEnAttente} color="#EF9F27" bg="#FAEEDA" />
        <StatCard label={lang === 'ar' ? 'المبلغ المستحق' : 'À payer'} value={`${totalMontantDu.toFixed(0)} ${lang === 'ar' ? 'د.' : 'DH'}`} color="#E24B4A" bg="#FCEBEB" />
      </div>

      {/* Bouton "Tout valider" */}
      {totalEnAttente > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={validerTout}
            style={{
              padding: '9px 16px', background: '#1D9E75', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ✓ {lang === 'ar' ? `التحقق من كل الحصص (${totalEnAttente})` : `Tout valider (${totalEnAttente})`}
          </button>
        </div>
      )}

      {/* ═══ DISPATCH AFFICHAGE ═══
          - Vue TABLEAU uniquement en 'semaine' + desktop (7 jours = lisible)
          - Vue CARTES pour toutes les autres périodes + toutes les situations mobile
            (mois+ = trop de colonnes pour un tableau lisible) */}
      {instituteurs.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 12, border: '1px dashed #ccc' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍🏫</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {lang === 'ar' ? 'لا يوجد أساتذة' : 'Aucun instituteur'}
          </div>
        </div>
      ) : joursOuvres.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 12, border: '1px dashed #ccc' }}>
          {lang === 'ar' ? 'لا توجد أيام عمل في الفترة' : 'Aucun jour travaillé dans la période'}
        </div>
      ) : (periode === 'semaine' && !isMobile) ? (
        // ═══ VUE TABLEAU (semaine desktop) ═══
        <div style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid #e0e0d8', overflow: 'auto',
        }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 12, minWidth: 600,
          }}>
            <thead>
              <tr style={{ background: '#f5f5f0' }}>
                <th style={{
                  padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#666',
                  position: 'sticky', left: 0, background: '#f5f5f0', zIndex: 2,
                  borderRight: '1px solid #e0e0d8',
                  minWidth: 140,
                }}>
                  {lang === 'ar' ? 'الأستاذ' : 'Instituteur'}
                </th>
                {joursOuvres.map(d => {
                  const date = new Date(d);
                  return (
                    <th key={d}
                      onClick={() => validerColonne(d)}
                      title={lang === 'ar' ? 'التحقق من كل الحصص لهذا اليوم' : 'Valider toutes les séances de ce jour'}
                      style={{
                        padding: '8px 4px', textAlign: 'center',
                        fontWeight: 600, color: '#666', fontSize: 10,
                        cursor: 'pointer', borderBottom: '1px solid #e0e0d8',
                        minWidth: 38,
                      }}>
                      <div style={{ fontSize: 10, color: '#999' }}>
                        {date.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { weekday: 'short' })}
                      </div>
                      <div style={{ fontWeight: 700, color: '#1a1a1a' }}>
                        {date.getDate()}
                      </div>
                    </th>
                  );
                })}
                <th style={{
                  padding: '8px 10px', textAlign: 'center', fontWeight: 700,
                  color: '#666', borderLeft: '1px solid #e0e0d8',
                  minWidth: 70,
                }}>
                  {lang === 'ar' ? 'الإجمالي' : 'Total'}
                </th>
                <th style={{
                  padding: '8px 10px', textAlign: 'center', fontWeight: 700,
                  color: '#666', minWidth: 90,
                }}>
                  {lang === 'ar' ? 'مستحق' : 'À payer'}
                </th>
                <th style={{
                  padding: '8px 10px', textAlign: 'center', fontWeight: 700,
                  color: '#666', minWidth: 50,
                }}></th>
              </tr>
            </thead>
            <tbody>
              {instituteurs.map(inst => {
                const stats = statsInst[inst.id] || { total: 0, valides: 0, enAttente: 0, montantDu: 0, tarif: 0 };
                const seancesI = seancesParInst[inst.id] || {};
                return (
                  <tr key={inst.id} style={{ borderTop: '1px solid #f0f0ec' }}>
                    <td style={{
                      padding: '8px 12px',
                      position: 'sticky', left: 0, background: '#fff', zIndex: 1,
                      borderRight: '1px solid #e0e0d8',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                        {inst.prenom} {inst.nom}
                      </div>
                      {inst.instituteur_id_ecole && (
                        <div style={{
                          display: 'inline-block', marginTop: 2,
                          padding: '1px 6px', background: '#EDE9FE', color: '#534AB7',
                          borderRadius: 4, fontSize: 10, fontWeight: 700,
                        }}>{inst.instituteur_id_ecole}</div>
                      )}
                    </td>
                    {joursOuvres.map(d => {
                      const s = seancesI[d];
                      return (
                        <td key={d}
                          onClick={() => toggleSeance(s)}
                          style={{
                            padding: '6px 2px', textAlign: 'center',
                            cursor: s ? 'pointer' : 'default',
                            fontSize: 16,
                          }}>
                          {!s ? (
                            <span style={{ color: '#ddd' }}>·</span>
                          ) : s.paye ? (
                            <span title={lang === 'ar' ? 'مدفوع' : 'Payée'}>💰</span>
                          ) : s.valide ? (
                            <span style={{ color: '#1D9E75' }}
                              title={lang === 'ar' ? 'مُتحقق منها' : 'Validée'}>✅</span>
                          ) : (
                            <span style={{ color: '#EF9F27' }}
                              title={lang === 'ar' ? 'في انتظار التحقق — انقر للتحقق' : 'En attente — clic pour valider'}>⏳</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{
                      padding: '8px 10px', textAlign: 'center',
                      borderLeft: '1px solid #e0e0d8',
                      fontWeight: 700, color: '#1a1a1a',
                    }}>
                      <div>{stats.total}</div>
                      {stats.valides < stats.total && (
                        <div style={{ fontSize: 10, color: '#EF9F27', fontWeight: 600 }}>
                          {stats.enAttente} {lang === 'ar' ? 'منتظر' : 'en att.'}
                        </div>
                      )}
                    </td>
                    <td style={{
                      padding: '8px 10px', textAlign: 'center',
                      fontWeight: 700,
                      color: stats.montantDu > 0 ? '#E24B4A' : '#999',
                    }}>
                      {stats.montantDu > 0
                        ? `${stats.montantDu.toFixed(0)} ${lang === 'ar' ? 'د.' : 'DH'}`
                        : '—'}
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      {stats.enAttente > 0 && (
                        <button onClick={() => validerLigne(inst.id)}
                          title={lang === 'ar' ? 'التحقق من كل حصصه' : 'Valider toutes ses séances'}
                          style={{
                            padding: '4px 8px', background: '#1D9E75', color: '#fff',
                            border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                          }}>
                          ✓ {stats.enAttente}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // ═══ VUE CARTES (mois+ ou mobile) ═══
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {instituteurs.map(inst => {
            const stats = statsInst[inst.id] || { total: 0, valides: 0, enAttente: 0, payees: 0, montantDu: 0, tarif: 0 };
            return (
              <InstituteurCard
                key={inst.id}
                inst={inst}
                stats={stats}
                lang={lang}
                isMobile={isMobile}
                onValidateRow={() => validerLigne(inst.id)}
                onShowDetails={() => setDetailsInst(inst)}
                onPayer={() => setPaiementInst(inst)}
              />
            );
          })}
        </div>
      )}

      {/* Légende */}
      <div style={{
        marginTop: 14, padding: '10px 14px',
        background: '#f9f9f5', borderRadius: 10,
        fontSize: 11, color: '#666',
        display: 'flex', flexWrap: 'wrap', gap: 14,
      }}>
        <span>⏳ {lang === 'ar' ? 'في انتظار التحقق' : 'En attente de validation'}</span>
        <span>✅ {lang === 'ar' ? 'مُتحقق منها (قابلة للدفع)' : 'Validée (payable)'}</span>
        <span>💰 {lang === 'ar' ? 'مدفوعة' : 'Payée'}</span>
        <span style={{ color: '#999' }}>· {lang === 'ar' ? 'لا حصة' : 'Aucune séance'}</span>
      </div>

      {/* Popup details instituteur (mode cartes) */}
      {detailsInst && (
        <DetailsInstituteurModal
          inst={detailsInst}
          seances={seancesParInst[detailsInst.id] || {}}
          joursOuvres={joursOuvres}
          stats={statsInst[detailsInst.id]}
          onClose={() => setDetailsInst(null)}
          onToggleSeance={async (s) => { await toggleSeance(s); }}
          onValidateRow={() => { validerLigne(detailsInst.id); setDetailsInst(null); }}
          lang={lang}
        />
      )}

      {/* Popup paiement instituteur */}
      {paiementInst && (
        <PaiementInstituteurModal
          inst={paiementInst}
          stats={statsInst[paiementInst.id]}
          seances={seances.filter(s => s.instituteur_id === paiementInst.id && s.valide && !s.paye)}
          onClose={() => setPaiementInst(null)}
          onConfirm={handlePayer}
          lang={lang}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Carte synthese d'un instituteur (mode cartes)
// Utilisee en mois/trimestre/semestre/annee et toujours en mobile.
// ══════════════════════════════════════════════════════════════════════
function InstituteurCard({ inst, stats, lang, isMobile, onValidateRow, onShowDetails, onPayer }) {
  const pctValides = stats.total > 0 ? Math.round((stats.valides / stats.total) * 100) : 0;
  const pctPayees  = stats.total > 0 ? Math.round((stats.payees  / stats.total) * 100) : 0;

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 16,
      border: '1px solid #e0e0d8',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Ligne 1 : identité + numéro */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: '#EDE9FE', color: '#534AB7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>👨‍🏫</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
            {inst.prenom} {inst.nom}
          </div>
          {inst.instituteur_id_ecole && (
            <div style={{
              display: 'inline-block', marginTop: 2,
              padding: '2px 8px', background: '#EDE9FE', color: '#534AB7',
              borderRadius: 6, fontSize: 10, fontWeight: 700,
            }}>{inst.instituteur_id_ecole}</div>
          )}
        </div>
        {stats.tarif > 0 && (
          <div style={{ fontSize: 11, color: '#888', textAlign: 'right' }}>
            <div style={{ fontWeight: 600, color: '#534AB7', fontSize: 13 }}>
              {stats.tarif.toFixed(0)} {lang === 'ar' ? 'د.' : 'DH'}
            </div>
            <div>{lang === 'ar' ? 'للحصة' : '/ séance'}</div>
          </div>
        )}
      </div>

      {/* Ligne 2 : barre de progression visuelle
          Decomposition : payées (bleu) + validées non payées (vert) + en attente (orange) + vide */}
      {stats.total > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            height: 10, background: '#f0f0ec', borderRadius: 999,
            overflow: 'hidden', display: 'flex',
          }}>
            {stats.payees > 0 && (
              <div title={`${stats.payees} ${lang === 'ar' ? 'مدفوعة' : 'payées'}`}
                style={{ width: `${(stats.payees / stats.total) * 100}%`, background: '#378ADD' }} />
            )}
            {(stats.valides - stats.payees) > 0 && (
              <div title={`${stats.valides - stats.payees} ${lang === 'ar' ? 'قابلة للدفع' : 'à payer'}`}
                style={{ width: `${((stats.valides - stats.payees) / stats.total) * 100}%`, background: '#1D9E75' }} />
            )}
            {stats.enAttente > 0 && (
              <div title={`${stats.enAttente} ${lang === 'ar' ? 'في الانتظار' : 'en attente'}`}
                style={{ width: `${(stats.enAttente / stats.total) * 100}%`, background: '#EF9F27' }} />
            )}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' }}>
            {stats.valides}/{stats.total} {lang === 'ar' ? 'حصة تم التحقق منها' : 'séances validées'}
            {' '}({pctValides}%)
          </div>
        </div>
      ) : (
        <div style={{
          padding: '10px 12px', marginBottom: 12,
          background: '#f9f9f5', borderRadius: 8,
          fontSize: 12, color: '#888', textAlign: 'center',
        }}>
          {lang === 'ar' ? 'لم تسجل حصص بعد' : 'Aucune séance enregistrée sur la période'}
        </div>
      )}

      {/* Ligne 3 : stats compactes + montant à payer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 8, marginBottom: 12,
      }}>
        <MiniStatCard icon="📋" label={lang === 'ar' ? 'الإجمالي' : 'Total'}
          value={stats.total} color="#534AB7" />
        <MiniStatCard icon="✅" label={lang === 'ar' ? 'مُتحقق' : 'Validées'}
          value={stats.valides} color="#1D9E75" />
        <MiniStatCard icon="⏳" label={lang === 'ar' ? 'منتظر' : 'En attente'}
          value={stats.enAttente} color="#EF9F27" highlight={stats.enAttente > 0} />
        <MiniStatCard icon="💰" label={lang === 'ar' ? 'مستحق' : 'À payer'}
          value={stats.montantDu > 0 ? `${stats.montantDu.toFixed(0)}` : '—'}
          color="#E24B4A" highlight={stats.montantDu > 0}
          suffix={stats.montantDu > 0 ? (lang === 'ar' ? 'د.' : 'DH') : null} />
      </div>

      {/* Ligne 4 : boutons d'action */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {stats.enAttente > 0 && (
          <button onClick={onValidateRow}
            style={{
              flex: '1 1 160px', padding: '10px 14px',
              background: '#1D9E75', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
            ✓ {lang === 'ar'
              ? `التحقق (${stats.enAttente})`
              : `Valider (${stats.enAttente})`}
          </button>
        )}
        {/* Bouton Payer : visible uniquement s'il y a des montants dus */}
        {stats.montantDu > 0 && (
          <button onClick={onPayer}
            style={{
              flex: '1 1 160px', padding: '10px 14px',
              background: 'linear-gradient(135deg, #E24B4A, #EF9F27)', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(226,75,74,0.25)',
            }}>
            💸 {lang === 'ar'
              ? `دفع ${stats.montantDu.toFixed(0)} د.`
              : `Payer ${stats.montantDu.toFixed(0)} DH`}
          </button>
        )}
        <button onClick={onShowDetails}
          style={{
            flex: '0 1 auto', padding: '10px 14px',
            background: '#fff', color: '#534AB7',
            border: '1px solid #534AB740', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
          📋 {lang === 'ar' ? 'التفاصيل' : 'Détails'}
        </button>
      </div>
    </div>
  );
}

// Mini stat card pour l'interieur d'une InstituteurCard
function MiniStatCard({ icon, label, value, color, highlight, suffix }) {
  return (
    <div style={{
      padding: '8px 10px',
      background: highlight ? `${color}15` : '#f9f9f5',
      border: `1px solid ${highlight ? color + '40' : '#e0e0d8'}`,
      borderRadius: 8,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: highlight ? color : '#1a1a1a' }}>
        {value}{suffix && <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 3 }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Modale de details : mini-calendrier d'un instituteur sur la periode
// ══════════════════════════════════════════════════════════════════════
function DetailsInstituteurModal({ inst, seances, joursOuvres, stats, onClose, onToggleSeance, onValidateRow, lang }) {
  // Grouper les jours ouvres par semaine pour un affichage calendrier
  // Une semaine = lignes de 7 cellules (ici on affiche juste les jours ouvres donc pas 7 strict,
  // mais on groupe par semaine ISO pour la lisibilite)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          padding: 24, maxWidth: 600, width: '100%',
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#EDE9FE', color: '#534AB7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>👨‍🏫</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a' }}>
              {inst.prenom} {inst.nom}
            </div>
            {inst.instituteur_id_ecole && (
              <div style={{
                display: 'inline-block', marginTop: 2,
                padding: '2px 8px', background: '#EDE9FE', color: '#534AB7',
                borderRadius: 6, fontSize: 10, fontWeight: 700,
              }}>{inst.instituteur_id_ecole}</div>
            )}
          </div>
          <button onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#f5f5f0', color: '#666', border: 'none',
              fontSize: 18, cursor: 'pointer', fontFamily: 'inherit',
              flexShrink: 0,
            }}>✕</button>
        </div>

        {/* Stats en ligne */}
        {stats && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6, marginBottom: 16,
          }}>
            <MiniStatCard icon="📋" label={lang === 'ar' ? 'الإجمالي' : 'Total'} value={stats.total} color="#534AB7" />
            <MiniStatCard icon="✅" label={lang === 'ar' ? 'مُتحقق' : 'Valid.'} value={stats.valides} color="#1D9E75" />
            <MiniStatCard icon="⏳" label={lang === 'ar' ? 'منتظر' : 'Attente'} value={stats.enAttente} color="#EF9F27" highlight={stats.enAttente > 0} />
            <MiniStatCard icon="💰" label={lang === 'ar' ? 'مستحق' : 'À payer'}
              value={stats.montantDu > 0 ? stats.montantDu.toFixed(0) : '—'}
              color="#E24B4A" highlight={stats.montantDu > 0}
              suffix={stats.montantDu > 0 ? (lang === 'ar' ? 'د.' : 'DH') : null} />
          </div>
        )}

        {/* Calendrier : liste des jours avec statut */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 8 }}>
            📅 {lang === 'ar' ? 'التقويم اليومي' : 'Calendrier jour par jour'}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: 6,
          }}>
            {joursOuvres.map(d => {
              const s = seances[d];
              const date = new Date(d);
              const jourNom = date.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { weekday: 'short' });
              let bg = '#f9f9f5', color = '#ccc', icon = '·', title = lang === 'ar' ? 'لا حصة' : 'Aucune séance';
              if (s) {
                if (s.paye) {
                  bg = '#E6F1FB'; color = '#378ADD'; icon = '💰'; title = lang === 'ar' ? 'مدفوعة' : 'Payée';
                } else if (s.valide) {
                  bg = '#E1F5EE'; color = '#1D9E75'; icon = '✅'; title = lang === 'ar' ? 'مُتحقق منها' : 'Validée';
                } else {
                  bg = '#FAEEDA'; color = '#EF9F27'; icon = '⏳'; title = lang === 'ar' ? 'في الانتظار — انقر للتحقق' : 'En attente — clic pour valider';
                }
              }
              return (
                <div key={d}
                  onClick={() => s && onToggleSeance(s)}
                  title={title}
                  style={{
                    padding: '8px 4px', borderRadius: 8,
                    background: bg, border: `1px solid ${color}40`,
                    textAlign: 'center',
                    cursor: s && !s.paye ? 'pointer' : 'default',
                    transition: 'transform 0.08s',
                  }}>
                  <div style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>
                    {jourNom}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a' }}>
                    {date.getDate()}/{date.getMonth() + 1}
                  </div>
                  <div style={{ fontSize: 16, marginTop: 2 }}>{icon}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {stats && stats.enAttente > 0 && (
            <button onClick={onValidateRow}
              style={{
                flex: 1, padding: '11px',
                background: '#1D9E75', color: '#fff',
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              ✓ {lang === 'ar'
                ? `التحقق من ${stats.enAttente} حصة منتظرة`
                : `Valider ${stats.enAttente} en attente`}
            </button>
          )}
          <button onClick={onClose}
            style={{
              flex: stats && stats.enAttente > 0 ? '0 1 auto' : 1,
              padding: '11px 20px',
              background: '#f5f5f0', color: '#666',
              border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {lang === 'ar' ? 'إغلاق' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Modale de paiement d'un instituteur
//
// Pré-remplit un formulaire de paiement avec le montant calculé à partir
// des séances validées non payées. Le surveillant peut modifier librement
// le montant (avance, solde partiel, etc.).
//
// Au submit : crée une dépense dans la table 'depenses' (catégorie 'salaire')
// et marque les séances concernées comme payées (paye=true + paiement_id).
// Couplage lâche : les séances restent indépendantes de Finance.
// ══════════════════════════════════════════════════════════════════════
function PaiementInstituteurModal({ inst, stats, seances, onClose, onConfirm, lang }) {
  // Date par défaut = aujourd'hui (format YYYY-MM-DD local, pas UTC)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const montantCalcule = stats?.montantDu || 0;
  const nbSeances = seances.length;

  const [montant, setMontant] = useState(montantCalcule.toFixed(2));
  const [dateDepense, setDateDepense] = useState(todayStr);
  const [description, setDescription] = useState(
    lang === 'ar'
      ? `دفع ${nbSeances} حصة`
      : `Paiement ${nbSeances} séance(s)`
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const val = parseFloat(montant);
    if (isNaN(val) || val <= 0) {
      setError(lang === 'ar' ? 'المبلغ يجب أن يكون رقما موجبا' : 'Le montant doit être un nombre positif');
      return;
    }
    setError('');
    setSaving(true);
    const res = await onConfirm({
      montant: val,
      dateDepense,
      description,
      seancesIds: seances.map(s => s.id),
    });
    setSaving(false);
    if (!res.ok) {
      setError((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + (res.error || ''));
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          padding: 24, maxWidth: 500, width: '100%',
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 13,
            background: 'linear-gradient(135deg, #E24B4A, #EF9F27)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, flexShrink: 0,
          }}>💸</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a' }}>
              {lang === 'ar' ? 'تسجيل دفع' : 'Enregistrer un paiement'}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
              {inst.prenom} {inst.nom}
              {inst.instituteur_id_ecole && (
                <span style={{
                  marginLeft: 6, padding: '1px 6px',
                  background: '#EDE9FE', color: '#534AB7',
                  borderRadius: 4, fontSize: 10, fontWeight: 700,
                }}>{inst.instituteur_id_ecole}</span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: '#f5f5f0', color: '#666', border: 'none',
              fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
              flexShrink: 0,
            }}>✕</button>
        </div>

        {/* Récap séances */}
        <div style={{
          background: '#E1F5EE', border: '1px solid #1D9E7530',
          borderRadius: 10, padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, color: '#085041', fontWeight: 700, marginBottom: 6 }}>
            📋 {lang === 'ar' ? 'الحصص القابلة للدفع' : 'Séances à payer'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1D9E75' }}>
              {nbSeances}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {lang === 'ar' ? 'حصة × ' : 'séance(s) × '}
              <strong>{stats?.tarif?.toFixed(0) || 0} {lang === 'ar' ? 'د.' : 'DH'}</strong>
              {' = '}
              <strong style={{ color: '#E24B4A' }}>
                {montantCalcule.toFixed(0)} {lang === 'ar' ? 'د.' : 'DH'}
              </strong>
            </div>
          </div>
        </div>

        {/* Champ Montant */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
            {lang === 'ar' ? 'المبلغ المدفوع' : 'Montant payé'}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min="0" step="0.01"
              value={montant}
              onChange={e => setMontant(e.target.value)}
              style={{
                flex: 1, padding: '12px 14px',
                fontSize: 18, fontWeight: 700,
                borderRadius: 10, border: '2px solid #e0e0d8',
                color: '#1a1a1a',
                fontFamily: 'inherit', textAlign: 'center', outline: 'none',
              }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#666' }}>
              {lang === 'ar' ? 'د.' : 'DH'}
            </span>
          </div>
          {montantCalcule > 0 && Math.abs(parseFloat(montant) - montantCalcule) > 0.01 && (
            <div style={{ fontSize: 10, color: '#EF9F27', marginTop: 4, fontStyle: 'italic' }}>
              ⚠️ {lang === 'ar'
                ? `يختلف عن المبلغ المحسوب (${montantCalcule.toFixed(0)} د.)`
                : `Diffère du montant calculé (${montantCalcule.toFixed(0)} DH)`}
            </div>
          )}
        </div>

        {/* Champ Date */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
            {lang === 'ar' ? 'تاريخ الدفع' : 'Date du paiement'}
          </label>
          <input type="date"
            value={dateDepense}
            onChange={e => setDateDepense(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px',
              fontSize: 13, borderRadius: 10, border: '1px solid #e0e0d8',
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>

        {/* Champ Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
            {lang === 'ar' ? 'الوصف' : 'Description'}
          </label>
          <input type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px',
              fontSize: 13, borderRadius: 10, border: '1px solid #e0e0d8',
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>

        {/* Info sur le couplage Finance */}
        <div style={{
          background: '#E6F1FB', borderLeft: '4px solid #378ADD',
          padding: '8px 12px', borderRadius: 6, marginBottom: 14,
          fontSize: 11, color: '#0C447C',
        }}>
          💡 {lang === 'ar'
            ? 'سيتم تسجيل هذا الدفع في وحدة المالية (فئة: الرواتب) وستُعلم الحصص كمدفوعة.'
            : 'Ce paiement sera enregistré dans le module Finance (catégorie : Salaires) et les séances seront marquées comme payées.'}
        </div>

        {error && (
          <div style={{
            padding: '8px 12px', background: '#FCEBEB',
            color: '#A32D2D', borderRadius: 8,
            fontSize: 12, fontWeight: 600, marginBottom: 12,
          }}>{error}</div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: '12px',
              background: '#f5f5f0', color: '#666',
              border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {lang === 'ar' ? 'إلغاء' : 'Annuler'}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            style={{
              flex: 2, padding: '12px',
              background: saving ? '#888' : 'linear-gradient(135deg, #E24B4A, #EF9F27)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
              boxShadow: saving ? 'none' : '0 2px 8px rgba(226,75,74,0.25)',
            }}>
            {saving
              ? '...'
              : (lang === 'ar' ? '💸 تأكيد الدفع' : '💸 Confirmer le paiement')}
          </button>
        </div>
      </div>
    </div>
  );
}
