import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

export default function GestionEnsembles({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,    setNiveaux]    = useState([]);
  const [ensembles,  setEnsembles]  = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [programmes, setProgrammes] = useState([]); // programme du niveau sélectionné
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [confirmModal, setConfirmModal] = useState({isOpen:false});

  const emptyForm = { nom:'', ordre:1, sourates_ids:[] };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (filtreNiveau) chargerProgramme(filtreNiveau);
  }, [filtreNiveau]);

  const loadData = async () => {
    setLoading(true);
    const [{data:nd},{data:ed},{data:sd}] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur')
        .eq('ecole_id',user.ecole_id).eq('type','sourate').order('ordre'),
      supabase.from('ensembles_sourates').select('*')
        .eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('sourates').select('*').order('numero'),
    ]);
    setNiveaux(nd||[]);
    setEnsembles(ed||[]);
    setSouratesDB(sd||[]);
    if (!filtreNiveau && nd?.length > 0) setFiltreNiveau(nd[0].id);
    setLoading(false);
  };

  const chargerProgramme = async (niveauId) => {
    const { data } = await supabase.from('programmes')
      .select('reference_id').eq('niveau_id',niveauId)
      .eq('ecole_id',user.ecole_id).order('ordre');
    setProgrammes(data ? data.map(d=>d.reference_id) : []);
  };

  // Sourates du programme du niveau sélectionné (dans l'ordre décroissant)
  const souratesProgramme = souratesDB
    .filter(s => programmes.includes(s.id))
    .sort((a,b) => b.numero - a.numero);

  const ensemblesNiveau = ensembles.filter(e=>e.niveau_id===filtreNiveau);
  const niveauSelectionne = niveaux.find(n=>n.id===filtreNiveau);

  const startCreate = () => {
    setEditing(null);
    setForm({...emptyForm, ordre: ensemblesNiveau.length+1});
    setShowForm(true); window.scrollTo(0,0);
  };

  const startEdit = (e) => {
    setEditing(e.id);
    setForm({ nom:e.nom, ordre:e.ordre, sourates_ids:e.sourates_ids||[] });
    setShowForm(true); window.scrollTo(0,0);
  };

  const resetForm = () => { setEditing(null); setForm(emptyForm); setShowForm(false); };

  const toggleSourate = (id) => {
    setForm(f=>({
      ...f,
      sourates_ids: f.sourates_ids.includes(id)
        ? f.sourates_ids.filter(x=>x!==id)
        : [...f.sourates_ids, id]
    }));
  };

  const save = async () => {
    if (!form.nom.trim()) return toast.warning(lang==='ar'?'الاسم إلزامي':'Le nom est obligatoire');
    if (form.sourates_ids.length===0) return toast.warning(lang==='ar'?'اختر سورة واحدة على الأقل':'Sélectionnez au moins une sourate');
    setSaving(true);
    const payload = {
      ecole_id: user.ecole_id, niveau_id: filtreNiveau,
      nom: form.nom.trim(), ordre: parseInt(form.ordre)||1,
      sourates_ids: form.sourates_ids,
    };
    let error;
    if (editing) ({ error } = await supabase.from('ensembles_sourates').update(payload).eq('id',editing));
    else         ({ error } = await supabase.from('ensembles_sourates').insert(payload));
    setSaving(false);
    if (error) { toast.error(error.message||'Erreur'); return; }
    toast.success(editing
      ?(lang==='ar'?'✅ تم التحديث':'✅ Ensemble modifié !')
      :(lang==='ar'?'✅ تم الإضافة':'✅ Ensemble ajouté !'));
    resetForm(); loadData();
  };

  const supprimer = (e) => {
    setConfirmModal({
      isOpen:true,
      title: lang==='ar'?'حذف المجموعة':'Supprimer l\'ensemble',
      message: (lang==='ar'?'حذف ':'Supprimer ')+e.nom+' ?',
      onConfirm: async()=>{
        await supabase.from('ensembles_sourates').delete().eq('id',e.id);
        toast.success(lang==='ar'?'تم الحذف':'Ensemble supprimé');
        setConfirmModal({isOpen:false}); loadData();
      }
    });
  };

  const nomSourate = (id) => souratesDB.find(s=>s.id===id)?.nom_ar || '?';

  // ── FORMULAIRE PARTAGÉ ──────────────────────────────────────────
  const FormContent = () => (
    <div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {lang==='ar'?'اسم المجموعة':'Nom de l\'ensemble *'}
        </label>
        <input style={{width:'100%',padding:'12px 14px',borderRadius:10,
          border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
          value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
          placeholder={lang==='ar'?'مثال: المجموعة الأولى':'Ex: Ensemble 1 — Juz Amma'}/>
      </div>

      {/* Sélection sourates du programme */}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <label style={{fontSize:12,fontWeight:600,color:'#666'}}>
            {lang==='ar'?'السور المكونة للمجموعة *':'Sourates de l\'ensemble *'}
          </label>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:12,fontWeight:700,
              color:form.sourates_ids.length>0?niveauSelectionne?.couleur||'#1D9E75':'#aaa'}}>
              {form.sourates_ids.length} {lang==='ar'?'سورة':'sourate(s)'}
            </span>
            {form.sourates_ids.length>0&&(
              <button onClick={()=>setForm(f=>({...f,sourates_ids:[]}))}
                style={{fontSize:11,color:'#E24B4A',background:'none',border:'none',cursor:'pointer'}}>
                ✕ {lang==='ar'?'مسح':'Effacer'}
              </button>
            )}
          </div>
        </div>

        {souratesProgramme.length===0?(
          <div style={{padding:'1.5rem',background:'#FAEEDA',borderRadius:10,
            color:'#633806',fontSize:13,textAlign:'center'}}>
            ⚠️ {lang==='ar'
              ?'لا يوجد برنامج لهذا المستوى. أضف البرنامج أولاً من صفحة المستويات.'
              :"Aucun programme défini pour ce niveau. Ajoutez-le d'abord dans Niveaux."}
          </div>
        ):(
          <div style={{maxHeight:260,overflowY:'auto',
            display:'flex',flexDirection:'column',gap:5}}>
            {souratesProgramme.map(s=>{
              const sel = form.sourates_ids.includes(s.id);
              const nc  = niveauSelectionne?.couleur||'#1D9E75';
              // Déjà dans un autre ensemble ?
              const dejaAffecte = ensembles
                .filter(e=>e.id!==editing&&e.niveau_id===filtreNiveau)
                .some(e=>(e.sourates_ids||[]).includes(s.id));
              return(
                <div key={s.id} onClick={()=>toggleSourate(s.id)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                    borderRadius:10,cursor:'pointer',
                    background:sel?`${nc}10`:dejaAffecte?'#f9f9f6':'#f5f5f0',
                    border:`1.5px solid ${sel?nc:dejaAffecte?'#e0d8c0':'#e0e0d8'}`,
                    opacity:dejaAffecte&&!sel?0.6:1}}>
                  <div style={{width:22,height:22,borderRadius:5,flexShrink:0,
                    border:`1.5px solid ${sel?nc:'#ccc'}`,
                    background:sel?nc:'#fff',
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {sel&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>}
                  </div>
                  <span style={{fontSize:11,color:'#aaa',minWidth:24}}>{s.numero}</span>
                  <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",direction:'rtl',
                    color:sel?nc:'#333',fontWeight:sel?600:400}}>{s.nom_ar}</span>
                  {dejaAffecte&&!sel&&(
                    <span style={{fontSize:10,color:'#EF9F27',flexShrink:0}}>
                      {lang==='ar'?'مُعيَّنة':'Affectée'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:8}}>
        <button onClick={resetForm}
          style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',
            borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {lang==='ar'?'إلغاء':'Annuler'}
        </button>
        <button onClick={save} disabled={saving}
          style={{flex:2,padding:'13px',
            background:saving?'#ccc':editing?'#378ADD':niveauSelectionne?.couleur||'#1D9E75',
            color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,
            cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
          {saving?'...':(editing
            ?(lang==='ar'?'تحديث':'Mettre à jour ✓')
            :(lang==='ar'?'حفظ':'Enregistrer'))}
        </button>
      </div>
    </div>
  );

  const ListeEnsembles = () => (
    <>
      {loading&&<div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>}
      {!loading&&ensemblesNiveau.length===0&&!showForm&&(
        <div style={{textAlign:'center',color:'#aaa',padding:'3rem',
          background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:40,marginBottom:10}}>📦</div>
          <div style={{fontSize:14,marginBottom:12}}>
            {lang==='ar'?'لا توجد مجموعات بعد':'Aucun ensemble défini'}
          </div>
          <div style={{fontSize:12,color:'#bbb'}}>
            {lang==='ar'?'أضف مجموعة لتنظيم سور هذا المستوى'
              :'Groupez les sourates du programme pour organiser la progression'}
          </div>
        </div>
      )}
      {!loading&&ensemblesNiveau.map((e,idx)=>{
        const nc = niveauSelectionne?.couleur||'#888';
        const souratesEnsemble = souratesDB.filter(s=>(e.sourates_ids||[]).includes(s.id))
          .sort((a,b)=>b.numero-a.numero);
        return(
          <div key={e.id} style={{background:'#fff',borderRadius:14,padding:'14px 16px',
            marginBottom:10,border:`0.5px solid ${nc}20`}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {/* Numéro */}
              <div style={{width:40,height:40,borderRadius:10,background:`${nc}20`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontWeight:800,fontSize:16,color:nc,flexShrink:0}}>
                {e.ordre}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15}}>{e.nom}</div>
                <div style={{fontSize:12,color:'#888',marginTop:3}}>
                  {souratesEnsemble.length} {lang==='ar'?'سورة':'sourate(s)'}
                  {souratesEnsemble.length>0&&' · '}
                  {souratesEnsemble.slice(0,3).map(s=>s.nom_ar).join(' · ')}
                  {souratesEnsemble.length>3&&' ...'}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>startEdit(e)}
                  style={{padding:'7px 10px',background:'#E6F1FB',color:'#0C447C',
                    border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:600}}>✏️</button>
                <button onClick={()=>supprimer(e)}
                  style={{padding:'7px 10px',background:'#FCEBEB',color:'#E24B4A',
                    border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>🗑</button>
              </div>
            </div>
            {/* Pastilles sourates */}
            {souratesEnsemble.length>0&&(
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:10,paddingTop:10,
                borderTop:'0.5px solid #f0f0ec'}}>
                {souratesEnsemble.map(s=>(
                  <span key={s.id} style={{fontSize:11,padding:'2px 10px',borderRadius:20,
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
    </>
  );

  const ConfirmModal = () => confirmModal.isOpen ? (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:360,width:'100%'}}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
        <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={()=>setConfirmModal({isOpen:false})}
            style={{padding:'10px 20px',background:'#f5f5f0',border:'none',
              borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
            {lang==='ar'?'إلغاء':'Annuler'}
          </button>
          <button onClick={confirmModal.onConfirm}
            style={{padding:'10px 20px',background:'#E24B4A',color:'#fff',border:'none',
              borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>
            {lang==='ar'?'حذف':'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── MOBILE ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        <div style={{background:'#fff',padding:'14px 16px 0',
          borderBottom:'0.5px solid #e0e0d8',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#085041',padding:0}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>
              📦 {lang==='ar'?'مجموعات السور':'Ensembles'}
            </div>
            {filtreNiveau&&(
              <button onClick={()=>{if(showForm&&!editing)resetForm();else startCreate();}}
                style={{background:showForm&&!editing?'#f0f0ec':niveauSelectionne?.couleur||'#1D9E75',
                  color:showForm&&!editing?'#666':'#fff',border:'none',borderRadius:10,
                  padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {showForm&&!editing?'✕':'+ Ajouter'}
              </button>
            )}
          </div>
          {/* Filtre niveaux sourate */}
          <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none',paddingBottom:10}}>
            {niveaux.map(n=>(
              <div key={n.id} onClick={()=>{setFiltreNiveau(n.id);setShowForm(false);}}
                style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,
                  flexShrink:0,cursor:'pointer',
                  background:filtreNiveau===n.id?n.couleur:'#f0f0ec',
                  color:filtreNiveau===n.id?'#fff':'#666'}}>
                {n.code}
              </div>
            ))}
          </div>
        </div>
        <div style={{padding:'12px'}}>
          {niveaux.length===0&&!loading&&(
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12}}>
              <div style={{fontSize:36,marginBottom:10}}>📖</div>
              <div style={{fontSize:14}}>{lang==='ar'?'لا توجد مستويات سور':'Aucun niveau sourate'}</div>
              <button onClick={()=>navigate('niveaux')}
                style={{marginTop:12,padding:'10px 20px',background:'#1D9E75',color:'#fff',
                  border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'إضافة مستوى':'Créer un niveau'}
              </button>
            </div>
          )}
          {showForm&&(
            <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
              border:`1.5px solid ${editing?'#378ADD':niveauSelectionne?.couleur||'#1D9E75'}`}}>
              <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                {editing?(lang==='ar'?'تعديل المجموعة':'✏️ Modifier'):(lang==='ar'?'إضافة مجموعة':'📦 Nouvel ensemble')}
              </div>
              <FormContent/>
            </div>
          )}
          <ListeEnsembles/>
        </div>
        <ConfirmModal/>
      </div>
    );
  }

  // ── PC ──────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>
            ← {lang==='ar'?'رجوع':'Retour'}
          </button>
          <div style={{fontSize:20,fontWeight:700}}>
            📦 {lang==='ar'?'مجموعات السور':'Ensembles de sourates'}
          </div>
        </div>
        {filtreNiveau&&(
          <button onClick={()=>{if(showForm&&!editing)resetForm();else startCreate();}}
            style={{padding:'8px 18px',
              background:showForm&&!editing?'#f0f0ec':niveauSelectionne?.couleur||'#1D9E75',
              color:showForm&&!editing?'#666':'#fff',border:'none',
              borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
            {showForm&&!editing?'✕ Annuler':'+ Nouvel ensemble'}
          </button>
        )}
      </div>

      {/* Filtre niveaux PC */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:'1rem'}}>
        {niveaux.length===0&&!loading&&(
          <div style={{fontSize:13,color:'#888',padding:'1rem',background:'#fff',
            borderRadius:10,border:'0.5px solid #e0e0d8'}}>
            {lang==='ar'?'لا توجد مستويات سور. ':' Aucun niveau sourate. '}
            <button onClick={()=>navigate('niveaux')}
              style={{color:'#1D9E75',background:'none',border:'none',cursor:'pointer',
                fontWeight:600,fontSize:13}}>
              {lang==='ar'?'إنشاء مستوى →':'Créer un niveau →'}
            </button>
          </div>
        )}
        {niveaux.map(n=>(
          <div key={n.id} onClick={()=>{setFiltreNiveau(n.id);setShowForm(false);}}
            style={{padding:'6px 16px',borderRadius:20,fontSize:12,fontWeight:600,
              cursor:'pointer',
              background:filtreNiveau===n.id?n.couleur:'#f5f5f0',
              color:filtreNiveau===n.id?'#fff':'#666',
              border:`0.5px solid ${filtreNiveau===n.id?n.couleur:'#e0e0d8'}`}}>
            {n.code} — {n.nom}
          </div>
        ))}
      </div>

      {/* Formulaire + liste PC */}
      {showForm&&(
        <div style={{background:'#fff',
          border:`1.5px solid ${editing?'#378ADD':niveauSelectionne?.couleur||'#1D9E75'}`,
          borderRadius:14,padding:'1.5rem',marginBottom:'1.5rem'}}>
          <div style={{fontSize:15,fontWeight:600,color:'#085041',marginBottom:'1rem'}}>
            {editing?'✏️ Modifier l\'ensemble':'📦 Nouvel ensemble'}
          </div>
          <FormContent/>
        </div>
      )}
      <ListeEnsembles/>
      <ConfirmModal/>
    </div>
  );
}
