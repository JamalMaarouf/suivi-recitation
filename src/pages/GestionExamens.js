import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { getSouratesForNiveau } from '../lib/sourates';

const HIZB_NUMS = Array.from({length:60}, (_,i) => i+1);

export default function GestionExamens({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,    setNiveaux]    = useState([]);
  const [examens,    setExamens]    = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [filtreNiveau, setFiltreNiveau] = useState('tous');
  const [confirmModal, setConfirmModal] = useState({isOpen:false});

  const emptyForm = {
    niveau_id:'', nom:'', description:'',
    type_contenu:'hizb', contenu_ids:[],
    score_minimum:70, bloquant:true, ordre:1
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{data:nd},{data:ed},{data:sd}] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('examens').select('*, niveau:niveau_id(code,nom,couleur,type)').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('sourates').select('*').order('numero'),
    ]);
    setNiveaux(nd||[]);
    setExamens(ed||[]);
    setSouratesDB(sd||[]);
    setLoading(false);
  };

  const niveauDuForm = niveaux.find(n=>n.id===form.niveau_id);

  const startCreate = () => {
    setEditing(null);
    const nbExams = examens.filter(e=>e.niveau_id===filtreNiveau||filtreNiveau==='tous').length;
    setForm({...emptyForm, ordre: nbExams+1,
      type_contenu: niveaux.find(n=>n.id===filtreNiveau)?.type || 'hizb',
      niveau_id: filtreNiveau==='tous' ? '' : filtreNiveau
    });
    setShowForm(true); window.scrollTo(0,0);
  };

  const startEdit = (e) => {
    setEditing(e.id);
    setForm({
      niveau_id: e.niveau_id||'',
      nom: e.nom, description: e.description||'',
      type_contenu: e.type_contenu||e.niveau?.type||'hizb',
      contenu_ids: e.contenu_ids||[],
      score_minimum: e.score_minimum||70,
      bloquant: e.bloquant!==false,
      ordre: e.ordre||1
    });
    setShowForm(true); window.scrollTo(0,0);
  };

  const resetForm = () => { setEditing(null); setForm(emptyForm); setShowForm(false); };

  const toggleItem = (id) => {
    setForm(f=>({
      ...f,
      contenu_ids: f.contenu_ids.includes(id)
        ? f.contenu_ids.filter(x=>x!==id)
        : [...f.contenu_ids, id]
    }));
  };

  const selectQuick = (n) => {
    setForm(f=>({...f, contenu_ids: Array.from({length:n},(_,i)=>i+1)}));
  };

  const save = async () => {
    if (!form.nom.trim())         return toast.warning(lang==='ar'?'الاسم إلزامي':'Le nom est obligatoire');
    if (!form.niveau_id)          return toast.warning(lang==='ar'?'اختر المستوى':'Sélectionnez un niveau');
    if (form.contenu_ids.length===0) return toast.warning(lang==='ar'?'اختر الأحزاب أو السور':'Sélectionnez les Hizb ou Sourates');
    setSaving(true);
    const payload = {
      ecole_id: user.ecole_id,
      niveau_id: form.niveau_id,
      nom: form.nom.trim(),
      description: form.description.trim()||null,
      type_contenu: form.type_contenu,
      contenu_ids: form.contenu_ids,
      score_minimum: parseInt(form.score_minimum)||70,
      bloquant: form.bloquant,
      ordre: parseInt(form.ordre)||1,
      actif: true,
    };
    let error;
    if (editing) ({ error } = await supabase.from('examens').update(payload).eq('id',editing));
    else         ({ error } = await supabase.from('examens').insert(payload));
    setSaving(false);
    if (error) { toast.error(error.message||'Erreur'); return; }
    toast.success(editing
      ?(lang==='ar'?'✅ تم التحديث':'✅ Examen modifié !')
      :(lang==='ar'?'✅ تم الإضافة':'✅ Examen ajouté !'));
    resetForm(); loadData();
  };

  const supprimer = (e) => {
    setConfirmModal({
      isOpen:true,
      title: lang==='ar'?'حذف الامتحان':'Supprimer l\'examen',
      message: (lang==='ar'?'حذف الامتحان ':'Supprimer ')+e.nom+' ?',
      onConfirm: async()=>{
        await supabase.from('examens').delete().eq('id',e.id);
        toast.success(lang==='ar'?'تم الحذف':'Examen supprimé');
        setConfirmModal({isOpen:false}); loadData();
      }
    });
  };

  const toggleActif = async (e) => {
    await supabase.from('examens').update({actif:!e.actif}).eq('id',e.id);
    loadData();
  };

  // Sourates pour le niveau sélectionné
  const souratesNiveau = niveauDuForm
    ? getSouratesForNiveau(niveauDuForm.code).map(s=>{
        const dbS = souratesDB.find(x=>x.numero===s.numero);
        return dbS ? {...s, id:dbS.id} : null;
      }).filter(Boolean)
    : [];

  // Résumé du contenu d'un examen
  const resumeContenu = (e) => {
    const ids = e.contenu_ids||[];
    if (ids.length===0) return lang==='ar'?'لا يوجد محتوى':'Aucun contenu';
    if ((e.type_contenu||'hizb')==='hizb') {
      const sorted = [...ids].sort((a,b)=>a-b);
      if (sorted.length===1) return `Hizb ${sorted[0]}`;
      const consecutive = sorted.every((v,i)=>i===0||v===sorted[i-1]+1);
      if (consecutive) return `Hizb ${sorted[0]} → ${sorted[sorted.length-1]} (${sorted.length})`;
      return sorted.map(h=>`H${h}`).join(', ');
    } else {
      const names = ids.map(id=>souratesDB.find(x=>x.id===id)?.nom_ar||'?');
      if (names.length<=3) return names.join(' · ');
      return `${names[0]} · ${names[1]}... (${names.length})`;
    }
  };

  const examsFiltres = filtreNiveau==='tous'
    ? examens
    : examens.filter(e=>e.niveau_id===filtreNiveau);

  // ── FORMULAIRE (partagé PC+Mobile) ────────────────────────────────
  const FormContent = () => (
    <div>
      {/* Nom */}
      <div style={{marginBottom:13}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {lang==='ar'?'اسم الامتحان':'Nom de l\'examen *'}
        </label>
        <input style={{width:'100%',padding:'12px 14px',borderRadius:10,
          border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
          value={form.nom}
          onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
          placeholder={lang==='ar'?'مثال: امتحان الأحزاب الخمسة الأولى':"Ex: Examen 5 premiers Hizb"}/>
      </div>

      {/* Niveau */}
      <div style={{marginBottom:13}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {lang==='ar'?'المستوى':'Niveau *'}
        </label>
        <select style={{width:'100%',padding:'12px 14px',borderRadius:10,
          border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',
          background:'#fff',boxSizing:'border-box'}}
          value={form.niveau_id}
          onChange={e=>{
            const niv = niveaux.find(n=>n.id===e.target.value);
            setForm(f=>({...f,niveau_id:e.target.value,
              type_contenu:niv?.type||'hizb',contenu_ids:[]}));
          }}>
          <option value="">— {lang==='ar'?'اختر مستوى':'Choisir un niveau'} —</option>
          {niveaux.map(n=>(
            <option key={n.id} value={n.id}>{n.code} — {n.nom}</option>
          ))}
        </select>
      </div>

      {/* Sélection Hizb ou Sourates */}
      {form.niveau_id&&(
        <div style={{marginBottom:13}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666'}}>
              {form.type_contenu==='hizb'
                ?(lang==='ar'?'الأحزاب التي يشملها الامتحان *':'Hizb inclus dans l\'examen *')
                :(lang==='ar'?'السور التي يشملها الامتحان *':'Sourates incluses dans l\'examen *')}
            </label>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,fontWeight:700,
                color:form.contenu_ids.length>0?'#1D9E75':'#888'}}>
                {form.contenu_ids.length} {lang==='ar'?'محدد':'sélectionné(s)'}
              </span>
              {form.contenu_ids.length>0&&(
                <button onClick={()=>setForm(f=>({...f,contenu_ids:[]}))}
                  style={{fontSize:11,color:'#E24B4A',background:'none',border:'none',cursor:'pointer'}}>
                  ✕ {lang==='ar'?'مسح':'Effacer'}
                </button>
              )}
            </div>
          </div>

          {/* Hizb */}
          {form.type_contenu==='hizb'&&(
            <>
              {/* Sélection rapide */}
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                <span style={{fontSize:11,color:'#888',alignSelf:'center'}}>
                  {lang==='ar'?'اختيار سريع:':'Sélection rapide :'}
                </span>
                {[1,5,10,15,20,30,60].map(n=>(
                  <button key={n} onClick={()=>selectQuick(n)}
                    style={{padding:'4px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',
                      background: JSON.stringify(form.contenu_ids)===JSON.stringify(Array.from({length:n},(_,i)=>i+1))
                        ?'#1D9E75':'#f5f5f0',
                      color: JSON.stringify(form.contenu_ids)===JSON.stringify(Array.from({length:n},(_,i)=>i+1))
                        ?'#fff':'#666',
                      fontSize:12,cursor:'pointer',fontWeight:500}}>
                    1→{n}
                  </button>
                ))}
              </div>
              {/* Grille 60 Hizb */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:4}}>
                {HIZB_NUMS.map(h=>{
                  const sel=form.contenu_ids.includes(h);
                  return(
                    <div key={h} onClick={()=>toggleItem(h)}
                      style={{height:36,borderRadius:8,display:'flex',alignItems:'center',
                        justifyContent:'center',fontSize:12,fontWeight:sel?700:400,
                        cursor:'pointer',transition:'all 0.1s',
                        background:sel?'#1D9E75':'#f5f5f0',
                        color:sel?'#fff':'#666',
                        border:`1.5px solid ${sel?'#1D9E75':'#e0e0d8'}`}}>
                      {h}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Sourates */}
          {form.type_contenu==='sourate'&&(
            <div style={{maxHeight:220,overflowY:'auto',
              display:'flex',flexDirection:'column',gap:5}}>
              {souratesNiveau.length===0&&(
                <div style={{textAlign:'center',color:'#aaa',padding:'1rem',fontSize:13}}>
                  {lang==='ar'?'لا توجد سور لهذا المستوى':'Aucune sourate pour ce niveau'}
                </div>
              )}
              {souratesNiveau.map(s=>{
                const sel=form.contenu_ids.includes(s.id);
                return(
                  <div key={s.id} onClick={()=>toggleItem(s.id)}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
                      borderRadius:10,cursor:'pointer',
                      background:sel?'#E1F5EE':'#f5f5f0',
                      border:`1.5px solid ${sel?'#1D9E75':'#e0e0d8'}`}}>
                    <div style={{width:20,height:20,borderRadius:5,flexShrink:0,
                      border:`1.5px solid ${sel?'#1D9E75':'#ccc'}`,
                      background:sel?'#1D9E75':'#fff',
                      display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {sel&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>}
                    </div>
                    <span style={{fontSize:11,color:'#aaa',minWidth:22}}>{s.numero}</span>
                    <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",
                      direction:'rtl',color:sel?'#085041':'#333',
                      fontWeight:sel?600:400}}>{s.nom_ar}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Score minimum */}
      <div style={{marginBottom:13}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {lang==='ar'?`النقاط الدنيا للنجاح : ${form.score_minimum}%`:`Score minimum pour réussir : ${form.score_minimum}%`}
        </label>
        <input type="range" min="0" max="100" step="5"
          style={{width:'100%',accentColor:'#1D9E75'}}
          value={form.score_minimum}
          onChange={e=>setForm(f=>({...f,score_minimum:parseInt(e.target.value)}))}/>
        <div style={{display:'flex',justifyContent:'space-between',
          fontSize:11,color:'#aaa',marginTop:2}}>
          <span>0%</span>
          <span style={{fontWeight:600,color:'#1D9E75'}}>{form.score_minimum}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Bloquant toggle */}
      <div style={{marginBottom:16}}>
        <div onClick={()=>setForm(f=>({...f,bloquant:!f.bloquant}))}
          style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
            borderRadius:12,cursor:'pointer',
            background:form.bloquant?'#FCEBEB':'#f5f5f0',
            border:`1.5px solid ${form.bloquant?'#E24B4A30':'#e0e0d8'}`}}>
          <div style={{width:44,height:24,borderRadius:12,position:'relative',flexShrink:0,
            background:form.bloquant?'#E24B4A':'#ccc',transition:'background 0.2s'}}>
            <div style={{position:'absolute',top:2,
              left:form.bloquant?20:2,width:20,height:20,
              borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:600,
              color:form.bloquant?'#A32D2D':'#666'}}>
              {form.bloquant
                ?(lang==='ar'?'🔒 موقف — يمنع الاستظهار حتى اجتياز الامتحان':'🔒 Bloquant — empêche de continuer')
                :(lang==='ar'?'📢 تنبيه فقط':'📢 Alerte uniquement')}
            </div>
            <div style={{fontSize:11,color:'#888',marginTop:1}}>
              {form.bloquant
                ?(lang==='ar'?'يجب اجتياز الامتحان قبل الاستمرار':'L\'élève doit passer l\'examen avant de continuer')
                :(lang==='ar'?'تنبيه للمراقب بدون إيقاف':'Notification au surveillant sans blocage')}
            </div>
          </div>
        </div>
      </div>

      {/* Boutons */}
      <div style={{display:'flex',gap:8}}>
        <button onClick={resetForm}
          style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',
            border:'none',borderRadius:12,fontSize:14,fontWeight:600,
            cursor:'pointer',fontFamily:'inherit'}}>
          {lang==='ar'?'إلغاء':'Annuler'}
        </button>
        <button onClick={save} disabled={saving}
          style={{flex:2,padding:'13px',
            background:saving?'#ccc':editing?'#378ADD':'#1D9E75',
            color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,
            cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
          {saving?'...':(editing
            ?(lang==='ar'?'تحديث':'Mettre à jour ✓')
            :(lang==='ar'?'حفظ':'Enregistrer'))}
        </button>
      </div>
    </div>
  );

  // ── MOBILE ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        <div style={{background:'#fff',padding:'14px 16px 0',
          borderBottom:'0.5px solid #e0e0d8',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',
                fontSize:22,color:'#085041',padding:0}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>
              📝 {lang==='ar'?'الامتحانات':'Examens'}
            </div>
            <button onClick={()=>{if(showForm&&!editing)resetForm();else startCreate();}}
              style={{background:showForm&&!editing?'#f0f0ec':'#1D9E75',
                color:showForm&&!editing?'#666':'#fff',border:'none',borderRadius:10,
                padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              {showForm&&!editing?'✕':'+ Ajouter'}
            </button>
          </div>
          {/* Filtre niveau */}
          <div style={{display:'flex',gap:6,overflowX:'auto',
            scrollbarWidth:'none',paddingBottom:10}}>
            <div onClick={()=>setFiltreNiveau('tous')}
              style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,
                flexShrink:0,cursor:'pointer',
                background:filtreNiveau==='tous'?'#1D9E75':'#f0f0ec',
                color:filtreNiveau==='tous'?'#fff':'#666'}}>
              {lang==='ar'?'الكل':'Tous'}
            </div>
            {niveaux.map(n=>(
              <div key={n.id} onClick={()=>setFiltreNiveau(n.id)}
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
          {showForm&&(
            <div style={{background:'#fff',borderRadius:16,padding:'18px',
              marginBottom:14,border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`}}>
              <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                {editing
                  ?(lang==='ar'?'تعديل الامتحان':'✏️ Modifier l\'examen')
                  :(lang==='ar'?'إضافة امتحان':'📝 Nouvel examen')}
              </div>
              <FormContent/>
            </div>
          )}

          {loading&&<div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>}

          {!loading&&examsFiltres.length===0&&!showForm&&(
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem',
              background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
              <div style={{fontSize:40,marginBottom:10}}>📝</div>
              <div style={{fontSize:14}}>
                {lang==='ar'?'لا توجد امتحانات':'Aucun examen configuré'}
              </div>
            </div>
          )}

          {!loading&&examsFiltres.map(e=>{
            const nc=e.niveau?.couleur||'#888';
            return(
              <div key={e.id} style={{background:'#fff',borderRadius:14,
                padding:'14px',marginBottom:10,
                border:`0.5px solid ${nc}20`,opacity:e.actif?1:0.6}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{fontSize:24,flexShrink:0}}>
                    {e.bloquant?'🔒':'📢'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15}}>{e.nom}</div>
                    {/* Contenu */}
                    <div style={{fontSize:12,color:'#085041',marginTop:4,
                      fontFamily:(e.type_contenu||'hizb')==='sourate'?"'Tajawal',Arial":'inherit',
                      direction:(e.type_contenu||'hizb')==='sourate'?'rtl':'ltr'}}>
                      {resumeContenu(e)}
                    </div>
                    <div style={{display:'flex',gap:5,marginTop:6,flexWrap:'wrap'}}>
                      {e.niveau&&(
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                          background:`${nc}20`,color:nc,fontWeight:600}}>
                          {e.niveau.code}
                        </span>
                      )}
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                        background:'#E1F5EE',color:'#085041',fontWeight:600}}>
                        ✓ min {e.score_minimum}%
                      </span>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                        background:e.bloquant?'#FCEBEB':'#FAEEDA',
                        color:e.bloquant?'#A32D2D':'#633806',fontWeight:600}}>
                        {e.bloquant?'🔒':'📢'} {e.bloquant
                          ?(lang==='ar'?'موقف':'Bloquant')
                          :(lang==='ar'?'تنبيه':'Alerte')}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button onClick={()=>startEdit(e)}
                    style={{flex:1,padding:'9px',background:'#E6F1FB',color:'#0C447C',
                      border:'none',borderRadius:10,fontSize:13,fontWeight:600,
                      cursor:'pointer',fontFamily:'inherit'}}>
                    ✏️ {lang==='ar'?'تعديل':'Modifier'}
                  </button>
                  <button onClick={()=>toggleActif(e)}
                    style={{flex:1,padding:'9px',
                      background:e.actif?'#FAEEDA':'#E1F5EE',
                      color:e.actif?'#633806':'#085041',border:'none',
                      borderRadius:10,fontSize:13,fontWeight:600,
                      cursor:'pointer',fontFamily:'inherit'}}>
                    {e.actif
                      ?(lang==='ar'?'تعطيل':'Désactiver')
                      :(lang==='ar'?'تفعيل':'Activer')}
                  </button>
                  <button onClick={()=>supprimer(e)}
                    style={{padding:'9px 14px',background:'#FCEBEB',color:'#E24B4A',
                      border:'none',borderRadius:10,fontSize:13,cursor:'pointer'}}>
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {confirmModal.isOpen&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
            zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:320,width:'100%'}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
              <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setConfirmModal({isOpen:false})}
                  style={{flex:1,padding:'12px',background:'#f5f5f0',border:'none',
                    borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                  {lang==='ar'?'إلغاء':'Annuler'}
                </button>
                <button onClick={confirmModal.onConfirm}
                  style={{flex:1,padding:'12px',background:'#E24B4A',color:'#fff',
                    border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  {lang==='ar'?'حذف':'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PC ────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="back-link"
            onClick={()=>goBack?goBack():navigate('dashboard')}>
            ← {lang==='ar'?'رجوع':'Retour'}
          </button>
          <div style={{fontSize:20,fontWeight:700}}>
            📝 {lang==='ar'?'إدارة الامتحانات':'Gestion des examens'}
          </div>
        </div>
        <button onClick={()=>{if(showForm&&!editing)resetForm();else startCreate();}}
          style={{padding:'8px 18px',
            background:showForm&&!editing?'#f0f0ec':'#1D9E75',
            color:showForm&&!editing?'#666':'#fff',border:'none',
            borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
          {showForm&&!editing?'✕ Annuler':'+ Nouvel examen'}
        </button>
      </div>

      {/* Filtre niveau PC */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:'1rem'}}>
        {[{id:'tous',code:lang==='ar'?'الكل':'Tous',couleur:'#1D9E75'},...niveaux].map(n=>(
          <div key={n.id} onClick={()=>setFiltreNiveau(n.id)}
            style={{padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:600,
              cursor:'pointer',
              background:filtreNiveau===n.id?n.couleur:'#f5f5f0',
              color:filtreNiveau===n.id?'#fff':'#666',
              border:`0.5px solid ${filtreNiveau===n.id?n.couleur:'#e0e0d8'}`}}>
            {n.code}
          </div>
        ))}
      </div>

      {/* Formulaire PC */}
      {showForm&&(
        <div style={{background:'#fff',
          border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`,
          borderRadius:14,padding:'1.5rem',marginBottom:'1.5rem'}}>
          <div style={{fontSize:15,fontWeight:600,color:'#085041',marginBottom:'1rem'}}>
            {editing
              ?(lang==='ar'?'تعديل الامتحان':'✏️ Modifier l\'examen')
              :(lang==='ar'?'إضافة امتحان جديد':'📝 Nouvel examen')}
          </div>
          <FormContent/>
        </div>
      )}

      {loading?<div className="loading">...</div>
      :examsFiltres.length===0?(
        <div style={{textAlign:'center',padding:'3rem',color:'#aaa',
          background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:48,marginBottom:12}}>📝</div>
          <div>{lang==='ar'?'لا توجد امتحانات':'Aucun examen configuré'}</div>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {examsFiltres.map(e=>{
            const nc=e.niveau?.couleur||'#888';
            return(
              <div key={e.id} style={{background:'#fff',borderRadius:14,
                padding:'16px 18px',border:`0.5px solid ${nc}20`,
                display:'flex',alignItems:'center',gap:16,
                opacity:e.actif?1:0.5}}>
                <div style={{fontSize:28,flexShrink:0}}>
                  {e.bloquant?'🔒':'📢'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>
                    {e.nom}
                  </div>
                  {/* Contenu de l'examen */}
                  <div style={{fontSize:13,color:'#085041',marginBottom:6,
                    fontFamily:(e.type_contenu||'hizb')==='sourate'?"'Tajawal',Arial":'inherit',
                    direction:(e.type_contenu||'hizb')==='sourate'?'rtl':'ltr'}}>
                    {resumeContenu(e)}
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {e.niveau&&(
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                        background:`${nc}20`,color:nc,fontWeight:600}}>
                        {e.niveau.code} — {e.niveau.nom}
                      </span>
                    )}
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:'#E1F5EE',color:'#085041',fontWeight:600}}>
                      Score min: {e.score_minimum}%
                    </span>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:e.bloquant?'#FCEBEB':'#FAEEDA',
                      color:e.bloquant?'#A32D2D':'#633806',fontWeight:600}}>
                      {e.bloquant
                        ?'🔒 Bloquant'
                        :'📢 Alerte seulement'}
                    </span>
                  </div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button onClick={()=>startEdit(e)}
                    style={{padding:'7px 12px',background:'#E6F1FB',color:'#0C447C',
                      border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    ✏️
                  </button>
                  <button onClick={()=>toggleActif(e)}
                    style={{padding:'7px 12px',
                      background:e.actif?'#FAEEDA':'#E1F5EE',
                      color:e.actif?'#633806':'#085041',border:'none',
                      borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    {e.actif?'Désactiver':'Activer'}
                  </button>
                  <button onClick={()=>supprimer(e)}
                    style={{padding:'7px 10px',background:'#FCEBEB',color:'#E24B4A',
                      border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmModal.isOpen&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
          zIndex:1000,display:'flex',alignItems:'center',
          justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,
            maxWidth:400,width:'100%'}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>
              {confirmModal.title}
            </div>
            <div style={{fontSize:13,color:'#666',marginBottom:20}}>
              {confirmModal.message}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmModal({isOpen:false})}
                style={{padding:'10px 20px',background:'#f5f5f0',border:'none',
                  borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Annuler
              </button>
              <button onClick={confirmModal.onConfirm}
                style={{padding:'10px 20px',background:'#E24B4A',color:'#fff',
                  border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
