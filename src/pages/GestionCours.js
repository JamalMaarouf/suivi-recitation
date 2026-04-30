import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';

// ══════════════════════════════════════════════════════════════════════
// PAGE GESTION COURS DE FOND
// Accessible depuis Gestion → Paramètres école → Cours
//
// Gère le paramétrage des cours de fond (Tajwid, Tafsir, Sira, etc.)
// distincts de la récitation du Coran.
//
// Cette page s'occupe UNIQUEMENT du CRUD des cours eux-mêmes :
//   - créer/modifier/supprimer un cours
//   - l'associer à un ou plusieurs niveaux
//   - nommage trilingue (arabe / français / anglais)
//   - catégorie libre + durée estimée
//
// L'édition des AXES d'un cours se fait dans une page dédiée (étape 3).
// Le SUIVI des cours (validation axes) se fait dans un menu principal
// "Cours" séparé (étape 4).
// ══════════════════════════════════════════════════════════════════════

export default function GestionCours({ user, navigate, goBack, lang, isMobile }) {
  const { toast } = useToast();

  // ─── State ──────────────────────────────────────────────────
  const [cours, setCours] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [loading, setLoading] = useState(true);
  // Formulaire d'ajout/édition (null = fermé, object = ouvert)
  // editing = null → mode ajout ; editing = coursObj → mode édition
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nom_ar: '', nom_fr: '', nom_en: '',
    categorie: '', description: '',
    annee_estimee: '',
    niveauCodes: [],  // array de codes niveau (multi-select)
  });
  const [saving, setSaving] = useState(false);
  // Map : cours_id → nb axes total (pour afficher le badge)
  const [coursAxesCount, setCoursAxesCount] = useState({});
  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // ─── Chargement initial ────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    const [coursRes, niveauxRes] = await Promise.all([
      supabase.from('cours')
        .select('id, nom_ar, nom_fr, nom_en, categorie, description, annee_estimee, ordre, actif, created_at')
        .eq('ecole_id', user.ecole_id)
        .eq('actif', true)
        .order('ordre', { ascending: true }),
      supabase.from('niveaux')
        .select('id, code, nom, couleur')
        .eq('ecole_id', user.ecole_id)
        .order('ordre', { ascending: true }),
    ]);
    const coursList = coursRes.data || [];
    setCours(coursList);
    setNiveaux(niveauxRes.data || []);

    // Charger les associations cours × niveaux
    if (coursList.length > 0) {
      const ids = coursList.map(c => c.id);
      const [liaisonsRes, axesCountRes] = await Promise.all([
        supabase.from('cours_niveaux')
          .select('cours_id, code_niveau')
          .in('cours_id', ids),
        supabase.from('cours_axes')
          .select('cours_id')
          .in('cours_id', ids),
      ]);
      // Map cours_id → array de codes niveaux
      const liaisonsMap = {};
      (liaisonsRes.data || []).forEach(l => {
        if (!liaisonsMap[l.cours_id]) liaisonsMap[l.cours_id] = [];
        liaisonsMap[l.cours_id].push(l.code_niveau);
      });
      // Attacher aux cours pour l'affichage
      setCours(coursList.map(c => ({ ...c, niveauCodes: liaisonsMap[c.id] || [] })));
      // Map cours_id → nb axes
      const axesCount = {};
      (axesCountRes.data || []).forEach(a => {
        axesCount[a.cours_id] = (axesCount[a.cours_id] || 0) + 1;
      });
      setCoursAxesCount(axesCount);
    }
    setLoading(false);
  };
  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, []);

  // ─── Ouvrir formulaire : ajout ou édition ──────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({
      nom_ar: '', nom_fr: '', nom_en: '',
      categorie: '', description: '',
      annee_estimee: '',
      niveauCodes: [],
    });
    setFormOpen(true);
  };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      nom_ar: c.nom_ar || '',
      nom_fr: c.nom_fr || '',
      nom_en: c.nom_en || '',
      categorie: c.categorie || '',
      description: c.description || '',
      annee_estimee: c.annee_estimee !== null && c.annee_estimee !== undefined ? String(c.annee_estimee) : '',
      niveauCodes: c.niveauCodes || [],
    });
    setFormOpen(true);
  };

  // ─── Sauvegarder (insert ou update) ────────────────────────
  const handleSave = async () => {
    // Validation : nom_ar obligatoire, au moins 1 niveau assigné
    if (!form.nom_ar.trim()) {
      toast.error(lang === 'ar' ? 'الاسم بالعربية إلزامي' : 'Le nom en arabe est obligatoire');
      return;
    }
    if (form.niveauCodes.length === 0) {
      toast.error(lang === 'ar' ? 'اختر مستوى واحدا على الأقل' : 'Choisis au moins un niveau');
      return;
    }
    setSaving(true);
    const payload = {
      nom_ar: form.nom_ar.trim(),
      nom_fr: form.nom_fr.trim() || null,
      nom_en: form.nom_en.trim() || null,
      categorie: form.categorie.trim() || null,
      description: form.description.trim() || null,
      annee_estimee: form.annee_estimee ? parseFloat(form.annee_estimee) : null,
      ecole_id: user.ecole_id,
    };
    let coursId;
    if (editing) {
      // UPDATE
      const { error } = await supabase.from('cours').update(payload).eq('id', editing.id);
      if (error) {
        setSaving(false);
        toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
        return;
      }
      coursId = editing.id;
      // Supprimer les anciennes liaisons + recréer
      await supabase.from('cours_niveaux').delete().eq('cours_id', coursId);
    } else {
      // INSERT
      payload.created_by = user.id;
      payload.ordre = cours.length;  // à la fin par défaut
      const { data, error } = await supabase.from('cours').insert(payload).select('id').maybeSingle();
      if (error) {
        setSaving(false);
        toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
        return;
      }
      coursId = data?.id;
    }
    // Insérer les liaisons cours × niveaux
    if (coursId && form.niveauCodes.length > 0) {
      const liaisons = form.niveauCodes.map(code => ({ cours_id: coursId, code_niveau: code }));
      const { error: liaisonError } = await supabase.from('cours_niveaux').insert(liaisons);
      if (liaisonError) {
        setSaving(false);
        toast.error((lang === 'ar' ? 'خطأ في ربط المستويات: ' : 'Erreur liaisons : ') + liaisonError.message);
        return;
      }
    }
    setSaving(false);
    setFormOpen(false);
    toast.success(editing
      ? (lang === 'ar' ? '✅ تم التعديل' : '✅ Cours modifié')
      : (lang === 'ar' ? '✅ تم إنشاء الدرس' : '✅ Cours créé'));
    loadData();
  };

  // ─── Suppression (soft delete : actif=false) ───────────────
  const handleDelete = (c) => {
    const nom = c.nom_ar || c.nom_fr || 'ce cours';
    setConfirmModal({
      isOpen: true,
      title: lang === 'ar' ? '🗑 حذف الدرس' : '🗑 Supprimer le cours',
      message: lang === 'ar'
        ? `هل أنت متأكد من حذف "${nom}"؟ سيتم حذف جميع المحاور والتحقق منها أيضا.`
        : `Confirmer la suppression de "${nom}" ? Tous les axes et validations seront aussi supprimés.`,
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, isOpen: false }));
        const { error } = await supabase.from('cours').delete().eq('id', c.id);
        if (error) {
          toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
          return;
        }
        toast.success(lang === 'ar' ? '✅ تم الحذف' : '✅ Supprimé');
        loadData();
      },
    });
  };

  // Toggle niveau dans le formulaire
  const toggleNiveau = (code) => {
    setForm(f => {
      const set = new Set(f.niveauCodes);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...f, niveauCodes: Array.from(set) };
    });
  };

  // Libellé cours affiché selon la langue
  const nomAffiche = (c) => {
    if (lang === 'ar') return c.nom_ar;
    if (lang === 'en') return c.nom_en || c.nom_fr || c.nom_ar;
    return c.nom_fr || c.nom_ar;
  };

  // Niveau par code (pour afficher couleurs)
  const niveauByCode = React.useMemo(() => {
    const m = {};
    niveaux.forEach(n => { m[n.code] = n; });
    return m;
  }, [niveaux]);

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
                📚 {lang === 'ar' ? 'الدروس' : 'Cours'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {lang === 'ar' ? 'إدارة الدروس و المحاور' : 'Gestion des cours et axes'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <PageHeader
            title="Cours"
            titleAr="الدروس"
            icon="📚"
            subtitle={lang === 'ar' ? 'إدارة الدروس، المحاور و المستويات المعنية' : 'Paramétrer les cours, leurs axes et les niveaux concernés'}
            onBack={() => goBack ? goBack() : navigate('gestion')}
            lang={lang}
            actions={
              <button onClick={openCreate}
                style={{
                  padding: '9px 14px', background: '#1D9E75', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ➕ {lang === 'ar' ? 'إضافة درس' : 'Ajouter un cours'}
              </button>
            }
          />
        </div>
      )}

      {/* Contenu */}
      <div style={{ padding: isMobile ? '14px' : '0 1.5rem' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
          </div>
        ) : (
          <>
            {/* Bouton ajouter - mobile */}
            {isMobile && (
              <button onClick={openCreate}
                style={{
                  width: '100%', padding: '12px',
                  background: '#1D9E75', color: '#fff',
                  border: 'none', borderRadius: 10, marginBottom: 14,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ➕ {lang === 'ar' ? 'إضافة درس' : 'Ajouter un cours'}
              </button>
            )}

            {/* Liste */}
            {cours.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center', color: '#888',
                background: '#fff', borderRadius: 12, border: '1px dashed #ccc',
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {lang === 'ar' ? 'لا توجد دروس' : 'Aucun cours créé'}
                </div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {lang === 'ar' ? 'ابدأ بإضافة درس' : 'Commence par ajouter un cours'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cours.map(c => (
                  <div key={c.id} style={{
                    background: '#fff', borderRadius: 12, padding: 16,
                    border: '1px solid #e0e0d8',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: '#E6F1FB', color: '#0C447C',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, flexShrink: 0,
                      }}>📚</div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                          {nomAffiche(c)}
                        </div>
                        {/* Autres langues */}
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          {lang !== 'ar' && c.nom_ar && <span>{c.nom_ar}</span>}
                          {lang !== 'fr' && c.nom_fr && <span>{lang !== 'ar' ? ' · ' : ''}{c.nom_fr}</span>}
                          {lang !== 'en' && c.nom_en && <span>{(lang !== 'ar' || c.nom_fr) ? ' · ' : ''}{c.nom_en}</span>}
                        </div>
                        {/* Catégorie + durée */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {c.categorie && (
                            <span style={{
                              padding: '2px 8px', background: '#EDE9FE', color: '#534AB7',
                              borderRadius: 6, fontSize: 10, fontWeight: 700,
                            }}>{c.categorie}</span>
                          )}
                          {c.annee_estimee && (
                            <span style={{
                              padding: '2px 8px', background: '#FAEEDA', color: '#633806',
                              borderRadius: 6, fontSize: 10, fontWeight: 700,
                            }}>
                              ⏱ {c.annee_estimee} {lang === 'ar' ? 'سنة' : 'an(s)'}
                            </span>
                          )}
                          <span style={{
                            padding: '2px 8px', background: '#E1F5EE', color: '#085041',
                            borderRadius: 6, fontSize: 10, fontWeight: 700,
                          }}>
                            📝 {coursAxesCount[c.id] || 0} {lang === 'ar' ? 'محور' : 'axe(s)'}
                          </span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => navigate('cours_axes', c.id)}
                          title={lang === 'ar' ? 'إدارة المحاور' : 'Gérer les axes'}
                          style={{
                            padding: '6px 10px', background: '#E6F1FB', color: '#378ADD',
                            border: '1px solid #378ADD30', borderRadius: 8,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                          📝 {lang === 'ar' ? 'المحاور' : 'Axes'}
                        </button>
                        <button onClick={() => openEdit(c)}
                          title={lang === 'ar' ? 'تعديل' : 'Modifier'}
                          style={{
                            padding: '6px 10px', background: '#f5f5f0', color: '#666',
                            border: '1px solid #e0e0d8', borderRadius: 8,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          }}>✏️</button>
                        <button onClick={() => handleDelete(c)}
                          title={lang === 'ar' ? 'حذف' : 'Supprimer'}
                          style={{
                            padding: '6px 10px', background: '#FCEBEB', color: '#E24B4A',
                            border: '1px solid #E24B4A30', borderRadius: 8,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          }}>🗑</button>
                      </div>
                    </div>

                    {/* Niveaux associés */}
                    {c.niveauCodes && c.niveauCodes.length > 0 && (
                      <div style={{
                        marginTop: 10, paddingTop: 10,
                        borderTop: '1px solid #f0f0ec',
                        display: 'flex', gap: 6, flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: 10, color: '#888', marginRight: 4, alignSelf: 'center' }}>
                          🎯 {lang === 'ar' ? 'مستويات:' : 'Niveaux :'}
                        </span>
                        {c.niveauCodes.map(code => {
                          const n = niveauByCode[code];
                          const couleur = n?.couleur || '#888';
                          return (
                            <span key={code} style={{
                              padding: '2px 10px',
                              background: `${couleur}20`, color: couleur,
                              borderRadius: 12, fontSize: 11, fontWeight: 700,
                              border: `1px solid ${couleur}40`,
                            }}>{n?.nom || code}</span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ MODALE FORMULAIRE AJOUT/ÉDITION ═══ */}
      {formOpen && (
        <div onClick={() => setFormOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16,
              padding: 24, maxWidth: 560, width: '100%',
              maxHeight: '92vh', overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
            {/* Header modale */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: '#E6F1FB', color: '#0C447C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>📚</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a' }}>
                  {editing
                    ? (lang === 'ar' ? 'تعديل الدرس' : 'Modifier le cours')
                    : (lang === 'ar' ? 'إضافة درس جديد' : 'Nouveau cours')}
                </div>
              </div>
              <button onClick={() => setFormOpen(false)}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: '#f5f5f0', color: '#666', border: 'none',
                  fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
                  flexShrink: 0,
                }}>✕</button>
            </div>

            {/* Nom arabe (obligatoire) */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                {lang === 'ar' ? 'الاسم بالعربية' : 'Nom (arabe)'} <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <input type="text"
                dir="rtl"
                value={form.nom_ar}
                onChange={e => setForm(f => ({ ...f, nom_ar: e.target.value }))}
                placeholder="مثلا: التجويد"
                style={{
                  width: '100%', padding: '10px 14px',
                  fontSize: 15, fontWeight: 600,
                  borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }} />
            </div>

            {/* Nom français */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                {lang === 'ar' ? 'الاسم بالفرنسية' : 'Nom (français)'}
              </label>
              <input type="text"
                value={form.nom_fr}
                onChange={e => setForm(f => ({ ...f, nom_fr: e.target.value }))}
                placeholder="ex: Tajwid"
                style={{
                  width: '100%', padding: '10px 14px',
                  fontSize: 13, borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }} />
            </div>

            {/* Nom anglais */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                {lang === 'ar' ? 'الاسم بالإنجليزية' : 'Nom (anglais)'}
              </label>
              <input type="text"
                value={form.nom_en}
                onChange={e => setForm(f => ({ ...f, nom_en: e.target.value }))}
                placeholder="ex: Tajwid"
                style={{
                  width: '100%', padding: '10px 14px',
                  fontSize: 13, borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }} />
            </div>

            {/* Catégorie + Durée sur la même ligne */}
            <div style={{
              display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
              gap: 10, marginBottom: 12,
            }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                  {lang === 'ar' ? 'الفئة (اختياري)' : 'Catégorie (optionnel)'}
                </label>
                <input type="text"
                  value={form.categorie}
                  onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                  placeholder={lang === 'ar' ? 'مثلا: علوم القرآن' : 'ex: Sciences du Coran'}
                  style={{
                    width: '100%', padding: '10px 14px',
                    fontSize: 13, borderRadius: 10, border: '1px solid #e0e0d8',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                  {lang === 'ar' ? 'المدة (سنة)' : 'Durée (an)'}
                </label>
                <input type="number" step="0.5" min="0"
                  value={form.annee_estimee}
                  onChange={e => setForm(f => ({ ...f, annee_estimee: e.target.value }))}
                  placeholder="1"
                  style={{
                    width: '100%', padding: '10px 14px',
                    fontSize: 13, borderRadius: 10, border: '1px solid #e0e0d8',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }} />
              </div>
            </div>

            {/* Description (optionnelle, multilignes) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                {lang === 'ar' ? 'الوصف (اختياري)' : 'Description (optionnel)'}
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={lang === 'ar' ? 'وصف مختصر للدرس...' : 'Description courte du cours...'}
                rows={2}
                style={{
                  width: '100%', padding: '10px 14px',
                  fontSize: 13, borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  resize: 'vertical',
                }} />
            </div>

            {/* Niveaux (multi-select avec pills) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                🎯 {lang === 'ar' ? 'المستويات المعنية' : 'Niveaux concernés'} <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              {niveaux.length === 0 ? (
                <div style={{
                  padding: 12, background: '#FAEEDA', borderRadius: 8,
                  fontSize: 12, color: '#633806',
                }}>
                  ⚠️ {lang === 'ar' ? 'لا توجد مستويات. أضف مستويات أولا.' : 'Aucun niveau. Ajoute des niveaux d\'abord.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {niveaux.map(n => {
                    const checked = form.niveauCodes.includes(n.code);
                    const couleur = n.couleur || '#888';
                    return (
                      <button key={n.code} type="button"
                        onClick={() => toggleNiveau(n.code)}
                        style={{
                          padding: '7px 14px', borderRadius: 999,
                          border: `1.5px solid ${checked ? couleur : '#e0e0d8'}`,
                          background: checked ? `${couleur}20` : '#fff',
                          color: checked ? couleur : '#888',
                          fontSize: 12, fontWeight: checked ? 700 : 500,
                          cursor: 'pointer', fontFamily: 'inherit',
                          transition: 'all 0.1s',
                        }}>
                        {checked ? '✓ ' : ''}{n.nom}
                      </button>
                    );
                  })}
                </div>
              )}
              {form.niveauCodes.length > 0 && (
                <div style={{ fontSize: 10, color: '#888', marginTop: 6 }}>
                  {form.niveauCodes.length} {lang === 'ar' ? 'مستوى محدد' : 'niveau(x) sélectionné(s)'}
                </div>
              )}
            </div>

            {/* Info : les axes se gèrent dans une autre page */}
            {editing && (
              <div style={{
                background: '#E6F1FB', borderLeft: '4px solid #378ADD',
                padding: '8px 12px', borderRadius: 6, marginBottom: 14,
                fontSize: 11, color: '#0C447C',
              }}>
                💡 {lang === 'ar'
                  ? 'لإضافة أو تعديل المحاور، انقر على زر "المحاور" من القائمة'
                  : 'Pour ajouter/modifier les axes, clique sur le bouton "📝 Axes" depuis la liste'}
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setFormOpen(false)}
                style={{
                  flex: 1, padding: '12px',
                  background: '#f5f5f0', color: '#666',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {lang === 'ar' ? 'إلغاء' : 'Annuler'}
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{
                  flex: 2, padding: '12px',
                  background: saving ? '#888' : '#1D9E75',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700,
                  cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>
                {saving
                  ? '...'
                  : (editing
                      ? (lang === 'ar' ? '💾 حفظ التعديل' : '💾 Enregistrer')
                      : (lang === 'ar' ? '✓ إنشاء الدرس' : '✓ Créer le cours'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(m => ({ ...m, isOpen: false }))}
        lang={lang}
      />
    </div>
  );
}
