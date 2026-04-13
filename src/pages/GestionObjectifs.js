import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import ConfirmModal from '../components/ConfirmModal';

const PERIODES = [
  { val:'semaine',   label_fr:'Semaine',   label_ar:'أسبوع',       jours:7   },
  { val:'mois',      label_fr:'Mois',      label_ar:'شهر',         jours:30  },
  { val:'trimestre', label_fr:'Trimestre', label_ar:'فصل دراسي',   jours:90  },
  { val:'semestre',  label_fr:'Semestre',  label_ar:'نصف سنة',     jours:180 },
  { val:'annee',     label_fr:'Année',     label_ar:'سنة',         jours:365 },
  { val:'custom',    label_fr:'Dates personnalisées', label_ar:'تواريخ مخصصة', jours:0 },
];

const METRIQUES_HIZB    = [
  { val:'tomon', label_fr:'Tomon récités',  label_ar:'أثمان مُسمَّعة',  unite_fr:'tomon',  unite_ar:'ثمن' },
  { val:'hizb',  label_fr:'Hizb complets',  label_ar:'أحزاب مكتملة',   unite_fr:'hizb',   unite_ar:'حزب' },
];
const METRIQUES_SOURATE = [
  { val:'sourate',  label_fr:'Sourates complètes', label_ar:'سور مكتملة',    unite_fr:'sourate(s)',  unite_ar:'سورة' },
  { val:'ensemble', label_fr:'Ensembles complétés', label_ar:'مجموعات مكتملة', unite_fr:'ensemble(s)', unite_ar:'مجموعة' },
];

const getMetriques = (niveauType) =>
  niveauType === 'sourate' ? METRIQUES_SOURATE : METRIQUES_HIZB;

