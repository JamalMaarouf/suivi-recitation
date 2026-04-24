import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { getSouratesForNiveau } from '../lib/sourates';
import { t } from '../lib/i18n';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import ExportButtons from '../components/ExportButtons';

export default function GestionExamens({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,    setNiveaux]    = useState([]);
  const [examens,    setExamens]    = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [ecoleConfig, setEcoleConfig] = useState(null);
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
  // Programme du niveau sélectionné (éléments disponibles pour l'examen)
  const [programmeNiveau, setProgrammeNiveau] = useState([]); // ids/nums du programme
  const [ensemblesNiveau, setEnsemblesNiveau] = useState([]); // ensembles pour niveaux sourate

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
    const [{data:nd},{data:ed},{data:sd},{data:ec}] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur,sens_recitation').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('examens').select('*').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('sourates').select('*').order('numero'),
      supabase.from('ecoles').select('sens_recitation_defaut').eq('id',user.ecole_id).maybeSingle(),
    ]);
    setNiveaux(nd||[]);
    setEcoleConfig(ec||null);
    // Enrichir chaque examen avec les données de son niveau
    const examensenrichis = (ed||[]).map(e=>({
      ...e,
      niveau: (nd||[]).find(n=>n.id===e.niveau_id)||null
    }));
    setExamens(examensenrichis);
    setSouratesDB(sd||[]);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
    // Si filtreNiveau actif, charger son programme avec la liste fraîche
    if (filtreNiveau && filtreNiveau!=='tous' && nd) {
      chargerProgrammeNiveau(filtreNiveau, nd);
    }
  };

  const niveauDuForm = niveaux.find(n=>n.id===form.niveau_id);

  // Charger le programme du niveau quand niveau_id change dans le form
  const chargerProgrammeNiveau = async (niveau_id, niveauxListe) => {
    if (!niveau_id) { setProgrammeNiveau([]); return; }
    const liste = niveauxListe || niveaux;
    const niv = liste.find(n => n.id === niveau_id);

    // Charger souratesDB si vide et niveau sourate
    let sDB = souratesDB;
    if (niv?.type === 'sourate' && souratesDB.length === 0) {
      const { data: sd } = await supabase.from('sourates').select('*').order('numero');
      if (sd && sd.length > 0) { setSouratesDB(sd); sDB = sd; }
    }

    const { data } = await supabase
      .from('programmes')
      .select('reference_id, type_contenu')
      .eq('niveau_id', niveau_id)
      .eq('ecole_id', user.ecole_id)
      .order('ordre');

    if (!data || data.length === 0) { setProgrammeNiveau([]); return; }

    // Charger les ensembles si niveau sourate
    if (niv?.type === 'sourate') {
      const { data: ens } = await supabase.from('ensembles_sourates')
        .select('*').eq('niveau_id', niveau_id)
        .eq('ecole_id', user.ecole_id).order('ordre');
      setEnsemblesNiveau(ens || []);
    } else {
      setEnsemblesNiveau([]);
    }

    if (niv?.type === 'hizb') {
      setProgrammeNiveau(data.map(d => parseInt(d.reference_id)));
    } else {
      // Sourate : vérifier que les UUIDs existent dans souratesDB
      const ids = data.map(d => d.reference_id);
      const idsValides = ids.filter(id => sDB.some(s => s.id === id));
      if (idsValides.length > 0) {
        setProgrammeNiveau(idsValides);
      } else {
        // Migration : numéros → UUIDs
        const convertis = ids.map(id => {
          const num = parseInt(id);
          return isNaN(num) ? id : sDB.find(s => s.numero === num)?.id || null;
        }).filter(Boolean);
        setProgrammeNiveau(convertis);
      }
    }
  };

  const startCreate = () => {
    setEditing(null);
    const nid = filtreNiveau==='tous' ? '' : filtreNiveau;
    setForm({...emptyForm,
      ordre: examens.length+1,
      type_contenu: niveaux.find(n=>n.id===nid)?.type || 'hizb',
      niveau_id: nid
    });
    if (nid) chargerProgrammeNiveau(nid, niveaux);
    else { setProgrammeNiveau([]); setEnsemblesNiveau([]); }
    setShowForm(true);
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
    if (e.niveau_id) chargerProgrammeNiveau(e.niveau_id, niveaux);
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
    resetForm();
    setFiltreNiveau('tous'); // afficher tous les examens après création
    loadData();
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

  // ── Helper : préparer une ligne d'examen pour export ──
  const prepareExamRow = (e) => {
    const niveau = e.niveau || niveaux.find(n => n.id === e.niveau_id);
    return {
      nom: e.nom || '',
      description: e.description || '',
      niveau_nom: niveau?.nom || niveau?.code || '—',
      niveau_couleur: niveau?.couleur || '#085041',
      type_contenu: e.type_contenu || '',
      nb_elements: Array.isArray(e.contenu_ids) ? e.contenu_ids.length : 0,
      score_minimum: e.score_minimum || 0,
      bloquant: !!e.bloquant,
      ordre: e.ordre || 0,
    };
  };

  // ── Export PDF ──
  const handleExportPDF = async () => {
    if (examsFiltres.length === 0) return;
    const rows = examsFiltres.map(prepareExamRow);
    const niveauLabel = filtreNiveau !== 'tous'
      ? (niveaux.find(n => n.id === filtreNiveau)?.nom || '')
      : '';
    try {
      await openPDF('rapport_gestion_examens', {
        ecole: { nom: user?.ecole?.nom || '' },
        filtreNiveau: niveauLabel,
        rows,
      }, lang);
    } catch (err) {
      toast.error((lang === 'ar' ? 'خطأ PDF : ' : 'Erreur PDF : ') + err.message);
    }
  };

  // ── Export Excel ──
  const handleExportExcel = async () => {
    if (examsFiltres.length === 0) return;
    const headers = [
      lang === 'ar' ? 'الترتيب' : 'Ordre',
      lang === 'ar' ? 'اسم الامتحان' : 'Nom',
      lang === 'ar' ? 'الوصف' : 'Description',
      lang === 'ar' ? 'المستوى' : 'Niveau',
      lang === 'ar' ? 'نوع المحتوى' : 'Type contenu',
      lang === 'ar' ? 'عدد العناصر' : 'Nb éléments',
      lang === 'ar' ? 'عتبة النجاح %' : 'Seuil %',
      lang === 'ar' ? 'حاجز' : 'Bloquant',
    ];
    const rows = examsFiltres.map(prepareExamRow).map(r => [
      r.ordre,
      r.nom,
      r.description,
      r.niveau_nom,
      r.type_contenu === 'hizb' ? (lang==='ar'?'حزب':'Hizb')
        : r.type_contenu === 'sourate' ? (lang==='ar'?'سورة':'Sourate')
        : r.type_contenu === 'ensemble' ? (lang==='ar'?'مجموعة':'Ensemble')
        : r.type_contenu,
      r.nb_elements,
      r.score_minimum,
      r.bloquant ? (lang==='ar'?'نعم':'Oui') : (lang==='ar'?'لا':'Non'),
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      await exportExcelSimple(
        `examens_config_${dateStr}.xlsx`,
        [headers, ...rows],
        lang === 'ar' ? 'الامتحانات' : 'Examens',
      );
    } catch (err) {
      toast.error((lang === 'ar' ? 'خطأ Excel : ' : 'Erreur Excel : ') + err.message);
    }
  };

  // ── FORMULAIRE (partagé PC+Mobile) ────────────────────────────────
  const renderFormContent = () => (
    <div>
      {/* Nom */}
      <div style={{marginBottom:13}}>
        <label className="field-lbl">
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
        <label className="field-lbl">
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
            chargerProgrammeNiveau(e.target.value, niveaux);
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

          {/* Hizb — uniquement ceux du programme du niveau */}
          {form.type_contenu==='hizb'&&(
            <>
              {programmeNiveau.length===0?(
                <div style={{textAlign:'center',padding:'1.5rem',background:'#FAEEDA',
                  borderRadius:10,color:'#633806',fontSize:13}}>
                  ⚠️ {lang==='ar'
                    ?'لا يوجد برنامج لهذا المستوى. أضف البرنامج أولاً من صفحة المستويات.'
                    :"Aucun programme défini pour ce niveau. Ajoutez-le d'abord dans Niveaux."}
                </div>
              ):(
                <>
                  {/* Sélection rapide : tout / effacer */}
                  <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center',flexWrap:'wrap'}}>
                    <button onClick={()=>setForm(f=>({...f,contenu_ids:[...programmeNiveau]}))}
                      style={{padding:'4px 12px',borderRadius:20,border:'0.5px solid #1D9E75',
                        background:'#E1F5EE',color:'#085041',fontSize:12,cursor:'pointer',fontWeight:600}}>
                      {lang==='ar'?'تحديد الكل':'Tout sélectionner'} ({programmeNiveau.length})
                    </button>
                    {form.contenu_ids.length>0&&(
                      <button onClick={()=>setForm(f=>({...f,contenu_ids:[]}))}
                        style={{padding:'4px 12px',borderRadius:20,border:'0.5px solid #e0e0d8',
                          background:'#FCEBEB',color:'#E24B4A',fontSize:12,cursor:'pointer'}}>
                        ✕ {lang==='ar'?'مسح':'Effacer'}
                      </button>
                    )}
                    <span style={{fontSize:11,color:'#888',marginLeft:'auto'}}>
                      {lang==='ar'?'من برنامج المستوى':'Du programme du niveau'}
                    </span>
                  </div>
                  {/* Grille des Hizb du programme uniquement, triés selon le sens du niveau */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:4}}>
                    {(() => {
                      const sensNiv = niveauDuForm?.sens_recitation || ecoleConfig?.sens_recitation_defaut || 'desc';
                      const sorted = [...programmeNiveau].sort((a,b) => sensNiv === 'asc' ? a - b : b - a);
                      return sorted.map(h=>{
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
                    });
                    })()}
                  </div>
                </>
              )}
            </>
          )}

          {/* Ensembles — pour les niveaux sourate */}
          {form.type_contenu==='sourate'&&(
            <>
              {ensemblesNiveau.length===0?(
                <div style={{textAlign:'center',padding:'1.5rem',background:'#FAEEDA',
                  borderRadius:10,color:'#633806',fontSize:13}}>
                  ⚠️ {lang==='ar'
                    ?'لا توجد مجموعات لهذا المستوى. أضف المجموعات أولاً.'
                    :"Aucun ensemble défini. Ajoutez-les d'abord dans Ensembles."}
                  <button onClick={()=>navigate('ensembles')}
                    style={{display:'block',margin:'8px auto 0',padding:'6px 14px',
                      background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,
                      fontSize:12,cursor:'pointer',fontWeight:600}}>
                    {lang==='ar'?'انتقل إلى المجموعات':'Aller aux Ensembles →'}
                  </button>
                </div>
              ):(
                <>
                  <div style={{fontSize:12,color:'#666',marginBottom:8,fontWeight:600}}>
                    {lang==='ar'
                      ?'اختر المجموعات التي يشملها الامتحان:'
                      :"Sélectionnez les ensembles couverts par l'examen :"}
                  </div>
                  <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
                    <button onClick={()=>setForm(f=>({...f,contenu_ids:(ensemblesNiveau||[]).map(e=>e.id)}))}
                      style={{padding:'4px 12px',borderRadius:20,border:'0.5px solid #1D9E75',
                        background:'#E1F5EE',color:'#085041',fontSize:12,cursor:'pointer',fontWeight:600}}>
                      {lang==='ar'?'تحديد الكل':'Tout sélectionner'}
                    </button>
                    {form.contenu_ids.length>0&&(
                      <button onClick={()=>setForm(f=>({...f,contenu_ids:[]}))}
                        style={{padding:'4px 12px',borderRadius:20,border:'0.5px solid #e0e0d8',
                          background:'#FCEBEB',color:'#E24B4A',fontSize:12,cursor:'pointer'}}>
                        ✕ {lang==='ar'?'مسح':'Effacer'}
                      </button>
                    )}
                    <span style={{fontSize:12,color:'#1D9E75',fontWeight:700}}>
                      {form.contenu_ids.length}/{ensemblesNiveau.length}
                    </span>
                  </div>
                  <div style={{maxHeight:260,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
                    {(ensemblesNiveau||[]).map(ens=>{
                      const sel=form.contenu_ids.includes(ens.id);
                      const nb=(ens.sourates_ids||[]).length;
                      return(
                        <div key={ens.id} onClick={()=>toggleItem(ens.id)}
                          style={{display:'flex',alignItems:'center',gap:10,
                            padding:'12px 14px',borderRadius:10,cursor:'pointer',
                            background:sel?'#E1F5EE':'#f5f5f0',
                            border:`1.5px solid ${sel?'#1D9E75':'#e0e0d8'}`}}>
                          <div style={{width:22,height:22,borderRadius:5,flexShrink:0,
                            border:`1.5px solid ${sel?'#1D9E75':'#ccc'}`,
                            background:sel?'#1D9E75':'#fff',
                            display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {sel&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>}
                          </div>
                          <div style={{width:30,height:30,borderRadius:8,background:sel?'#1D9E7520':'#e0e0d820',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontWeight:800,fontSize:13,color:sel?'#1D9E75':'#888',flexShrink:0}}>
                            {ens.ordre}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:sel?700:500,fontSize:14,
                              color:sel?'#085041':'#333'}}>{ens.nom}</div>
                            <div style={{fontSize:11,color:'#888',marginTop:1}}>
                              {nb} {lang==='ar'?'سورة':'sourate(s)'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Score minimum */}
      <div style={{marginBottom:13}}>
        <label className="field-lbl">
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
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')} style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#fff'}}>
              📝 {lang==='ar'?'الامتحانات':'Examens'}
            </div>
            <button onClick={()=>{if(showForm&&!editing)resetForm();else startCreate();}}
              style={{background:showForm&&!editing?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'8px 14px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
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
          {/* Export mobile */}
          {examsFiltres.length > 0 && (
            <div style={{display:'flex',gap:6,marginTop:8}}>
              <button onClick={handleExportPDF}
                style={{flex:1,background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>
                📄 PDF
              </button>
              <button onClick={handleExportExcel}
                style={{flex:1,background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>
                📊 Excel
              </button>
            </div>
          )}
        </div>

        <div style={{padding:'12px'}}>
          {showForm&&(
            <div style={{background:'#fff',borderRadius:16,padding:'18px',
              marginBottom:14,border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`}}>
              <div style={{fontSize:15,fontWeight:700,color:'#fff',marginBottom:14}}>
                {editing
                  ?(lang==='ar'?'تعديل الامتحان':'✏️ Modifier l\'examen')
                  :(lang==='ar'?'إضافة امتحان':'📝 Nouvel examen')}
              </div>
              {renderFormContent()}
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

          {!loading&&(examsFiltres||[]).map(e=>{
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
                    <div style={{fontSize:12,color:'#fff',marginTop:4,
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
          <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}></button>
          <div style={{fontSize:20,fontWeight:700}}>
            📝 {lang==='ar'?'إدارة الامتحانات':'Gestion des examens'}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {examsFiltres.length > 0 && (
            <ExportButtons
              onPDF={handleExportPDF}
              onExcel={handleExportExcel}
              lang={lang}
              variant="inline"
            />
          )}
          <button onClick={()=>{if(showForm&&!editing)resetForm();else startCreate();}}
            style={{padding:'8px 18px',
              background:showForm&&!editing?'#f0f0ec':'#1D9E75',
              color:showForm&&!editing?'#666':'#fff',border:'none',
              borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
            {showForm&&!editing?'✕ Annuler':'+ Nouvel examen'}
          </button>
        </div>
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
          {renderFormContent()}
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
          {(examsFiltres||[]).map(e=>{
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
