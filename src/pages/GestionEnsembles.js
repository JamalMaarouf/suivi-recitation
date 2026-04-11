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

  const emptyForm = { nom:'', ordre:1, sourates_ids:[] };
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

  const niveauSel    = niveaux.find(n=>n.id===filtreNiveau);
  const nc           = niveauSel?.couleur || '#1D9E75';
  const ensNiveau    = ensembles.filter(e=>e.niveau_id===filtreNiveau).sort((a,b)=>a.ordre-b.ordre);
  // Sourates du programme dans l'ordre décroissant
  const souratesProg = souratesDB.filter(s=>programmeIds.includes(s.id)).sort((a,b)=>b.numero-a.numero);
  // Sourates pas encore dans un ensemble pour ce niveau
  const sAffectees   = ensembles.filter(e=>e.niveau_id===filtreNiveau&&e.id!==editing)
                                 .flatMap(e=>e.sourates_ids||[]);

  const resetForm = () => { setEditing(null); setForm(emptyForm); setShowForm(false); };

  const startCreate = () => {
    setEditing(null);
    setForm({...emptyForm, ordre: ensNiveau.length+1});
    setShowForm(true);
  };

  const startEdit = (e) => {
    setEditing(e.id);
    setForm({ nom:e.nom, ordre:e.ordre, sourates_ids:e.sourates_ids||[] });
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
    if (!form.nom.trim()) return toast.warning(lang==='ar'?'الاسم إلزامي':'Le nom est obligatoire');
    if (form.sourates_ids.length===0) return toast.warning(lang==='ar'?'اختر سورة واحدة على الأقل':'Sélectionnez au moins une sourate');
    setSaving(true);
    const payload = { ecole_id:user.ecole_id, niveau_id:filtreNiveau,
      nom:form.nom.trim(), ordre:parseInt(form.ordre)||1, sourates_ids:form.sourates_ids };
    let error;
    if (editing) ({ error } = await supabase.from('ensembles_sourates').update(payload).eq('id',editing));
    else         ({ error } = await supabase.from('ensembles_sourates').insert(payload));
    setSaving(false);
    if (error) { toast.error(error.message||'Erreur'); return; }
    toast.success(editing?(lang==='ar'?'✅ تم التحديث':'✅ Modifié !'):(lang==='ar'?'✅ تم الإضافة':'✅ Ensemble ajouté !'));
    resetForm(); loadData();
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
    const nonAffectees = souratesProg.filter(s=>!sAffectees.includes(s.id));
    const dejaDansAutre = souratesProg.filter(s=>sAffectees.includes(s.id));

    return (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
        zIndex:1000,display:'flex',
        alignItems:isMobile?'flex-end':'center',
        justifyContent:'center',padding:isMobile?0:'20px'}}>
        <div style={{background:'#fff',
          borderRadius:isMobile?'20px 20px 0 0':'16px',
          width:'100%',maxWidth:600,maxHeight:isMobile?'92vh':'85vh',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Header */}
          <div style={{padding:'16px 18px',borderBottom:'0.5px solid #e0e0d8',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${nc}20`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontWeight:800,fontSize:14,color:nc,flexShrink:0}}>
                {niveauSel?.code}
              </div>
              <div style={{flex:1,fontWeight:700,fontSize:16,color:'#1a1a1a'}}>
                {editing?(lang==='ar'?'تعديل المجموعة':'Modifier l\'ensemble')
                        :(lang==='ar'?'إضافة مجموعة':'Nouvel ensemble')}
              </div>
              <button onClick={resetForm}
                style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#888',padding:0}}>×</button>
            </div>
            {/* Nom de l'ensemble */}
            <input style={{width:'100%',padding:'10px 12px',borderRadius:10,
              border:`1.5px solid ${nc}40`,fontSize:15,fontFamily:'inherit',boxSizing:'border-box',
              marginTop:8}}
              value={form.nom}
              onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
              placeholder={lang==='ar'?'مثال: المجموعة الأولى — جزء عم':'Ex: Groupe 1 — Juz Amma'}
              autoFocus/>
          </div>

          {/* Légende */}
          <div style={{padding:'10px 18px',background:'#f9f9f6',
            borderBottom:'0.5px solid #e0e0d8',flexShrink:0,
            display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#666'}}>
              <div style={{width:14,height:14,borderRadius:3,background:nc,flexShrink:0}}/>
              {lang==='ar'?'محدد في هذه المجموعة':'Dans cet ensemble'}
              <span style={{fontWeight:700,color:nc}}>({form.sourates_ids.length})</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#666'}}>
              <div style={{width:14,height:14,borderRadius:3,background:'#f5f5f0',border:'1px solid #e0e0d8',flexShrink:0}}/>
              {lang==='ar'?'متاحة':'Disponibles'}
              <span style={{fontWeight:600}}>({nonAffectees.length})</span>
            </div>
            {dejaDansAutre.length>0&&(
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#EF9F27'}}>
                <div style={{width:14,height:14,borderRadius:3,background:'#FAEEDA',border:'1px solid #EF9F27',flexShrink:0}}/>
                {lang==='ar'?'في مجموعة أخرى':'Dans autre ensemble'}
                <span style={{fontWeight:600}}>({dejaDansAutre.length})</span>
              </div>
            )}
            {/* Boutons rapides */}
            <div style={{marginRight:'auto',display:'flex',gap:6}}>
              <button onClick={()=>setForm(f=>({...f,sourates_ids:nonAffectees.map(s=>s.id)}))}
                style={{padding:'3px 10px',borderRadius:20,border:`0.5px solid ${nc}`,
                  background:`${nc}15`,color:nc,fontSize:11,cursor:'pointer',
                  fontWeight:600,fontFamily:'inherit'}}>
                {lang==='ar'?'تحديد المتاحة':'Sél. disponibles'}
              </button>
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

          {/* Liste sourates */}
          {souratesProg.length===0?(
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
              padding:'2rem',flexDirection:'column',gap:10,color:'#aaa'}}>
              <div style={{fontSize:36}}>⚠️</div>
              <div style={{fontSize:14,textAlign:'center',color:'#633806'}}>
                {lang==='ar'
                  ?'لا يوجد برنامج لهذا المستوى. أضف البرنامج أولاً من صفحة المستويات.'
                  :"Aucun programme défini. Ajoutez-le d'abord dans Niveaux."}
              </div>
              <button onClick={()=>{resetForm();navigate('niveaux');}}
                style={{padding:'10px 20px',background:nc,color:'#fff',border:'none',
                  borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'انتقل إلى المستويات':'Aller aux Niveaux →'}
              </button>
            </div>
          ):(
            <div ref={scrollRef} style={{flex:1,overflowY:'auto',padding:'10px 18px',
              overscrollBehavior:'contain'}}>
              {/* Sourates disponibles (pas encore dans un ensemble) */}
              {nonAffectees.length>0&&(
                <>
                  <div style={{fontSize:11,fontWeight:700,color:'#666',marginBottom:6,marginTop:4,
                    textTransform:'uppercase',letterSpacing:'0.5px'}}>
                    {lang==='ar'?'متاحة':'Disponibles'} ({nonAffectees.length})
                  </div>
                  {nonAffectees.map(s=>{
                    const sel=form.sourates_ids.includes(s.id);
                    return(
                      <div key={s.id} onClick={()=>toggleSourate(s.id)}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                          borderRadius:10,cursor:'pointer',marginBottom:5,
                          background:sel?`${nc}12`:'#f5f5f0',
                          border:`1.5px solid ${sel?nc:'#e0e0d8'}`}}>
                        <div style={{width:22,height:22,borderRadius:5,flexShrink:0,
                          border:`1.5px solid ${sel?nc:'#ccc'}`,background:sel?nc:'#fff',
                          display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {sel&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:11,color:'#aaa',minWidth:24}}>{s.numero}</span>
                        <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",direction:'rtl',
                          color:sel?nc:'#333',fontWeight:sel?700:400}}>{s.nom_ar}</span>
                      </div>
                    );
                  })}
                </>
              )}
              {/* Sourates déjà dans un autre ensemble */}
              {dejaDansAutre.length>0&&(
                <>
                  <div style={{fontSize:11,fontWeight:700,color:'#EF9F27',marginBottom:6,marginTop:14,
                    textTransform:'uppercase',letterSpacing:'0.5px'}}>
                    {lang==='ar'?'في مجموعة أخرى (يمكن إعادة تعيينها)':'Dans un autre ensemble (réassignable)'}
                  </div>
                  {dejaDansAutre.map(s=>{
                    const sel=form.sourates_ids.includes(s.id);
                    const autreEns=ensembles.find(e=>e.niveau_id===filtreNiveau&&e.id!==editing&&(e.sourates_ids||[]).includes(s.id));
                    return(
                      <div key={s.id} onClick={()=>toggleSourate(s.id)}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                          borderRadius:10,cursor:'pointer',marginBottom:5,
                          background:sel?`${nc}12`:'#FAEEDA30',
                          border:`1.5px solid ${sel?nc:'#EF9F2750'}`}}>
                        <div style={{width:22,height:22,borderRadius:5,flexShrink:0,
                          border:`1.5px solid ${sel?nc:'#EF9F27'}`,background:sel?nc:'#FAEEDA',
                          display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {sel?<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>
                             :<span style={{color:'#EF9F27',fontSize:10}}>↺</span>}
                        </div>
                        <span style={{fontSize:11,color:'#aaa',minWidth:24}}>{s.numero}</span>
                        <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",direction:'rtl',
                          color:sel?nc:'#633806',fontWeight:sel?700:400}}>{s.nom_ar}</span>
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

          {/* Footer boutons */}
          <div style={{padding:'14px 18px',borderTop:'0.5px solid #e0e0d8',flexShrink:0,display:'flex',gap:8}}>
            <button onClick={resetForm}
              style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',
                borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              {lang==='ar'?'إلغاء':'Annuler'}
            </button>
            <button onClick={save} disabled={saving||form.sourates_ids.length===0||!form.nom.trim()}
              style={{flex:2,padding:'13px',
                background:saving||form.sourates_ids.length===0||!form.nom.trim()?'#ccc':editing?'#378ADD':nc,
                color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,
                cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
              {saving?'...':(editing
                ?(lang==='ar'?'تحديث':'Mettre à jour ✓')
                :(lang==='ar'?'حفظ الإضافة':'Enregistrer'))}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── RENDU PRINCIPAL ─────────────────────────────────────────────
  const HeaderNiveaux = () => (
    <div style={{background:'#fff',padding:isMobile?'14px 16px 0':'0 0 16px',
      borderBottom:isMobile?'0.5px solid #e0e0d8':'none',
      position:isMobile?'sticky':'relative',top:0,zIndex:100}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
        <button onClick={()=>goBack?goBack():navigate('dashboard')}
          style={{background:'none',border:'none',cursor:'pointer',
            fontSize:isMobile?22:14,color:'#085041',padding:0,
            fontFamily:'inherit',fontWeight:600}}>
          {isMobile?'←':'← Retour'}
        </button>
        {!isMobile&&<div style={{fontSize:20,fontWeight:700}}>
          📦 {lang==='ar'?'مجموعات السور':'Ensembles de sourates'}
        </div>}
        {isMobile&&<div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>
          📦 {lang==='ar'?'مجموعات السور':'Ensembles'}
        </div>}
      </div>

      {/* Sélecteur de niveau — cards horizontales scrollables */}
      {niveaux.length===0&&!loading?(
        <div style={{padding:'12px',background:'#FAEEDA',borderRadius:10,
          color:'#633806',fontSize:13,marginBottom:12}}>
          {lang==='ar'?'لا توجد مستويات سور. ':'Aucun niveau sourate. '}
          <button onClick={()=>navigate('niveaux')}
            style={{color:nc,background:'none',border:'none',cursor:'pointer',fontWeight:600,fontSize:13}}>
            {lang==='ar'?'إنشاء مستوى →':'Créer un niveau →'}
          </button>
        </div>
      ):(
        <div style={{display:'flex',gap:8,overflowX:'auto',scrollbarWidth:'none',
          paddingBottom:10,flexWrap:isMobile?'nowrap':'wrap'}}>
          {niveaux.map(n=>(
            <div key={n.id} onClick={()=>{setFiltreNiveau(n.id);setShowForm(false);}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
                borderRadius:12,cursor:'pointer',flexShrink:0,
                background:filtreNiveau===n.id?n.couleur:'#fff',
                color:filtreNiveau===n.id?'#fff':'#666',
                border:`1.5px solid ${filtreNiveau===n.id?n.couleur:'#e0e0d8'}`,
                boxShadow:filtreNiveau===n.id?`0 2px 8px ${n.couleur}40`:'none'}}>
              <span style={{fontSize:13,fontWeight:700}}>{n.code}</span>
              <span style={{fontSize:12,opacity:0.85}}>{n.nom}</span>
              {filtreNiveau===n.id&&(
                <span style={{fontSize:11,background:'rgba(255,255,255,0.25)',
                  padding:'1px 6px',borderRadius:20,marginLeft:2}}>
                  {ensembles.filter(e=>e.niveau_id===n.id).length} {lang==='ar'?'مجموعة':'ensemble(s)'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
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
