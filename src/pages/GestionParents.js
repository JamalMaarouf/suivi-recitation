import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import PageHeader from '../components/PageHeader';

// ══════════════════════════════════════════════════════════════════════
// PAGE GESTION PARAMÈTRES PARENTS
// Accessible depuis Gestion → Paramètres école → Parents
//
// Permet au surveillant de configurer les seuils qui déterminent si
// un parent est classé 'actif', 'peu actif' ou 'inactif' dans le
// dashboard de suivi.
//
// Stockage : ecoles.seuil_parent_actif_jours + ecoles.seuil_parent_peu_actif_jours
// ══════════════════════════════════════════════════════════════════════

export default function GestionParents({ user, navigate, goBack, lang, isMobile }) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seuilActif, setSeuilActif] = useState(7);
  const [seuilPeuActif, setSeuilPeuActif] = useState(30);
  const [stats, setStats] = useState(null);

  // ─── Chargement ─────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    const [ecoleRes, visitesRes] = await Promise.all([
      supabase.from('ecoles')
        .select('seuil_parent_actif_jours, seuil_parent_peu_actif_jours')
        .eq('id', user.ecole_id).maybeSingle(),
      supabase.from('parents_visites')
        .select('parent_id, date_visite')
        .eq('ecole_id', user.ecole_id),
    ]);
    if (ecoleRes.data) {
      setSeuilActif(ecoleRes.data.seuil_parent_actif_jours ?? 7);
      setSeuilPeuActif(ecoleRes.data.seuil_parent_peu_actif_jours ?? 30);
    }
    // Stats rapides pour prévisualisation
    const visites = visitesRes.data || [];
    const parentsUniques = new Set(visites.map(v => v.parent_id));
    setStats({
      nbParentsActifs: parentsUniques.size,
      nbVisitesTotal: visites.length,
    });
    setLoading(false);
  };
  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, []);

  // ─── Sauvegarde ────────────────────────────────────────────
  const handleSave = async () => {
    // Validation : seuils positifs et seuilActif < seuilPeuActif
    const a = parseInt(seuilActif, 10);
    const p = parseInt(seuilPeuActif, 10);
    if (isNaN(a) || a < 1 || isNaN(p) || p < 1) {
      toast.error(lang === 'ar' ? 'قيم غير صالحة' : 'Valeurs invalides');
      return;
    }
    if (a >= p) {
      toast.error(lang === 'ar'
        ? 'عتبة "نشط" يجب أن تكون أقل من عتبة "قليل النشاط"'
        : 'Le seuil "actif" doit être inférieur au seuil "peu actif"');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('ecoles').update({
      seuil_parent_actif_jours: a,
      seuil_parent_peu_actif_jours: p,
    }).eq('id', user.ecole_id);
    setSaving(false);
    if (error) {
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    toast.success(lang === 'ar' ? '✅ تم الحفظ' : '✅ Paramètres enregistrés');
  };

  return (
    <div style={{ background: isMobile ? '#f5f5f0' : 'transparent', minHeight: isMobile ? '100vh' : 'auto', paddingBottom: 80 }}>

      {/* Header */}
      {isMobile ? (
        <div style={{
          background: 'linear-gradient(135deg, #085041, #1D9E75)',
          color: '#fff', padding: '48px 16px 14px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => goBack ? goBack() : navigate('gestion')}
              style={{
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10,
                padding: 0, flexShrink: 0, color: '#fff', fontSize: 18, cursor: 'pointer',
              }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                👨‍👩‍👧 {lang === 'ar' ? 'متابعة الأولياء' : 'Suivi parents'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {lang === 'ar' ? 'عتبات نشاط الأولياء' : 'Seuils d\'activité des parents'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <PageHeader
            title="Suivi parents"
            titleAr="متابعة الأولياء"
            icon="👨‍👩‍👧"
            subtitle={lang === 'ar' ? 'عتبات تصنيف نشاط الأولياء' : "Seuils de classification de l'activité des parents"}
            onBack={() => goBack ? goBack() : navigate('gestion')}
            lang={lang}
          />
        </div>
      )}

      <div style={{ padding: isMobile ? '14px' : '0 1.5rem' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
          </div>
        ) : (
          <>
            {/* Info explicative */}
            <div style={{
              background: '#E6F1FB', borderLeft: '4px solid #378ADD',
              padding: '12px 14px', borderRadius: 10, marginBottom: 14,
              fontSize: 12, color: '#0C447C', lineHeight: 1.5,
            }}>
              💡 {lang === 'ar'
                ? 'يتم تصنيف كل ولي بحسب آخر تاريخ زيارة لحساب ابنه في البوابة. العتبات قابلة للتخصيص حسب احتياجات مدرستك.'
                : 'Chaque parent est classé selon sa date de dernière visite au portail. Les seuils sont personnalisables selon les besoins de ton école.'}
            </div>

            {/* Bloc de configuration */}
            <div style={{
              background: '#fff', borderRadius: 12, padding: 18,
              border: '1px solid #e0e0d8', marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', marginBottom: 14 }}>
                ⚙️ {lang === 'ar' ? 'إعداد العتبات' : 'Configuration des seuils'}
              </div>

              {/* Seuil actif */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#085041', display: 'block', marginBottom: 6 }}>
                  🟢 {lang === 'ar' ? 'ولي نشط إذا آخر زيارة أقل من:' : 'Parent actif si dernière visite < à :'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="number" min="1" max="365"
                    value={seuilActif}
                    onChange={e => setSeuilActif(e.target.value)}
                    style={{
                      width: 100, padding: '10px 14px', fontSize: 15, fontWeight: 700,
                      borderRadius: 10, border: '1px solid #1D9E7560',
                      fontFamily: 'inherit', outline: 'none', textAlign: 'center',
                      color: '#085041', background: '#E1F5EE',
                    }} />
                  <span style={{ fontSize: 13, color: '#666' }}>
                    {lang === 'ar' ? 'يوم' : 'jour(s)'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' }}>
                  {lang === 'ar'
                    ? `مثال: عتبة ${seuilActif} = الأولياء الذين زاروا في آخر ${seuilActif} يوم يعتبرون نشطين`
                    : `Exemple : seuil ${seuilActif} = les parents venus dans les ${seuilActif} derniers jours sont actifs`}
                </div>
              </div>

              {/* Seuil peu actif */}
              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#EF9F27', display: 'block', marginBottom: 6 }}>
                  🟡 {lang === 'ar' ? 'ولي قليل النشاط إذا آخر زيارة أقل من:' : 'Parent peu actif si dernière visite < à :'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="number" min="1" max="365"
                    value={seuilPeuActif}
                    onChange={e => setSeuilPeuActif(e.target.value)}
                    style={{
                      width: 100, padding: '10px 14px', fontSize: 15, fontWeight: 700,
                      borderRadius: 10, border: '1px solid #EF9F2760',
                      fontFamily: 'inherit', outline: 'none', textAlign: 'center',
                      color: '#633806', background: '#FAEEDA',
                    }} />
                  <span style={{ fontSize: 13, color: '#666' }}>
                    {lang === 'ar' ? 'يوم' : 'jour(s)'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' }}>
                  {lang === 'ar'
                    ? `ولي لم يزر منذ أكثر من ${seuilPeuActif} يوم = غير نشط 🔴`
                    : `Parent non venu depuis plus de ${seuilPeuActif} jours = inactif 🔴`}
                </div>
              </div>
            </div>

            {/* Aperçu visuel des catégories */}
            <div style={{
              background: '#fff', borderRadius: 12, padding: 18,
              border: '1px solid #e0e0d8', marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', marginBottom: 12 }}>
                🎨 {lang === 'ar' ? 'معاينة التصنيفات' : 'Aperçu des catégories'}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                gap: 8,
              }}>
                <CategorieCard
                  emoji="🟢"
                  label={lang === 'ar' ? 'نشط' : 'Actif'}
                  desc={lang === 'ar' ? `< ${seuilActif} يوم` : `< ${seuilActif} jour(s)`}
                  color="#1D9E75" bg="#E1F5EE"
                />
                <CategorieCard
                  emoji="🟡"
                  label={lang === 'ar' ? 'قليل النشاط' : 'Peu actif'}
                  desc={lang === 'ar'
                    ? `${seuilActif}-${seuilPeuActif} يوم`
                    : `${seuilActif}-${seuilPeuActif} jour(s)`}
                  color="#EF9F27" bg="#FAEEDA"
                />
                <CategorieCard
                  emoji="🔴"
                  label={lang === 'ar' ? 'غير نشط' : 'Inactif'}
                  desc={lang === 'ar' ? `> ${seuilPeuActif} يوم` : `> ${seuilPeuActif} jours`}
                  color="#E24B4A" bg="#FCEBEB"
                />
                <CategorieCard
                  emoji="⚪"
                  label={lang === 'ar' ? 'لم يزر' : 'Jamais venu'}
                  desc={lang === 'ar' ? 'لا زيارة' : '0 visite'}
                  color="#888" bg="#f5f5f0"
                />
              </div>
            </div>

            {/* Stats actuelles */}
            {stats && (
              <div style={{
                background: '#E6F1FB', borderRadius: 12, padding: 14,
                border: '1px solid #378ADD30', marginBottom: 14,
                display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
              }}>
                <div style={{ fontSize: 24 }}>📊</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, color: '#0C447C', fontWeight: 700 }}>
                    {lang === 'ar' ? 'إحصائيات حالية' : 'Statistiques actuelles'}
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    {lang === 'ar'
                      ? `${stats.nbParentsActifs} ولي زار المنصة · ${stats.nbVisitesTotal} زيارة إجمالا`
                      : `${stats.nbParentsActifs} parent(s) ont déjà visité · ${stats.nbVisitesTotal} visite(s) enregistrée(s)`}
                  </div>
                </div>
                <button onClick={() => navigate('parents')}
                  style={{
                    padding: '8px 14px', background: '#378ADD', color: '#fff',
                    border: 'none', borderRadius: 8,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {lang === 'ar' ? '👁 عرض التفاصيل' : '👁 Voir détails'}
                </button>
              </div>
            )}

            {/* Bouton enregistrer */}
            <button onClick={handleSave} disabled={saving}
              style={{
                width: '100%', padding: '14px',
                background: saving ? '#888' : '#1D9E75',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 800,
                cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}>
              {saving ? '...' : `💾 ${lang === 'ar' ? 'حفظ الإعدادات' : 'Enregistrer les paramètres'}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Mini carte pour chaque catégorie
function CategorieCard({ emoji, label, desc, color, bg }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: bg, borderRadius: 10,
      border: `1px solid ${color}30`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{desc}</div>
    </div>
  );
}
