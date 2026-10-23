import React from 'react';
import { supabase } from '../../lib/supabase';


// ══════════════════════════════════════════════════════
// COMPOSANT IdentiteEcoleTab — Identité école (J3 sprint 12j)
// Phase 1 : Directeur uniquement. Pourra accueillir + tard logo, nom AR/FR
// ══════════════════════════════════════════════════════
export function IdentiteEcoleTab({ user, lang, ecoleConfig, setEcoleConfig, showMsg }) {
  const [nomAr, setNomAr] = React.useState(ecoleConfig?.nom_ar || '');
  const [nomDirecteur, setNomDirecteur] = React.useState(ecoleConfig?.nom_directeur || '');
  const [nomDirecteurAr, setNomDirecteurAr] = React.useState(ecoleConfig?.nom_directeur_ar || '');
  const [saving, setSaving] = React.useState(false);

  // Resync si ecoleConfig change apres montage (rare mais propre)
  React.useEffect(() => {
    setNomAr(ecoleConfig?.nom_ar || '');
    setNomDirecteur(ecoleConfig?.nom_directeur || '');
    setNomDirecteurAr(ecoleConfig?.nom_directeur_ar || '');
  }, [ecoleConfig?.nom_ar, ecoleConfig?.nom_directeur, ecoleConfig?.nom_directeur_ar]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      nom_ar: nomAr.trim() || null,
      nom_directeur: nomDirecteur.trim() || null,
      nom_directeur_ar: nomDirecteurAr.trim() || null,
    };
    const { error } = await supabase.from('ecoles')
      .update(payload)
      .eq('id', user.ecole_id);
    setSaving(false);
    if (error) {
      showMsg('error', lang === 'ar' ? 'خطأ في الحفظ' : 'Erreur de sauvegarde');
      return;
    }
    setEcoleConfig(prev => ({ ...prev, ...payload }));
    showMsg('success', lang === 'ar' ? 'تم الحفظ' : 'Identité enregistrée');
  };

  // Apercu du header certificat (meme logique que api/pdf.js certificatHeader)
  // pour que le surveillant voie en direct ce qui apparaitra sur le diplome.
  const nomFrEcole = ecoleConfig?.nom || '';
  const PREFIXE_AR = 'المدرسة القرآنية';
  const rawNomAr = (nomAr.trim() || nomFrEcole || '');
  let apercu;
  if (!rawNomAr) apercu = 'مدرسة قرآنية';
  else if (rawNomAr.includes('مدرسة') || rawNomAr.includes('المدرسة')) apercu = rawNomAr;
  else apercu = `${PREFIXE_AR} ${rawNomAr}`;

  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 };
  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '0.5px solid #e0e0d8', fontSize: 14, fontFamily: 'inherit',
    boxSizing: 'border-box', background: '#fff',
  };
  const sectionTitleStyle = { fontSize: 14, fontWeight: 700, color: '#085041', marginBottom: 14,
    paddingBottom: 8, borderBottom: '1.5px solid #EF9F27' };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#085041', marginBottom: 8 }}>
        👔 {lang === 'ar' ? 'هوية المدرسة' : "Identité de l'école"}
      </h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 22, lineHeight: 1.5 }}>
        {lang === 'ar'
          ? 'هذه المعلومات تظهر على شهادات الامتحانات و الجلائز.'
          : "Ces informations apparaissent sur les certificats d'examens et les diplômes."}
      </p>

      {/* ─── SECTION 1 : NOM DE L'ÉCOLE ─── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '0.5px solid #e0e0d8', marginBottom: 16 }}>
        <div style={sectionTitleStyle}>
          🕌 {lang === 'ar' ? 'اسم المدرسة' : "Nom de l'école"}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>
            {lang === 'ar' ? 'الاسم (بالفرنسية)' : 'Nom (français)'}
          </label>
          <input
            type="text"
            value={nomFrEcole}
            disabled
            style={{ ...inputStyle, background: '#f9f9f6', color: '#666', cursor: 'not-allowed' }}
          />
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
            {lang === 'ar'
              ? 'لا يمكن تعديل هذا الحقل من هنا. تواصل مع المسؤول لتغييره.'
              : "Non modifiable depuis cet écran. Contacte l'administrateur pour le changer."}
          </div>
        </div>

        <div style={{ marginBottom: 4 }}>
          <label style={labelStyle}>
            {lang === 'ar' ? 'الاسم (بالعربية)' : 'Nom (arabe)'}
          </label>
          <input
            type="text"
            value={nomAr}
            onChange={e => setNomAr(e.target.value)}
            placeholder={lang === 'ar' ? 'مثال: التوحيد' : 'مثال: التوحيد'}
            style={{ ...inputStyle, direction: 'rtl', textAlign: 'right' }}
            maxLength={150}
          />
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6, lineHeight: 1.5 }}>
            {lang === 'ar'
              ? 'اختياري. سيُسبق هذا الاسم على الشهادة بـ "المدرسة القرآنية" تلقائيًا (إلا إذا احتوى الاسم على "مدرسة" مسبقًا).'
              : 'Optionnel. Sur le certificat, ce nom sera précédé automatiquement par "المدرسة القرآنية" (sauf s\'il contient déjà "مدرسة").'}
          </div>
        </div>
      </div>

      {/* ─── SECTION 2 : DIRECTEUR ─── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '0.5px solid #e0e0d8', marginBottom: 16 }}>
        <div style={sectionTitleStyle}>
          🎩 {lang === 'ar' ? 'مدير المدرسة (اختياري)' : 'Directeur (optionnel)'}
        </div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 1.5 }}>
          {lang === 'ar'
            ? 'اترك الحقلين فارغين إذا لم يكن لمدرستك مدير منفصل عن المشرف. ستظهر فقط توقيع المشرف على الشهادات.'
            : "Laisse les deux champs vides si ton école n'a pas de Directeur distinct du Surveillant. Seule la signature du Surveillant apparaîtra alors sur les certificats."}
        </p>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>
            {lang === 'ar' ? 'اسم المدير (بالفرنسية)' : 'Nom du Directeur (français)'}
          </label>
          <input
            type="text"
            value={nomDirecteur}
            onChange={e => setNomDirecteur(e.target.value)}
            placeholder={lang === 'ar' ? 'مثال: محمد الأمين' : 'Ex: Mohammed El Amine'}
            style={inputStyle}
            maxLength={100}
          />
        </div>

        <div>
          <label style={labelStyle}>
            {lang === 'ar' ? 'اسم المدير (بالعربية)' : 'Nom du Directeur (arabe)'}
          </label>
          <input
            type="text"
            value={nomDirecteurAr}
            onChange={e => setNomDirecteurAr(e.target.value)}
            placeholder={lang === 'ar' ? 'مثال: محمد الأمين' : 'مثال: محمد الأمين'}
            style={{ ...inputStyle, direction: 'rtl', textAlign: 'right' }}
            maxLength={100}
          />
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
            {lang === 'ar'
              ? 'إذا تركته فارغًا، سيُستخدم الاسم الفرنسي على الشهادات بالعربية أيضًا.'
              : 'Si vide, le nom français sera utilisé aussi sur les certificats en arabe.'}
          </div>
        </div>
      </div>

      {/* ─── BOUTON ENREGISTRER ─── */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '12px 28px', background: '#1D9E75', color: '#fff',
          border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
          cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
          opacity: saving ? 0.6 : 1, marginBottom: 24,
        }}>
        {saving ? '⏳' : '✓'} {lang === 'ar' ? 'حفظ' : 'Enregistrer'}
      </button>

      {/* ─── APERÇU CERTIFICAT ─── */}
      <div style={{ padding: 20, background: '#f9f9f6', borderRadius: 12, border: '0.5px solid #e0e0d8' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' }}>
          {lang === 'ar' ? 'معاينة على الشهادة' : 'APERÇU SUR LE CERTIFICAT'}
        </div>

        {/* Aperçu header */}
        <div style={{ background: '#fff', padding: '16px 24px', borderBottom: '1.5px solid #EF9F27', textAlign: 'center', borderRadius: '8px 8px 0 0' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#085041', direction: 'rtl' }}>
            {apercu}
          </div>
          {(ecoleConfig?.ville || ecoleConfig?.pays) && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {[ecoleConfig?.ville, ecoleConfig?.pays].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {/* Aperçu signatures (si directeur) */}
        {(nomDirecteur || nomDirecteurAr) ? (
          <div style={{ background: '#fff', padding: '20px 24px 16px', borderRadius: '0 0 8px 8px',
            display: 'flex', justifyContent: 'space-around', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ borderBottom: '1.5px solid #333', marginBottom: 6, paddingTop: 14 }}></div>
              <div style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 700, direction: 'rtl' }}>
                {nomDirecteurAr || nomDirecteur}
              </div>
              <div style={{ fontSize: 11, color: '#666', direction: 'rtl', marginTop: 2 }}>المُدير</div>
              <div style={{ fontSize: 9.5, color: '#aaa', marginTop: 2 }}>Directeur</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ borderBottom: '1.5px solid #333', marginBottom: 6, paddingTop: 14 }}></div>
              <div style={{ fontSize: 11, color: '#666', direction: 'rtl' }}>المُشرف</div>
              <div style={{ fontSize: 9.5, color: '#aaa', marginTop: 2 }}>Surveillant</div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', padding: '20px 24px 16px', borderRadius: '0 0 8px 8px',
            display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ borderBottom: '1.5px solid #333', marginBottom: 6, paddingTop: 14 }}></div>
              <div style={{ fontSize: 11, color: '#666', direction: 'rtl' }}>المُشرف</div>
              <div style={{ fontSize: 9.5, color: '#aaa', marginTop: 2 }}>Surveillant</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
