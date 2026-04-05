import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import { t } from '../lib/i18n';
import { SOURATES_5B, SOURATES_5A, SOURATES_2M } from '../lib/sourates';

const PERIODES = [
  { val: 'semaine',    label_fr: 'Semaine',    label_ar: 'أسبوع',       label_en: 'Week',      jours: 7   },
  { val: 'quinzaine',  label_fr: 'Quinzaine',  label_ar: 'أسبوعان',     label_en: 'Fortnight', jours: 15  },
  { val: 'mois',       label_fr: 'Mois',       label_ar: 'شهر',         label_en: 'Month',     jours: 30  },
  { val: 'trimestre',  label_fr: 'Trimestre',  label_ar: 'فصل دراسي',   label_en: 'Quarter',   jours: 90  },
  { val: 'semestre',   label_fr: 'Semestre',   label_ar: 'نصف سنة',     label_en: 'Semester',  jours: 180 },
  { val: 'annee',      label_fr: 'Année',      label_ar: 'سنة',         label_en: 'Year',      jours: 365 },
];

const METRIQUES = [
  { val: 'tomon',    label_fr: 'Tomon récités',       label_ar: 'أثمان مُسمَّعة',    label_en: 'Tomon recited',    niveaux: ['2','1'] },
  { val: 'hizb',     label_fr: 'Hizb complets',       label_ar: 'أحزاب مكتملة',     label_en: 'Complete Hizb',   niveaux: ['2','1'] },
  { val: 'sourate',  label_fr: 'Sourates complètes',  label_ar: 'سور مكتملة',       label_en: 'Complete surahs', niveaux: ['5B','5A','2M'] },
  { val: 'sequence', label_fr: 'Séquences',           label_ar: 'مقاطع',            label_en: 'Sequences',       niveaux: ['5B','5A','2M'] },
  { val: 'points',   label_fr: 'Points gagnés',       label_ar: 'نقاط مكتسبة',     label_en: 'Points earned',   niveaux: ['5B','5A','2M','2','1'] },
  { val: 'seances',  label_fr: 'Séances actives',     label_ar: 'حصص نشطة',        label_en: 'Active sessions', niveaux: ['5B','5A','2M','2','1'] },
];

const NIVEAUX = ['5B','5A','2M','2','1'];
const NIVEAU_LABELS = { '5B':'Préscolaire','5A':'Primaire 1-2','2M':'Primaire 3-4','2':'Primaire 5-6','1':'Collège/Lycée' };
const NIVEAU_COLORS = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };

const getPeriodeLabel = (val, lang) => {
  const p = PERIODES.find(x=>x.val===val);
  return p ? (lang==='ar'?p.label_ar:lang==='en'?p.label_en:p.label_fr) : val;
};
const getMetriqueLabel = (val, lang) => {
  const m = METRIQUES.find(x=>x.val===val);
  return m ? (lang==='ar'?m.label_ar:lang==='en'?m.label_en:m.label_fr) : val;
};

// Calculate date range from periode
const calcDateRange = (periode, refDate=new Date()) => {
  const p = PERIODES.find(x=>x.val===periode);
  const debut = new Date(refDate);
  debut.setHours(0,0,0,0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + (p?.jours||30) - 1);
  fin.setHours(23,59,59,999);
  return { debut: debut.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] };
};

// Calculate achievement for an objectif
const calcAtteinte = (obj, validations, recitationsSourates) => {
  const debut = new Date(obj.date_debut);
  const fin = new Date(obj.date_fin); fin.setHours(23,59,59,999);

  const vPeriode = validations.filter(v => {
    const d = new Date(v.date_validation);
    return d >= debut && d <= fin;
  });
  const rPeriode = recitationsSourates.filter(r => {
    const d = new Date(r.date_validation);
    return d >= debut && d <= fin;
  });

  let realise = 0;
  if (obj.metrique === 'tomon') realise = vPeriode.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
  else if (obj.metrique === 'hizb') realise = vPeriode.filter(v=>v.type_validation==='hizb_complet').length;
  else if (obj.metrique === 'sourate') realise = rPeriode.filter(r=>r.type_recitation==='complete').length;
  else if (obj.metrique === 'sequence') realise = rPeriode.filter(r=>r.type_recitation==='sequence').length;
  else if (obj.metrique === 'points') {
    const t = vPeriode.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
    const h = vPeriode.filter(v=>v.type_validation==='hizb_complet').length;
    const pts_r = rPeriode.reduce((s,r)=>s+(r.points||0),0);
    realise = t*10+Math.floor(t/2)*25+Math.floor(t/4)*60+h*100+pts_r;
  }
  else if (obj.metrique === 'seances') {
    const jours = new Set([...vPeriode,...rPeriode].map(v=>new Date(v.date_validation).toDateString()));
    realise = jours.size;
  }

  const pct = obj.valeur_cible > 0 ? Math.min(100, Math.round(realise/obj.valeur_cible*100)) : 0;
  const now = new Date();
  const isActive = now >= debut && now <= fin;
  const isExpired = now > fin;
  const status = pct >= 100 ? 'atteint' : isExpired ? 'expire' : isActive ? 'en_cours' : 'futur';
  return { realise, pct, status };
};

const statusConfig = {
  atteint:  { color:'#1D9E75', bg:'#E1F5EE', label_fr:'✓ Atteint',   label_ar:'✓ محقق',    label_en:'✓ Achieved' },
  expire:   { color:'#E24B4A', bg:'#FCEBEB', label_fr:'✗ Expiré',    label_ar:'✗ منتهي',   label_en:'✗ Expired'  },
  en_cours: { color:'#EF9F27', bg:'#FAEEDA', label_fr:'En cours',    label_ar:'جارٍ',      label_en:'In progress'},
  futur:    { color:'#888',    bg:'#f5f5f0', label_fr:'À venir',     label_ar:'قادم',      label_en:'Upcoming'   },
};

