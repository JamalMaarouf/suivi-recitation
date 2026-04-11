import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

export default function GestionExamens({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,  setNiveaux]  = useState([]);
  const [examens,  setExamens]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [filtreNiveau, setFiltreNiveau] = useState('tous');
  const [confirmModal, setConfirmModal] = useState({isOpen:false});

  const emptyForm = {
    niveau_id: '', nom: '', description: '',
    type_seuil: 'hizb', valeur_seuil: 1,
    score_minimum: 70, bloquant: true, ordre: 1
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: nd }, { data: ed }] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
      supabase.from('examens').select('*, niveau:niveau_id(code,nom,couleur)').eq('ecole_id', user.ecole_id).order('ordre'),
    ]);
    setNiveaux(nd || []);
    setExamens(ed || []);
    setLoading(false);
  };

  const startEdit = (e) => {
    setEditing(e.id);
    setForm({ niveau_id: e.niveau_id||'', nom: e.nom, description: e.description||'',
      type_seuil: e.type_seuil, valeur_seuil: e.valeur_seuil,
      score_minimum: e.score_minimum, bloquant: e.bloquant, ordre: e.ordre });
    setShowForm(true); window.scrollTo(0,0);
  };

  const resetForm = () => { setEditing(null); setForm(emptyForm); setShowForm(false); };

  const save = async () => {
    if (!form.nom.trim()) return toast.warning(lang==='ar'?'الاسم إلزامي':'Le nom est obligatoire');
    if (!form.valeur_seuil || form.valeur_seuil < 1) return toast.warning(lang==='ar'?'القيمة الحدية إلزامية':'La valeur seuil est obligatoire');
    setSaving(true);
    const payload = {
      ecole_id: user.ecole_id,
      niveau_id: form.niveau_id || null,
      nom: form.nom.trim(),
      description: form.description.trim() || null,
      type_seuil: form.type_seuil,
      valeur_seuil: parseInt(form.valeur_seuil),
      score_minimum: parseInt(form.score_minimum) || 0,
      bloquant: form.bloquant,
      ordre: parseInt(form.ordre) || 1,
      actif: true,
    };
    let error;
    if (editing) ({ error } = await supabase.from('examens').update(payload).eq('id', editing));
    else         ({ error } = await supabase.from('examens').insert(payload));
    setSaving(false);
    if (error) { toast.error(error.message || 'Erreur'); return; }
    toast.success(editing
      ? (lang==='ar'?'✅ تم التحديث':'✅ Examen modifié !')
      : (lang==='ar'?'✅ تم إضافة الامتحان':'✅ Examen ajouté !'));
    resetForm(); loadData();
  };

  const supprimer = (e) => {
    setConfirmModal({
      isOpen: true,
      title: lang==='ar'?'حذف الامتحان':'Supprimer l\'examen',
      message: (lang==='ar'?'حذف الامتحان ':'Supprimer l\'examen ') + e.nom + ' ?',
      onConfirm: async () => {
        await supabase.from('examens').delete().eq('id', e.id);
        toast.success(lang==='ar'?'تم الحذف':'Examen supprimé');
        setConfirmModal({isOpen:false}); loadData();
      }
    });
  };

  const toggleActif = async (e) => {
    await supabase.from('examens').update({ actif: !e.actif }).eq('id', e.id);
    loadData();
  };

  // Types de seuil selon le type de niveau sélectionné
  const niveauSelectionne = niveaux.find(n => n.id === form.niveau_id);
  const typesSeuil = niveauSelectionne?.type === 'sourate'
    ? [{val:'sourate',fr:'Sourates récitées',ar:'سور مسمَّعة'},{val:'points',fr:'Points gagnés',ar:'نقاط'}]
    : [{val:'hizb',fr:'Hizb complets',ar:'أحزاب مكتملة'},{val:'tomon',fr:'Tomon récités',ar:'أثمان مسمَّعة'},{val:'points',fr:'Points gagnés',ar:'نقاط'}];

  const examsFiltres = filtreNiveau === 'tous' ? examens : examens.filter(e => e.niveau_id === filtreNiveau);

  const FormContent = () => (
    <div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {lang==='ar'?'اسم الامتحان':'Nom de l\'examen *'}
        </label>
        <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
          value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
          placeholder={lang==='ar'?'مثال: امتحان الحزب الأول':'Ex: Examen Hizb 1'}/>
      </div>

      {/* Niveau concerné */}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {lang==='ar'?'المستوى (اتركه فارغاً لكل المستويات)':'Niveau (vide = tous les niveaux)'}
        </label>
        <select style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
          value={form.niveau_id} onChange={e=>setForm(f=>({...f,niveau_id:e.target.value,type_seuil:'hizb'}))}>
          <option value="">{lang==='ar'?'— كل المستويات —':'— Tous les niveaux —'}</option>
          {niveaux.map(n => (
            <option key={n.id} value={n.id}>{n.code} — {n.nom}</option>
          ))}
        </select>
      </div>

      {/* Type seuil + valeur */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <div>
          <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
            {lang==='ar'?'نوع الحد':'Type de seuil *'}
          </label>
          <select style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
            value={form.type_seuil} onChange={e=>setForm(f=>({...f,type_seuil:e.target.value}))}>
            {typesSeuil.map(t => <option key={t.val} value={t.val}>{lang==='ar'?t.ar:t.fr}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
            {lang==='ar'?'القيمة':'Valeur seuil *'}
          </label>
          <input type="number" min="1"
            style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
            value={form.valeur_seuil} onChange={e=>setForm(f=>({...f,valeur_seuil:e.target.value}))}
            placeholder="1"/>
        </div>
      </div>

      {/* Score minimum */}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {lang==='ar'?`النقاط الدنيا للنجاح: ${form.score_minimum}%`:`Score minimum pour réussir : ${form.score_minimum}%`}
        </label>
        <input type="range" min="0" max="100" step="5"
          style={{width:'100%'}}
          value={form.score_minimum} onChange={e=>setForm(f=>({...f,score_minimum:parseInt(e.target.value)}))}/>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#aaa',marginTop:2}}>
          <span>0%</span><span style={{fontWeight:600,color:'#1D9E75'}}>{form.score_minimum}%</span><span>100%</span>
        </div>
      </div>

      {/* Bloquant */}
      <div style={{marginBottom:14}}>
        <div onClick={()=>setForm(f=>({...f,bloquant:!f.bloquant}))}
          style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:12,cursor:'pointer',
            background:form.bloquant?'#FCEBEB':'#f5f5f0',
            border:`1.5px solid ${form.bloquant?'#E24B4A30':'#e0e0d8'}`}}>
          <div style={{width:44,height:24,borderRadius:12,position:'relative',
            background:form.bloquant?'#E24B4A':'#ccc',transition:'background 0.2s',flexShrink:0}}>
            <div style={{position:'absolute',top:2,left:form.bloquant?20:2,width:20,height:20,
              borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:form.bloquant?'#A32D2D':'#666'}}>
              {form.bloquant
                ? (lang==='ar'?'🔒 موقف — يمنع الاستظهار حتى اجتياز الامتحان':'🔒 Bloquant — empêche la récitation')
                : (lang==='ar'?'📢 تنبيه فقط — لا يوقف الاستظهار':'📢 Alerte uniquement — ne bloque pas')}
            </div>
            <div style={{fontSize:11,color:'#888',marginTop:2}}>
              {form.bloquant
                ? (lang==='ar'?'سيُطلب اجتياز الامتحان قبل الاستمرار':'L\'élève doit passer l\'examen avant de continuer')
                : (lang==='ar'?'تنبيه للمراقب فقط دون إيقاف':'Notification au surveillant sans blocage')}
            </div>
          </div>
        </div>
      </div>

      {/* Boutons */}
      <div style={{display:'flex',gap:8}}>
        <button onClick={resetForm}
          style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {lang==='ar'?'إلغاء':'Annuler'}
        </button>
        <button onClick={save} disabled={saving}
          style={{flex:2,padding:'13px',background:saving?'#ccc':editing?'#378ADD':'#EF9F27',
            color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
          {saving?'...':(editing?(lang==='ar'?'تحديث':'Mettre à jour ✓'):(lang==='ar'?'حفظ':'Enregistrer'))}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        <div style={{background:'#fff',padding:'14px 16px 0',borderBottom:'0.5px solid #e0e0d8',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#085041',padding:0}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>
              📝 {lang==='ar'?'الامتحانات':'Examens'}
            </div>
            <button onClick={()=>{setEditing(null);setForm(emptyForm);setShowForm(v=>!v);}}
              style={{background:showForm&&!editing?'#f0f0ec':'#EF9F27',color:showForm&&!editing?'#666':'#fff',
                border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              {showForm&&!editing?'✕':'+ Ajouter'}
            </button>
          </div>
          {/* Filtre niveau */}
          <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none',paddingBottom:10}}>
            <div onClick={()=>setFiltreNiveau('tous')}
              style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,flexShrink:0,cursor:'pointer',
                background:filtreNiveau==='tous'?'#EF9F27':'#f0f0ec',color:filtreNiveau==='tous'?'#fff':'#666'}}>
              {lang==='ar'?'الكل':'Tous'}
            </div>
            {niveaux.map(n=>(
              <div key={n.id} onClick={()=>setFiltreNiveau(n.id)}
                style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,flexShrink:0,cursor:'pointer',
                  background:filtreNiveau===n.id?n.couleur:'#f0f0ec',
                  color:filtreNiveau===n.id?'#fff':'#666'}}>
                {n.code}
              </div>
            ))}
          </div>
        </div>

        <div style={{padding:'12px'}}>
          {showForm && (
            <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
              border:`1.5px solid ${editing?'#378ADD':'#EF9F27'}`}}>
              <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                {editing?(lang==='ar'?'تعديل الامتحان':'✏️ Modifier'):(lang==='ar'?'إضافة امتحان':'📝 Nouvel examen')}
              </div>
              <FormContent/>
            </div>
          )}

          {loading && <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>}

          {!loading && examsFiltres.length === 0 && (
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12}}>
              <div style={{fontSize:40,marginBottom:10}}>📝</div>
              <div style={{fontSize:14}}>{lang==='ar'?'لا توجد امتحانات':'Aucun examen configuré'}</div>
            </div>
          )}

          {!loading && examsFiltres.map(e => {
            const nc = e.niveau?.couleur || '#888';
            return (
              <div key={e.id} style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:10,
                border:`0.5px solid ${e.actif?nc+'30':'#e0e0d8'}`,opacity:e.actif?1:0.6}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{width:46,height:46,borderRadius:12,
                    background:e.bloquant?'#FCEBEB':'#FAEEDA',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
                    {e.bloquant?'🔒':'📢'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15}}>{e.nom}</div>
                    <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                      {e.niveau && (
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:`${nc}20`,color:nc,fontWeight:600}}>
                          {e.niveau.code}
                        </span>
                      )}
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#E6F1FB',color:'#0C447C',fontWeight:600}}>
                        {e.valeur_seuil} {e.type_seuil==='hizb'?(lang==='ar'?'حزب':'hizb'):e.type_seuil==='tomon'?(lang==='ar'?'ثُمن':'tomon'):e.type_seuil==='sourate'?(lang==='ar'?'سورة':'sourate'):'pts'}
                      </span>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#E1F5EE',color:'#085041',fontWeight:600}}>
                        {e.score_minimum}% {lang==='ar'?'للنجاح':'min'}
                      </span>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                        background:e.bloquant?'#FCEBEB':'#FAEEDA',
                        color:e.bloquant?'#A32D2D':'#633806',fontWeight:600}}>
                        {e.bloquant?(lang==='ar'?'🔒 موقف':'🔒 Bloquant'):(lang==='ar'?'📢 تنبيه':'📢 Alerte')}
                      </span>
                    </div>
                    {e.description && <div style={{fontSize:12,color:'#888',marginTop:4}}>{e.description}</div>}
                  </div>
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button onClick={()=>startEdit(e)}
                    style={{flex:1,padding:'9px',background:'#E6F1FB',color:'#0C447C',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    ✏️ {lang==='ar'?'تعديل':'Modifier'}
                  </button>
                  <button onClick={()=>toggleActif(e)}
                    style={{flex:1,padding:'9px',background:e.actif?'#FAEEDA':'#E1F5EE',
                      color:e.actif?'#633806':'#085041',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    {e.actif?(lang==='ar'?'تعطيل':'Désactiver'):(lang==='ar'?'تفعيل':'Activer')}
                  </button>
                  <button onClick={()=>supprimer(e)}
                    style={{padding:'9px 14px',background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:10,fontSize:13,cursor:'pointer'}}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>

        {confirmModal.isOpen && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:320,width:'100%'}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
              <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setConfirmModal({isOpen:false})}
                  style={{flex:1,padding:'12px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>{lang==='ar'?'إلغاء':'Annuler'}</button>
                <button onClick={confirmModal.onConfirm}
                  style={{flex:1,padding:'12px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>{lang==='ar'?'حذف':'Supprimer'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PC ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>← Retour</button>
          <div style={{fontSize:20,fontWeight:700}}>📝 Gestion des examens</div>
        </div>
        <button onClick={()=>{setEditing(null);setForm(emptyForm);setShowForm(v=>!v);}}
          style={{padding:'8px 18px',background:showForm&&!editing?'#f0f0ec':'#EF9F27',color:showForm&&!editing?'#666':'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
          {showForm&&!editing?'✕ Annuler':'+ Nouvel examen'}
        </button>
      </div>

      {/* Filtre */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:'1rem'}}>
        {[{id:'tous',code:'Tous',couleur:'#EF9F27'},...niveaux].map(n=>(
          <div key={n.id} onClick={()=>setFiltreNiveau(n.id)}
            style={{padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',
              background:filtreNiveau===n.id?n.couleur:'#f5f5f0',
              color:filtreNiveau===n.id?'#fff':'#666',border:`0.5px solid ${filtreNiveau===n.id?n.couleur:'#e0e0d8'}`}}>
            {n.code}
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{background:'#fff',border:`1.5px solid ${editing?'#378ADD':'#EF9F27'}`,borderRadius:14,padding:'1.5rem',marginBottom:'1.5rem'}}>
          <div style={{fontSize:15,fontWeight:600,color:'#085041',marginBottom:'1rem'}}>
            {editing?'✏️ Modifier l\'examen':'📝 Nouvel examen'}
          </div>
          <FormContent/>
        </div>
      )}

      {loading ? <div className="loading">...</div> : examsFiltres.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'#aaa',background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:48,marginBottom:12}}>📝</div>
          <div>Aucun examen configuré</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {examsFiltres.map(e => {
            const nc = e.niveau?.couleur || '#888';
            return (
              <div key={e.id} style={{background:'#fff',borderRadius:14,padding:'16px',
                border:`0.5px solid ${nc}20`,display:'flex',alignItems:'center',gap:16,opacity:e.actif?1:0.5}}>
                <div style={{fontSize:28,flexShrink:0}}>{e.bloquant?'🔒':'📢'}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>{e.nom}</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {e.niveau && <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:`${nc}20`,color:nc,fontWeight:600}}>{e.niveau.code} — {e.niveau.nom}</span>}
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#E6F1FB',color:'#0C447C',fontWeight:600}}>Seuil: {e.valeur_seuil} {e.type_seuil}</span>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#E1F5EE',color:'#085041',fontWeight:600}}>Score min: {e.score_minimum}%</span>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:e.bloquant?'#FCEBEB':'#FAEEDA',color:e.bloquant?'#A32D2D':'#633806',fontWeight:600}}>
                      {e.bloquant?'🔒 Bloquant':'📢 Alerte seulement'}
                    </span>
                  </div>
                  {e.description && <div style={{fontSize:12,color:'#888',marginTop:4}}>{e.description}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button onClick={()=>startEdit(e)} style={{padding:'7px 12px',background:'#E6F1FB',color:'#0C447C',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>✏️</button>
                  <button onClick={()=>toggleActif(e)} style={{padding:'7px 12px',background:e.actif?'#FAEEDA':'#E1F5EE',color:e.actif?'#633806':'#085041',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    {e.actif?'Désactiver':'Activer'}
                  </button>
                  <button onClick={()=>supprimer(e)} style={{padding:'7px 10px',background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmModal.isOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:400,width:'100%'}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
            <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmModal({isOpen:false})} style={{padding:'10px 20px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>Annuler</button>
              <button onClick={confirmModal.onConfirm} style={{padding:'10px 20px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
