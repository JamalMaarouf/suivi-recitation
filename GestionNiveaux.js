import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { getSouratesForNiveau } from '../lib/sourates';

const HIZB_NUMS = Array.from({length:60}, (_,i) => i+1);

export default function GestionBlocs({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,   setNiveaux]   = useState([]);
  const [examens,   setExamens]   = useState([]);
  const [blocs,     setBlocs]     = useState([]);
  const [souratesDB,setSouratesDB]= useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  // Filtres
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [filtreExamen, setFiltreExamen] = useState('');

  // Formulaire
  const [showForm, setShowForm]   = useState(false);
  const [editing,  setEditing]    = useState(null);
  const emptyForm = { examen_id:'', niveau_id:'', nom:'', ordre:1, type_contenu:'hizb', contenu_ids:[] };
  const [form, setForm]           = useState(emptyForm);
  const [confirmModal, setConfirmModal] = useState({isOpen:false});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data:nd },{ data:ed },{ data:bd },{ data:sd }] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('examens').select('id,nom,niveau_id,type_seuil').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('blocs_examen').select('*, examen:examen_id(nom), niveau:niveau_id(code,nom,couleur)').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('sourates').select('*').order('numero'),
    ]);
    setNiveaux(nd||[]);
    setExamens(ed||[]);
    setBlocs(bd||[]);
    setSouratesDB(sd||[]);
    if (!filtreNiveau && nd?.length > 0) setFiltreNiveau(nd[0].id);
    setLoading(false);
  };

  const niveauSelectionne = niveaux.find(n=>n.id===filtreNiveau);
  const examensNiveau = examens.filter(e=>e.niveau_id===filtreNiveau);
  const blocsExamen = blocs.filter(b=>b.examen_id===filtreExamen);

  // Quand on change de niveau, reset l'examen sélectionné
  const changerNiveau = (nid) => {
    setFiltreNiveau(nid);
    const examsNiv = examens.filter(e=>e.niveau_id===nid);
    setFiltreExamen(examsNiv.length>0?examsNiv[0].id:'');
    setShowForm(false);
  };

  const startCreate = () => {
    setEditing(null);
    setForm({
      examen_id: filtreExamen,
      niveau_id: filtreNiveau,
      nom: '',
      ordre: blocsExamen.length+1,
      type_contenu: niveauSelectionne?.type || 'hizb',
      contenu_ids: []
    });
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const startEdit = (b) => {
    setEditing(b.id);
    setForm({
      examen_id: b.examen_id,
      niveau_id: b.niveau_id,
      nom: b.nom,
      ordre: b.ordre,
      type_contenu: b.type_contenu,
      contenu_ids: b.contenu_ids || []
    });
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const resetForm = () => { setEditing(null); setForm(emptyForm); setShowForm(false); };

  const toggleItem = (id) => {
    const ids = form.contenu_ids;
    const exists = ids.includes(id);
    setForm(f=>({...f, contenu_ids: exists ? ids.filter(x=>x!==id) : [...ids, id]}));
  };

  const save = async () => {
    if (!form.nom.trim()) return toast.warning(lang==='ar'?'الاسم إلزامي':'Le nom est obligatoire');
    if (form.contenu_ids.length === 0) return toast.warning(lang==='ar'?'اختر عناصر البلوك':'Sélectionnez au moins un élément');
    if (!form.examen_id) return toast.warning(lang==='ar'?'اختر الامتحان':'Sélectionnez un examen');
    setSaving(true);
    const payload = {
      examen_id: form.examen_id,
      niveau_id: form.niveau_id,
      ecole_id: user.ecole_id,
      nom: form.nom.trim(),
      ordre: parseInt(form.ordre)||1,
      type_contenu: form.type_contenu,
      contenu_ids: form.contenu_ids,
    };
    let error;
    if (editing) ({ error } = await supabase.from('blocs_examen').update(payload).eq('id',editing));
    else         ({ error } = await supabase.from('blocs_examen').insert(payload));
    setSaving(false);
    if (error) { toast.error(error.message||'Erreur'); return; }
    toast.success(editing
      ? (lang==='ar'?'✅ تم التحديث':'✅ Bloc modifié !')
      : (lang==='ar'?'✅ تم الإضافة':'✅ Bloc ajouté !'));
    resetForm(); loadData();
  };

  const supprimer = (b) => {
    setConfirmModal({
      isOpen:true,
      title: lang==='ar'?'حذف البلوك':'Supprimer le bloc',
      message: (lang==='ar'?'حذف ':'Supprimer ')+b.nom+' ?',
      onConfirm: async()=>{
        await supabase.from('blocs_examen').delete().eq('id',b.id);
        toast.success(lang==='ar'?'تم الحذف':'Bloc supprimé');
        setConfirmModal({isOpen:false}); loadData();
      }
    });
  };

  // Sourates disponibles pour le niveau sélectionné
  const souratesNiveau = niveauSelectionne
    ? getSouratesForNiveau(niveauSelectionne.code).map(s => {
        const dbS = souratesDB.find(x=>x.numero===s.numero);
        return { ...s, id: dbS?.id || null, nom_fr: s.nom_ar };
      }).filter(s=>s.id)
    : [];

  // Résumé d'un bloc
  const resumeBloc = (b) => {
    if (b.type_contenu === 'hizb') {
      const sorted = [...(b.contenu_ids||[])].sort((a,z)=>a-z);
      if (sorted.length === 0) return '—';
      if (sorted.length === 1) return `Hizb ${sorted[0]}`;
      return `Hizb ${sorted[0]} → ${sorted[sorted.length-1]} (${sorted.length})`;
    } else {
      const names = (b.contenu_ids||[]).map(id=>{
        const s = souratesDB.find(x=>x.id===id);
        return s?.nom_ar || '?';
      });
      if (names.length === 0) return '—';
      if (names.length <= 3) return names.join(', ');
      return `${names[0]}, ${names[1]}... (${names.length} sourates)`;
    }
  };

  const FormContent = () => (
    <div>
      {/* Nom du bloc */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {lang==='ar'?'اسم البلوك':'Nom du bloc *'}
        </label>
        <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',
          fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
          value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
          placeholder={lang==='ar'?'مثال: المجموعة الأولى — 5 أحزاب':"Ex: Groupe 1 — 5 premiers Hizb"}/>
      </div>

      {/* Sélection des éléments */}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <label style={{fontSize:12,fontWeight:600,color:'#666'}}>
            {form.type_contenu==='hizb'
              ? (lang==='ar'?'اختر الأحزاب':'Sélectionner les Hizb *')
              : (lang==='ar'?'اختر السور':'Sélectionner les Sourates *')}
          </label>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>
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

        {/* Grille Hizb */}
        {form.type_contenu==='hizb'&&(
          <>
            {/* Sélection rapide */}
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
              {[[5,'5'],[10,'10'],[15,'15'],[30,'30'],[60,'60']].map(([n,label])=>(
                <button key={n} onClick={()=>setForm(f=>({...f,contenu_ids:Array.from({length:n},(_,i)=>i+1)}))}
                  style={{padding:'4px 12px',borderRadius:20,border:'0.5px solid #e0e0d8',background:'#f5f5f0',
                    fontSize:12,cursor:'pointer',fontWeight:500,color:'#666'}}>
                  1→{label}
                </button>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:4,
              maxHeight:180,overflowY:'auto',padding:'4px'}}>
              {HIZB_NUMS.map(h=>{
                const sel = form.contenu_ids.includes(h);
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

        {/* Liste Sourates */}
        {form.type_contenu==='sourate'&&(
          <div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
            {souratesNiveau.length===0&&(
              <div style={{textAlign:'center',color:'#aaa',padding:'1rem',fontSize:13}}>
                {lang==='ar'?'لا توجد سور لهذا المستوى':'Aucune sourate pour ce niveau'}
              </div>
            )}
            {souratesNiveau.map(s=>{
              const sel = form.contenu_ids.includes(s.id);
              return(
                <div key={s.id} onClick={()=>toggleItem(s.id)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
                    borderRadius:10,cursor:'pointer',
                    background:sel?'#E1F5EE':'#f5f5f0',
                    border:`1.5px solid ${sel?'#1D9E75':'#e0e0d8'}`}}>
                  <div style={{width:20,height:20,borderRadius:5,flexShrink:0,
                    border:`1.5px solid ${sel?'#1D9E75':'#ccc'}`,background:sel?'#1D9E75':'#fff',
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {sel&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>}
                  </div>
                  <span style={{fontSize:11,color:'#aaa',minWidth:22}}>{s.numero}</span>
                  <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",direction:'rtl',
                    color:sel?'#085041':'#333',fontWeight:sel?600:400}}>{s.nom_ar}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Boutons */}
      <div style={{display:'flex',gap:8}}>
        <button onClick={resetForm}
          style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',
            borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {lang==='ar'?'إلغاء':'Annuler'}
        </button>
        <button onClick={save} disabled={saving}
          style={{flex:2,padding:'13px',background:saving?'#ccc':editing?'#378ADD':'#1D9E75',
            color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,
            cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
          {saving?'...':(editing
            ?(lang==='ar'?'تحديث':'Mettre à jour ✓')
            :(lang==='ar'?'حفظ':'Enregistrer'))}
        </button>
      </div>
    </div>
  );

  return (
    <div style={isMobile?{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}:{}}>
      {/* Header */}
      <div style={isMobile?{background:'#fff',padding:'14px 16px 0',borderBottom:'0.5px solid #e0e0d8',position:'sticky',top:0,zIndex:100}:{}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:isMobile?22:14,
              color:'#085041',padding:0,fontFamily:'inherit',fontWeight:600}}>
            {isMobile?'←':'← Retour'}
          </button>
          {!isMobile&&<div style={{fontSize:20,fontWeight:700}}>🔧 Blocs d'examen</div>}
          {isMobile&&<div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>🔧 {lang==='ar'?'مجموعات الامتحان':'Blocs'}</div>}
        </div>

        {/* Filtre Niveau */}
        <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none',
          paddingBottom:isMobile?10:8,flexWrap:isMobile?'nowrap':'wrap'}}>
          {niveaux.map(n=>(
            <div key={n.id} onClick={()=>changerNiveau(n.id)}
              style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,
                flexShrink:0,cursor:'pointer',
                background:filtreNiveau===n.id?n.couleur:'#f0f0ec',
                color:filtreNiveau===n.id?'#fff':'#666'}}>
              {n.code}
            </div>
          ))}
        </div>

        {/* Filtre Examen */}
        {examensNiveau.length>0&&(
          <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none',
            paddingBottom:isMobile?10:8,flexWrap:isMobile?'nowrap':'wrap'}}>
            {examensNiveau.map(e=>(
              <div key={e.id} onClick={()=>{setFiltreExamen(e.id);setShowForm(false);}}
                style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,
                  flexShrink:0,cursor:'pointer',
                  background:filtreExamen===e.id?'#EF9F27':'#f5f5f0',
                  color:filtreExamen===e.id?'#fff':'#666',
                  border:`0.5px solid ${filtreExamen===e.id?'#EF9F27':'#e0e0d8'}`}}>
                📝 {e.nom}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{padding:isMobile?'12px':'0',marginTop:isMobile?0:'1rem'}}>

        {/* Pas d'examen pour ce niveau */}
        {!loading&&examensNiveau.length===0&&(
          <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12,
            border:'0.5px solid #e0e0d8'}}>
            <div style={{fontSize:36,marginBottom:10}}>📝</div>
            <div style={{fontSize:14,marginBottom:8}}>
              {lang==='ar'?'لا توجد امتحانات لهذا المستوى':'Aucun examen pour ce niveau'}
            </div>
            <button onClick={()=>navigate('examens')}
              style={{padding:'10px 20px',background:'#EF9F27',color:'#fff',border:'none',
                borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              {lang==='ar'?'إضافة امتحان':'Créer un examen'}
            </button>
          </div>
        )}

        {/* Bouton ajouter bloc */}
        {filtreExamen&&!showForm&&(
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button onClick={startCreate}
              style={{padding:'10px 18px',background:'#1D9E75',color:'#fff',border:'none',
                borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              + {lang==='ar'?'إضافة بلوك':'Ajouter un bloc'}
            </button>
          </div>
        )}

        {/* Formulaire */}
        {showForm&&(
          <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
            border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`}}>
            <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
              {editing
                ?(lang==='ar'?'تعديل البلوك':'✏️ Modifier le bloc')
                :(lang==='ar'?'إضافة بلوك':'🔧 Nouveau bloc')}
            </div>
            <FormContent/>
          </div>
        )}

        {/* Loading */}
        {loading&&<div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>}

        {/* Liste blocs */}
        {!loading&&filtreExamen&&blocsExamen.length===0&&!showForm&&(
          <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
            <div style={{fontSize:36,marginBottom:10}}>🔧</div>
            <div style={{fontSize:14}}>
              {lang==='ar'?'لا توجد مجموعات بعد':'Aucun bloc défini pour cet examen'}
            </div>
          </div>
        )}

        {!loading&&blocsExamen.map((b,idx)=>{
          const nc = b.niveau?.couleur||'#888';
          return(
            <div key={b.id} style={{background:'#fff',borderRadius:14,padding:'14px',
              marginBottom:10,border:`0.5px solid ${nc}20`}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                {/* Numéro */}
                <div style={{width:40,height:40,borderRadius:10,background:`${nc}20`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontWeight:800,fontSize:16,color:nc,flexShrink:0}}>
                  {b.ordre}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:'#1a1a1a'}}>{b.nom}</div>
                  <div style={{fontSize:12,color:'#888',marginTop:4,fontFamily:"'Tajawal',Arial",direction:'rtl',textAlign:'right'}}>
                    {resumeBloc(b)}
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:b.type_contenu==='hizb'?'#E6F1FB':'#EEEDFE',
                      color:b.type_contenu==='hizb'?'#0C447C':'#3C3489',fontWeight:600}}>
                      {b.type_contenu==='hizb'?`📿 ${(b.contenu_ids||[]).length} Hizb`:`📖 ${(b.contenu_ids||[]).length} sourates`}
                    </span>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:'#FAEEDA',color:'#633806',fontWeight:600}}>
                      📝 {b.examen?.nom||'—'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={()=>startEdit(b)}
                  style={{flex:1,padding:'9px',background:'#E6F1FB',color:'#0C447C',border:'none',
                    borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  ✏️ {lang==='ar'?'تعديل':'Modifier'}
                </button>
                <button onClick={()=>supprimer(b)}
                  style={{padding:'9px 14px',background:'#FCEBEB',color:'#E24B4A',border:'none',
                    borderRadius:10,fontSize:13,cursor:'pointer'}}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Modal */}
      {confirmModal.isOpen&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,
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
