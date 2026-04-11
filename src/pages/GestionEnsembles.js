import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

export default function GestionEnsembles({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,      setNiveaux]      = useState([]);
  const [ensembles,    setEnsembles]    = useState([]);
  const [souratesDB,   setSouratesDB]   = useState([]);
  const [programmeIds, setProgrammeIds] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [confirmModal, setConfirmModal] = useState({isOpen:false});
  const scrollRef = useRef(null);

  const emptyForm = { nom:'', niveau_id:'', ordre:1, sourates_ids:[] };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (filtreNiveau && souratesDB.length > 0) chargerProgramme(filtreNiveau, souratesDB);
  }, [filtreNiveau, souratesDB]);

  const loadData = async () => {
    setLoading(true);
    const [{data:nd},{data:ed},{data:sd}] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur')
        .eq('ecole_id',user.ecole_id).eq('type','sourate').order('ordre'),
      supabase.from('ensembles_sourates').select('*')
        .eq('ecole_id',user.ecole_id).order('niveau_id,ordre'),
      supabase.from('sourates').select('*').order('numero'),
    ]);
    setNiveaux(nd||[]);
    setEnsembles(ed||[]);
    setSouratesDB(sd||[]);
    if (nd?.length > 0 && !filtreNiveau) setFiltreNiveau(nd[0].id);
    setLoading(false);
  };

  const chargerProgramme = async (niveauId, sDB) => {
    const { data } = await supabase.from('programmes')
      .select('reference_id').eq('niveau_id',niveauId)
      .eq('ecole_id',user.ecole_id).order('ordre');
    if (!data || data.length===0) { setProgrammeIds([]); return; }
    const ids = data.map(d=>d.reference_id);
    const idsValides = ids.filter(id => sDB.some(s=>s.id===id));
    if (idsValides.length>0) { setProgrammeIds(idsValides); return; }
    // Migration : numéros → UUIDs
    const convertis = ids.map(id=>{
      const num=parseInt(id);
      return isNaN(num)?id:(sDB.find(s=>s.numero===num)?.id||null);
    }).filter(Boolean);
    setProgrammeIds(convertis);
  };

  // Niveau affiché dans la liste = filtreNiveau
  // Niveau du formulaire = form.niveau_id (peut différer)
  const niveauSel    = niveaux.find(n=>n.id===filtreNiveau);
  const niveauForm   = niveaux.find(n=>n.id===form.niveau_id);
  const nc           = (showForm ? niveauForm?.couleur : niveauSel?.couleur) || '#1D9E75';
  const ensNiveau    = ensembles.filter(e=>e.niveau_id===filtreNiveau).sort((a,b)=>a.ordre-b.ordre);
  // Sourates du programme du niveau sélectionné dans le formulaire
  const souratesProg = souratesDB.filter(s=>programmeIds.includes(s.id)).sort((a,b)=>b.numero-a.numero);
  // Sourates déjà dans un ensemble pour ce niveau (dans le formulaire)
  const sAffectees   = ensembles
    .filter(e=>e.niveau_id===(form.niveau_id||filtreNiveau)&&e.id!==editing)
    .flatMap(e=>e.sourates_ids||[]);

  const resetForm = () => { setEditing(null); setForm(emptyForm); setShowForm(false); };

  const startCreate = () => {
    setEditing(null);
    // niveau_id vide — l'utilisateur le choisit dans le formulaire
    setForm({...emptyForm, niveau_id:'', ordre:1, sourates_ids:[]});
    setProgrammeIds([]);
    setShowForm(true);
  };

  const startEdit = async (e) => {
    setEditing(e.id);
    setForm({ nom:e.nom, niveau_id:e.niveau_id||'', ordre:e.ordre, sourates_ids:e.sourates_ids||[] });
    // Charger le programme du niveau de cet ensemble
    if (e.niveau_id) await chargerProgramme(e.niveau_id, souratesDB);
    setShowForm(true);
  };

  const toggleSourate = (id) => {
    const scrollTop = scrollRef.current?.scrollTop || 0;
    setForm(f=>({
      ...f,
      sourates_ids: f.sourates_ids.includes(id)
        ? f.sourates_ids.filter(x=>x!==id)
        : [...f.sourates_ids, id]
    }));
    requestAnimationFrame(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=scrollTop; });
  };

  const save = async () => {
    if (!form.niveau_id) return toast.warning(lang==='ar'?'اختر المستوى':'Sélectionnez un niveau');
    if (!form.nom.trim()) return toast.warning(lang==='ar'?'الاسم إلزامي':'Le nom est obligatoire');
    if (form.sourates_ids.length===0) return toast.warning(lang==='ar'?'اختر سورة واحدة على الأقل':'Sélectionnez au moins une sourate');
    setSaving(true);
    const niveauIdSauvegarde = form.niveau_id; // mémoriser avant resetForm
    const payload = { ecole_id:user.ecole_id, niveau_id:form.niveau_id,
      nom:form.nom.trim(), ordre:parseInt(form.ordre)||1, sourates_ids:form.sourates_ids };
    let error;
    if (editing) ({ error } = await supabase.from('ensembles_sourates').update(payload).eq('id',editing));
    else         ({ error } = await supabase.from('ensembles_sourates').insert(payload));
    setSaving(false);
    if (error) { toast.error(error.message||'Erreur'); return; }
    toast.success(editing?(lang==='ar'?'✅ تم التحديث':'✅ Modifié !'):(lang==='ar'?'✅ تم الإضافة':'✅ Ensemble ajouté !'));
    setFiltreNiveau(niveauIdSauvegarde); // afficher le niveau de l'ensemble créé
    resetForm();
    loadData();
  };

  const supprimer = (e) => {
    setConfirmModal({ isOpen:true,
      title: lang==='ar'?'حذف المجموعة':'Supprimer',
      message: (lang==='ar'?'حذف ':'Supprimer ')+e.nom+' ?',
      onConfirm: async()=>{
        await supabase.from('ensembles_sourates').delete().eq('id',e.id);
        toast.success(lang==='ar'?'تم الحذف':'Supprimé');
        setConfirmModal({isOpen:false}); loadData();
      }
    });
  };

  const nomSourate = (id) => souratesDB.find(s=>s.id===id)?.nom_ar||'?';
  const numSourate = (id) => souratesDB.find(s=>s.id===id)?.numero||'?';

  // ── PANNEAU FORMULAIRE ───────────────────────────────────────────
  const PanneauForm = () => {
    if (!showForm) return null;
    const ncForm        = niveauForm?.couleur || '#1D9E75';
    const nonAffectees  = souratesProg.filter(s=>!sAffectees.includes(s.id));
    const dejaDansAutre = souratesProg.filter(s=>sAffectees.includes(s.id));

    return (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
        zIndex:1000,display:'flex',
        alignItems:isMobile?'flex-end':'center',
        justifyContent:'center',padding:isMobile?0:'20px'}}>
        <div style={{background:'#fff',
          borderRadius:isMobile?'20px 20px 0 0':'16px',
          width:'100%',maxWidth:620,maxHeight:isMobile?'94vh':'88vh',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* ── HEADER ── */}
          <div style={{padding:'16px 18px 14px',borderBottom:'0.5px solid #e0e0d8',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:16,color:'#1a1a1a',flex:1}}>
                📦 {editing?(lang==='ar'?'تعديل المجموعة':'Modifier l\'ensemble')
                           :(lang==='ar'?'إضافة مجموعة جديدة':'Nouvel ensemble')}
              </div>
              <button onClick={resetForm}
                style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#888',padding:0}}>×</button>
            </div>

            {/* ÉTAPE 1 — Sélection du niveau via liste déroulante */}
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:700,color:'#888',display:'block',
                marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
                {lang==='ar'?'① اختر المستوى':'① Choisir le niveau'}
              </label>
              <select
                value={form.niveau_id}
                onChange={async e=>{
                  const nid = e.target.value;
                  setForm(f=>({...f,niveau_id:nid,sourates_ids:[]}));
                  if (nid) await chargerProgramme(nid, souratesDB);
                  else setProgrammeIds([]);
                }}
                style={{width:'100%',padding:'11px 14px',borderRadius:10,
                  border:`1.5px solid ${ncForm}50`,fontSize:14,fontFamily:'inherit',
                  background:'#fff',color:form.niveau_id?'#1a1a1a':'#888',
                  cursor:'pointer',outline:'none',boxSizing:'border-box'}}>
                <option value="">— {lang==='ar'?'اختر المستوى':'Sélectionnez un niveau'} —</option>
                {niveaux.map(n=>(
                  <option key={n.id} value={n.id}>{n.code} — {n.nom}</option>
                ))}
              </select>
            </div>

            {/* ÉTAPE 2 — Nom (visible seulement si niveau choisi) */}
            {form.niveau_id&&(
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'#888',marginBottom:6,
                  textTransform:'uppercase',letterSpacing:'0.5px'}}>
                  {lang==='ar'?'② اسم المجموعة':'② Nom de l\'ensemble'}
                </div>
                <input style={{width:'100%',padding:'10px 12px',borderRadius:10,
                  border:`1.5px solid ${ncForm}50`,fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                  value={form.nom}
                  onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
                  placeholder={lang==='ar'?'مثال: المجموعة الأولى — جزء عم':'Ex: Groupe 1 — Juz Amma'}
                  autoFocus/>
              </div>
            )}
          </div>

          {/* ── LÉGENDE (si niveau choisi) ── */}
          {form.niveau_id&&(
            <div style={{padding:'10px 18px',background:'#f9f9f6',
              borderBottom:'0.5px solid #e0e0d8',flexShrink:0,
              display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#666'}}>
                <div style={{width:12,height:12,borderRadius:3,background:ncForm,flexShrink:0}}/>
                {lang==='ar'?'محدد':'Sélectionné'}
                <span style={{fontWeight:700,color:ncForm}}>({form.sourates_ids.length})</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#666'}}>
                <div style={{width:12,height:12,borderRadius:3,background:'#f5f5f0',border:'1px solid #e0e0d8',flexShrink:0}}/>
                {lang==='ar'?'متاحة':'Disponibles'}
                <span style={{fontWeight:600}}>({nonAffectees.length})</span>
              </div>
              {dejaDansAutre.length>0&&(
                <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#EF9F27'}}>
                  <div style={{width:12,height:12,borderRadius:3,background:'#FAEEDA',border:'1px solid #EF9F27',flexShrink:0}}/>
                  {lang==='ar'?'في مجموعة أخرى':'Dans autre ensemble'}
                  <span style={{fontWeight:600}}>({dejaDansAutre.length})</span>
                </div>
              )}
              <div style={{marginRight:'auto',display:'flex',gap:6}}>
                {nonAffectees.length>0&&(
                  <button onClick={()=>setForm(f=>({...f,sourates_ids:nonAffectees.map(s=>s.id)}))}
                    style={{padding:'3px 10px',borderRadius:20,border:`0.5px solid ${ncForm}`,
                      background:`${ncForm}15`,color:ncForm,fontSize:11,
                      cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>
                    {lang==='ar'?'تحديد المتاحة':'Sél. disponibles'}
                  </button>
                )}
                {form.sourates_ids.length>0&&(
                  <button onClick={()=>setForm(f=>({...f,sourates_ids:[]}))}
                    style={{padding:'3px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',
                      background:'#FCEBEB',fontSize:11,cursor:'pointer',
                      color:'#E24B4A',fontFamily:'inherit'}}>
                    ✕ {lang==='ar'?'مسح':'Effacer'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 — SOURATES ── */}
          {!form.niveau_id?(
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
              padding:'2rem',flexDirection:'column',gap:8,color:'#aaa'}}>
              <div style={{fontSize:40}}>☝️</div>
              <div style={{fontSize:14,textAlign:'center'}}>
                {lang==='ar'
                  ?"اختر المستوى أولاً لعرض سوره"
                  :"Choisissez d'abord un niveau pour afficher son programme"}
              </div>
            </div>
          ):souratesProg.length===0?(
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
              padding:'2rem',flexDirection:'column',gap:10}}>
              <div style={{fontSize:36}}>⚠️</div>
              <div style={{fontSize:14,textAlign:'center',color:'#633806'}}>
                {lang==='ar'
                  ?"لا يوجد برنامج لهذا المستوى"
                  :"Aucun programme défini pour ce niveau"}
              </div>
              <button onClick={()=>{resetForm();navigate('niveaux');}}
                style={{padding:'10px 20px',background:ncForm,color:'#fff',border:'none',
                  borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'انتقل إلى المستويات':'Définir le programme →'}
              </button>
            </div>
          ):(
            <div ref={scrollRef} style={{flex:1,overflowY:'auto',padding:'10px 18px',
              overscrollBehavior:'contain'}}>

              {/* Sourates DISPONIBLES */}
              {nonAffectees.length>0&&(
                <>
                  <div style={{fontSize:11,fontWeight:700,color:'#888',marginBottom:6,marginTop:4,
                    textTransform:'uppercase',letterSpacing:'0.5px'}}>
                    ③ {lang==='ar'?'اختر السور لتكوين المجموعة':'Sélectionnez les sourates de l\'ensemble'}
                    <span style={{color:'#bbb',fontWeight:400,marginRight:4}}>
                      — {lang==='ar'?'المتاحة':'disponibles'} ({nonAffectees.length})
                    </span>
                  </div>
                  {nonAffectees.map(s=>{
                    const sel=form.sourates_ids.includes(s.id);
                    return(
                      <div key={s.id} onClick={()=>toggleSourate(s.id)}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                          borderRadius:10,cursor:'pointer',marginBottom:5,
                          background:sel?`${ncForm}12`:'#f5f5f0',
                          border:`1.5px solid ${sel?ncForm:'#e0e0d8'}`}}>
                        <div style={{width:22,height:22,borderRadius:5,flexShrink:0,
                          border:`1.5px solid ${sel?ncForm:'#ccc'}`,background:sel?ncForm:'#fff',
                          display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {sel&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:11,color:'#aaa',minWidth:24}}>{s.numero}</span>
                        <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",direction:'rtl',
                          color:sel?ncForm:'#333',fontWeight:sel?700:400}}>{s.nom_ar}</span>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Sourates dans AUTRE ensemble */}
              {dejaDansAutre.length>0&&(
                <>
                  <div style={{fontSize:11,fontWeight:700,color:'#EF9F27',marginBottom:6,marginTop:14,
                    textTransform:'uppercase',letterSpacing:'0.5px'}}>
                    {lang==='ar'?'في مجموعة أخرى (يمكن إعادة تعيينها)':'Dans un autre ensemble (réassignable)'}
                  </div>
                  {dejaDansAutre.map(s=>{
                    const sel=form.sourates_ids.includes(s.id);
                    const autreEns=ensembles.find(e=>e.niveau_id===form.niveau_id&&e.id!==editing&&(e.sourates_ids||[]).includes(s.id));
                    return(
                      <div key={s.id} onClick={()=>toggleSourate(s.id)}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                          borderRadius:10,cursor:'pointer',marginBottom:5,
                          background:sel?`${ncForm}12`:'#FAEEDA30',
                          border:`1.5px solid ${sel?ncForm:'#EF9F2750'}`}}>
                        <div style={{width:22,height:22,borderRadius:5,flexShrink:0,
                          border:`1.5px solid ${sel?ncForm:'#EF9F27'}`,
                          background:sel?ncForm:'#FAEEDA',
                          display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {sel?<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>
                             :<span style={{color:'#EF9F27',fontSize:10}}>↺</span>}
                        </div>
                        <span style={{fontSize:11,color:'#aaa',minWidth:24}}>{s.numero}</span>
                        <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",direction:'rtl',
                          color:sel?ncForm:'#633806',fontWeight:sel?700:400}}>{s.nom_ar}</span>
                        {!sel&&autreEns&&(
                          <span style={{fontSize:10,color:'#EF9F27',padding:'1px 6px',
                            borderRadius:10,background:'#FAEEDA',flexShrink:0,whiteSpace:'nowrap'}}>
                            {autreEns.nom}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── BOUTONS ── */}
          <div style={{padding:'14px 18px',borderTop:'0.5px solid #e0e0d8',flexShrink:0,display:'flex',gap:8}}>
            <button onClick={resetForm}
              style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',
                borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              {lang==='ar'?'إلغاء':'Annuler'}
            </button>
            <button onClick={save}
              disabled={saving||!form.niveau_id||form.sourates_ids.length===0||!form.nom.trim()}
              style={{flex:2,padding:'13px',
                background:saving||!form.niveau_id||form.sourates_ids.length===0||!form.nom.trim()
                  ?'#ccc':editing?'#378ADD':ncForm,
                color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,
                cursor:saving||!form.niveau_id?'not-allowed':'pointer',fontFamily:'inherit'}}>
              {saving?'...':(editing
                ?(lang==='ar'?'تحديث':'Mettre à jour ✓')
                :(lang==='ar'?'حفظ المجموعة':'Enregistrer'))}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── RENDU PRINCIPAL ─────────────────────────────────────────────
  const HeaderNiveaux = () => (
    <div style={{background:'#fff',padding:isMobile?'14px 16px 12px':'0 0 16px',
      borderBottom:isMobile?'0.5px solid #e0e0d8':'none',
      position:isMobile?'sticky':'relative',top:0,zIndex:100}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>goBack?goBack():navigate('dashboard')}
          style={{background:'none',border:'none',cursor:'pointer',
            fontSize:isMobile?22:14,color:'#085041',padding:0,
            fontFamily:'inherit',fontWeight:600}}>
          {isMobile?'←':'← Retour'}
        </button>
        <div style={{flex:1,fontSize:isMobile?17:20,fontWeight:isMobile?800:700,
          color:isMobile?'#085041':'#1a1a1a'}}>
          📦 {lang==='ar'?'مجموعات السور':'Ensembles de sourates'}
        </div>
      </div>
    </div>
  );

  // ── MOBILE ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        <HeaderNiveaux/>
        <div style={{padding:'12px'}}>
          {loading&&<div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>}

          {!loading&&filtreNiveau&&(
            <button onClick={startCreate}
              style={{width:'100%',padding:'13px',background:nc,color:'#fff',border:'none',
                borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',
                fontFamily:'inherit',marginBottom:14,
                boxShadow:`0 3px 10px ${nc}40`}}>
              + {lang==='ar'?'إضافة مجموعة جديدة':'Ajouter un ensemble'}
            </button>
          )}

          {!loading&&ensNiveau.length===0&&(
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem',
              background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
              <div style={{fontSize:40,marginBottom:10}}>📦</div>
              <div style={{fontSize:14}}>
                {lang==='ar'?'لا توجد مجموعات بعد':'Aucun ensemble pour ce niveau'}
              </div>
            </div>
          )}

          {!loading&&ensNiveau.map((e,idx)=>{
            const sEns=souratesDB.filter(s=>(e.sourates_ids||[]).includes(s.id)).sort((a,b)=>b.numero-a.numero);
            return(
              <div key={e.id} style={{background:'#fff',borderRadius:14,padding:'14px',
                marginBottom:10,border:`1px solid ${nc}20`}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:sEns.length?10:0}}>
                  <div style={{width:42,height:42,borderRadius:10,background:`${nc}20`,
                    display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:16,fontWeight:800,color:nc,lineHeight:1}}>{e.ordre}</span>
                    <span style={{fontSize:9,color:nc,opacity:0.7}}>{sEns.length} {lang==='ar'?'سور':'sour.'}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15}}>{e.nom}</div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>startEdit(e)}
                      style={{padding:'7px 10px',background:'#E6F1FB',color:'#0C447C',
                        border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>✏️</button>
                    <button onClick={()=>supprimer(e)}
                      style={{padding:'7px 10px',background:'#FCEBEB',color:'#E24B4A',
                        border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>🗑</button>
                  </div>
                </div>
                {sEns.length>0&&(
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',
                    paddingTop:10,borderTop:'0.5px solid #f0f0ec'}}>
                    {sEns.map(s=>(
                      <span key={s.id} style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                        background:`${nc}15`,color:nc,fontWeight:600,
                        fontFamily:"'Tajawal',Arial",direction:'rtl'}}>
                        {s.nom_ar}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <PanneauForm/>
        {confirmModal.isOpen&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,
            display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:320,width:'100%'}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
              <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setConfirmModal({isOpen:false})}
                  style={{flex:1,padding:'12px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                  {lang==='ar'?'إلغاء':'Annuler'}
                </button>
                <button onClick={confirmModal.onConfirm}
                  style={{flex:1,padding:'12px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  {lang==='ar'?'حذف':'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PC ──────────────────────────────────────────────────────────
  return (
    <div>
      <HeaderNiveaux/>
      {loading&&<div className="loading">...</div>}

      {!loading&&filtreNiveau&&(
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'1rem'}}>
          <button onClick={startCreate}
            style={{padding:'9px 20px',background:nc,color:'#fff',border:'none',
              borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',
              boxShadow:`0 2px 8px ${nc}40`}}>
            + {lang==='ar'?'إضافة مجموعة':'Ajouter un ensemble'}
          </button>
        </div>
      )}

      {!loading&&ensNiveau.length===0&&(
        <div style={{textAlign:'center',padding:'3rem',color:'#aaa',
          background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:48,marginBottom:12}}>📦</div>
          <div style={{marginBottom:8}}>{lang==='ar'?'لا توجد مجموعات':'Aucun ensemble configuré'}</div>
          <div style={{fontSize:13,color:'#bbb'}}>
            {lang==='ar'?'أضف مجموعة لتنظيم سور هذا المستوى':'Groupez les sourates pour organiser la progression'}
          </div>
        </div>
      )}

      {!loading&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
          {ensNiveau.map(e=>{
            const sEns=souratesDB.filter(s=>(e.sourates_ids||[]).includes(s.id)).sort((a,b)=>b.numero-a.numero);
            return(
              <div key={e.id} style={{background:'#fff',borderRadius:14,padding:'16px',
                border:`1px solid ${nc}20`}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:12}}>
                  <div style={{width:44,height:44,borderRadius:10,background:`${nc}20`,
                    display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:18,fontWeight:800,color:nc,lineHeight:1}}>{e.ordre}</span>
                    <span style={{fontSize:9,color:nc,opacity:0.7}}>{sEns.length} {lang==='ar'?'سور':'sour.'}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{e.nom}</div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button onClick={()=>startEdit(e)}
                      style={{padding:'6px 10px',background:'#E6F1FB',color:'#0C447C',
                        border:'none',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:600}}>✏️</button>
                    <button onClick={()=>supprimer(e)}
                      style={{padding:'6px 10px',background:'#FCEBEB',color:'#E24B4A',
                        border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>🗑</button>
                  </div>
                </div>
                {sEns.length>0&&(
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',
                    paddingTop:10,borderTop:`0.5px solid ${nc}20`}}>
                    {sEns.map(s=>(
                      <span key={s.id} style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                        background:`${nc}15`,color:nc,fontWeight:600,
                        fontFamily:"'Tajawal',Arial",direction:'rtl'}}>
                        {s.nom_ar}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PanneauForm/>
      {confirmModal.isOpen&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:400,width:'100%'}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
            <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmModal({isOpen:false})}
                style={{padding:'10px 20px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                {lang==='ar'?'إلغاء':'Annuler'}
              </button>
              <button onClick={confirmModal.onConfirm}
                style={{padding:'10px 20px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {lang==='ar'?'حذف':'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
