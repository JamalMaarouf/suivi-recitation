import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';

// ══════════════════════════════════════════════════════════════════════
// PAGE GESTION ASSIDUITÉ
// Accessible depuis Gestion → Paramètres école → Assiduité
//
// Contient 2 sections :
// 1) Seuils d'assiduité (à risque / parfait) — stockés dans table ecoles
// 2) Jours non travaillés — stockés dans table jours_non_travailles
// ══════════════════════════════════════════════════════════════════════
export default function GestionAssiduite({ user, navigate, goBack, lang, isMobile }) {
  const { toast } = useToast();

  // ─── State Seuils ───────────────────────────────────────────
  const [seuilRisque, setSeuilRisque] = useState(80);
  const [seuilParfait, setSeuilParfait] = useState(100);
  const [seuilsLoading, setSeuilsLoading] = useState(true);
  const [seuilsSaving, setSeuilsSaving] = useState(false);

  // ─── State Jours non travaillés ─────────────────────────────
  const [jours, setJours] = useState([]);
  const [joursLoading, setJoursLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formDebut, setFormDebut] = useState('');
  const [formFin, setFormFin] = useState('');
  const [adding, setAdding] = useState(false);

  // ─── State PIN kiosque ──────────────────────────────────────
  // PIN a 4 chiffres requis pour sortir du mode kiosque verrouille
  const [pinKiosque, setPinKiosque] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinSet, setPinSet] = useState(false);  // true si un PIN est deja defini
  const [pinSaving, setPinSaving] = useState(false);

  // Confirmation suppression
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const hideConfirm = () => setConfirmModal(m => ({ ...m, isOpen: false, onConfirm: null }));
  const showConfirm = (title, message, onConfirm) => setConfirmModal({
    isOpen: true, title, message, onConfirm,
  });

  // ─── Chargement initial ────────────────────────────────────
  const loadData = async () => {
    setSeuilsLoading(true);
    setJoursLoading(true);
    const [ecoleRes, joursRes] = await Promise.all([
      supabase.from('ecoles')
        .select('seuil_assiduite_risque, seuil_assiduite_parfait, pin_kiosque')
        .eq('id', user.ecole_id)
        .maybeSingle(),
      supabase.from('jours_non_travailles')
        .select('id, date_debut, date_fin, label')
        .eq('ecole_id', user.ecole_id)
        .order('date_debut', { ascending: true }),
    ]);
    if (ecoleRes.data) {
      if (ecoleRes.data.seuil_assiduite_risque !== null && ecoleRes.data.seuil_assiduite_risque !== undefined) {
        setSeuilRisque(ecoleRes.data.seuil_assiduite_risque);
      }
      if (ecoleRes.data.seuil_assiduite_parfait !== null && ecoleRes.data.seuil_assiduite_parfait !== undefined) {
        setSeuilParfait(ecoleRes.data.seuil_assiduite_parfait);
      }
      // PIN kiosque : on ne charge pas la valeur par securite (hash coté UI),
      // mais on affiche juste s'il est defini ou non (pour que le surveillant
      // sache s'il doit en creer un ou modifier l'existant)
      setPinSet(!!ecoleRes.data.pin_kiosque);
    }
    setJours(joursRes.data || []);
    setSeuilsLoading(false);
    setJoursLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  // ─── Sauvegarde seuils ─────────────────────────────────────
  const saveSeuils = async () => {
    // Validations
    if (seuilRisque < 0 || seuilRisque > 100) {
      toast.error(lang === 'ar' ? 'عتبة الخطر يجب أن تكون بين 0 و 100' : 'Le seuil à risque doit être entre 0 et 100');
      return;
    }
    if (seuilParfait < 0 || seuilParfait > 100) {
      toast.error(lang === 'ar' ? 'عتبة المواظبة التامة يجب أن تكون بين 0 و 100' : 'Le seuil parfait doit être entre 0 et 100');
      return;
    }
    if (seuilRisque >= seuilParfait) {
      toast.error(lang === 'ar'
        ? 'عتبة الخطر يجب أن تكون أقل من عتبة المواظبة'
        : 'Le seuil à risque doit être inférieur au seuil parfait');
      return;
    }
    setSeuilsSaving(true);
    const { error } = await supabase.from('ecoles')
      .update({
        seuil_assiduite_risque: seuilRisque,
        seuil_assiduite_parfait: seuilParfait,
      })
      .eq('id', user.ecole_id);
    setSeuilsSaving(false);
    if (error) {
      console.error('[saveSeuils]', error);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    toast.success(lang === 'ar' ? '✅ تم حفظ العتبات' : '✅ Seuils enregistrés');
  };

  // ─── Sauvegarde PIN kiosque ────────────────────────────────
  const savePin = async () => {
    // Validations : 4 chiffres exactement
    if (!/^\d{4}$/.test(pinKiosque)) {
      toast.error(lang === 'ar'
        ? 'الرمز يجب أن يتكون من 4 أرقام'
        : 'Le PIN doit contenir exactement 4 chiffres');
      return;
    }
    if (pinKiosque !== pinConfirm) {
      toast.error(lang === 'ar'
        ? 'الرمزان لا يتطابقان'
        : 'Les deux PINs ne correspondent pas');
      return;
    }
    setPinSaving(true);
    const { error } = await supabase.from('ecoles')
      .update({ pin_kiosque: pinKiosque })
      .eq('id', user.ecole_id);
    setPinSaving(false);
    if (error) {
      console.error('[savePin]', error);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    setPinKiosque('');
    setPinConfirm('');
    setPinSet(true);
    toast.success(lang === 'ar' ? '✅ تم حفظ رمز الكشك' : '✅ PIN kiosque enregistré');
  };

  // ─── Suppression du PIN (remet a NULL) ─────────────────────
  const deletePin = () => {
    showConfirm(
      lang === 'ar' ? 'حذف رمز الكشك' : 'Supprimer le PIN',
      lang === 'ar'
        ? 'سيتم تعطيل وضع الكشك. هل تريد المتابعة؟'
        : 'Cela désactivera le mode kiosque. Continuer ?',
      async () => {
        const { error } = await supabase.from('ecoles')
          .update({ pin_kiosque: null })
          .eq('id', user.ecole_id);
        hideConfirm();
        if (error) {
          toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
          return;
        }
        setPinSet(false);
        toast.success(lang === 'ar' ? '✅ تم الحذف' : '✅ PIN supprimé');
      }
    );
  };

  // ─── Ajout jour non travaillé ──────────────────────────────
  const addJour = async () => {
    if (!formDebut) {
      toast.error(lang === 'ar' ? 'تاريخ البداية إلزامي' : 'Date de début obligatoire');
      return;
    }
    const fin = formFin || formDebut;  // si vide = 1 seul jour
    if (fin < formDebut) {
      toast.error(lang === 'ar' ? 'تاريخ النهاية قبل تاريخ البداية' : 'Date de fin avant date de début');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('jours_non_travailles').insert({
      ecole_id: user.ecole_id,
      date_debut: formDebut,
      date_fin: fin,
      label: formLabel.trim() || null,
    });
    setAdding(false);
    if (error) {
      console.error('[addJour]', error);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    toast.success(lang === 'ar' ? '✅ تمت الإضافة' : '✅ Période ajoutée');
    setFormLabel('');
    setFormDebut('');
    setFormFin('');
    setShowForm(false);
    loadData();
  };

  // ─── Suppression ──────────────────────────────────────────
  const deleteJour = (jour) => {
    const label = jour.label || formatDateCompact(jour.date_debut, lang);
    showConfirm(
      lang === 'ar' ? 'حذف الفترة' : 'Supprimer la période',
      lang === 'ar'
        ? `هل تريد حذف "${label}" ؟`
        : `Supprimer "${label}" ?`,
      async () => {
        const { error } = await supabase.from('jours_non_travailles').delete().eq('id', jour.id);
        hideConfirm();
        if (error) {
          console.error('[deleteJour]', error);
          toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
          return;
        }
        toast.success(lang === 'ar' ? '✅ تم الحذف' : '✅ Supprimée');
        loadData();
      }
    );
  };

  // ══════════════════════════════════════════════════════════
  // Rendu
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ background: isMobile ? '#f5f5f0' : 'transparent', minHeight: isMobile ? '100vh' : 'auto', paddingBottom: 80 }}>

      {/* ─── Header ─── */}
      {isMobile ? (
        <div style={{
          background: 'linear-gradient(135deg, #085041, #1D9E75)',
          color: '#fff',
          padding: '48px 16px 14px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('gestion')}
              style={{
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.2)',
                border: 'none', borderRadius: 10, padding: 0, flexShrink: 0,
                color: '#fff', fontSize: 18, cursor: 'pointer',
              }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                📅 {lang === 'ar' ? 'إعدادات الحضور' : 'Assiduité'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {lang === 'ar' ? 'العتبات و أيام العطل' : 'Seuils & jours non travaillés'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <PageHeader
            title="Assiduité"
            titleAr="إعدادات الحضور"
            icon="📅"
            subtitle={lang === 'ar' ? 'العتبات و أيام العطل' : 'Seuils & jours non travaillés'}
            onBack={() => navigate('gestion')}
            lang={lang}
          />
        </div>
      )}

      {/* ─── Contenu ─── */}
      <div style={{ padding: isMobile ? '14px' : '0 1.5rem' }}>

        {/* ════════════════════════════════════════════ */}
        {/* SECTION 1 : SEUILS D'ASSIDUITÉ              */}
        {/* ════════════════════════════════════════════ */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: isMobile ? 16 : 20,
          marginBottom: 16, border: '1px solid #e0e0d8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 22 }}>📊</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                {lang === 'ar' ? 'عتبات الحضور' : 'Seuils d\'assiduité'}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                {lang === 'ar'
                  ? 'تُستعمل لتصنيف الطلاب في لوحة المتابعة'
                  : 'Utilisés pour classer les élèves dans le dashboard'}
              </div>
            </div>
          </div>

          {seuilsLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>
              {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12, marginBottom: 14,
              }}>
                {/* Seuil à risque */}
                <div style={{
                  background: '#FCEBEB', padding: 14, borderRadius: 10,
                  border: '1px solid #E24B4A30',
                }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#A32D2D', display: 'block', marginBottom: 6 }}>
                    {lang === 'ar' ? '⚠️ عتبة الخطر' : '⚠️ Seuil à risque'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min="0" max="100"
                      value={seuilRisque}
                      onChange={e => setSeuilRisque(parseInt(e.target.value) || 0)}
                      style={{
                        flex: 1, padding: '10px 12px', fontSize: 16, fontWeight: 700,
                        borderRadius: 8, border: '1px solid #E24B4A50',
                        background: '#fff', color: '#A32D2D',
                        fontFamily: 'inherit', textAlign: 'center', outline: 'none',
                      }} />
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#A32D2D' }}>%</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
                    {lang === 'ar'
                      ? `الطلاب بنسبة أقل من ${seuilRisque}% يعتبرون في خطر`
                      : `Élèves avec un taux < ${seuilRisque}% classés à risque`}
                  </div>
                </div>

                {/* Seuil parfait */}
                <div style={{
                  background: '#E1F5EE', padding: 14, borderRadius: 10,
                  border: '1px solid #1D9E7530',
                }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#085041', display: 'block', marginBottom: 6 }}>
                    {lang === 'ar' ? '🌟 عتبة المواظبة التامة' : '🌟 Seuil assiduité parfaite'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min="0" max="100"
                      value={seuilParfait}
                      onChange={e => setSeuilParfait(parseInt(e.target.value) || 0)}
                      style={{
                        flex: 1, padding: '10px 12px', fontSize: 16, fontWeight: 700,
                        borderRadius: 8, border: '1px solid #1D9E7550',
                        background: '#fff', color: '#085041',
                        fontFamily: 'inherit', textAlign: 'center', outline: 'none',
                      }} />
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#085041' }}>%</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
                    {lang === 'ar'
                      ? `الطلاب بنسبة أعلى أو تساوي ${seuilParfait}% يعتبرون ممتازين`
                      : `Élèves avec un taux ≥ ${seuilParfait}% classés parfaits`}
                  </div>
                </div>
              </div>

              <button onClick={saveSeuils} disabled={seuilsSaving}
                style={{
                  width: '100%', padding: '12px',
                  background: seuilsSaving ? '#888' : 'linear-gradient(135deg, #085041, #1D9E75)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700,
                  cursor: seuilsSaving ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}>
                {seuilsSaving
                  ? (lang === 'ar' ? '...جاري الحفظ' : 'Enregistrement...')
                  : (lang === 'ar' ? '💾 حفظ العتبات' : '💾 Enregistrer les seuils')}
              </button>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════ */}
        {/* SECTION 2 : JOURS NON TRAVAILLÉS             */}
        {/* ════════════════════════════════════════════ */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: isMobile ? 16 : 20,
          border: '1px solid #e0e0d8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 22 }}>🗓️</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                {lang === 'ar' ? 'أيام العطل و الإجازات' : 'Jours non travaillés'}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                {lang === 'ar'
                  ? 'فترات غير محسوبة في الغياب (أعياد، عطل، إلخ.)'
                  : 'Périodes exclues du calcul d\'absences (fériés, vacances...)'}
              </div>
            </div>
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                style={{
                  padding: '8px 14px', background: '#1D9E75', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', flexShrink: 0,
                }}>
                + {lang === 'ar' ? 'إضافة' : 'Ajouter'}
              </button>
            )}
          </div>

          {/* Formulaire d'ajout */}
          {showForm && (
            <div style={{
              background: '#E1F5EE', padding: 14, borderRadius: 10,
              border: '1px solid #1D9E7530', marginBottom: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#085041', marginBottom: 10 }}>
                {lang === 'ar' ? '➕ إضافة فترة جديدة' : '➕ Nouvelle période'}
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
                <input type="text" value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  placeholder={lang === 'ar' ? 'الاسم (مثلاً: عيد الفطر)' : 'Nom (ex: Aïd al-Fitr)'}
                  style={{
                    padding: '10px 12px', fontSize: 13, borderRadius: 8,
                    border: '1px solid #1D9E7540', fontFamily: 'inherit', outline: 'none',
                  }} />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 10,
                }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>
                      {lang === 'ar' ? 'من' : 'Du'}
                    </label>
                    <input type="date" value={formDebut}
                      onChange={e => setFormDebut(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8,
                        border: '1px solid #1D9E7540', fontFamily: 'inherit', outline: 'none',
                        boxSizing: 'border-box',
                      }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>
                      {lang === 'ar' ? 'إلى (اختياري - يوم واحد إذا كانت فارغة)' : 'Au (optionnel - 1 jour si vide)'}
                    </label>
                    <input type="date" value={formFin}
                      onChange={e => setFormFin(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8,
                        border: '1px solid #1D9E7540', fontFamily: 'inherit', outline: 'none',
                        boxSizing: 'border-box',
                      }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addJour} disabled={adding}
                  style={{
                    flex: 1, padding: '10px',
                    background: adding ? '#888' : '#1D9E75', color: '#fff',
                    border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    cursor: adding ? 'wait' : 'pointer', fontFamily: 'inherit',
                  }}>
                  {adding
                    ? (lang === 'ar' ? '...' : '...')
                    : (lang === 'ar' ? '✓ إضافة' : '✓ Ajouter')}
                </button>
                <button onClick={() => { setShowForm(false); setFormLabel(''); setFormDebut(''); setFormFin(''); }}
                  style={{
                    padding: '10px 16px',
                    background: '#fff', color: '#666',
                    border: '1px solid #c0c0b8', borderRadius: 8,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
              </div>
            </div>
          )}

          {/* Liste des périodes existantes */}
          {joursLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>
              {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
            </div>
          ) : jours.length === 0 ? (
            <div style={{
              padding: 30, textAlign: 'center', color: '#888',
              background: '#f5f5f0', borderRadius: 10, border: '1px dashed #ccc',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>
                {lang === 'ar' ? 'لم تتم إضافة فترات بعد' : 'Aucune période définie'}
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                {lang === 'ar'
                  ? 'أضف أياماً مستثناة من حساب الغياب'
                  : 'Ajoute des jours à exclure du calcul d\'absences'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jours.map(j => {
                const unJour = j.date_debut === j.date_fin;
                return (
                  <div key={j.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: '#f9f9f5', borderRadius: 10,
                    border: '1px solid #e0e0d8',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: '#FAEEDA', color: '#EF9F27',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>🌴</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {j.label && (
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                          {j.label}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#666', marginTop: j.label ? 2 : 0 }}>
                        {unJour
                          ? formatDateCompact(j.date_debut, lang)
                          : `${formatDateCompact(j.date_debut, lang)} → ${formatDateCompact(j.date_fin, lang)}`}
                      </div>
                    </div>
                    <button onClick={() => deleteJour(j)}
                      style={{
                        background: '#FCEBEB', color: '#E24B4A',
                        border: 'none', borderRadius: 8,
                        padding: '7px 9px', fontSize: 12, cursor: 'pointer',
                        flexShrink: 0,
                      }}>
                      🗑
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════ */}
        {/* SECTION 3 : PIN KIOSQUE (protection Finance)  */}
        {/* ════════════════════════════════════════════ */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: isMobile ? 16 : 20,
          marginTop: 16, border: '1px solid #e0e0d8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 22 }}>🔒</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                {lang === 'ar' ? 'رمز وضع الكشك' : 'PIN mode kiosque'}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                {lang === 'ar'
                  ? 'رمز من 4 أرقام مطلوب للخروج من وضع الكشك المقفل'
                  : 'Code à 4 chiffres requis pour sortir du mode kiosque verrouillé'}
              </div>
            </div>
            {pinSet && (
              <div style={{
                padding: '4px 10px', background: '#E1F5EE',
                color: '#085041', borderRadius: 6,
                fontSize: 11, fontWeight: 700,
              }}>
                ✓ {lang === 'ar' ? 'مفعّل' : 'Défini'}
              </div>
            )}
          </div>

          {/* Info explication */}
          <div style={{
            background: '#E6F1FB', borderLeft: '4px solid #378ADD',
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            fontSize: 12, color: '#0C447C',
          }}>
            💡 {lang === 'ar'
              ? 'عند تفعيل وضع الكشك، لن يتمكن أحد من الوصول إلى القوائم الأخرى (المالية، الإدارة...) دون إدخال الرمز.'
              : 'Une fois le mode kiosque activé, personne ne peut accéder aux autres menus (Finance, Gestion...) sans saisir ce PIN.'}
          </div>

          <div style={{
            background: '#FAEEDA', padding: 14, borderRadius: 10,
            border: '1px solid #EF9F2730',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 10, marginBottom: 10,
            }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#633806', display: 'block', marginBottom: 4 }}>
                  {lang === 'ar'
                    ? (pinSet ? 'رمز جديد (4 أرقام)' : 'الرمز (4 أرقام)')
                    : (pinSet ? 'Nouveau PIN (4 chiffres)' : 'PIN (4 chiffres)')}
                </label>
                <input type="password"
                  inputMode="numeric" maxLength={4}
                  value={pinKiosque}
                  onChange={e => setPinKiosque(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="••••"
                  style={{
                    width: '100%', padding: '11px 12px',
                    fontSize: 20, fontWeight: 700, letterSpacing: 8,
                    borderRadius: 8, border: '1px solid #EF9F2750',
                    background: '#fff', color: '#633806',
                    fontFamily: 'monospace', textAlign: 'center', outline: 'none',
                    boxSizing: 'border-box',
                  }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#633806', display: 'block', marginBottom: 4 }}>
                  {lang === 'ar' ? 'تأكيد الرمز' : 'Confirmer le PIN'}
                </label>
                <input type="password"
                  inputMode="numeric" maxLength={4}
                  value={pinConfirm}
                  onChange={e => setPinConfirm(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="••••"
                  style={{
                    width: '100%', padding: '11px 12px',
                    fontSize: 20, fontWeight: 700, letterSpacing: 8,
                    borderRadius: 8, border: '1px solid #EF9F2750',
                    background: '#fff', color: '#633806',
                    fontFamily: 'monospace', textAlign: 'center', outline: 'none',
                    boxSizing: 'border-box',
                  }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={savePin} disabled={pinSaving}
                style={{
                  flex: 1, minWidth: 140, padding: '10px 14px',
                  background: pinSaving ? '#888' : '#EF9F27',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700,
                  cursor: pinSaving ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}>
                {pinSaving
                  ? '...'
                  : (pinSet
                      ? (lang === 'ar' ? '🔄 تغيير الرمز' : '🔄 Changer le PIN')
                      : (lang === 'ar' ? '🔒 حفظ الرمز' : '🔒 Enregistrer le PIN'))}
              </button>
              {pinSet && (
                <button onClick={deletePin}
                  style={{
                    padding: '10px 14px',
                    background: '#FCEBEB', color: '#E24B4A',
                    border: '1px solid #E24B4A30', borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  🗑 {lang === 'ar' ? 'حذف الرمز' : 'Supprimer'}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modale de confirmation */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={hideConfirm}
        lang={lang}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Helper : format date compact
// ──────────────────────────────────────────────────────────────
function formatDateCompact(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}