const calcDates = (type_periode) => {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const add = (d, n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
  const debut = new Date(today); debut.setHours(0,0,0,0);
  const jours = PERIODES.find(p=>p.val===type_periode)?.jours||30;
  return { date_debut: fmt(debut), date_fin: fmt(add(debut, jours-1)) };
};

const emptyForm = {
  type_cible:'niveau', niveau_id:'', eleve_id:'',
  metrique:'tomon', valeur_cible:4,
  type_periode:'mois', date_debut:'', date_fin:'',
  notes:'', actif:true,
};

export default function GestionObjectifs({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,    setNiveaux]    = useState([]);
  const [eleves,     setEleves]     = useState([]);
  const [objectifs,  setObjectifs]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [filtreType, setFiltreType] = useState('tous');
  const [searchEleve,setSearchEleve]= useState('');
  const [confirmModal, setConfirmModal] = useState({isOpen:false});

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data:nv },{ data:el },{ data:ob }] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole').eq('ecole_id',user.ecole_id).order('nom'),
      supabase.from('objectifs').select('*').eq('ecole_id',user.ecole_id).order('created_at',{ascending:false}),
    ]);
    setNiveaux(nv||[]);
    setEleves(el||[]);
    setObjectifs(ob||[]);
    setLoading(false);
  };

  const niveauDuForm = niveaux.find(n=>n.id===form.niveau_id);
  const metriques    = getMetriques(niveauDuForm?.type||'hizb');

  const setFormField = (key, val) => setForm(f=>({...f,[key]:val}));

  const onChangePeriode = (val) => {
    if (val==='custom') {
      setForm(f=>({...f, type_periode:'custom', date_debut:'', date_fin:''}));
    } else {
      const {date_debut, date_fin} = calcDates(val);
      setForm(f=>({...f, type_periode:val, date_debut, date_fin}));
    }
  };

  const onChangeNiveau = (nid) => {
    const niv = niveaux.find(n=>n.id===nid);
    const metr = getMetriques(niv?.type||'hizb')[0]?.val||'tomon';
    setForm(f=>({...f, niveau_id:nid, metrique:metr}));
  };

  const startCreate = () => {
    setEditing(null);
    const dates = calcDates('mois');
    setForm({...emptyForm, ...dates,
      niveau_id: niveaux[0]?.id||'',
      metrique: getMetriques(niveaux[0]?.type||'hizb')[0]?.val||'tomon',
    });
    setShowForm(true);
  };

  const startEdit = (obj) => {
    setEditing(obj.id);
    setForm({
      type_cible:   obj.type_cible,
      niveau_id:    obj.niveau_id||'',
      eleve_id:     obj.eleve_id||'',
      metrique:     obj.metrique,
      valeur_cible: obj.valeur_cible,
      type_periode: obj.type_periode,
      date_debut:   obj.date_debut,
      date_fin:     obj.date_fin,
      notes:        obj.notes||'',
      actif:        obj.actif,
    });
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const save = async () => {
    if (saving) return;
    if (form.type_cible==='niveau' && !form.niveau_id)
      return toast.warning(lang==='ar'?'اختر المستوى':'Sélectionnez un niveau');
    if (form.type_cible==='eleve' && !form.eleve_id)
      return toast.warning(lang==='ar'?'اختر الطالب':'Sélectionnez un élève');
    if (!form.date_debut || !form.date_fin)
      return toast.warning(lang==='ar'?'حدد الفترة':'Définissez la période');
    if (parseInt(form.valeur_cible)<1)
      return toast.warning(lang==='ar'?'الهدف يجب أن يكون أكبر من 0':'L\'objectif doit être > 0');

    setSaving(true);
    const payload = {
      ecole_id:     user.ecole_id,
      type_cible:   form.type_cible,
      niveau_id:    form.type_cible==='niveau' ? form.niveau_id : null,
      eleve_id:     form.type_cible==='eleve'  ? form.eleve_id  : null,
      metrique:     form.metrique,
      valeur_cible: parseInt(form.valeur_cible)||1,
      type_periode: form.type_periode,
      date_debut:   form.date_debut,
      date_fin:     form.date_fin,
      notes:        form.notes.trim()||null,
      actif:        form.actif,
      created_by:   user.id,
    };
    const { error } = editing
      ? await supabase.from('objectifs').update(payload).eq('id',editing)
      : await supabase.from('objectifs').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing
      ? (lang==='ar'?'✅ تم التحديث':'✅ Objectif modifié !')
      : (lang==='ar'?'✅ تم الإضافة':'✅ Objectif ajouté !'));
    setShowForm(false); setEditing(null); setForm(emptyForm);
    loadAll();
  };

  const supprimer = (id) => setConfirmModal({
    isOpen:true,
    title: lang==='ar'?'حذف الهدف':'Supprimer l\'objectif',
    message: lang==='ar'?'هل تريد حذف هذا الهدف نهائياً؟':'Supprimer cet objectif définitivement ?',
    onConfirm: async()=>{ await supabase.from('objectifs').delete().eq('id',id); loadAll(); setConfirmModal({isOpen:false}); }
  });

  // ── Helpers affichage ──────────────────────────────────────────
  const nomNiveau = (id) => { const n=niveaux.find(x=>x.id===id); return n?`${n.code} — ${n.nom}`:'?'; };
  const couleurNiveau = (id) => niveaux.find(n=>n.id===id)?.couleur||'#888';
  const nomEleve  = (id) => { const e=eleves.find(x=>x.id===id); return e?`${e.prenom} ${e.nom}`:'?'; };
  const labelMetrique = (val, type) => {
    const all = [...METRIQUES_HIZB, ...METRIQUES_SOURATE];
    const m = all.find(x=>x.val===val);
    return m ? (lang==='ar'?m.label_ar:m.label_fr) : val;
  };
  const labelPeriode = (val) => {
    const p = PERIODES.find(x=>x.val===val);
    return p ? (lang==='ar'?p.label_ar:p.label_fr) : val;
  };
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '';

  // ── Filtre liste ──────────────────────────────────────────────
  const objFiltres = objectifs.filter(o => {
    if (filtreType!=='tous' && o.type_cible!==filtreType) return false;
    return true;
  });

  // ── Elevés filtrés pour sélection ─────────────────────────────
  const elevesFiltres = eleves.filter(e =>
    `${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase()
      .includes(searchEleve.toLowerCase())
  );

  // ── FORMULAIRE ─────────────────────────────────────────────────
  const FormContent = (
    <div>
      {/* Type cible */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:8}}>
          {lang==='ar'?'نوع الهدف':'Type d\'objectif'}
        </label>
        <div style={{display:'flex',gap:8}}>
          {[
            {val:'niveau', icon:'🏫', fr:'Par niveau', ar:'حسب المستوى'},
            {val:'eleve',  icon:'👤', fr:'Par élève',  ar:'حسب الطالب'},
          ].map(t=>(
            <div key={t.val} onClick={()=>setFormField('type_cible',t.val)}
              style={{flex:1,padding:'10px',borderRadius:10,cursor:'pointer',textAlign:'center',
                background:form.type_cible===t.val?'#E1F5EE':'#f5f5f0',
                border:`1.5px solid ${form.type_cible===t.val?'#1D9E75':'#e0e0d8'}`}}>
              <div style={{fontSize:20}}>{t.icon}</div>
              <div style={{fontSize:12,fontWeight:600,color:form.type_cible===t.val?'#085041':'#555',marginTop:4}}>
                {lang==='ar'?t.ar:t.fr}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sélection niveau ou élève */}
      {form.type_cible==='niveau' ? (
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
            {lang==='ar'?'المستوى *':'Niveau *'}
          </label>
          <select value={form.niveau_id} onChange={e=>onChangeNiveau(e.target.value)}
            style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
              fontSize:14,fontFamily:'inherit',background:'#fff',outline:'none',boxSizing:'border-box'}}>
            <option value="">— {lang==='ar'?'اختر':'Choisir'} —</option>
            {niveaux.map(n=><option key={n.id} value={n.id}>{n.code} — {n.nom}</option>)}
          </select>
        </div>
      ):(
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
            {lang==='ar'?'الطالب *':'Élève *'}
          </label>
          {!form.eleve_id ? (
            <>
              <input value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}
                placeholder={lang==='ar'?'🔍 بحث...':'🔍 Rechercher...'}
                style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
                  fontSize:14,fontFamily:'inherit',boxSizing:'border-box',marginBottom:6}}/>
              <div style={{maxHeight:160,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                {elevesFiltres.slice(0,15).map(e=>{
                  const niv = niveaux.find(n=>n.code===e.code_niveau);
                  return(
                    <div key={e.id} onClick={()=>{setFormField('eleve_id',e.id);setSearchEleve('');
                      const metr=getMetriques(niv?.type||'hizb')[0]?.val||'tomon';
                      setFormField('metrique',metr);}}
                      style={{padding:'8px 12px',borderRadius:8,cursor:'pointer',background:'#f5f5f0',
                        border:'0.5px solid #e0e0d8',display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{fontSize:11,padding:'1px 7px',borderRadius:20,
                        background:`${niv?.couleur||'#888'}20`,color:niv?.couleur||'#888',fontWeight:700}}>
                        {e.code_niveau}
                      </span>
                      {e.eleve_id_ecole&&<span style={{fontSize:11,color:'#aaa'}}>#{e.eleve_id_ecole}</span>}
                      <span style={{fontSize:13,fontWeight:500}}>{e.prenom} {e.nom}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ):(
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
              borderRadius:10,background:'#E1F5EE',border:'1.5px solid #1D9E75'}}>
              <span style={{flex:1,fontWeight:700,fontSize:14}}>{nomEleve(form.eleve_id)}</span>
              <button onClick={()=>setFormField('eleve_id','')}
                style={{background:'none',border:'none',color:'#E24B4A',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* Métrique + valeur */}
      <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginBottom:14}}>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
            {lang==='ar'?'المقياس':'Métrique'}
          </label>
          <select value={form.metrique} onChange={e=>setFormField('metrique',e.target.value)}
            style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
              fontSize:14,fontFamily:'inherit',background:'#fff',outline:'none',boxSizing:'border-box'}}>
            {metriques.map(m=>(
              <option key={m.val} value={m.val}>{lang==='ar'?m.label_ar:m.label_fr}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
            {lang==='ar'?'الهدف':'Objectif'}
          </label>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <button onClick={()=>setFormField('valeur_cible',Math.max(1,parseInt(form.valeur_cible||1)-1))}
              style={{width:36,height:42,borderRadius:8,border:'0.5px solid #e0e0d8',
                background:'#f5f5f0',fontSize:18,cursor:'pointer',fontWeight:700}}>−</button>
            <input type="number" min="1" max="999" value={form.valeur_cible}
              onChange={e=>setFormField('valeur_cible',parseInt(e.target.value)||1)}
              style={{width:64,padding:'10px 8px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:16,fontWeight:800,textAlign:'center',fontFamily:'inherit',outline:'none'}}/>
            <button onClick={()=>setFormField('valeur_cible',parseInt(form.valeur_cible||1)+1)}
              style={{width:36,height:42,borderRadius:8,border:'0.5px solid #e0e0d8',
                background:'#f5f5f0',fontSize:18,cursor:'pointer',fontWeight:700}}>+</button>
          </div>
        </div>
      </div>

      {/* Période */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:8}}>
          {lang==='ar'?'الفترة':'Période'}
        </label>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
          {PERIODES.map(p=>(
            <div key={p.val} onClick={()=>onChangePeriode(p.val)}
              style={{padding:'5px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,
                background:form.type_periode===p.val?'#1D9E75':'#f5f5f0',
                color:form.type_periode===p.val?'#fff':'#666',
                border:`0.5px solid ${form.type_periode===p.val?'#1D9E75':'#e0e0d8'}`}}>
              {lang==='ar'?p.label_ar:p.label_fr}
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div>
            <label style={{fontSize:11,color:'#888',display:'block',marginBottom:4}}>
              {lang==='ar'?'من':'Du'}
            </label>
            <input type="date" value={form.date_debut}
              onChange={e=>setFormField('date_debut',e.target.value)}
              style={{width:'100%',padding:'9px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:'#888',display:'block',marginBottom:4}}>
              {lang==='ar'?'إلى':'Au'}
            </label>
            <input type="date" value={form.date_fin}
              onChange={e=>setFormField('date_fin',e.target.value)}
              style={{width:'100%',padding:'9px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={{marginBottom:16}}>
        <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
          {lang==='ar'?'ملاحظات (اختياري)':'Notes (optionnel)'}
        </label>
        <textarea value={form.notes} onChange={e=>setFormField('notes',e.target.value)} rows={2}
          placeholder={lang==='ar'?'ملاحظة حول هذا الهدف...':'Remarque sur cet objectif...'}
          style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
            fontSize:13,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',outline:'none'}}/>
      </div>

      {/* Actif toggle */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
        marginBottom:16,padding:'10px 14px',background:'#f9f9f6',borderRadius:10}}>
        <span style={{fontSize:13,fontWeight:600,color:'#555'}}>
          {lang==='ar'?'هدف نشط':'Objectif actif'}
        </span>
        <div onClick={()=>setFormField('actif',!form.actif)}
          style={{width:44,height:24,borderRadius:12,cursor:'pointer',position:'relative',
            background:form.actif?'#1D9E75':'#ccc',transition:'background 0.2s'}}>
          <div style={{position:'absolute',top:2,left:form.actif?22:2,width:20,height:20,
            borderRadius:'50%',background:'#fff',transition:'left 0.2s',
            boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
        </div>
      </div>

      {/* Boutons */}
      <div style={{display:'flex',gap:10}}>
        <button onClick={save} disabled={saving}
          style={{flex:1,padding:'13px',border:'none',borderRadius:12,
            background:saving?'#ccc':'#1D9E75',color:'#fff',fontSize:14,
            fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
          {saving?'...':(editing
            ?(lang==='ar'?'تحديث':'Modifier')
            :(lang==='ar'?'إضافة الهدف':'Ajouter l\'objectif'))}
        </button>
        <button onClick={()=>{setShowForm(false);setEditing(null);setForm(emptyForm);}}
          style={{padding:'13px 20px',border:'0.5px solid #e0e0d8',borderRadius:12,
            background:'#fff',color:'#666',fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
          {lang==='ar'?'إلغاء':'Annuler'}
        </button>
      </div>
    </div>
  );

  // ── CARTE OBJECTIF ─────────────────────────────────────────────
  const CarteObjectif = ({obj}) => {
    const isNiveau = obj.type_cible==='niveau';
    const nc = isNiveau ? couleurNiveau(obj.niveau_id) : '#378ADD';
    const today = new Date();
    const debut = new Date(obj.date_debut);
    const fin   = new Date(obj.date_fin);
    const actif = today >= debut && today <= fin && obj.actif;
    const all   = [...METRIQUES_HIZB,...METRIQUES_SOURATE];
    const m     = all.find(x=>x.val===obj.metrique);
    const unite = m ? (lang==='ar'?m.unite_ar:m.unite_fr) : '';

    return (
      <div style={{background:'#fff',borderRadius:14,padding:'14px 16px',
        border:`0.5px solid ${nc}30`,opacity:obj.actif?1:0.6,
        borderLeft:`4px solid ${nc}`}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,flexShrink:0,
            background:`${nc}15`,display:'flex',alignItems:'center',
            justifyContent:'center',fontSize:20}}>
            {isNiveau?'🏫':'👤'}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              <span style={{fontWeight:700,fontSize:14}}>
                {isNiveau ? nomNiveau(obj.niveau_id) : nomEleve(obj.eleve_id)}
              </span>
              {actif && <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,
                background:'#E1F5EE',color:'#1D9E75',fontWeight:700}}>
                {lang==='ar'?'نشط':'Actif'}
              </span>}
              {!obj.actif && <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,
                background:'#f5f5f0',color:'#aaa',fontWeight:700}}>
                {lang==='ar'?'غير نشط':'Inactif'}
              </span>}
            </div>
            <div style={{fontSize:13,color:'#1D9E75',fontWeight:700,marginBottom:4}}>
              🎯 {obj.valeur_cible} {unite} — {labelMetrique(obj.metrique)}
            </div>
            <div style={{fontSize:11,color:'#888'}}>
              📅 {formatDate(obj.date_debut)} → {formatDate(obj.date_fin)}
              <span style={{marginRight:6,marginLeft:6,color:'#ddd'}}>·</span>
              {labelPeriode(obj.type_periode)}
            </div>
            {obj.notes && <div style={{fontSize:11,color:'#aaa',marginTop:4,fontStyle:'italic'}}>
              💬 {obj.notes}
            </div>}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
            <button onClick={()=>startEdit(obj)}
              style={{padding:'5px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',
                background:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>
              ✏️
            </button>
            <button onClick={()=>supprimer(obj.id)}
              style={{padding:'5px 12px',borderRadius:8,border:'0.5px solid #FCEBEB',
                background:'#FCEBEB',fontSize:12,cursor:'pointer',color:'#E24B4A'}}>
              🗑️
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── RENDU ──────────────────────────────────────────────────────
  const stats = {
    total:   objectifs.length,
    niveau:  objectifs.filter(o=>o.type_cible==='niveau').length,
    eleve:   objectifs.filter(o=>o.type_cible==='eleve').length,
    actifs:  objectifs.filter(o=>o.actif).length,
  };

  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        <div style={{background:'#fff',padding:'14px 16px',borderBottom:'0.5px solid #e0e0d8',
          position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:showForm?0:10}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#085041',padding:0}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>
              🎯 {lang==='ar'?'الأهداف':'Objectifs'}
            </div>
            <button onClick={showForm?()=>{setShowForm(false);setEditing(null);}:startCreate}
              style={{background:showForm?'#f0f0ec':'#1D9E75',color:showForm?'#666':'#fff',
                border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
              {showForm?'✕':(lang==='ar'?'+ إضافة':'+ Ajouter')}
            </button>
          </div>
        </div>
        <div style={{padding:'12px'}}>
          {showForm&&(
            <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
              border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`}}>
              <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                {editing?(lang==='ar'?'تعديل الهدف':'✏️ Modifier'):(lang==='ar'?'إضافة هدف جديد':'🎯 Nouvel objectif')}
              </div>
              {FormContent}
            </div>
          )}
          {!showForm&&(
            <>
              {/* Stats */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12}}>
                {[
                  {l:lang==='ar'?'المجموع':'Total',       v:stats.total,  c:'#085041', bg:'#E1F5EE'},
                  {l:lang==='ar'?'نشطة':'Actifs',         v:stats.actifs, c:'#1D9E75', bg:'#E1F5EE'},
                  {l:lang==='ar'?'بالمستوى':'Par niveau',  v:stats.niveau, c:'#378ADD', bg:'#E6F1FB'},
                  {l:lang==='ar'?'بالطالب':'Par élève',    v:stats.eleve,  c:'#D85A30', bg:'#FAECE7'},
                ].map((s,i)=>(
                  <div key={i} style={{background:s.bg,borderRadius:12,padding:'12px',textAlign:'center'}}>
                    <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11,color:s.c,opacity:0.8}}>{s.l}</div>
                  </div>
                ))}
              </div>
              {/* Filtres */}
              <div style={{display:'flex',gap:6,marginBottom:12}}>
                {[
                  {val:'tous',   fr:'Tous',        ar:'الكل'},
                  {val:'niveau', fr:'Par niveau',  ar:'بالمستوى'},
                  {val:'eleve',  fr:'Par élève',   ar:'بالطالب'},
                ].map(f=>(
                  <div key={f.val} onClick={()=>setFiltreType(f.val)}
                    style={{padding:'5px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,
                      background:filtreType===f.val?'#085041':'#f5f5f0',
                      color:filtreType===f.val?'#fff':'#666'}}>
                    {lang==='ar'?f.ar:f.fr}
                  </div>
                ))}
              </div>
              {loading?<div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>
              :objFiltres.length===0?(
                <div style={{textAlign:'center',padding:'3rem',color:'#aaa',background:'#fff',borderRadius:12}}>
                  <div style={{fontSize:40,marginBottom:10}}>🎯</div>
                  <div>{lang==='ar'?'لا توجد أهداف':'Aucun objectif défini'}</div>
                </div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {objFiltres.map(obj=><CarteObjectif key={obj.id} obj={obj}/>)}
                </div>
              )}
            </>
          )}
        </div>
        <ConfirmModal {...confirmModal} onClose={()=>setConfirmModal({isOpen:false})} lang={lang}/>
      </div>
    );
  }

  // ── PC ─────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">
            ← {lang==='ar'?'رجوع':'Retour'}
          </button>
          <div style={{fontSize:20,fontWeight:700}}>🎯 {lang==='ar'?'الأهداف':'Gestion des objectifs'}</div>
        </div>
        <button onClick={showForm?()=>{setShowForm(false);setEditing(null);}:startCreate}
          style={{padding:'8px 18px',background:showForm?'#f0f0ec':'#1D9E75',
            color:showForm?'#666':'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
          {showForm?'✕ Annuler':'+ Nouvel objectif'}
        </button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:'1.25rem'}}>
        {[
          {l:lang==='ar'?'المجموع':'Total',       v:stats.total,  c:'#085041', bg:'#E1F5EE'},
          {l:lang==='ar'?'نشطة':'Actifs',         v:stats.actifs, c:'#1D9E75', bg:'#E1F5EE'},
          {l:lang==='ar'?'بالمستوى':'Par niveau',  v:stats.niveau, c:'#378ADD', bg:'#E6F1FB'},
          {l:lang==='ar'?'بالطالب':'Par élève',    v:stats.eleve,  c:'#D85A30', bg:'#FAECE7'},
        ].map((s,i)=>(
          <div key={i} style={{background:s.bg,borderRadius:12,padding:'14px',textAlign:'center'}}>
            <div style={{fontSize:26,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:12,color:s.c,opacity:0.8,marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:showForm?'1fr 380px':'1fr',gap:'1.25rem'}}>
        {/* Liste */}
        <div>
          {/* Filtres */}
          <div style={{display:'flex',gap:6,marginBottom:12}}>
            {[
              {val:'tous',   fr:'Tous',       ar:'الكل'},
              {val:'niveau', fr:'Par niveau', ar:'بالمستوى'},
              {val:'eleve',  fr:'Par élève',  ar:'بالطالب'},
            ].map(f=>(
              <div key={f.val} onClick={()=>setFiltreType(f.val)}
                style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,
                  background:filtreType===f.val?'#085041':'#f5f5f0',
                  color:filtreType===f.val?'#fff':'#666',
                  border:`0.5px solid ${filtreType===f.val?'#085041':'#e0e0d8'}`}}>
                {lang==='ar'?f.ar:f.fr}
              </div>
            ))}
            <span style={{fontSize:12,color:'#888',alignSelf:'center',marginRight:8}}>
              {objFiltres.length} {lang==='ar'?'هدف':'objectif(s)'}
            </span>
          </div>

          {loading?<div style={{textAlign:'center',padding:'3rem',color:'#888'}}>...</div>
          :objFiltres.length===0?(
            <div style={{textAlign:'center',padding:'4rem',color:'#aaa',background:'#fff',
              borderRadius:12,border:'0.5px solid #e0e0d8'}}>
              <div style={{fontSize:48,marginBottom:12}}>🎯</div>
              <div>{lang==='ar'?'لا توجد أهداف محددة':'Aucun objectif défini'}</div>
              <div style={{fontSize:13,marginTop:6,color:'#ccc'}}>
                {lang==='ar'?'أضف هدفاً للبدء':'Cliquez sur "+ Nouvel objectif" pour commencer'}
              </div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {objFiltres.map(obj=><CarteObjectif key={obj.id} obj={obj}/>)}
            </div>
          )}
        </div>

        {/* Formulaire PC */}
        {showForm&&(
          <div style={{background:'#fff',border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`,
            borderRadius:14,padding:'1.5rem',height:'fit-content',position:'sticky',top:20}}>
            <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:'1rem'}}>
              {editing?(lang==='ar'?'تعديل الهدف':'✏️ Modifier l\'objectif')
                      :(lang==='ar'?'إضافة هدف جديد':'🎯 Nouvel objectif')}
            </div>
            {FormContent}
          </div>
        )}
      </div>

      <ConfirmModal {...confirmModal} onClose={()=>setConfirmModal({isOpen:false})} lang={lang}/>
    </div>
  );
}
