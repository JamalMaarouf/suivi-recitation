import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isSourateNiveauDyn, genererLoginParentUnique } from '../lib/helpers';
import { useToast } from '../lib/toast';
import MobileSkeletonList from '../components/MobileSkeletonList';
import { usePullToRefresh, PullToRefreshIndicator } from '../lib/usePullToRefresh';
import { hapticSuccess } from '../lib/haptic';
import AcquisSelector from '../components/AcquisSelector';

export default function ElevesMobile({ user, navigate, goBack, lang='ar' }) {
  const { toast } = useToast();
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [programmesParNiveau, setProgrammesParNiveau] = useState({});
  const [ecoleConfig, setEcoleConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('tous');
  const [showForm, setShowForm] = useState(false);
  const [editEleve, setEditEleve] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgType, setMsgType] = useState('');
  const [showAcquis, setShowAcquis] = useState(false);
  const [showEleveCree, setShowEleveCree] = useState(null); // {eleve, parent} ou null
  const [showConfirmDelete, setShowConfirmDelete] = useState(null); // {id, nom} ou null

  const emptyForm = { prenom:'', nom:'', niveau:'Débutant', code_niveau:'', eleve_id_ecole:'',
    instituteur_referent_id:'', hizb_depart:0, tomon_depart:1, sourates_acquises:0,
    hizbs_acquis:[], telephone:'', date_inscription:'', email_parent:'' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  // Body scroll lock quand drawer ouvert (evite double-scroll iOS/Android)
  useEffect(() => {
    if (showForm) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showForm]);

  const loadData = async () => {
    setLoading(true);
    try {
    const [{ data: ed }, { data: id }, { data: niv }, { data: prog }, { data: ec }] = await Promise.all([
      supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id).limit(500).order('nom').order('nom'),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id).is('suspendu_at', null),
      supabase.from('niveaux').select('id,code,nom,couleur,type,sens_recitation').eq('ecole_id', user.ecole_id).order('ordre'),
      supabase.from('programmes').select('niveau_id,reference_id,ordre,bloc_numero,bloc_nom,bloc_sens,type_contenu').eq('ecole_id', user.ecole_id),
      supabase.from('ecoles').select('sens_recitation_defaut').eq('id', user.ecole_id).maybeSingle(),
    ]);
    setEleves(ed || []);
    setInstituteurs(id || []);
    setNiveaux(niv || []);
    setEcoleConfig(ec || null);
    // Indexer programmes par code de niveau (et non niveau_id) pour usage AcquisSelector
    const niveauxById = Object.fromEntries((niv || []).map(n => [n.id, n.code]));
    const progByCode = {};
    (prog || []).forEach(p => {
      const code = niveauxById[p.niveau_id];
      if (!code) return;
      if (!progByCode[code]) progByCode[code] = [];
      progByCode[code].push(p);
    });
    setProgrammesParNiveau(progByCode);
    // Set default code_niveau to first niveau
    if (niv && niv.length > 0) {
      setForm(f => f.code_niveau ? f : { ...f, code_niveau: niv[0].code });
    }
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const showMsg = (type, text) => {
    setMsgType(type); setMsgText(text);
    setTimeout(() => setMsgText(''), 4000);
  };

  const getNiveauColor = (code) =>
    niveaux.find(n=>n.code===code)?.couleur ||
    {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[code] || '#888';

  const startAdd = () => {
    const defaultCode = niveaux[0]?.code || '1';
    setForm({ ...emptyForm, code_niveau: defaultCode });
    setEditEleve(null);
    setShowAcquis(false);
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const startEdit = (e) => {
    setForm({ prenom:e.prenom||'', nom:e.nom||'', niveau:e.niveau||'Débutant',
      code_niveau:e.code_niveau||'', eleve_id_ecole:e.eleve_id_ecole||'',
      instituteur_referent_id:e.instituteur_referent_id||'',
      hizb_depart:e.hizb_depart||0, tomon_depart:e.tomon_depart||1,
      sourates_acquises:e.sourates_acquises||0,
      hizbs_acquis: Array.isArray(e.hizbs_acquis) ? e.hizbs_acquis : [],
      telephone:e.telephone||'', date_inscription:e.date_inscription||'' });
    setEditEleve(e);
    setShowAcquis(false);
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const handleSave = async () => {
    if (!form.prenom?.trim()) return showMsg('error', lang==='ar'?'الاسم إلزامي':'Prénom obligatoire');
    if (!form.nom?.trim()) return showMsg('error', lang==='ar'?'اللقب إلزامي':'Nom obligatoire');
    if (!form.eleve_id_ecole?.trim()) return showMsg('error', lang==='ar'?'رقم التعريف إلزامي':'ID élève obligatoire');
    if (!form.instituteur_referent_id) return showMsg('error', lang==='ar'?'اختر الأستاذ المرجع':'Choisir un instituteur');
    setSaving(true);
    const payload = {
      prenom: form.prenom.trim(), nom: form.nom.trim(), niveau: form.niveau,
      code_niveau: form.code_niveau, ecole_id: user.ecole_id,
      eleve_id_ecole: form.eleve_id_ecole.trim(),
      instituteur_referent_id: form.instituteur_referent_id,
      hizb_depart: parseInt(form.hizb_depart)||0,
      tomon_depart: parseInt(form.tomon_depart)||1,
      sourates_acquises: parseInt(form.sourates_acquises)||0,
      hizbs_acquis: Array.isArray(form.hizbs_acquis) ? form.hizbs_acquis : [],
      telephone: form.telephone?.trim()||null,
      date_inscription: form.date_inscription||null,
    };
    if (editEleve) {
      const { error } = await supabase.from('eleves').update(payload).eq('id', editEleve.id);
      if (error) { showMsg('error', error.message); setSaving(false); return; }
      showMsg('success', lang==='ar'?'✅ تم تحديث الطالب':'✅ Élève mis à jour');
      setSaving(false);
      setShowForm(false);
      setEditEleve(null);
      setForm({ ...emptyForm, code_niveau: niveaux[0]?.code||'' });
      hapticSuccess();
      loadData();
    } else {
      // ── Creation eleve : reproduit la logique complete de Gestion.js
      // 1. Check unicite eleve_id_ecole
      const { data: ex } = await supabase.from('eleves').select('id')
        .eq('eleve_id_ecole', form.eleve_id_ecole.trim()).eq('ecole_id', user.ecole_id).maybeSingle();
      if (ex) { showMsg('error', lang==='ar'?'رقم التعريف مستخدم مسبقاً':'ID élève déjà utilisé'); setSaving(false); return; }

      // 2. INSERT eleve avec .select() pour recuperer l'ID (Opt 2 : 1 seule requete grace a A2)
      const { data: eleveData, error } = await supabase.from('eleves').insert(payload).select('id').single();
      if (error) { showMsg('error', error.message); setSaving(false); return; }

      // 3. ⭐ Creer le compte parent automatiquement (manquait sur mobile, fix mai 2026)
      const mdpParent = ecoleConfig?.mdp_defaut_parents || 'parent2024';
      let loginParent;
      try {
        loginParent = await genererLoginParentUnique(supabase, form.eleve_id_ecole.trim());
      } catch (err) {
        console.error('[ElevesMobile] genererLoginParentUnique:', err);
        showMsg('error', (lang==='ar'?'فشل إنشاء معرف ولي الأمر: ':'Échec génération login parent: ') + err.message);
        setSaving(false);
        return;
      }

      const { data: parentData, error: parentErr } = await supabase.from('utilisateurs').insert({
        prenom: form.prenom.trim(), nom: form.nom.trim(),
        identifiant: loginParent, mot_de_passe: mdpParent,
        role: 'parent', ecole_id: user.ecole_id, statut_compte: 'actif',
        email: (form.email_parent || '').trim() || null,
      }).select().single();
      if (parentErr) {
        console.error('[ElevesMobile] Erreur creation parent:', parentErr);
        // Non-bloquant : l'eleve a ete cree, on signale juste
        showMsg('error', (lang==='ar'?'تحذير: فشل إنشاء حساب الأب: ':'Avertissement: échec compte parent: ') + parentErr.message);
      }

      // 4. Creer le lien parent_eleve
      if (parentData?.id && eleveData?.id) {
        await supabase.from('parent_eleve').insert({
          parent_id: parentData.id, eleve_id: eleveData.id
        });
      }

      // 5. Modale recap avec login/mdp du parent (equivalent ModaleEleveCree desktop)
      setShowEleveCree({
        eleve: {
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          eleve_id_ecole: form.eleve_id_ecole.trim(),
          code_niveau: form.code_niveau,
        },
        parent: { login: loginParent, mdp: mdpParent },
      });

      setSaving(false);
      setShowForm(false);
      setForm({ ...emptyForm, code_niveau: niveaux[0]?.code||'' });
      hapticSuccess();
      setTimeout(() => loadData(), 0); // Defer pour laisser React peindre la modale d'abord
    }
  };

  const handleDelete = async (id) => {
    // UX (mai 2026) : remplacer window.confirm() natif moche par modale stylee
    const eleve = eleves.find(e => e.id === id);
    setShowConfirmDelete({ id, nom: eleve ? `${eleve.prenom} ${eleve.nom}` : '' });
  };

  const confirmDelete = async () => {
    if (!showConfirmDelete) return;
    const { error } = await supabase.from('eleves').delete().eq('id', showConfirmDelete.id);
    if (error) {
      toast.error((lang==='ar'?'خطأ: ':'Erreur: ') + error.message);
    } else {
      toast.success(lang==='ar'?'✅ تم الحذف':'✅ Élève supprimé');
    }
    setShowConfirmDelete(null);
    loadData();
  };

  const elevesFiltres = eleves.filter(e => {
    const matchSearch = !search || `${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(search.toLowerCase());
    const matchNiveau = filtreNiveau === 'tous' || e.code_niveau === filtreNiveau;
    return matchSearch && matchNiveau;
  });

  const isSour = (code) => niveaux.find(n=>n.code===code)?.type === 'sourate' || ['5B','5A','2M'].includes(code||'');
  const niveauLabel = (e) => {
    const v = e.niveau;
    if (v==='Avancé'||v==='متقدم') return { label:lang==='ar'?'متقدم':'Avancé', color:'#085041' };
    if (v==='Intermédiaire'||v==='متوسط') return { label:lang==='ar'?'متوسط':'Interm.', color:'#378ADD' };
    return { label:lang==='ar'?'مبتدئ':'Débutant', color:'#EF9F27' };
  };

  // Pull-to-refresh (Phase 2 mobile)
  const {
    pullDistance, isRefreshing, isThreshold,
    onTouchStart, onTouchMove, onTouchEnd,
  } = usePullToRefresh(loadData);

  return (
    <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}>

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)', padding:'48px 16px 16px', position:'sticky', top:0, zIndex:100}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')}
            style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:10, padding:'8px 12px', color:'#fff', fontSize:16, cursor:'pointer'}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:18, fontWeight:800, color:'#fff'}}>👥 {lang==='ar'?'الطلاب':'Élèves'}</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.75)'}}>{eleves.length} {lang==='ar'?'طالب مسجل':'inscrits'}</div>
          </div>
        </div>
        {/* Barre de recherche */}
        {!showForm && (
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={lang==='ar'?'🔍 بحث عن طالب...':'🔍 Rechercher...'}
            style={{width:'100%', padding:'10px 14px', borderRadius:12, border:'none', fontSize:14,
              fontFamily:'inherit', boxSizing:'border-box', background:'rgba(255,255,255,0.15)',
              color:'#fff', outline:'none'}}/>
        )}
      </div>

      {/* ── MESSAGE ── */}
      {msgText && (
        <div style={{margin:'10px 12px 0', padding:'10px 14px', borderRadius:10, fontSize:13,
          background: msgType==='error'?'#FCEBEB':'#E1F5EE',
          color: msgType==='error'?'#E24B4A':'#085041', fontWeight:500}}>
          {msgText}
        </div>
      )}

      {/* Pull-to-refresh indicator (Phase 2 mobile) */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        isThreshold={isThreshold}
        lang={lang}
      />

      {/* ── DRAWER FORMULAIRE — Plein écran slide-up ── */}
      {showForm && (
        <>
          <style>{`
            @keyframes drawerSlideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `}</style>
          <div style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'#f5f5f0',
            display:'flex', flexDirection:'column',
            animation:'drawerSlideUp 0.3s ease-out',
            direction: lang==='ar' ? 'rtl' : 'ltr',
          }}>
            {/* ── HEADER DRAWER (sticky) ── */}
            <div style={{
              flexShrink:0, height:56, background:'#fff',
              borderBottom:'0.5px solid #e0e0d8',
              display:'flex', alignItems:'center',
              padding:'0 8px', gap:8,
              boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <button
                onClick={()=>{setShowForm(false);setEditEleve(null);setShowAcquis(false);setForm({...emptyForm,code_niveau:niveaux[0]?.code||''});}}
                aria-label={lang==='ar'?'إغلاق':'Fermer'}
                style={{
                  width:44, height:44, border:'none', background:'transparent',
                  color:'#666', fontSize:22, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:10,
                }}>✕</button>
              <div style={{flex:1, textAlign:'center', fontSize:15, fontWeight:700, color:'#1a1a1a'}}>
                {editEleve ? (lang==='ar'?'تعديل الطالب':'Modifier l\'élève') : (lang==='ar'?'طالب جديد':'Nouvel élève')}
              </div>
              <div style={{width:44}}/>
            </div>

            {/* ── BODY DRAWER (scrollable) ── */}
            <div style={{flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'16px'}}>
              {/* Prénom + Nom */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:2}}>
                {[{l:lang==='ar'?'الاسم *':'Prénom *',k:'prenom'},{l:lang==='ar'?'اللقب *':'Nom *',k:'nom'}].map(f=>(
                  <div key={f.k} style={{marginBottom:10}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{f.l}</label>
                    <input style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                      value={form[f.k]} onChange={e=>setForm(x=>({...x,[f.k]:e.target.value}))} placeholder={f.l.replace(' *','')}/>
                  </div>
                ))}
              </div>

              {/* Niveau scolaire — chips */}
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'المستوى الدراسي *':'Niveau scolaire *'}</label>
                <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                  {niveaux.map(n => {
                    const nc = n.couleur || getNiveauColor(n.code);
                    const sel = form.code_niveau === n.code;
                    return (
                      <div key={n.code} onClick={()=>{setForm(x=>({...x,code_niveau:n.code,hizbs_acquis:[],hizb_depart:0,tomon_depart:1,sourates_acquises:0}));setShowAcquis(false);}}
                        style={{padding:'7px 13px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:sel?700:400,
                          background:sel?nc:'#f5f5f0', color:sel?'#fff':'#666',
                          border:`1.5px solid ${sel?nc:'#e0e0d8'}`}}>
                        {n.code}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ID + Référent */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:2}}>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{lang==='ar'?'رقم التعريف *':'ID élève *'}</label>
                  <input style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={form.eleve_id_ecole} onChange={e=>setForm(x=>({...x,eleve_id_ecole:e.target.value}))} placeholder="001"/>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{lang==='ar'?'الأستاذ *':'Référent *'}</label>
                  <select style={{width:'100%',padding:'11px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:12,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
                    value={form.instituteur_referent_id} onChange={e=>setForm(x=>({...x,instituteur_referent_id:e.target.value}))}>
                    <option value="">—</option>
                    {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                  </select>
                </div>
              </div>

              {/* Téléphone + Date */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:2}}>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{lang==='ar'?'هاتف الولي':'Tél. parent'}</label>
                  <input type="tel" style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={form.telephone} onChange={e=>setForm(x=>({...x,telephone:e.target.value}))} placeholder="06XXXXXXXX"/>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{lang==='ar'?'تاريخ التسجيل':'Inscription'}</label>
                  <input type="date" style={{width:'100%',padding:'11px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:12,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={form.date_inscription} onChange={e=>setForm(x=>({...x,date_inscription:e.target.value}))}/>
                </div>
              </div>

              {/* Email parent (optionnel, utilise lors de la creation du compte parent) */}
              {!editEleve && (
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>
                    {lang==='ar'?'البريد الإلكتروني للولي (اختياري)':'Email parent (optionnel)'}
                  </label>
                  <input type="email" style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={form.email_parent} onChange={e=>setForm(x=>({...x,email_parent:e.target.value}))} placeholder="parent@example.com"/>
                </div>
              )}

              {/* ── ACQUIS ANTERIEURS — Bouton repli + AcquisSelector ── */}
              <div style={{marginBottom:14, marginTop:6}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8}}>
                  <label style={{fontSize:12, fontWeight:600, color:'#666', margin:0}}>
                    {lang==='ar'?'المكتسبات السابقة':'Acquis antérieurs'}
                  </label>
                  <button onClick={()=>setShowAcquis(s=>!s)}
                    style={{padding:'6px 12px', border:'0.5px solid #e0e0d8', borderRadius:8,
                      background: showAcquis ? '#E1F5EE' : '#fff',
                      fontSize:11, cursor:'pointer', fontFamily:'inherit',
                      color: showAcquis ? '#085041' : '#666', fontWeight:600}}>
                    {showAcquis
                      ? (lang==='ar'?'▲ طي':'▲ Réduire')
                      : (isSour(form.code_niveau)
                          ? `▼ ${lang==='ar'?'سور':'Sourates'} ${form.sourates_acquises||0}`
                          : `▼ ${lang==='ar'?'الحزب':'Hizb'} ${form.hizb_depart||0}, ${lang==='ar'?'ث':'T'}.${form.tomon_depart||1}`)}
                  </button>
                </div>
                {showAcquis && (
                  <AcquisSelector
                    codeNiveau={form.code_niveau}
                    niveauxDyn={niveaux}
                    hizb={form.hizb_depart}
                    tomon={form.tomon_depart}
                    lang={lang}
                    sens={(niveaux.find(n=>n.code===form.code_niveau)?.sens_recitation) || ecoleConfig?.sens_recitation_defaut || 'desc'}
                    programmeNiveau={programmesParNiveau[form.code_niveau] || []}
                    onHizbChange={h => setForm(prev => ({ ...prev, hizb_depart: h }))}
                    onTomonChange={tv => setForm(prev => ({ ...prev, tomon_depart: tv }))}
                    souratesAcquises={form.sourates_acquises}
                    onSouratesChange={n => setForm(prev => ({ ...prev, sourates_acquises: n }))}
                    hizbsAcquis={form.hizbs_acquis || []}
                    onHizbsAcquisChange={arr => setForm(prev => ({ ...prev, hizbs_acquis: arr }))}
                  />
                )}
              </div>

              <div style={{fontSize:11,color:'#888',marginBottom:8}}>
                <span style={{color:'#E24B4A'}}>*</span> {lang==='ar'?'حقول إلزامية':'Champs obligatoires'}
              </div>
            </div>

            {/* ── FOOTER DRAWER (sticky) ── */}
            <div style={{
              flexShrink:0, padding:'12px 16px',
              background:'#fff', borderTop:'0.5px solid #e0e0d8',
              boxShadow:'0 -2px 8px rgba(0,0,0,0.04)',
              display:'flex', gap:10,
              paddingBottom:'max(12px, env(safe-area-inset-bottom))',
            }}>
              <button onClick={()=>{setShowForm(false);setEditEleve(null);setShowAcquis(false);setForm({...emptyForm,code_niveau:niveaux[0]?.code||''});}}
                style={{flex:1,padding:'14px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'إلغاء':'Annuler'}
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{flex:2,padding:'14px',background:editEleve?'#378ADD':'#1D9E75',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:saving?0.6:1}}>
                {saving?'...':(editEleve?(lang==='ar'?'تحديث ✓':'Mettre à jour ✓'):(lang==='ar'?'حفظ':'Enregistrer'))}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── FILTRES NIVEAUX ── */}
      {!showForm && (
        <div style={{display:'flex', gap:6, overflowX:'auto', padding:'10px 12px', scrollbarWidth:'none', background:'#fff', borderBottom:'0.5px solid #e0e0d8'}}>
          {['tous', ...niveaux.map(n=>n.code)].map(code => {
            const nc = code==='tous' ? '#085041' : getNiveauColor(code);
            const sel = filtreNiveau===code;
            return (
              <div key={code} onClick={()=>setFiltreNiveau(code)}
                style={{padding:'5px 14px', borderRadius:20, fontSize:11, fontWeight:600, flexShrink:0, cursor:'pointer',
                  background:sel?nc:'#f0f0ec', color:sel?'#fff':'#666', border:`1.5px solid ${sel?nc:'transparent'}`}}>
                {code==='tous'?(lang==='ar'?'الكل':'Tous'):code}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LISTE ── */}
      {!showForm && (
        <>
          <div style={{padding:'8px 14px', fontSize:11, color:'#888'}}>
            {elevesFiltres.length} {lang==='ar'?'طالب':'élève(s)'}
          </div>
          {loading ? (
            <MobileSkeletonList type="card-with-avatar" count={6} />
          ) : elevesFiltres.length===0 ? (
            <div style={{textAlign:'center', padding:'3rem', color:'#aaa', fontSize:13}}>
              <div style={{fontSize:36, marginBottom:8}}>👥</div>
              <div>{lang==='ar'?'لا يوجد طلاب':'Aucun élève'}</div>
            </div>
          ) : (
            <div style={{padding:'0 12px'}}>
              {(() => {
                // Phase 2 Sprint 5 - Groupement sectionne par niveau
                // Activation : pas de recherche ET filtre 'tous'
                const shouldGroup = !search && filtreNiveau === 'tous';
                if (!shouldGroup) return elevesFiltres;
                // Construire liste avec headers de section intercales
                const ordered = [...elevesFiltres].sort((a, b) => {
                  // Ordre selon niveaux[]
                  const ia = niveaux.findIndex(n => n.code === a.code_niveau);
                  const ib = niveaux.findIndex(n => n.code === b.code_niveau);
                  const da = ia === -1 ? 999 : ia;
                  const db = ib === -1 ? 999 : ib;
                  if (da !== db) return da - db;
                  return (a.nom || '').localeCompare(b.nom || '');
                });
                const result = [];
                let lastNiveau = null;
                ordered.forEach(e => {
                  if (e.code_niveau !== lastNiveau) {
                    const niv = niveaux.find(n => n.code === e.code_niveau);
                    const color = niv?.couleur || '#888';
                    const nbInNiveau = ordered.filter(x => x.code_niveau === e.code_niveau).length;
                    result.push({
                      __section: true,
                      code: e.code_niveau || '?',
                      label: niv?.nom || e.code_niveau || '?',
                      color,
                      count: nbInNiveau,
                    });
                    lastNiveau = e.code_niveau;
                  }
                  result.push(e);
                });
                return result;
              })().map(e => {
                // Rendu d'un header de section
                if (e.__section) {
                  return (
                    <div key={`section-${e.code}`} style={{
                      position:'sticky', top:0, zIndex:10,
                      background:'#f5f5f0',
                      padding:'10px 4px 6px',
                      display:'flex', alignItems:'center', gap:8,
                      borderBottom:`0.5px solid ${e.color}30`,
                      marginBottom:6,
                    }}>
                      <span style={{
                        padding:'3px 9px', borderRadius:12,
                        background:`${e.color}20`, color:e.color,
                        fontSize:11, fontWeight:800, letterSpacing:'0.3px',
                      }}>{e.code}</span>
                      <span style={{fontSize:12, color:'#666', fontWeight:600}}>
                        {e.label}
                      </span>
                      <span style={{fontSize:11, color:'#aaa', marginLeft:'auto'}}>
                        {e.count} {lang==='ar'?'طالب':'élèves'}
                      </span>
                    </div>
                  );
                }
                // Rendu normal d'une carte eleve
                const nc = getNiveauColor(e.code_niveau);
                const inst = instituteurs.find(i=>i.id===e.instituteur_referent_id);
                const nl = niveauLabel(e);
                return (
                  <div key={e.id} style={{background:'#fff', borderRadius:14, padding:'12px 14px', marginBottom:8,
                    border:'0.5px solid #e0e0d8', display:'flex', alignItems:'center', gap:10,
                    boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                    {/* Avatar */}
                    <div onClick={()=>navigate('fiche',e)}
                      style={{width:42,height:42,borderRadius:'50%',background:`${nc}20`,color:nc,
                        display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0,cursor:'pointer'}}>
                      {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                    </div>
                    {/* Info */}
                    <div onClick={()=>navigate('fiche',e)} style={{flex:1, minWidth:0, cursor:'pointer'}}>
                      <div style={{fontWeight:700, fontSize:13}}>{e.prenom} {e.nom}</div>
                      <div style={{display:'flex', gap:5, marginTop:2, alignItems:'center', flexWrap:'wrap'}}>
                        <span style={{padding:'1px 6px',borderRadius:10,fontSize:10,fontWeight:700,background:`${nc}20`,color:nc}}>{e.code_niveau||'?'}</span>
                        <span style={{fontSize:10,fontWeight:500,color:nl.color}}>{nl.label}</span>
                        {e.eleve_id_ecole&&<span style={{fontSize:10,color:'#bbb'}}>#{e.eleve_id_ecole}</span>}
                      </div>
                      <div style={{display:'flex', gap:8, marginTop:2, fontSize:10, color:'#888', flexWrap:'wrap'}}>
                        {inst&&<span>👨‍🏫 {inst.prenom} {inst.nom}</span>}
                        {isSour(e.code_niveau)
                          ? <span style={{color:'#1D9E75',fontWeight:600}}>📖 {e.sourates_acquises||0}</span>
                          : <span>{lang==='ar'?'ح':'H'}.{e.hizb_depart} {lang==='ar'?'ث':'T'}.{e.tomon_depart}</span>}
                        {e.telephone&&<span>📞 {e.telephone}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    {user.role==='surveillant' && (
                      <div style={{display:'flex', gap:6, flexShrink:0}}>
                        <button onClick={()=>startEdit(e)}
                          aria-label={lang==='ar'?'تعديل':'Modifier'}
                          style={{background:'#E6F1FB',color:'#378ADD',border:'none',borderRadius:10,
                            width:44,height:44,fontSize:16,cursor:'pointer',
                            display:'flex',alignItems:'center',justifyContent:'center'}}>✏️</button>
                        <button onClick={()=>handleDelete(e.id)}
                          aria-label={lang==='ar'?'حذف':'Supprimer'}
                          style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:10,
                            width:44,height:44,fontSize:16,cursor:'pointer',
                            display:'flex',alignItems:'center',justifyContent:'center'}}>🗑</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* FAB - Floating Action Button (Phase 2 mobile classe mondiale)
          Place au-dessus du FAB recherche d'App.js (bottom:80) pour eviter chevauchement.
          Cache si formulaire ouvert (l'action principale est alors "Enregistrer" ou "Annuler"). */}
      {user.role==='surveillant' && !showForm && (
        <button onClick={startAdd}
          aria-label={lang==='ar'?'إضافة طالب':'Ajouter un élève'}
          style={{
            position:'fixed', bottom:144, right:14, zIndex:90,
            width:56, height:56, borderRadius:28,
            background:'linear-gradient(135deg,#1D9E75,#085041)',
            border:'none', color:'#fff', fontSize:28, fontWeight:300,
            cursor:'pointer',
            boxShadow:'0 6px 16px rgba(8,80,65,0.40)',
            display:'flex', alignItems:'center', justifyContent:'center',
            lineHeight:1, paddingBottom:4,
          }}>
          +
        </button>
      )}

      {/* ─── Modale recap creation eleve (equivalent ModaleEleveCree desktop) ─── */}
      {/* UX (mai 2026) : sur mobile aussi, donner le temps au surveillant
          de noter le login/mdp du parent. Pattern slide-up depuis le bas. */}
      {showEleveCree && (
        <>
          <style>{`
            @keyframes modalMobileFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes modalMobileSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          `}</style>
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999,
            display:'flex', alignItems:'center', justifyContent:'center', padding:16,
            animation:'modalMobileFadeIn 0.15s ease-out'}}
            onClick={()=>setShowEleveCree(null)}>
            <div onClick={e=>e.stopPropagation()}
              style={{background:'#fff', borderRadius:16, width:'100%', maxWidth:480, padding:20,
                maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)',
                animation:'modalMobileSlideUp 0.18s ease-out'}}>
              <div style={{textAlign:'center', marginBottom:16}}>
                <div style={{fontSize:44, marginBottom:6}}>🎉</div>
                <div style={{fontSize:17, fontWeight:800, color:'#085041'}}>
                  {lang==='ar'?'تم إضافة الطالب بنجاح!':'Élève créé avec succès !'}
                </div>
              </div>

              {/* Récap élève */}
              <div style={{background:'#E1F5EE', border:'1px solid #1D9E7530', borderRadius:10,
                padding:'10px 12px', marginBottom:10}}>
                <div style={{fontSize:11, fontWeight:700, color:'#085041', marginBottom:4, textTransform:'uppercase', letterSpacing:0.3}}>
                  👤 {lang==='ar'?'الطالب':'Élève'}
                </div>
                <div style={{fontSize:15, fontWeight:700, color:'#1a1a1a'}}>
                  {showEleveCree.eleve.prenom} {showEleveCree.eleve.nom}
                </div>
                <div style={{fontSize:12, color:'#666', marginTop:3, display:'flex', gap:10, flexWrap:'wrap'}}>
                  <span>🆔 {showEleveCree.eleve.eleve_id_ecole}</span>
                  <span>🎓 {showEleveCree.eleve.code_niveau}</span>
                </div>
              </div>

              {/* Récap compte parent */}
              <div style={{background:'#FFF8EC', border:'1px solid #EF9F2740', borderRadius:10,
                padding:'10px 12px', marginBottom:12}}>
                <div style={{fontSize:11, fontWeight:700, color:'#7B5800', marginBottom:6, textTransform:'uppercase', letterSpacing:0.3}}>
                  👨‍👩‍👧 {lang==='ar'?'حساب الولي':'Compte parent'}
                </div>
                <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:'5px 10px', fontSize:13}}>
                  <div style={{color:'#666', fontWeight:600}}>{lang==='ar'?'المعرف:':'Login :'}</div>
                  <div style={{fontWeight:700, color:'#1a1a1a', fontFamily:'monospace', wordBreak:'break-all'}}>{showEleveCree.parent.login}</div>
                  <div style={{color:'#666', fontWeight:600}}>{lang==='ar'?'كلمة المرور:':'Mot de passe :'}</div>
                  <div style={{fontWeight:700, color:'#1a1a1a', fontFamily:'monospace'}}>{showEleveCree.parent.mdp}</div>
                </div>
                <div style={{fontSize:11, color:'#8a5a00', marginTop:8, lineHeight:1.5, fontStyle:'italic'}}>
                  ℹ️ {lang==='ar'
                    ? 'يمكن للولي تغيير كلمة المرور لاحقاً. سلّم هذه المعلومات إليه.'
                    : 'Le parent peut changer son mot de passe. Communiquez-lui ces informations.'}
                </div>
              </div>

              {/* Boutons */}
              <div style={{display:'flex', gap:8}}>
                <button onClick={()=>{
                  const txt = lang==='ar'
                    ? `حساب ولي الأمر:\nالمعرف: ${showEleveCree.parent.login}\nكلمة المرور: ${showEleveCree.parent.mdp}`
                    : `Compte parent :\nLogin : ${showEleveCree.parent.login}\nMot de passe : ${showEleveCree.parent.mdp}`;
                  navigator.clipboard?.writeText(txt).then(() => {
                    toast.success(lang==='ar'?'✅ تم النسخ':'✅ Copié');
                  }).catch(()=>{});
                }}
                  style={{flex:1, padding:'12px', background:'#fff', color:'#085041',
                    border:'1.5px solid #085041', borderRadius:10, fontSize:13, fontWeight:600,
                    cursor:'pointer', fontFamily:'inherit'}}>
                  📋 {lang==='ar'?'نسخ':'Copier'}
                </button>
                <button onClick={()=>setShowEleveCree(null)}
                  style={{flex:1, padding:'12px',
                    background:'linear-gradient(135deg,#1D9E75,#085041)', color:'#fff',
                    border:'none', borderRadius:10, fontSize:13, fontWeight:700,
                    cursor:'pointer', fontFamily:'inherit',
                    boxShadow:'0 2px 8px rgba(8,80,65,0.3)'}}>
                  ✓ {lang==='ar'?'حسناً':'OK'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── Modale confirmation suppression (remplace window.confirm) ─── */}
      {showConfirmDelete && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16,
          animation:'modalMobileFadeIn 0.15s ease-out'}}
          onClick={()=>setShowConfirmDelete(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:'#fff', borderRadius:16, width:'100%', maxWidth:380, padding:20,
              boxShadow:'0 20px 60px rgba(0,0,0,0.3)',
              animation:'modalMobileSlideUp 0.18s ease-out'}}>
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:14}}>
              <div style={{width:48, height:48, borderRadius:14, background:'#FFE5E5',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0}}>🗑️</div>
              <div>
                <div style={{fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:2}}>
                  {lang==='ar'?'تأكيد الحذف':'Confirmer la suppression'}
                </div>
                <div style={{fontSize:13, color:'#666'}}>
                  {lang==='ar'?'هل أنت متأكد؟':'Cette action est définitive'}
                </div>
              </div>
            </div>
            {showConfirmDelete.nom && (
              <div style={{background:'#f5f5f0', borderRadius:8, padding:'10px 12px', marginBottom:14,
                fontSize:13, color:'#444'}}>
                <span style={{fontWeight:600}}>{lang==='ar'?'الطالب: ':'Élève : '}</span>{showConfirmDelete.nom}
              </div>
            )}
            <div style={{display:'flex', gap:8}}>
              <button onClick={()=>setShowConfirmDelete(null)}
                style={{flex:1, padding:'11px', background:'#f5f5f0', color:'#444',
                  border:'0.5px solid #e0e0d8', borderRadius:10, fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit'}}>
                {lang==='ar'?'إلغاء':'Annuler'}
              </button>
              <button onClick={confirmDelete}
                style={{flex:1, padding:'11px', background:'#E24B4A', color:'#fff',
                  border:'none', borderRadius:10, fontSize:13, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit'}}>
                🗑️ {lang==='ar'?'حذف':'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
