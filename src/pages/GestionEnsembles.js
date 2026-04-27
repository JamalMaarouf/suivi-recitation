import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { t } from '../lib/i18n';

export default function GestionEnsembles({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,      setNiveaux]      = useState([]);
  const [ensembles,    setEnsembles]    = useState([]);
  const [souratesDB,   setSouratesDB]   = useState([]);
  const [programmeIds, setProgrammeIds] = useState([]);
  const [ecoleConfig,  setEcoleConfig]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [filtreNiveau, setFiltreNiveau] = useState('all');
  const scrollRef = useRef(null);

  const emptyForm = { niveau_id: '', nom: '', ordre: 1, sourates_ids: [] };
  const [form, setForm] = useState(emptyForm);

  // ── CHARGEMENT ─────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  const loadAll = async (niveauAafficher) => {
    setLoading(true);
    const [{ data: nd }, { data: ed }, { data: sd }, { data: ec }] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur,sens_recitation')
        .eq('ecole_id', user.ecole_id).eq('type', 'sourate').order('ordre'),
      supabase.from('ensembles_sourates').select('*')
        .eq('ecole_id', user.ecole_id).order('niveau_id,ordre'),
      supabase.from('sourates').select('*').order('numero'),
      supabase.from('ecoles').select('sens_recitation_defaut').eq('id', user.ecole_id).maybeSingle(),
    ]);
    setNiveaux(nd || []);
    setEnsembles(ed || []);
    setSouratesDB(sd || []);
    setEcoleConfig(ec || null);
    setLoading(false);
  };

  const chargerProgramme = async (niveauId) => {
    if (!niveauId) { setProgrammeIds([]); return; }
    const { data } = await supabase.from('programmes')
      .select('reference_id').eq('niveau_id', niveauId)
      .eq('ecole_id', user.ecole_id).order('ordre');
    if (!data || data.length === 0) { setProgrammeIds([]); return; }
    // reference_id est stocke en TEXT en BDD (cf colonne data_type='text').
    // Pour les niveaux sourate, il contient l'id integer de la sourate sous forme string
    // (insert : reference_id: String(id) - voir GestionNiveaux ligne 320).
    // On convertit en integer pour comparer correctement avec souratesDB.id (integer).
    const setIdsValides = new Set(souratesDB.map(s => s.id));
    const ids = data
      .map(d => parseInt(d.reference_id))
      .filter(id => !isNaN(id) && setIdsValides.has(id));
    setProgrammeIds(ids);
  };

  // ── FORMULAIRE ─────────────────────────────────────────────────
  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setProgrammeIds([]);
    setShowForm(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setProgrammeIds([]);
    setShowForm(true);
  };

  const openEdit = async (e) => {
    setEditing(e.id);
    setForm({ niveau_id: e.niveau_id || '', nom: e.nom, ordre: e.ordre, sourates_ids: e.sourates_ids || [] });
    await chargerProgramme(e.niveau_id);
    setShowForm(true);
  };

  const toggleSourate = (id) => {
    const scrollTop = scrollRef.current?.scrollTop || 0;
    setForm(f => ({
      ...f,
      sourates_ids: f.sourates_ids.includes(id)
        ? f.sourates_ids.filter(x => x !== id)
        : [...f.sourates_ids, id]
    }));
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
    });
  };

  const save = async () => {
    if (saving) return;
    if (!form.niveau_id) return toast.warning(lang === 'ar' ? 'اختر المستوى' : 'Sélectionnez un niveau');
    if (!form.nom.trim()) return toast.warning(lang === 'ar' ? 'الاسم إلزامي' : 'Le nom est obligatoire');
    if (form.sourates_ids.length === 0) return toast.warning(lang === 'ar' ? 'اختر سورة واحدة على الأقل' : 'Sélectionnez au moins une sourate');
    setSaving(true);
    const payload = {
      ecole_id: user.ecole_id,
      niveau_id: form.niveau_id,
      nom: form.nom.trim(),
      ordre: parseInt(form.ordre) || 1,
      sourates_ids: form.sourates_ids,
    };
    const { error } = editing
      ? await supabase.from('ensembles_sourates').update(payload).eq('id', editing)
      : await supabase.from('ensembles_sourates').insert(payload);
    if (error) { setSaving(false); toast.error(error.message || 'Erreur'); return; }
    toast.success(editing ? '✅ Modifié !' : '✅ Ensemble ajouté !');
    resetForm();
    setSaving(false);
    loadAll();
  };

  const supprimer = (e) => {
    setConfirmModal({
      isOpen: true,
      title: lang === 'ar' ? 'حذف المجموعة' : "Supprimer l'ensemble",
      message: (lang === 'ar' ? 'حذف ' : 'Supprimer ') + e.nom + ' ?',
      onConfirm: async () => {
        await supabase.from('ensembles_sourates').delete().eq('id', e.id);
        toast.success(lang === 'ar' ? 'تم الحذف' : 'Supprimé');
        setConfirmModal({ isOpen: false });
        loadAll();
      }
    });
  };

  // ── DONNÉES CALCULÉES ──────────────────────────────────────────
  const niveauForm = niveaux.find(n => n.id === form.niveau_id);
  const ncForm = niveauForm?.couleur || '#1D9E75';
  const sensForm = niveauForm?.sens_recitation || ecoleConfig?.sens_recitation_defaut || 'desc';
  // Tri des sourates selon le sens du niveau :
  // desc = 114 → 1 (on commence par An-Nas)
  // asc  = 1 → 114 (on commence par Al-Fatiha)
  const souratesProg = souratesDB.filter(s => programmeIds.includes(s.id))
    .sort((a, b) => sensForm === 'asc' ? a.numero - b.numero : b.numero - a.numero);
  const sAffectees = ensembles
    .filter(e => e.niveau_id === form.niveau_id && e.id !== editing)
    .flatMap(e => e.sourates_ids || []);
  const nonAffectees = souratesProg.filter(s => !sAffectees.includes(s.id));
  const dejaDansAutre = souratesProg.filter(s => sAffectees.includes(s.id));

  // Grouper les ensembles par niveau pour l'affichage
  const groupes = niveaux
    .map(niv => ({ niv, items: ensembles.filter(e => e.niveau_id === niv.id).sort((a, b) => a.ordre - b.ordre) }))
    .filter(g => g.items.length > 0);

  const nomSourate = (id) => souratesDB.find(s => s.id === id)?.nom_ar || '';

  // ── PANNEAU FORMULAIRE ─────────────────────────────────────────
  const PanneauForm = () => {
    if (!showForm) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center', padding: isMobile ? 0 : '20px'
      }}>
        <div style={{
          background: '#fff', width: '100%', maxWidth: 640,
          maxHeight: isMobile ? '94vh' : '88vh',
          borderRadius: isMobile ? '20px 20px 0 0' : '16px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)'
        }}>
          {/* Header */}
          <div style={{ padding: '16px 18px 14px', borderBottom: '0.5px solid #e0e0d8', flexShrink: 0,
            background: `linear-gradient(135deg, ${ncForm}08, #fff)` }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ flex: 1, fontWeight: 800, fontSize: 16, color: '#1a1a1a' }}>
                📦 {editing ? (lang === 'ar' ? 'تعديل المجموعة' : "Modifier l'ensemble") : (lang === 'ar' ? 'إضافة مجموعة جديدة' : 'Nouvel ensemble')}
              </div>
              <button onClick={resetForm} style={{ width:30, height:30, borderRadius:'50%', background:'#f5f5f0', border:'none', fontSize:16, cursor:'pointer', color:'#888', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            {/* ① Niveau */}
            <div style={{ marginBottom: 12 }}>
              <label className="field-lbl">
                {lang === 'ar' ? '① اختر المستوى' : '① Choisir le niveau'}
              </label>
              <select value={form.niveau_id}
                onChange={async e => {
                  const nid = e.target.value;
                  setForm(f => ({ ...f, niveau_id: nid, sourates_ids: [] }));
                  if (nid) await chargerProgramme(nid);
                  else setProgrammeIds([]);
                }}
                className="field-select" style={{border:`1.5px solid ${ncForm}50`,fontSize:14}}>
                <option value="">— {lang === 'ar' ? 'اختر المستوى' : 'Sélectionnez un niveau'} —</option>
                {niveaux.map(n => <option key={n.id} value={n.id}>{n.code} — {n.nom}</option>)}
              </select>
            </div>

            {/* ② Nom */}
            {form.niveau_id && (
              <div>
                <label className="field-lbl">
                  {lang === 'ar' ? '② اسم المجموعة' : "② Nom de l'ensemble"}
                </label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder={lang === 'ar' ? 'مثال: المجموعة الأولى' : 'Ex: Groupe 1 — Juz Amma'}
                  autoFocus
                  className="field-input" style={{border:`1.5px solid ${ncForm}50`,fontSize:15}} />
              </div>
            )}
          </div>

          {/* Légende */}
          {form.niveau_id && (
            <div style={{
              padding: '8px 18px', background: '#f9f9f6',
              borderBottom: '0.5px solid #e0e0d8', flexShrink: 0,
              display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: ncForm }} />
                {lang === 'ar' ? 'محدد' : 'Sélectionné'} <span style={{ fontWeight: 700, color: ncForm }}>({form.sourates_ids.length})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f5f5f0', border: '1px solid #e0e0d8' }} />
                {lang === 'ar' ? 'متاحة' : 'Disponibles'} <span style={{ fontWeight: 600 }}>({nonAffectees.length})</span>
              </div>
              {dejaDansAutre.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#EF9F27' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: '#FAEEDA', border: '1px solid #EF9F27' }} />
                  {lang === 'ar' ? 'في مجموعة أخرى' : 'Dans autre ensemble'} <span style={{ fontWeight: 600 }}>({dejaDansAutre.length})</span>
                </div>
              )}
              <div style={{ marginRight: 'auto', display: 'flex', gap: 6 }}>
                {nonAffectees.length > 0 && (
                  <button onClick={() => setForm(f => ({ ...f, sourates_ids: (nonAffectees||[]).map(s => s.id) }))}
                    style={{ padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${ncForm}`, background: `${ncForm}15`, color: ncForm, fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                    {lang === 'ar' ? 'تحديد المتاحة' : 'Sél. disponibles'}
                  </button>
                )}
                {form.sourates_ids.length > 0 && (
                  <button onClick={() => setForm(f => ({ ...f, sourates_ids: [] }))}
                    style={{ padding: '3px 10px', borderRadius: 20, border: '0.5px solid #e0e0d8', background: '#FCEBEB', fontSize: 11, cursor: 'pointer', color: '#E24B4A', fontFamily: 'inherit' }}>
                    ✕ {lang === 'ar' ? 'مسح' : 'Effacer'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ③ Liste sourates */}
          {!form.niveau_id ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#aaa', padding: '2rem' }}>
              <div style={{ fontSize: 36 }}>☝️</div>
              <div style={{ fontSize: 14, textAlign: 'center' }}>
                {lang === 'ar' ? 'اختر المستوى أولاً' : "Choisissez d'abord un niveau"}
              </div>
            </div>
          ) : souratesProg.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, padding: '2rem' }}>
              <div style={{ fontSize: 36 }}>⚠️</div>
              <div style={{ fontSize: 14, textAlign: 'center', color: '#633806' }}>
                {lang === 'ar' ? 'لا يوجد برنامج لهذا المستوى' : 'Aucun programme défini pour ce niveau'}
              </div>
              <button onClick={() => { resetForm(); navigate('niveaux'); }}
                style={{ padding: '10px 20px', background: ncForm, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'ar' ? 'انتقل إلى المستويات' : 'Définir le programme →'}
              </button>
            </div>
          ) : (
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 18px', overscrollBehavior: 'contain' }}>
              {/* Disponibles */}
              {nonAffectees.length > 0 && (
                <>
                  <div className="section-label" style={{marginTop:8}}>
                    ③ {lang === 'ar' ? 'متاحة' : 'Disponibles'} ({nonAffectees.length})
                  </div>
                  {(nonAffectees||[]).map(s => {
                    const sel = form.sourates_ids.includes(s.id);
                    return (
                      <div key={s.id} onClick={() => toggleSourate(s.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 5, background: sel ? `${ncForm}12` : '#f5f5f0', border: `1.5px solid ${sel ? ncForm : '#e0e0d8'}` }}>
                        <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${sel ? ncForm : '#ccc'}`, background: sel ? ncForm : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {sel && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 11, color: '#aaa', minWidth: 24 }}>{s.numero}</span>
                        <span style={{ flex: 1, fontSize: 14, fontFamily: "'Tajawal',Arial", direction: 'rtl', color: sel ? ncForm : '#333', fontWeight: sel ? 700 : 400 }}>{s.nom_ar}</span>
                      </div>
                    );
                  })}
                </>
              )}
              {/* Dans autre ensemble */}
              {dejaDansAutre.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#EF9F27', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {lang === 'ar' ? 'في مجموعة أخرى (قابلة لإعادة التعيين)' : 'Dans un autre ensemble (réassignable)'}
                  </div>
                  {dejaDansAutre.map(s => {
                    const sel = form.sourates_ids.includes(s.id);
                    const autreEns = ensembles.find(e => e.niveau_id === form.niveau_id && e.id !== editing && (e.sourates_ids || [])?.includes(s.id));
                    return (
                      <div key={s.id} onClick={() => toggleSourate(s.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 5, background: sel ? `${ncForm}12` : '#FAEEDA30', border: `1.5px solid ${sel ? ncForm : '#EF9F2750'}` }}>
                        <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${sel ? ncForm : '#EF9F27'}`, background: sel ? ncForm : '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {sel ? <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span> : <span style={{ color: '#EF9F27', fontSize: 10 }}>↺</span>}
                        </div>
                        <span style={{ fontSize: 11, color: '#aaa', minWidth: 24 }}>{s.numero}</span>
                        <span style={{ flex: 1, fontSize: 14, fontFamily: "'Tajawal',Arial", direction: 'rtl', color: sel ? ncForm : '#633806', fontWeight: sel ? 700 : 400 }}>{s.nom_ar}</span>
                        {!sel && autreEns && (
                          <span style={{ fontSize: 10, color: '#EF9F27', padding: '1px 6px', borderRadius: 10, background: '#FAEEDA', flexShrink: 0 }}>{autreEns.nom}</span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Boutons */}
          <div style={{ padding: '14px 18px', borderTop: '0.5px solid #e0e0d8', flexShrink: 0, display: 'flex', gap: 8 }}>
            <button onClick={resetForm} style={{ flex: 1, padding: '13px', background: '#f5f5f0', color: '#666', border: '0.5px solid #e0e0d8', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition:'all 0.15s' }}>
              {lang === 'ar' ? 'إلغاء' : 'Annuler'}
            </button>
            <button onClick={save} disabled={saving || !form.niveau_id || !form.nom.trim() || form.sourates_ids.length === 0}
              style={{ flex: 2, padding: '13px', background: saving || !form.niveau_id || !form.nom.trim() || form.sourates_ids.length === 0 ? '#e0e0d8' : editing ? 'linear-gradient(135deg,#378ADD,#1a6ab1)' : `linear-gradient(135deg,${ncForm},#085041)`, color: saving || !form.niveau_id || !form.nom.trim() || form.sourates_ids.length === 0 ? '#aaa' : '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: saving || !form.niveau_id || !form.nom.trim() || form.sourates_ids.length === 0 ? 'none' : '0 2px 8px rgba(0,0,0,0.15)', transition:'all 0.15s' }}>
              {saving ? '...' : editing ? (lang === 'ar' ? 'تحديث' : 'Mettre à jour ✓') : (lang === 'ar' ? 'حفظ المجموعة' : 'Enregistrer')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── CARTE ENSEMBLE ─────────────────────────────────────────────
  const CarteEnsemble = ({ e, cniv }) => {
    const niveauE = niveaux.find(n => n.id === e.niveau_id);
    const sensE = niveauE?.sens_recitation || ecoleConfig?.sens_recitation_defaut || 'desc';
    const sEns = souratesDB.filter(s => (e.sourates_ids || []).includes(s.id))
      .sort((a, b) => sensE === 'asc' ? a.numero - b.numero : b.numero - a.numero);
    return (
      <div onClick={()=>openEdit(e)}
        style={{ background:'#fff', borderRadius:14, padding:'1.1rem',
          border:`0.5px solid ${cniv}25`, cursor:'pointer',
          display:'flex', alignItems:'center', gap:12,
          transition:'all 0.15s', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}
        onMouseEnter={ev=>{ev.currentTarget.style.transform='translateY(-2px)';ev.currentTarget.style.boxShadow=`0 6px 20px ${cniv}25`;ev.currentTarget.style.border=`0.5px solid ${cniv}60`;}}
        onMouseLeave={ev=>{ev.currentTarget.style.transform='translateY(0)';ev.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)';ev.currentTarget.style.border=`0.5px solid ${cniv}25`;}}>
        {/* Icône */}
        <div style={{ width:48, height:48, borderRadius:12, flexShrink:0,
          background:`linear-gradient(135deg,${cniv}25,${cniv}10)`,
          border:`1px solid ${cniv}30`,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:18, fontWeight:900, color:cniv, lineHeight:1 }}>{e.ordre}</span>
          <span style={{ fontSize:8, color:cniv, opacity:0.7, marginTop:2 }}>{sEns.length} {lang==='ar'?'سور':'s.'}</span>
        </div>
        {/* Texte */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:'#1a1a1a', marginBottom:3,
            lineHeight:1.3, wordBreak:'break-word' }}>{e.nom}</div>
          <div style={{ fontSize:11, color:'#999' }}>{sEns.length} {lang==='ar'?'سورة':'sourate(s)'}</div>
        </div>
        {/* Actions — stop propagation */}
        <div style={{ display:'flex', gap:5, flexShrink:0 }} onClick={ev=>ev.stopPropagation()}>
          <button onClick={()=>openEdit(e)}
            style={{ width:30, height:30, background:'#E6F1FB', color:'#378ADD', border:'none',
              borderRadius:8, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✏️</button>
          <button onClick={()=>supprimer(e)}
            style={{ width:30, height:30, background:'#FCEBEB', color:'#E24B4A', border:'none',
              borderRadius:8, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>🗑</button>
        </div>
        <span style={{ color:`${cniv}80`, fontSize:16, flexShrink:0 }}>›</span>
      </div>
    );
  };

  const ConfirmModal = () => confirmModal.isOpen ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{confirmModal.title}</div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>{confirmModal.message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setConfirmModal({ isOpen: false })} style={{ padding: '10px 20px', background: '#f5f5f0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {lang === 'ar' ? 'إلغاء' : 'Annuler'}
          </button>
          <button onClick={confirmModal.onConfirm} style={{ padding: '10px 20px', background: '#E24B4A', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {lang === 'ar' ? 'حذف' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── MOBILE ─────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ paddingBottom: 80, background: '#f5f5f0', minHeight: '100vh' }}>
        <div style={{ background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100 }}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={() => goBack ? goBack() : navigate('dashboard')} style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1, fontSize:17, fontWeight:800, color:'#fff'}}>📦 {lang === 'ar' ? 'مجموعات السور' : 'Ensembles'}</div>
            <button onClick={openCreate} style={{background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'8px 14px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0,whiteSpace:'nowrap'}}>+ {lang==='ar'?'إضافة':'Ajouter'}</button>
          </div>
        </div>
        <div style={{ padding: '12px' }}>
          {loading && <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>...</div>}
          {!loading && ensembles.length === 0 && (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '3rem', background: '#fff', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📦</div>
              <div>{lang === 'ar' ? 'لا توجد مجموعات بعد' : 'Aucun ensemble configuré'}</div>
            </div>
          )}
          {!loading && groupes.map(({ niv, items }) => (
            <div key={niv.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: niv.couleur, marginBottom: 8, padding: '3px 12px', borderRadius: 20, background: `${niv.couleur}15`, display: 'inline-block', border: `1px solid ${niv.couleur}30` }}>
                {niv.code} — {niv.nom}
              </div>
              {(items||[]).map(e => <CarteEnsemble key={e.id} e={e} cniv={niv.couleur || '#1D9E75'} />)}
            </div>
          ))}
        </div>
        <PanneauForm />
        <ConfirmModal />
      </div>
    );
  }

  // ── PC ──────────────────────────────────────────────────────────
  const groupesFiltres = filtreNiveau === 'all' ? groupes : groupes.filter(g => g.niv.id === filtreNiveau);

  return (
    <div style={{padding:'0 0 2rem'}}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button className="back-link" onClick={() => goBack ? goBack() : navigate('dashboard')}></button>
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:'#085041' }}>📦 {lang === 'ar' ? 'مجموعات السور' : 'Ensembles de sourates'}</div>
            <div style={{ fontSize:11, color:'#888', marginTop:1 }}>
              {ensembles.length} {lang==='ar'?'مجموعة في':'ensemble(s) sur'} {niveaux.length} {lang==='ar'?'مستوى':'niveaux'}
            </div>
          </div>
        </div>
        <button onClick={openCreate}
          style={{ padding:'9px 20px', background:'linear-gradient(135deg,#085041,#1D9E75)', color:'#fff',
            border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
            boxShadow:'0 2px 8px rgba(8,80,65,0.25)', display:'flex', alignItems:'center', gap:6 }}>
          + {lang === 'ar' ? 'إضافة مجموعة' : 'Ajouter un ensemble'}
        </button>
      </div>

      {/* Filtres niveaux */}
      {!loading && niveaux.length > 1 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:'1.25rem',
          padding:'10px 14px', background:'#fff', borderRadius:12,
          border:'0.5px solid #e8e8e0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
          <button onClick={()=>setFiltreNiveau('all')}
            style={{ padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
              background: filtreNiveau==='all' ? '#085041' : '#f5f5f0',
              color: filtreNiveau==='all' ? '#fff' : '#666',
              transition:'all 0.15s' }}>
            {lang==='ar'?'الكل':'Tous'} ({ensembles.length})
          </button>
          {groupes.map(({niv,items}) => (
            <button key={niv.id} onClick={()=>setFiltreNiveau(niv.id)}
              style={{ padding:'5px 14px', borderRadius:20, border:`1.5px solid ${filtreNiveau===niv.id?niv.couleur:'transparent'}`,
                cursor:'pointer', fontSize:12, fontWeight:600, transition:'all 0.15s',
                background: filtreNiveau===niv.id ? `${niv.couleur}15` : '#f5f5f0',
                color: filtreNiveau===niv.id ? niv.couleur : '#666' }}>
              <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%',
                background:niv.couleur, marginLeft:5, verticalAlign:'middle' }} />
              {niv.code} <span style={{ fontSize:10, opacity:0.7 }}>({items.length})</span>
            </button>
          ))}
        </div>
      )}

      {loading && <div style={{ textAlign:'center', padding:'3rem', color:'#888' }}>...</div>}

      {!loading && ensembles.length === 0 && (
        <div style={{ textAlign:'center', padding:'3rem', color:'#aaa', background:'#fff',
          borderRadius:14, border:'0.5px solid #e0e0d8' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
          <div style={{ marginBottom:8, fontWeight:600 }}>{lang === 'ar' ? 'لا توجد مجموعات' : 'Aucun ensemble configuré'}</div>
          <div style={{ fontSize:13, color:'#bbb' }}>{lang === 'ar' ? 'أضف مجموعة لتنظيم سور المستويات' : 'Groupez les sourates pour organiser la progression'}</div>
        </div>
      )}

      {!loading && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12}}>
          {groupesFiltres.flatMap(({ niv, items }) =>
            (items||[]).map(e => <CarteEnsemble key={e.id} e={e} cniv={niv.couleur || '#1D9E75'} />)
          )}
        </div>
      )}

      <PanneauForm />
      <ConfirmModal />
    </div>
  );
}