export default function GestionObjectifs({ user, navigate, goBack, lang='fr', isMobile }) {
  const [objectifs, setObjectifs] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [validations, setValidations] = useState([]);
  const [recitationsSourates, setRecitationsSourates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({isOpen:false,title:'',message:'',onConfirm:null,confirmColor:'#E24B4A',confirmLabel:''});
  const showConfirm = (title, message, onConfirm, confirmLabel, confirmColor) => setConfirmModal({isOpen:true,title,message,onConfirm,confirmLabel:confirmLabel||(lang==='ar'?'حذف':'Supprimer'),confirmColor:confirmColor||'#E24B4A'});
  const hideConfirm = () => setConfirmModal(m=>({...m,isOpen:false,onConfirm:null}));
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);

  // Filters
  const [filterType, setFilterType] = useState('tous');
  const [filterNiveau, setFilterNiveau] = useState('tous');
  const [filterStatut, setFilterStatut] = useState('tous');

  // New objectif form
  const [form, setForm] = useState({
    type_cible: 'niveau', eleve_id: '', code_niveau: '5B', instituteur_id: '',
    periode: 'mois', date_debut: new Date().toISOString().split('T')[0],
    date_fin: '', metrique: 'sourate', valeur_cible: '', cible_specifique: null, cibles_selectionnees: [], hizbSelected: null, titre: '', notes: ''
  });

  useEffect(() => { loadData(); }, []);

  // Auto-calculate date_fin when periode or date_debut changes
  useEffect(() => {
    if (form.periode && form.date_debut) {
      const range = calcDateRange(form.periode, new Date(form.date_debut));
      setForm(f => ({ ...f, date_fin: range.fin }));
    }
  }, [form.periode, form.date_debut]);

  // Auto-set metrique based on niveau/type_cible
  useEffect(() => {
    const niveau = form.type_cible === 'niveau' ? form.code_niveau : 
                   form.type_cible === 'eleve' ? eleves.find(e=>e.id===form.eleve_id)?.code_niveau : null;
    if (niveau && ['5B','5A','2M'].includes(niveau) && ['tomon','hizb'].includes(form.metrique)) {
      setForm(f => ({ ...f, metrique: 'sourate' }));
    } else if (niveau && ['2M','2','1'].includes(niveau) && ['sourate','sequence'].includes(form.metrique)) {
      setForm(f => ({ ...f, metrique: 'tomon' }));
    }
  }, [form.type_cible, form.code_niveau, form.eleve_id]);

  const loadData = async () => {
    setLoading(true);
    // Load each table safely — some may not exist yet
    const safeQuery = async (q) => { try { const r = await q; return r.data || []; } catch(e) { return []; } };
    
    const [objs, ed, inst, vd, rd] = await Promise.all([
      safeQuery(supabase.from('objectifs_globaux').select('*')
        .eq('ecole_id', user.ecole_id).order('created_at', { ascending: false })),
      safeQuery(supabase.from('eleves').select('*')
        .eq('ecole_id', user.ecole_id).order('nom')),
      safeQuery(supabase.from('utilisateurs').select('*').eq('role', 'instituteur').eq('ecole_id', user.ecole_id)),
      safeQuery(supabase.from('validations').select('*')
        .eq('ecole_id', user.ecole_id)),
      safeQuery(supabase.from('recitations_sourates').select('*')
        .eq('ecole_id', user.ecole_id)),
    ]);
    setObjectifs(objs);
    setEleves(ed);
    setInstituteurs(inst);
    setValidations(vd);
    setRecitationsSourates(rd);
    setLoading(false);
  };

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };

  const startEdit = (obj) => {
    setEditingId(obj.id);
    setForm({
      type_cible: obj.type_cible,
      eleve_id: obj.eleve_id||'',
      code_niveau: obj.code_niveau||'5B',
      instituteur_id: obj.instituteur_id||'',
      periode: obj.periode,
      date_debut: obj.date_debut,
      date_fin: obj.date_fin,
      metrique: obj.metrique,
      valeur_cible: String(obj.valeur_cible),
      cible_specifique: obj.cible_specifique||null,
      cibles_selectionnees: [],
      hizbSelected: null,
      titre: obj.titre||'',
      notes: obj.notes||'',
    });
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const saveObjectif = async () => {
    if (!form.valeur_cible || isNaN(form.valeur_cible) || parseInt(form.valeur_cible) <= 0)
      return showMsg('error', lang==='ar'?'يجب تحديد قيمة الهدف':lang==='en'?'Please set a target value':'Veuillez définir une valeur cible');
    if (form.type_cible === 'eleve' && !form.eleve_id)
      return showMsg('error', lang==='ar'?'اختر طالباً':lang==='en'?'Select a student':`Sélectionnez un élève`);
    if (form.type_cible === 'instituteur' && !form.instituteur_id)
      return showMsg('error', lang==='ar'?'اختر أستاذاً':lang==='en'?'Select a teacher':`Sélectionnez un instituteur`);

    setSaving(true);
    const insert = {
      type_cible: form.type_cible,
      eleve_id: form.type_cible === 'eleve' ? form.eleve_id : null,
      code_niveau: form.type_cible === 'niveau' ? form.code_niveau : null,
      instituteur_id: form.type_cible === 'instituteur' ? form.instituteur_id : null,
      periode: form.periode,
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      metrique: form.metrique,
      valeur_cible: parseInt(form.valeur_cible),
      titre: form.titre || null,
      notes: form.notes || null,
      cible_specifique: form.cibles_selectionnees.length>0 ? JSON.stringify(form.cibles_selectionnees) : (form.cible_specifique||null),
      created_by: user.id,
      ecole_id: user.ecole_id,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('objectifs_globaux').update(insert).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('objectifs_globaux').insert(insert));
    }
    setSaving(false);
    if (error) return showMsg('error', error.message);
    showMsg('success', editingId?(lang==='ar'?'تم تحديث الهدف':'Objectif modifié'):(lang==='ar'?'تم حفظ الهدف':'Objectif enregistré'));
    setShowForm(false);
    setEditingId(null);
    setForm({ type_cible:'niveau', eleve_id:'', code_niveau:'5B', instituteur_id:'',
      periode:'mois', date_debut:new Date().toISOString().split('T')[0],
      date_fin:'', metrique:'sourate', valeur_cible:'', cible_specifique:null, cibles_selectionnees:[], hizbSelected:null, titre:'', notes:'' });
    await loadData();
  };

  const deleteObjectif = (id) => showConfirm(
    lang==='ar'?'حذف الهدف':lang==='en'?'Delete objective':'Supprimer objectif',
    lang==='ar'?'هل تريد حذف هذا الهدف نهائياً؟':lang==='en'?'Delete this objective permanently?':'Supprimer définitivement cet objectif ?',
    async()=>{ await supabase.from('objectifs_globaux').delete().eq('id', id); await loadData(); hideConfirm(); }
  );

  // Get validations for an objectif's scope
  const getValsForObj = (obj) => {
    if (obj.type_cible === 'eleve') return validations.filter(v=>v.eleve_id===obj.eleve_id);
    if (obj.type_cible === 'niveau') {
      const elevesNiveau = eleves.filter(e=>(e.code_niveau||'1')===obj.code_niveau).map(e=>e.id);
      return validations.filter(v=>elevesNiveau.includes(v.eleve_id));
    }
    if (obj.type_cible === 'instituteur') {
      const elevesInst = eleves.filter(e=>e.instituteur_referent_id===obj.instituteur_id).map(e=>e.id);
      return validations.filter(v=>elevesInst.includes(v.eleve_id));
    }
    return validations;
  };

  const getRecsForObj = (obj) => {
    if (obj.type_cible === 'eleve') return recitationsSourates.filter(r=>r.eleve_id===obj.eleve_id);
    if (obj.type_cible === 'niveau') {
      const elevesNiveau = eleves.filter(e=>(e.code_niveau||'1')===obj.code_niveau).map(e=>e.id);
      return recitationsSourates.filter(r=>elevesNiveau.includes(r.eleve_id));
    }
    if (obj.type_cible === 'instituteur') {
      const elevesInst = eleves.filter(e=>e.instituteur_referent_id===obj.instituteur_id).map(e=>e.id);
      return recitationsSourates.filter(r=>elevesInst.includes(r.eleve_id));
    }
    return recitationsSourates;
  };

  const getObjLabel = (obj) => {
    if (obj.type_cible === 'eleve') {
      const e = eleves.find(x=>x.id===obj.eleve_id);
      return e ? `${e.prenom} ${e.nom}` : '—';
    }
    if (obj.type_cible === 'niveau') return `${lang==='ar'?'المستوى':lang==='en'?'Level':'Niveau'} ${obj.code_niveau}`;
    if (obj.type_cible === 'instituteur') {
      const i = instituteurs.find(x=>x.id===obj.instituteur_id);
      return i ? `${i.prenom} ${i.nom}` : '—';
    }
    return lang==='ar'?'عام':lang==='en'?'Global':'Global';
  };

  const getNiveauForObj = (obj) => {
    if (obj.type_cible === 'niveau') return obj.code_niveau;
    if (obj.type_cible === 'eleve') return eleves.find(e=>e.id===obj.eleve_id)?.code_niveau||'1';
    return null;
  };

  // Filtered objectifs
  const objFiltres = objectifs.filter(obj => {
    if (filterType !== 'tous' && obj.type_cible !== filterType) return false;
    if (filterNiveau !== 'tous' && getNiveauForObj(obj) !== filterNiveau) return false;
    if (filterStatut !== 'tous') {
      const { status } = calcAtteinte(obj, getValsForObj(obj), getRecsForObj(obj));
      if (status !== filterStatut) return false;
    }
    return true;
  });

  // Stats globales
  const statsGlobales = objectifs.reduce((acc, obj) => {
    const { status, pct } = calcAtteinte(obj, getValsForObj(obj), getRecsForObj(obj));
    acc.total++;
    if (status === 'atteint') acc.atteints++;
    else if (status === 'en_cours') acc.en_cours++;
    else if (status === 'expire') acc.expires++;
    acc.pct_moy += pct;
    return acc;
  }, { total:0, atteints:0, en_cours:0, expires:0, pct_moy:0 });
  if (statsGlobales.total > 0) statsGlobales.pct_moy = Math.round(statsGlobales.pct_moy / statsGlobales.total);

  const metriquesDisponibles = () => {
    if (form.type_cible === 'niveau') {
      return METRIQUES.filter(m => m.niveaux.includes(form.code_niveau));
    }
    if (form.type_cible === 'eleve' && form.eleve_id) {
      const niv = eleves.find(e=>e.id===form.eleve_id)?.code_niveau || '1';
      return METRIQUES.filter(m => m.niveaux.includes(niv));
    }
    return METRIQUES;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';

  if (isMobile) {
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        <div style={{background:'#fff', padding:'14px 16px', borderBottom:'0.5px solid #e0e0d8',
          position:'sticky', top:0, zIndex:100}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#085041',padding:0}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>
              🎯 {lang==='ar'?'الأهداف':lang==='en'?'Objectives':'Objectifs'}
            </div>
            {user.role==='surveillant'&&(
              <button onClick={()=>setShowForm(!showForm)}
                style={{background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,
                  padding:'8px 12px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {showForm?'✕':'+ Ajouter'}
              </button>
            )}
          </div>
        </div>
        {msg&&<div style={{margin:'8px 12px',padding:'10px 14px',borderRadius:10,fontSize:13,
          background:msg.ok?'#E1F5EE':'#FCEBEB',color:msg.ok?'#085041':'#E24B4A'}}>{msg.text}</div>}
        <div style={{padding:'12px'}}>
          {showForm&&user.role==='surveillant'&&(
            <div style={{background:'#fff',borderRadius:14,padding:'16px',marginBottom:12,border:'0.5px solid #e0e0d8'}}>
              <div style={{fontSize:14,fontWeight:700,color:'#085041',marginBottom:12}}>{lang==='ar'?'إضافة هدف':'Nouvel objectif'}</div>
              {[
                {label:lang==='ar'?'العنوان':'Titre',key:'titre',type:'text'},
                {label:lang==='ar'?'الوصف':'Description',key:'description',type:'text'},
              ].map(f=>(
                <div key={f.key} style={{marginBottom:12}}>
                  <label style={{fontSize:13,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>{f.label}</label>
                  <input type={f.type}
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',
                      fontSize:16,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={newObj[f.key]||''} onChange={e=>setNewObj(p=>({...p,[f.key]:e.target.value}))}/>
                </div>
              ))}
              <button onClick={ajouterObj}
                style={{width:'100%',padding:'14px',background:'#1D9E75',color:'#fff',border:'none',
                  borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'حفظ':'Enregistrer'}
              </button>
            </div>
          )}
          {objectifs.map(obj=>(
            <div key={obj.id} style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:10,border:'0.5px solid #e0e0d8'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div style={{fontWeight:700,fontSize:15,color:'#085041',flex:1,marginRight:8}}>{obj.titre}</div>
                <span style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:10,flexShrink:0,
                  color:obj.atteint?'#1D9E75':'#EF9F27',background:obj.atteint?'#E1F5EE':'#FAEEDA'}}>
                  {obj.atteint?(lang==='ar'?'مكتمل':'Atteint'):(lang==='ar'?'قيد التنفيذ':'En cours')}
                </span>
              </div>
              {obj.description&&<div style={{fontSize:13,color:'#888',marginBottom:8}}>{obj.description}</div>}
              {obj.valeur_cible&&(
                <div>
                  <div style={{height:6,background:'#f0f0ec',borderRadius:3,overflow:'hidden',marginBottom:4}}>
                    <div style={{height:'100%',background:'#1D9E75',borderRadius:3,
                      width:`${Math.min(100,Math.round(((obj.valeur_actuelle||0)/obj.valeur_cible)*100))}%`}}/>
                  </div>
                  <div style={{fontSize:11,color:'#888'}}>{obj.valeur_actuelle||0} / {obj.valeur_cible}</div>
                </div>
              )}
              {user.role==='surveillant'&&(
                <div style={{display:'flex',gap:8,marginTop:10}}>
                  <button onClick={()=>toggleAtteint(obj)}
                    style={{flex:1,padding:'10px',background:obj.atteint?'#f5f5f0':'#E1F5EE',
                      color:obj.atteint?'#888':'#085041',border:'none',borderRadius:10,
                      fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    {obj.atteint?(lang==='ar'?'إعادة فتح':'Réouvrir'):(lang==='ar'?'تحقق':'Atteint ✓')}
                  </button>
                  <button onClick={()=>supprimerObj(obj.id)}
                    style={{padding:'10px 14px',background:'#FCEBEB',color:'#E24B4A',border:'none',
                      borderRadius:10,fontSize:13,cursor:'pointer'}}>
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
          {objectifs.length===0&&(
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem'}}>
              <div style={{fontSize:40,marginBottom:12}}>🎯</div>
              <div style={{fontSize:14}}>{lang==='ar'?'لا توجد أهداف':'Aucun objectif défini'}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>{t(lang,'retour')}</button>
        <div style={{fontSize:20,fontWeight:700}}>🎯 {lang==='ar'?'إدارة الأهداف':lang==='en'?'Objectives':'Gestion des objectifs'}</div>
        {user.role==='surveillant'&&(
          <button className="btn-primary" style={{width:'auto',padding:'8px 16px',fontSize:13}} onClick={()=>{setShowForm(v=>!v);setEditingId(null);}}>
            {showForm?'✕':'+ '}{lang==='ar'?'هدف جديد':lang==='en'?'New objective':'Nouvel objectif'}
          </button>
        )}
      </div>

      {msg&&<div style={{padding:'10px 16px',borderRadius:8,marginBottom:'1rem',background:msg.type==='success'?'#E1F5EE':'#FCEBEB',color:msg.type==='success'?'#085041':'#A32D2D',fontSize:13,fontWeight:500}}>{msg.text}</div>}

      {/* Stats globales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:'1.25rem'}}>
        {[
          {val:statsGlobales.total,lbl:lang==='ar'?'إجمالي الأهداف':lang==='en'?'Total objectives':'Total objectifs',color:'#534AB7',bg:'#EEEDFE'},
          {val:statsGlobales.atteints,lbl:lang==='ar'?'محققة':lang==='en'?'Achieved':'Atteints',color:'#1D9E75',bg:'#E1F5EE'},
          {val:statsGlobales.en_cours,lbl:lang==='ar'?'جارية':lang==='en'?'In progress':'En cours',color:'#EF9F27',bg:'#FAEEDA'},
          {val:`${statsGlobales.pct_moy}%`,lbl:lang==='ar'?'متوسط الإنجاز':lang==='en'?'Avg completion':'Taux moyen',color:'#378ADD',bg:'#E6F1FB'},
        ].map(k=>(
          <div key={k.lbl} style={{background:k.bg,borderRadius:12,padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:24,fontWeight:800,color:k.color}}>{k.val}</div>
            <div style={{fontSize:11,color:k.color,opacity:0.8,marginTop:2}}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Form nouvel objectif */}
      {showForm&&user.role==='surveillant'&&(
        <div style={{background:'#fff',border:'1.5px solid #1D9E75',borderRadius:16,padding:'1.5rem',marginBottom:'1.5rem'}}>
          <div style={{fontSize:15,fontWeight:600,color:'#085041',marginBottom:'1rem'}}>
            {editingId?'✏️':'🎯'} {editingId?(lang==='ar'?'تعديل الهدف':lang==='en'?'Edit objective':'Modifier objectif'):(lang==='ar'?'تعريف هدف جديد':lang==='en'?'Define new objective':'Definir nouvel objectif')}
          </div>

          {/* Titre optionnel */}
          <div className="field-group" style={{marginBottom:12}}>
            <label className="field-lbl">{lang==='ar'?'عنوان الهدف (اختياري)':lang==='en'?'Objective title (optional)':'Titre de l\'objectif (optionnel)'}</label>
            <input className="field-input" value={form.titre} onChange={e=>setForm(f=>({...f,titre:e.target.value}))} placeholder={lang==='ar'?'مثال: هدف الفصل الأول':lang==='en'?'e.g. Q1 target':'Ex: Objectif T1 2025'}/>
          </div>

          {/* Ligne 1 : Type de cible — direction forcée LTR pour cohérence visuelle */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            {/* Cible spécifique selon type — affiché en PREMIER pour RTL */}
            {form.type_cible==='niveau' && (
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'المستوى':lang==='en'?'Level':'Niveau'} *</label>
                <select className="field-select" value={form.code_niveau} onChange={e=>setForm(f=>({...f,code_niveau:e.target.value,metrique:['5B','5A','2M'].includes(e.target.value)?'sourate':'tomon',cible_specifique:null,valeur_cible:'',cibles_selectionnees:[]}))}>
                  {NIVEAUX.map(n=><option key={n} value={n}>{n} — {NIVEAU_LABELS[n]}</option>)}
                </select>
              </div>
            )}

            {form.type_cible==='eleve' && (
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'الطالب':lang==='en'?'Student':'Élève'} *</label>
                <select className="field-select" value={form.eleve_id}
                  onChange={e=>{
                    const el=eleves.find(x=>x.id===e.target.value);
                    const niv=el?.code_niveau||'1';
                    setForm(f=>({...f,eleve_id:e.target.value,metrique:['5B','5A','2M'].includes(niv)?'sourate':'tomon',cible_specifique:null,valeur_cible:'',cibles_selectionnees:[]}));
                  }}>
                  <option value="">— {lang==='ar'?'اختر طالباً':lang==='en'?'Select a student':`Sélectionner un élève`} —</option>
                  {eleves.map(e=>(
                    <option key={e.id} value={e.id}>{e.prenom} {e.nom} · {e.code_niveau||'?'}{e.eleve_id_ecole?` #${e.eleve_id_ecole}`:''}</option>
                  ))}
                </select>
                {form.eleve_id && (()=>{
                  const el=eleves.find(e=>e.id===form.eleve_id);
                  if(!el) return null;
                  const nc=NIVEAU_COLORS[el.code_niveau||'1']||'#888';
                  return <div style={{marginTop:5,display:'flex',alignItems:'center',gap:6,fontSize:12}}>
                    <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:nc+'20',color:nc,border:`0.5px solid ${nc}40`}}>{el.code_niveau||'?'}</span>
                    <span style={{color:'#888'}}>{NIVEAU_LABELS[el.code_niveau||'1']||''}</span>
                  </div>;
                })()}
              </div>
            )}

            {form.type_cible==='instituteur' && (
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'الأستاذ':lang==='en'?'Teacher':'Instituteur'} *</label>
                <select className="field-select" value={form.instituteur_id} onChange={e=>setForm(f=>({...f,instituteur_id:e.target.value,cible_specifique:null,valeur_cible:'',cibles_selectionnees:[]}))}>
                  <option value="">— {lang==='ar'?'اختر أستاذاً':lang==='en'?'Select a teacher':`Sélectionner un instituteur`} —</option>
                  {instituteurs.map(i=>{
                    const nb=eleves.filter(e=>e.instituteur_referent_id===i.id).length;
                    return <option key={i.id} value={i.id}>{i.prenom} {i.nom} ({nb} {lang==='ar'?'طالب':lang==='en'?'students':'élèves'})</option>;
                  })}
                </select>
                {form.instituteur_id && (()=>{
                  const elevesInst=eleves.filter(e=>e.instituteur_referent_id===form.instituteur_id);
                  const niveaux=[...new Set(elevesInst.map(e=>e.code_niveau||'?'))];
                  return <div style={{marginTop:5,display:'flex',gap:4,flexWrap:'wrap'}}>
                    {niveaux.map(n=><span key={n} style={{padding:'2px 6px',borderRadius:10,background:'#f0f0ec',fontSize:11,color:'#666'}}>{n}</span>)}
                    <span style={{fontSize:11,color:'#888'}}>· {elevesInst.length} {lang==='ar'?'طالب':lang==='en'?'students':'élèves'}</span>
                  </div>;
                })()}
              </div>
            )}

            {form.type_cible==='global' && (
              <div className="field-group" style={{display:'flex',alignItems:'center',paddingTop:24}}>
                <div style={{padding:'10px 14px',background:'#f0faf6',borderRadius:8,fontSize:12,color:'#085041',width:'100%'}}>
                  🌐 {lang==='ar'?'يشمل جميع الطلاب':lang==='en'?'Covers all students':'Concerne tous les élèves'}
                </div>
              </div>
            )}

            {/* Type de cible — en SECOND pour apparaître à droite en RTL */}
            <div className="field-group" style={{order: lang==='ar'?-1:0}}>
              <label className="field-lbl">{lang==='ar'?'نوع الهدف':lang==='en'?'Target type':'Type de cible'} *</label>
              <select className="field-select" value={form.type_cible} onChange={e=>setForm(f=>({...f,type_cible:e.target.value,eleve_id:'',code_niveau:'5B',instituteur_id:'',metrique:'sourate',cible_specifique:null,valeur_cible:'',cibles_selectionnees:[]}))}>
                <option value="niveau">{lang==='ar'?'بالمستوى':lang==='en'?'By level':'Par niveau'}</option>
                <option value="eleve">{lang==='ar'?'بالطالب':lang==='en'?'By student':'Par élève'}</option>
                <option value="instituteur">{lang==='ar'?'بالأستاذ':lang==='en'?'By teacher':'Par instituteur'}</option>
                <option value="global">{lang==='ar'?'عام':lang==='en'?'Global':'Global'}</option>
              </select>
            </div>
          </div>


          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
            {/* Période */}
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'الفترة':lang==='en'?'Period':'Période'} *</label>
              <select className="field-select" value={form.periode} onChange={e=>setForm(f=>({...f,periode:e.target.value}))}>
                {PERIODES.map(p=><option key={p.val} value={p.val}>{lang==='ar'?p.label_ar:lang==='en'?p.label_en:p.label_fr}</option>)}
              </select>
            </div>

            {/* Date début */}
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'تاريخ البداية':lang==='en'?'Start date':'Date de début'} *</label>
              <input className="field-input" type="date" value={form.date_debut} onChange={e=>setForm(f=>({...f,date_debut:e.target.value}))}/>
            </div>

            {/* Date fin (auto) */}
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'تاريخ النهاية':lang==='en'?'End date':'Date de fin'}</label>
              <input className="field-input" type="date" value={form.date_fin} onChange={e=>setForm(f=>({...f,date_fin:e.target.value}))} style={{color:'#1D9E75',fontWeight:500}}/>
            </div>
          </div>

          {/* ÉTAPE 1 : Métrique + nombre */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'مؤشر القياس':lang==='en'?'Metric':'Métrique'} *</label>
              <select className="field-select" value={form.metrique}
                onChange={e=>setForm(f=>({...f,metrique:e.target.value,valeur_cible:'',cibles_selectionnees:[],hizbSelected:null}))}>
                {metriquesDisponibles().map(m=><option key={m.val} value={m.val}>{lang==='ar'?m.label_ar:lang==='en'?m.label_en:m.label_fr}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label className="field-lbl">
                {form.metrique==='sourate'?(lang==='ar'?'عدد السور المستهدفة':lang==='en'?'Number of target surahs':'Nombre de sourates cibles')
                :form.metrique==='hizb'?(lang==='ar'?'عدد الأحزاب المستهدفة':lang==='en'?'Number of target Hizb':'Nombre de Hizb cibles')
                :form.metrique==='tomon'?(lang==='ar'?'عدد الأثمان المستهدفة':lang==='en'?'Number of target Tomon':'Nombre de Tomon cibles')
                :form.metrique==='points'?(lang==='ar'?'النقاط المستهدفة':lang==='en'?'Target points':'Points cibles')
                :(lang==='ar'?'عدد الحصص':lang==='en'?'Target sessions':'Nombre de séances')} *
              </label>
              <input className="field-input" type="number" min="1"
                value={form.valeur_cible}
                onChange={e=>setForm(f=>({...f,valeur_cible:e.target.value,cibles_selectionnees:[]}))}
                placeholder={form.metrique==='points'?'500':form.metrique==='seances'?'12':'5'}/>
            </div>
          </div>

          {/* ÉTAPE 2 : Sélection visuelle des éléments (si sourate/hizb/tomon) */}
          {parseInt(form.valeur_cible)>0 && ['sourate','hizb','tomon'].includes(form.metrique) && (
            <div style={{marginBottom:12,border:'1.5px solid #1D9E75',borderRadius:12,padding:'1rem',background:'#f0faf6'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:600,color:'#085041'}}>
                  {lang==='ar'?'اختر العناصر المستهدفة':lang==='en'?'Select target items':`Sélectionnez les éléments cibles`}
                  <span style={{fontSize:11,color:'#888',marginRight:8,marginLeft:8}}>({form.cibles_selectionnees.length}/{parseInt(form.valeur_cible)||0})</span>
                </div>
                {form.cibles_selectionnees.length>0&&<button onClick={()=>setForm(f=>({...f,cibles_selectionnees:[]}))} style={{fontSize:11,color:'#E24B4A',background:'none',border:'none',cursor:'pointer'}}>✕ {lang==='ar'?'إلغاء الكل':lang==='en'?'Clear all':`Tout effacer`}</button>}
              </div>

              {/* Barre de progression de sélection */}
              <div style={{height:6,background:'#e8e8e0',borderRadius:3,overflow:'hidden',marginBottom:10}}>
                <div style={{height:'100%',width:`${Math.min(100,form.cibles_selectionnees.length/(parseInt(form.valeur_cible)||1)*100)}%`,background:form.cibles_selectionnees.length>=(parseInt(form.valeur_cible)||1)?'#1D9E75':'#EF9F27',borderRadius:3,transition:'width 0.3s'}}/>
              </div>

              {form.metrique==='sourate' && (()=>{
                const niv = form.type_cible==='niveau' ? form.code_niveau :
                            form.type_cible==='eleve' ? (eleves.find(e=>e.id===form.eleve_id)?.code_niveau||'5B') : '5A';
                const list = ['5B'].includes(niv) ? SOURATES_5B : SOURATES_5A;
                const sorted = [...list].sort((a,b)=>b.numero-a.numero);
                const maxSel = parseInt(form.valeur_cible)||0;
                return(
                  <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:220,overflowY:'auto'}}>
                    {sorted.map(s=>{
                      const key=`sourate_${s.numero}`;
                      const isSel=form.cibles_selectionnees.includes(key);
                      const isDisabled=!isSel&&form.cibles_selectionnees.length>=maxSel;
                      return(
                        <div key={s.numero} onClick={()=>{if(isDisabled)return;setForm(f=>({...f,cibles_selectionnees:isSel?f.cibles_selectionnees.filter(x=>x!==key):[...f.cibles_selectionnees,key]}));}}
                          style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,cursor:isDisabled?'not-allowed':'pointer',opacity:isDisabled?0.4:1,background:isSel?'#E1F5EE':'#fff',border:`0.5px solid ${isSel?'#1D9E75':'#e0e0d8'}`,transition:'all 0.15s'}}>
                          <div style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${isSel?'#1D9E75':'#ccc'}`,background:isSel?'#1D9E75':'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {isSel&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
                          </div>
                          <span style={{fontSize:11,color:'#bbb',minWidth:24}}>{s.numero}</span>
                          <span style={{fontSize:14,fontFamily:"'Tajawal',Arial",direction:'rtl',color:isSel?'#085041':'#333',fontWeight:isSel?600:400}}>{s.nom_ar}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {form.metrique==='hizb' && (()=>{
                const maxSel=parseInt(form.valeur_cible)||0;
                return(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4}}>
                    {Array.from({length:60},(_,i)=>i+1).map(h=>{
                      const key=`hizb_${h}`;
                      const isSel=form.cibles_selectionnees.includes(key);
                      const isDisabled=!isSel&&form.cibles_selectionnees.length>=maxSel;
                      return(
                        <div key={h} onClick={()=>{if(isDisabled)return;setForm(f=>({...f,cibles_selectionnees:isSel?f.cibles_selectionnees.filter(x=>x!==key):[...f.cibles_selectionnees,key]}));}}
                          style={{height:36,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:isSel?700:400,cursor:isDisabled?'not-allowed':'pointer',opacity:isDisabled?0.35:1,background:isSel?'#1D9E75':'#fff',color:isSel?'#fff':'#666',border:`0.5px solid ${isSel?'#1D9E75':'#e0e0d8'}`,transition:'all 0.1s'}}>
                          {h}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {form.metrique==='tomon' && (()=>{
                const maxSel=parseInt(form.valeur_cible)||0;
                // First pick a Hizb, then pick Tomon within it
                return(
                  <div>
                    <div style={{fontSize:11,color:'#085041',fontWeight:600,marginBottom:6}}>
                      {'1️⃣'} {lang==='ar'?'اختر الحزب أولاً':lang==='en'?'First select a Hizb':`Sélectionnez d'abord un Hizb`}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3,marginBottom:10}}>
                      {Array.from({length:60},(_,i)=>i+1).map(h=>{
                        const hasSelected=form.cibles_selectionnees.some(k=>k.startsWith(`h${h}_t`));
                        return(
                          <div key={h} onClick={()=>setForm(f=>({...f,hizbSelected:f.hizbSelected===h?null:h}))}
                            style={{height:28,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,cursor:'pointer',
                              background:form.hizbSelected===h?'#085041':hasSelected?'#E1F5EE':'#f5f5f0',
                              color:form.hizbSelected===h?'#fff':hasSelected?'#085041':'#888',
                              border:`0.5px solid ${form.hizbSelected===h?'#085041':hasSelected?'#9FE1CB':'#e0e0d8'}`,
                              fontWeight:form.hizbSelected===h||hasSelected?600:400}}>
                            {h}
                          </div>
                        );
                      })}
                    </div>
                    {form.hizbSelected && (
                      <div>
                        <div style={{fontSize:11,color:'#085041',fontWeight:600,marginBottom:6}}>
                          {'2️⃣'} {lang==='ar'?`الأثمان - الحزب ${form.hizbSelected}`:lang==='en'?`Tomon - Hizb ${form.hizbSelected}`:`Tomon du Hizb ${form.hizbSelected}`}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:6}}>
                          {[1,2,3,4,5,6,7,8].map(t=>{
                            const key=`h${form.hizbSelected}_t${t}`;
                            const isSel=form.cibles_selectionnees.includes(key);
                            const isDisabled=!isSel&&form.cibles_selectionnees.length>=maxSel;
                            return(
                              <div key={t} onClick={()=>{if(isDisabled)return;setForm(f=>({...f,cibles_selectionnees:isSel?f.cibles_selectionnees.filter(x=>x!==key):[...f.cibles_selectionnees,key]}));}}
                                style={{padding:'10px',borderRadius:8,textAlign:'center',cursor:isDisabled?'not-allowed':'pointer',opacity:isDisabled?0.35:1,
                                  background:isSel?'#1D9E75':'#fff',color:isSel?'#fff':'#555',border:`1.5px solid ${isSel?'#1D9E75':'#e0e0d8'}`,transition:'all 0.15s'}}>
                                <div style={{fontSize:14,fontWeight:700}}>T.{t}</div>
                                <div style={{fontSize:9,color:isSel?'#9FE1CB':'#bbb',marginTop:2}}>H{form.hizbSelected}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {form.cibles_selectionnees.length>0 && (
                      <div style={{marginTop:8,display:'flex',gap:4,flexWrap:'wrap'}}>
                        {form.cibles_selectionnees.map(k=>{
                          const [h,t]=k.replace('h','').split('_t');
                          return <span key={k} style={{padding:'2px 8px',background:'#E1F5EE',borderRadius:20,fontSize:11,color:'#085041'}}>Hizb {h} T.{t}</span>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Notes */}
          <div className="field-group" style={{marginBottom:14}}>
            <label className="field-lbl">{lang==='ar'?'ملاحظات':lang==='en'?'Notes':'Notes'}</label>
            <textarea className="field-input" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder={lang==='ar'?'ملاحظات إضافية...':lang==='en'?'Additional notes...':'Notes supplémentaires...'} style={{resize:'vertical'}}/>
          </div>

          {/* Preview */}
          {(form.valeur_cible>0||form.cible_specifique)&&(
            <div style={{background:'#f0faf6',border:'0.5px solid #9FE1CB',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#085041'}}>
              📋 <strong>{form.titre||lang==='ar'?'هدف':'Objectif'}</strong>
              {' → '}{getObjLabel({type_cible:form.type_cible,eleve_id:form.eleve_id,code_niveau:form.code_niveau,instituteur_id:form.instituteur_id})}
              {' → '}
              {form.cible_specifique
                ? <span style={{fontWeight:700,color:'#085041'}}>
                    {form.cible_specifique.startsWith('sourate_')
                      ? (()=>{const n=parseInt(form.cible_specifique.replace('sourate_',''));const s=[...SOURATES_5B,...SOURATES_5A,...SOURATES_2M].find(x=>x.numero===n);return (lang==='ar'?'سورة':'Sourate')+' '+n+' — '+(s?.nom_ar||'');})()
                      : form.cible_specifique.startsWith('hizb_')
                      ? `Hizb ${form.cible_specifique.replace('hizb_','')}`
                      : form.cible_specifique.replace('hizb','H').replace('_tomon',' T.')}
                  </span>
                : <span>{form.valeur_cible} {getMetriqueLabel(form.metrique,lang)}</span>}
              {' / '}{getPeriodeLabel(form.periode,lang)}
              {' ('}{formatDate(form.date_debut)} → {formatDate(form.date_fin)}{')'}
            </div>
          )}

          <button className="btn-primary" onClick={saveObjectif} disabled={saving}>
            {saving?'...':(editingId?('✓ '+(lang==='ar'?'تحديث':lang==='en'?'Update':'Mettre à jour')):('✓ '+(lang==='ar'?'حفظ الهدف':lang==='en'?'Save objective':'Enregistrer objectif')))}
          </button>
        </div>
      )}

      {/* Filtres */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
        <div style={{fontSize:12,fontWeight:600,color:'#888',marginBottom:8}}>
          🔍 {lang==='ar'?'تصفية الأهداف':lang==='en'?'Filter objectives':'Filtrer les objectifs'}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
          <select className="field-select" style={{flex:1,minWidth:130}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="tous">{lang==='ar'?'جميع الأنواع':lang==='en'?'All types':'Tous les types'}</option>
            <option value="eleve">{lang==='ar'?'بالطالب':lang==='en'?'By student':'Par élève'}</option>
            <option value="niveau">{lang==='ar'?'بالمستوى':lang==='en'?'By level':'Par niveau'}</option>
            <option value="instituteur">{lang==='ar'?'بالأستاذ':lang==='en'?'By teacher':'Par instituteur'}</option>
            <option value="global">{lang==='ar'?'عام':lang==='en'?'Global':'Global'}</option>
          </select>
          <select className="field-select" style={{flex:1,minWidth:130}} value={filterNiveau} onChange={e=>setFilterNiveau(e.target.value)}>
            <option value="tous">{lang==='ar'?'جميع المستويات':lang==='en'?'All levels':'Tous les niveaux'}</option>
            {NIVEAUX.map(n=><option key={n} value={n}>{n} — {NIVEAU_LABELS[n]}</option>)}
          </select>
          <select className="field-select" style={{flex:1,minWidth:130}} value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}>
            <option value="tous">{lang==='ar'?'جميع الحالات':lang==='en'?'All statuses':'Tous les statuts'}</option>
            <option value="en_cours">{lang==='ar'?'جارية':lang==='en'?'In progress':'En cours'}</option>
            <option value="atteint">{lang==='ar'?'محققة':lang==='en'?'Achieved':'Atteints'}</option>
            <option value="expire">{lang==='ar'?'منتهية':lang==='en'?'Expired':'Expirés'}</option>
            <option value="futur">{lang==='ar'?'قادمة':lang==='en'?'Upcoming':'À venir'}</option>
          </select>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:12,color:'#888'}}>
            {objFiltres.length} {lang==='ar'?'هدف':lang==='en'?'objective(s)':'objectif(s)'} {filterType!=='tous'||filterNiveau!=='tous'||filterStatut!=='tous'?`(${lang==='ar'?'مصفّى':lang==='en'?'filtered':'filtré'})`:''}
          </div>
          <div style={{display:'flex',gap:6}}>
            {(filterType!=='tous'||filterNiveau!=='tous'||filterStatut!=='tous')&&(
              <button onClick={()=>{setFilterType('tous');setFilterNiveau('tous');setFilterStatut('tous');}}
                style={{padding:'6px 12px',border:'0.5px solid #e0e0d8',borderRadius:8,background:'#fff',fontSize:12,cursor:'pointer',color:'#888'}}>
                ✕ {lang==='ar'?'إلغاء التصفية':lang==='en'?'Clear filters':'Effacer les filtres'}
              </button>
            )}
            <button onClick={loadData}
              style={{padding:'6px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
              🔄 {lang==='ar'?'تحديث':lang==='en'?'Refresh':'Actualiser'}
            </button>
          </div>
        </div>
      </div>

      {/* Liste des objectifs */}
      {loading ? <div className="loading">...</div> : objFiltres.length === 0 ? (
        <div className="empty">
          {lang==='ar'?'لا توجد أهداف محددة بعد':lang==='en'?'No objectives defined yet':'Aucun objectif défini'}
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {objFiltres.map(obj => {
            const vals = getValsForObj(obj);
            const recs = getRecsForObj(obj);
            const { realise, pct, status } = calcAtteinte(obj, vals, recs);
            const sc = statusConfig[status];
            const niv = getNiveauForObj(obj);
            const nc = niv ? NIVEAU_COLORS[niv] : '#888';

            return (
              <div key={obj.id} style={{background:'#fff',border:`0.5px solid ${sc.color}30`,borderLeft:`4px solid ${sc.color}`,borderRadius:12,padding:'1rem'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                      {obj.titre&&<span style={{fontSize:14,fontWeight:700,color:'#1a1a1a'}}>{obj.titre}</span>}
                      <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:sc.bg,color:sc.color}}>
                        {lang==='ar'?sc.label_ar:lang==='en'?sc.label_en:sc.label_fr}
                      </span>
                      {niv&&<span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:nc+'15',color:nc}}>{niv}</span>}
                    </div>
                    <div style={{fontSize:13,color:'#1a1a1a',fontWeight:500}}>
                      {getObjLabel(obj)} — {obj.valeur_cible} {getMetriqueLabel(obj.metrique,lang)} / {getPeriodeLabel(obj.periode,lang)}
                    </div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>
                      📅 {formatDate(obj.date_debut)} → {formatDate(obj.date_fin)}
                      {obj.notes&&<span style={{marginLeft:8}}>· {obj.notes}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:22,fontWeight:800,color:sc.color}}>{pct}%</div>
                    <div style={{fontSize:11,color:'#888'}}>{realise}/{obj.valeur_cible}</div>
                    {user.role==='surveillant'&&(
                      <div style={{display:'flex',gap:6,marginTop:4}}>
                        <button onClick={()=>startEdit(obj)} style={{fontSize:10,color:'#378ADD',background:'none',border:'none',cursor:'pointer',padding:0}}>✏️ {lang==='ar'?'تعديل':lang==='en'?'Edit':'Modifier'}</button>
                        <button onClick={()=>deleteObjectif(obj.id)} style={{padding:'3px 8px',background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>🗑 {lang==='ar'?'حذف':lang==='en'?'Delete':'Supprimer'}</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{height:10,background:'#e8e8e0',borderRadius:5,overflow:'hidden',marginBottom:8}}>
                  <div style={{height:'100%',width:`${pct}%`,borderRadius:5,transition:'width 0.5s',
                    background:pct>=100?'#1D9E75':pct>=60?'#EF9F27':'#E24B4A'}}/>
                </div>

                {/* Detail */}
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888'}}>
                  <span>{lang==='ar'?'المحقق':lang==='en'?'Achieved':'Réalisé'}: <strong style={{color:sc.color}}>{realise} {getMetriqueLabel(obj.metrique,lang)}</strong></span>
                  <span>{lang==='ar'?'المتبقي':lang==='en'?'Remaining':'Restant'}: <strong>{Math.max(0,obj.valeur_cible-realise)}</strong></span>
                  {status==='en_cours'&&<span>{lang==='ar'?'الأيام المتبقية':lang==='en'?'Days left':'Jours restants'}: <strong>{Math.max(0,Math.ceil((new Date(obj.date_fin)-new Date())/(1000*60*60*24)))}</strong></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message}
        onConfirm={confirmModal.onConfirm} onCancel={hideConfirm}
        confirmLabel={confirmModal.confirmLabel} confirmColor={confirmModal.confirmColor} lang={lang}/>
    </div>
  );
}
