import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import ConfirmModal from '../components/ConfirmModal';

// ══════════════════════════════════════════════════════════════════════
// PAGE ÉDITEUR D'AXES D'UN COURS
// Accessible via GestionCours → bouton "📝 Axes" d'un cours
//
// Permet de créer un arbre d'axes de profondeur illimitée :
//   Axe 1
//   ├── Axe 1.1
//   │   ├── Axe 1.1.1
//   │   └── Axe 1.1.2
//   └── Axe 1.2
//   Axe 2
//   └── Axe 2.1
//
// Technique clé : table cours_axes avec parent_axe_id (nullable = racine).
// ON DELETE CASCADE : supprimer un axe parent supprime aussi ses enfants.
// ══════════════════════════════════════════════════════════════════════

export default function GestionCoursAxes({ user, navigate, goBack, lang, isMobile, coursId }) {
  const { toast } = useToast();

  const [cours, setCours] = useState(null);
  const [axes, setAxes] = useState([]);  // liste plate de tous les axes du cours
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modale ajout/édition
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);      // axe en cours d'édition (null = ajout)
  const [parentFor, setParentFor] = useState(null);  // parent pour un nouvel axe (null = racine)
  const [form, setForm] = useState({
    nom_ar: '', nom_fr: '', nom_en: '',
    description: '', duree_estimee_seances: '',
  });
  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // ─── Chargement ─────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    const [coursRes, axesRes] = await Promise.all([
      supabase.from('cours')
        .select('id, nom_ar, nom_fr, nom_en, categorie')
        .eq('id', coursId)
        .maybeSingle(),
      supabase.from('cours_axes')
        .select('id, cours_id, parent_axe_id, nom_ar, nom_fr, nom_en, description, ordre, duree_estimee_seances')
        .eq('cours_id', coursId)
        .order('ordre', { ascending: true }),
    ]);
    setCours(coursRes.data || null);
    setAxes(axesRes.data || []);
    setLoading(false);
  };
  useEffect(() => { if (coursId) loadData(); /* eslint-disable-next-line */ }, [coursId]);

  // ─── Construction de l'arbre à partir de la liste plate ────
  // Retourne un array de nœuds racine (parent_axe_id=null), chacun
  // contient récursivement ses enfants. Trie par ordre à chaque niveau.
  const tree = useMemo(() => {
    const byParent = {};  // parent_id → array d'enfants
    axes.forEach(a => {
      const key = a.parent_axe_id || '_root';
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(a);
    });
    // Trier chaque groupe par ordre
    Object.keys(byParent).forEach(k => {
      byParent[k].sort((a, b) => a.ordre - b.ordre);
    });
    // Construire récursivement l'arbre
    const buildNode = (axe, path) => {
      const enfants = byParent[axe.id] || [];
      return {
        ...axe,
        path,  // ex: "1.2.1"
        enfants: enfants.map((e, i) => buildNode(e, `${path}.${i + 1}`)),
      };
    };
    const roots = byParent._root || [];
    return roots.map((r, i) => buildNode(r, `${i + 1}`));
  }, [axes]);

  // ─── Compter tous les axes descendants d'un nœud ───────────
  const countDescendants = (node) => {
    if (!node.enfants || node.enfants.length === 0) return 0;
    return node.enfants.reduce((sum, e) => sum + 1 + countDescendants(e), 0);
  };

  // ─── Ouvrir modale : ajout ou édition ──────────────────────
  const openCreate = (parentId = null) => {
    setEditing(null);
    setParentFor(parentId);
    setForm({ nom_ar: '', nom_fr: '', nom_en: '', description: '', duree_estimee_seances: '' });
    setFormOpen(true);
  };
  const openEdit = (axe) => {
    setEditing(axe);
    setParentFor(null);
    setForm({
      nom_ar: axe.nom_ar || '',
      nom_fr: axe.nom_fr || '',
      nom_en: axe.nom_en || '',
      description: axe.description || '',
      duree_estimee_seances: axe.duree_estimee_seances ? String(axe.duree_estimee_seances) : '',
    });
    setFormOpen(true);
  };

  // ─── Sauvegarder ────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.nom_ar.trim()) {
      toast.error(lang === 'ar' ? 'الاسم بالعربية إلزامي' : 'Le nom en arabe est obligatoire');
      return;
    }
    setSaving(true);
    const payload = {
      nom_ar: form.nom_ar.trim(),
      nom_fr: form.nom_fr.trim() || null,
      nom_en: form.nom_en.trim() || null,
      description: form.description.trim() || null,
      duree_estimee_seances: form.duree_estimee_seances
        ? parseInt(form.duree_estimee_seances, 10)
        : null,
    };
    if (editing) {
      // UPDATE
      const { error } = await supabase.from('cours_axes').update(payload).eq('id', editing.id);
      if (error) {
        setSaving(false);
        toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
        return;
      }
    } else {
      // INSERT : calculer l'ordre (max + 1 parmi les frères)
      const freres = axes.filter(a => (a.parent_axe_id || null) === (parentFor || null));
      const ordre = freres.length > 0 ? Math.max(...freres.map(f => f.ordre || 0)) + 1 : 0;
      payload.cours_id = coursId;
      payload.parent_axe_id = parentFor;
      payload.ordre = ordre;
      const { error } = await supabase.from('cours_axes').insert(payload);
      if (error) {
        setSaving(false);
        toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
        return;
      }
    }
    setSaving(false);
    setFormOpen(false);
    toast.success(editing
      ? (lang === 'ar' ? '✅ تم التعديل' : '✅ Axe modifié')
      : (lang === 'ar' ? '✅ تم الإضافة' : '✅ Axe ajouté'));
    loadData();
  };

  // ─── Suppression (CASCADE automatique sur les sous-axes) ───
  const handleDelete = (node) => {
    const nom = node.nom_ar || node.nom_fr || 'cet axe';
    const nbDesc = countDescendants(node);
    const message = nbDesc > 0
      ? (lang === 'ar'
          ? `هل أنت متأكد من حذف "${nom}"؟ سيتم حذف ${nbDesc} محور فرعي أيضا.`
          : `Confirmer la suppression de "${nom}" ? Les ${nbDesc} sous-axe(s) seront aussi supprimés.`)
      : (lang === 'ar'
          ? `هل أنت متأكد من حذف "${nom}"؟`
          : `Confirmer la suppression de "${nom}" ?`);
    setConfirmModal({
      isOpen: true,
      title: lang === 'ar' ? '🗑 حذف المحور' : '🗑 Supprimer l\'axe',
      message,
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, isOpen: false }));
        const { error } = await supabase.from('cours_axes').delete().eq('id', node.id);
        if (error) {
          toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
          return;
        }
        toast.success(lang === 'ar' ? '✅ تم الحذف' : '✅ Supprimé');
        loadData();
      },
    });
  };

  // ─── Déplacer un axe (monter/descendre dans les frères) ────
  const moveAxe = async (node, direction) => {
    // direction = -1 (monter) ou +1 (descendre)
    const freres = axes
      .filter(a => (a.parent_axe_id || null) === (node.parent_axe_id || null))
      .sort((a, b) => a.ordre - b.ordre);
    const idx = freres.findIndex(f => f.id === node.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= freres.length) return;  // hors limites
    const swap = freres[newIdx];
    // Échanger les ordres
    await supabase.from('cours_axes').update({ ordre: swap.ordre }).eq('id', node.id);
    await supabase.from('cours_axes').update({ ordre: node.ordre }).eq('id', swap.id);
    loadData();
  };

  // ─── Libellé multi-langue ──────────────────────────────────
  const nomAffiche = (a) => {
    if (lang === 'ar') return a.nom_ar;
    if (lang === 'en') return a.nom_en || a.nom_fr || a.nom_ar;
    return a.nom_fr || a.nom_ar;
  };

  // ─── Rendu récursif d'un nœud de l'arbre ───────────────────
  const renderNode = (node, depth = 0) => {
    const nbEnfants = node.enfants.length;
    const marge = depth * (isMobile ? 16 : 28);
    return (
      <div key={node.id}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: '#fff',
          border: '1px solid #e0e0d8',
          borderLeft: depth === 0
            ? '4px solid #0C447C'
            : `4px solid ${depth === 1 ? '#378ADD' : '#66A3D9'}`,
          borderRadius: 10,
          marginLeft: marge,
          marginBottom: 4,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}>
          {/* Numérotation */}
          <div style={{
            minWidth: 42, height: 26, padding: '0 6px',
            borderRadius: 6,
            background: depth === 0 ? '#E6F1FB' : '#f5f5f0',
            color: depth === 0 ? '#0C447C' : '#666',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, flexShrink: 0,
          }}>{node.path}</div>

          {/* Nom + sous-titre */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#1a1a1a',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{nomAffiche(node)}</div>
            {/* Sous-titres optionnels */}
            {(nbEnfants > 0 || node.duree_estimee_seances) && (
              <div style={{ fontSize: 10, color: '#888', marginTop: 2, display: 'flex', gap: 8 }}>
                {nbEnfants > 0 && (
                  <span>📂 {nbEnfants} {lang === 'ar' ? 'فرعي' : 'sous-axe(s)'}</span>
                )}
                {node.duree_estimee_seances && (
                  <span>⏱ {node.duree_estimee_seances} {lang === 'ar' ? 'حصة' : 'séance(s)'}</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {/* Monter / descendre */}
            <button onClick={() => moveAxe(node, -1)}
              title={lang === 'ar' ? 'رفع' : 'Monter'}
              style={{
                width: 26, height: 26, padding: 0,
                background: '#f5f5f0', color: '#666',
                border: '1px solid #e0e0d8', borderRadius: 6,
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>↑</button>
            <button onClick={() => moveAxe(node, +1)}
              title={lang === 'ar' ? 'خفض' : 'Descendre'}
              style={{
                width: 26, height: 26, padding: 0,
                background: '#f5f5f0', color: '#666',
                border: '1px solid #e0e0d8', borderRadius: 6,
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>↓</button>
            {/* Ajouter sous-axe */}
            <button onClick={() => openCreate(node.id)}
              title={lang === 'ar' ? 'إضافة فرعي' : 'Ajouter sous-axe'}
              style={{
                padding: '4px 8px',
                background: '#E1F5EE', color: '#085041',
                border: '1px solid #1D9E7540', borderRadius: 6,
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>➕</button>
            <button onClick={() => openEdit(node)}
              title={lang === 'ar' ? 'تعديل' : 'Modifier'}
              style={{
                width: 26, height: 26, padding: 0,
                background: '#E6F1FB', color: '#378ADD',
                border: '1px solid #378ADD30', borderRadius: 6,
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>✏️</button>
            <button onClick={() => handleDelete(node)}
              title={lang === 'ar' ? 'حذف' : 'Supprimer'}
              style={{
                width: 26, height: 26, padding: 0,
                background: '#FCEBEB', color: '#E24B4A',
                border: '1px solid #E24B4A30', borderRadius: 6,
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>🗑</button>
          </div>
        </div>
        {/* Rendu récursif des enfants */}
        {node.enfants.map(enfant => renderNode(enfant, depth + 1))}
      </div>
    );
  };

  // Nom du cours pour le titre
  const nomCours = cours ? (lang === 'ar' ? cours.nom_ar : (cours.nom_fr || cours.nom_ar)) : '';

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
            <button onClick={() => goBack ? goBack() : navigate('gestion_cours')}
              style={{
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10,
                padding: 0, flexShrink: 0, color: '#fff', fontSize: 18, cursor: 'pointer',
              }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                📝 {lang === 'ar' ? 'محاور:' : 'Axes :'} {nomCours}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {axes.length} {lang === 'ar' ? 'محور إجمالا' : 'axe(s) au total'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <button onClick={() => goBack ? goBack() : navigate('gestion_cours')} className="back-link"></button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>
                📝 {lang === 'ar' ? 'محاور الدرس:' : 'Axes du cours :'} {nomCours}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {axes.length} {lang === 'ar' ? 'محور إجمالا' : 'axe(s) au total'}
                {cours?.categorie && <> · {cours.categorie}</>}
              </div>
            </div>
            <button onClick={() => openCreate(null)}
              style={{
                padding: '9px 14px', background: '#1D9E75', color: '#fff',
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              ➕ {lang === 'ar' ? 'محور رئيسي' : 'Axe principal'}
            </button>
          </div>
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
            {/* Bouton ajouter mobile */}
            {isMobile && (
              <button onClick={() => openCreate(null)}
                style={{
                  width: '100%', padding: '12px',
                  background: '#1D9E75', color: '#fff',
                  border: 'none', borderRadius: 10, marginBottom: 14,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ➕ {lang === 'ar' ? 'إضافة محور رئيسي' : 'Ajouter un axe principal'}
              </button>
            )}

            {/* Info usage */}
            {tree.length > 0 && (
              <div style={{
                background: '#E6F1FB', borderLeft: '4px solid #378ADD',
                padding: '8px 12px', borderRadius: 6, marginBottom: 14,
                fontSize: 11, color: '#0C447C',
              }}>
                💡 {lang === 'ar'
                  ? 'انقر ➕ الخضراء لإضافة محاور فرعية داخل أي محور. استخدم ↑↓ لإعادة الترتيب.'
                  : 'Clique sur ➕ vert pour ajouter un sous-axe dans un axe. Utilise ↑↓ pour réordonner.'}
              </div>
            )}

            {/* Arbre */}
            {tree.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center', color: '#888',
                background: '#fff', borderRadius: 12, border: '1px dashed #ccc',
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {lang === 'ar' ? 'لا توجد محاور بعد' : 'Aucun axe pour le moment'}
                </div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {lang === 'ar'
                    ? 'أضف المحور الأول لبدء هيكلة الدرس'
                    : 'Ajoute le premier axe pour structurer le cours'}
                </div>
              </div>
            ) : (
              <div>{tree.map(node => renderNode(node, 0))}</div>
            )}
          </>
        )}
      </div>

      {/* ═══ MODALE FORMULAIRE ═══ */}
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
              padding: 24, maxWidth: 520, width: '100%',
              maxHeight: '92vh', overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: '#E6F1FB', color: '#0C447C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>📝</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a' }}>
                  {editing
                    ? (lang === 'ar' ? 'تعديل المحور' : 'Modifier l\'axe')
                    : (parentFor
                        ? (lang === 'ar' ? 'محور فرعي جديد' : 'Nouveau sous-axe')
                        : (lang === 'ar' ? 'محور رئيسي جديد' : 'Nouvel axe principal'))}
                </div>
                {parentFor && !editing && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {lang === 'ar' ? 'داخل:' : 'Dans :'} {(() => {
                      const parent = axes.find(a => a.id === parentFor);
                      return parent ? nomAffiche(parent) : '';
                    })()}
                  </div>
                )}
              </div>
              <button onClick={() => setFormOpen(false)}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: '#f5f5f0', color: '#666', border: 'none',
                  fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
                  flexShrink: 0,
                }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                {lang === 'ar' ? 'الاسم بالعربية' : 'Nom (arabe)'} <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <input type="text" dir="rtl"
                value={form.nom_ar}
                onChange={e => setForm(f => ({ ...f, nom_ar: e.target.value }))}
                placeholder="مثلا: المخارج"
                autoFocus
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 15, fontWeight: 600,
                  borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                {lang === 'ar' ? 'بالفرنسية (اختياري)' : 'Français (optionnel)'}
              </label>
              <input type="text"
                value={form.nom_fr}
                onChange={e => setForm(f => ({ ...f, nom_fr: e.target.value }))}
                placeholder="ex: Les makharij"
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 13,
                  borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                {lang === 'ar' ? 'بالإنجليزية (اختياري)' : 'Anglais (optionnel)'}
              </label>
              <input type="text"
                value={form.nom_en}
                onChange={e => setForm(f => ({ ...f, nom_en: e.target.value }))}
                placeholder="ex: Points of articulation"
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 13,
                  borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                ⏱ {lang === 'ar' ? 'عدد الحصص المقدر (اختياري)' : 'Durée estimée en séances (optionnel)'}
              </label>
              <input type="number" min="1"
                value={form.duree_estimee_seances}
                onChange={e => setForm(f => ({ ...f, duree_estimee_seances: e.target.value }))}
                placeholder="ex: 3"
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 13,
                  borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                {lang === 'ar' ? 'الوصف (اختياري)' : 'Description (optionnel)'}
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={lang === 'ar' ? 'وصف مختصر...' : 'Description courte...'}
                rows={2}
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 13,
                  borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  resize: 'vertical',
                }} />
            </div>

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
                {saving ? '...' : (editing
                  ? (lang === 'ar' ? '💾 حفظ' : '💾 Enregistrer')
                  : (lang === 'ar' ? '✓ إضافة' : '✓ Ajouter'))}
              </button>
            </div>
          </div>
        </div>
      )}

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
