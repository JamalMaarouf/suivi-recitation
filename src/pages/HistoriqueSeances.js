import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, formatDate, formatDateCourt, joursDepuis } from '../lib/helpers';
import { t } from '../lib/i18n';
import { getSouratesForNiveau } from '../lib/sourates';

const IS_SOURATE = (code) => ['5B','5A','2M'].includes(code||'');
const NIVEAU_COLORS = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };

function Avatar({ prenom, nom, size=36, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}
function NiveauBadge({ code }) {
  const c = NIVEAU_COLORS[code||'1']||'#888';
  return <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:c+'18',color:c,border:`0.5px solid ${c}30`}}>{code}</span>;
}
function StatCard({ val, lbl, color, bg, sub, icon }) {
  return (
    <div style={{background:bg,borderRadius:14,padding:'14px 16px',display:'flex',flexDirection:'column',gap:4}}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        {icon&&<span style={{fontSize:18}}>{icon}</span>}
        <div style={{fontSize:11,color:color,opacity:0.8,fontWeight:500}}>{lbl}</div>
      </div>
      <div style={{fontSize:26,fontWeight:800,color,letterSpacing:'-1px'}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:color,opacity:0.6}}>{sub}</div>}
    </div>
  );
}

const PERIODES_RAPIDES = (lang) => [
  { label: lang==='ar'?'اليوم':lang==='en'?'Today':"Aujourd'hui", jours:0 },
  { label: lang==='ar'?'أمس':lang==='en'?'Yesterday':'Hier', jours:1 },
  { label: lang==='ar'?'7 أيام':lang==='en'?'7 days':'7 jours', jours:7 },
  { label: lang==='ar'?'15 يوم':lang==='en'?'15 days':'15 jours', jours:15 },
  { label: lang==='ar'?'شهر':lang==='en'?'Month':'Mois', jours:30 },
  { label: lang==='ar'?'فصل':lang==='en'?'Quarter':'Trimestre', jours:90 },
];

export default function HistoriqueSeances({ user, navigate, lang='fr' }) {
  // Data
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [validations, setValidations] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [objectifs, setObjectifs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateDebut, setDateDebut] = useState(() => { const d=new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]; });
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterNiveau, setFilterNiveau] = useState('tous');
  const [filterInstituteur, setFilterInstituteur] = useState('tous');
  const [filterEleve, setFilterEleve] = useState('tous');
  const [filterType, setFilterType] = useState('tous');
  const [periodeActive, setPeriodeActive] = useState(1); // index in PERIODES_RAPIDES

  // UI
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [drillDown, setDrillDown] = useState(false);
  const [searchEleve, setSearchEleve] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: ed }, { data: inst }, { data: vd }, { data: rd }, { data: sdb }, { data: objs }] = await Promise.all([
      supabase.from('eleves').select('*').order('nom'),
      supabase.from('utilisateurs').select('*').eq('role','instituteur'),
      supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').order('date_validation',{ascending:false}),
      supabase.from('recitations_sourates').select('*, valideur:valide_par(prenom,nom)').order('date_validation',{ascending:false}),
      supabase.from('sourates').select('*'),
      supabase.from('objectifs_globaux').select('*').order('created_at',{ascending:false}),
    ]);
    setEleves(ed||[]);
    setInstituteurs(inst||[]);
    setValidations(vd||[]);
    setRecitations(rd||[]);
    setSouratesDB(sdb||[]);
    setObjectifs(objs||[]);
    setLoading(false);
  };

  const setPeriodeRapide = (idx) => {
    setPeriodeActive(idx);
    const p = PERIODES_RAPIDES(lang)[idx];
    const fin = new Date();
    const debut = new Date();
    if (p.jours === 1) { debut.setDate(debut.getDate()-1); fin.setDate(fin.getDate()-1); }
    else debut.setDate(debut.getDate()-p.jours);
    setDateDebut(debut.toISOString().split('T')[0]);
    setDateFin(fin.toISOString().split('T')[0]);
  };

  // Filter helpers
  const debut = new Date(dateDebut); debut.setHours(0,0,0,0);
  const fin = new Date(dateFin); fin.setHours(23,59,59,999);

  const elevesVisibles = eleves.filter(e => {
    if (filterNiveau !== 'tous' && (e.code_niveau||'1') !== filterNiveau) return false;
    if (filterInstituteur !== 'tous' && e.instituteur_referent_id !== filterInstituteur) return false;
    // Instituteur sees only their students (unless surveillant)
    if (user.role === 'instituteur' && e.instituteur_referent_id !== user.id) return false;
    return true;
  });
  const elevesVisiblesIds = new Set(elevesVisibles.map(e=>e.id));

  // Validations filtrées (Tomon/Hizb)
  const valsFiltrees = validations.filter(v => {
    const d = new Date(v.date_validation);
    if (d < debut || d > fin) return false;
    if (!elevesVisiblesIds.has(v.eleve_id)) return false;
    if (filterEleve !== 'tous' && v.eleve_id !== filterEleve) return false;
    if (filterType === 'tomon' && v.type_validation !== 'tomon') return false;
    if (filterType === 'hizb' && v.type_validation !== 'hizb_complet') return false;
    if (filterType === 'sourate' || filterType === 'sequence') return false;
    return true;
  });

  // Récitations filtrées (Sourates)
  const recsFiltrees = recitations.filter(r => {
    const d = new Date(r.date_validation);
    if (d < debut || d > fin) return false;
    const el = eleves.find(e=>e.id===r.eleve_id);
    if (!el || !elevesVisiblesIds.has(r.eleve_id)) return false;
    if (filterEleve !== 'tous' && r.eleve_id !== filterEleve) return false;
    if (filterType === 'sourate' && r.type_recitation !== 'complete') return false;
    if (filterType === 'sequence' && r.type_recitation !== 'sequence') return false;
    if (filterType === 'tomon' || filterType === 'hizb') return false;
    return true;
  });

  // Stats globales
  const tomonTotal = valsFiltrees.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
  const hizbTotal = valsFiltrees.filter(v=>v.type_validation==='hizb_complet').length;
  const souratesTotal = recsFiltrees.filter(r=>r.type_recitation==='complete').length;
  const sequencesTotal = recsFiltrees.filter(r=>r.type_recitation==='sequence').length;
  const ptsTotal = tomonTotal*10+Math.floor(tomonTotal/2)*25+Math.floor(tomonTotal/4)*60+hizbTotal*100+recsFiltrees.reduce((s,r)=>s+(r.points||0),0);
  const elevesActifs = new Set([...valsFiltrees.map(v=>v.eleve_id),...recsFiltrees.map(r=>r.eleve_id)]);
  const joursActifs = new Set([...valsFiltrees,...recsFiltrees].map(x=>new Date(x.date_validation).toDateString())).size;

  // Période précédente (pour comparaison)
  const duree = Math.max(1, Math.ceil((fin-debut)/(1000*60*60*24)));
  const debutPrec = new Date(debut); debutPrec.setDate(debutPrec.getDate()-duree);
  const finPrec = new Date(debut); finPrec.setDate(finPrec.getDate()-1);
  const valsPrec = validations.filter(v=>{const d=new Date(v.date_validation);return d>=debutPrec&&d<=finPrec&&elevesVisiblesIds.has(v.eleve_id);});
  const recsPrec = recitations.filter(r=>{const d=new Date(r.date_validation);return d>=debutPrec&&d<=finPrec&&elevesVisiblesIds.has(r.eleve_id);});
  const ptsPrec = valsPrec.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0)*10 + recsPrec.reduce((s,r)=>s+(r.points||0),0);
  const ptsDelta = ptsTotal - ptsPrec;
  const elevesActifsPrec = new Set([...valsPrec.map(v=>v.eleve_id),...recsPrec.map(r=>r.eleve_id)]).size;

  // Stats par élève
  const statsParEleve = elevesVisibles.map(eleve => {
    const vE = valsFiltrees.filter(v=>v.eleve_id===eleve.id);
    const rE = recsFiltrees.filter(r=>r.eleve_id===eleve.id);
    const tomon = vE.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
    const hizb = vE.filter(v=>v.type_validation==='hizb_complet').length;
    const sourates = rE.filter(r=>r.type_recitation==='complete').length;
    const seqs = rE.filter(r=>r.type_recitation==='sequence').length;
    const pts = tomon*10+Math.floor(tomon/2)*25+Math.floor(tomon/4)*60+hizb*100+rE.reduce((s,r)=>s+(r.points||0),0);
    const nbSeances = new Set([...vE,...rE].map(x=>new Date(x.date_validation).toDateString())).size;
    const derniere = [...vE,...rE].sort((a,b)=>new Date(b.date_validation)-new Date(a.date_validation))[0]?.date_validation||null;
    const isSourate = IS_SOURATE(eleve.code_niveau);

    // Objectif en cours
    const objEleve = objectifs.find(o=>o.type_cible==='eleve'&&o.eleve_id===eleve.id&&new Date(o.date_debut)<=fin&&new Date(o.date_fin)>=debut);
    const objNiveau = objectifs.find(o=>o.type_cible==='niveau'&&o.code_niveau===(eleve.code_niveau||'1')&&new Date(o.date_debut)<=fin&&new Date(o.date_fin)>=debut);
    const obj = objEleve || objNiveau;
    let pctObj = null;
    if (obj) {
      let realise = 0;
      if (obj.metrique==='tomon') realise=tomon;
      else if (obj.metrique==='hizb') realise=hizb;
      else if (obj.metrique==='sourate') realise=sourates;
      else if (obj.metrique==='sequence') realise=seqs;
      else if (obj.metrique==='points') realise=pts;
      else if (obj.metrique==='seances') realise=nbSeances;
      pctObj = Math.min(100, Math.round(realise/obj.valeur_cible*100));
    }

    // Période précédente pour cet élève
    const vEPrec = valsPrec.filter(v=>v.eleve_id===eleve.id);
    const rEPrec = recsPrec.filter(r=>r.eleve_id===eleve.id);
    const ptsPrec2 = vEPrec.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0)*10+rEPrec.reduce((s,r)=>s+(r.points||0),0);
    const trend = pts > ptsPrec2 ? 'up' : pts < ptsPrec2 ? 'down' : 'stable';

    const inst = instituteurs.find(i=>i.id===eleve.instituteur_referent_id);
    return { eleve, tomon, hizb, sourates, seqs, pts, nbSeances, derniere, isSourate, obj, pctObj, trend, ptsPrec:ptsPrec2, instituteurNom:inst?`${inst.prenom} ${inst.nom}`:'—' };
  }).filter(s=>true); // keep all for showing inactifs too

  const actifs = statsParEleve.filter(s=>s.pts>0||s.nbSeances>0).sort((a,b)=>b.pts-a.pts);
  const inactifs = statsParEleve.filter(s=>s.pts===0&&s.nbSeances===0);

  // Timeline par jour
  const timeline = {};
  [...valsFiltrees,...recsFiltrees].forEach(item=>{
    const key=new Date(item.date_validation).toISOString().split('T')[0];
    if(!timeline[key]) timeline[key]={date:key,pts:0,tomon:0,hizb:0,sourate:0,seq:0,nb:0};
    timeline[key].nb++;
    if(item.type_validation==='tomon'){timeline[key].tomon+=item.nombre_tomon;timeline[key].pts+=item.nombre_tomon*10;}
    else if(item.type_validation==='hizb_complet'){timeline[key].hizb++;timeline[key].pts+=100;}
    else if(item.type_recitation==='complete'){timeline[key].sourate++;timeline[key].pts+=(item.points||30);}
    else if(item.type_recitation==='sequence'){timeline[key].seq++;timeline[key].pts+=(item.points||10);}
  });
  const timelineArr = Object.values(timeline).sort((a,b)=>a.date.localeCompare(b.date));
  const maxPtsDay = Math.max(...timelineArr.map(d=>d.pts),1);

  // Drill-down: validations d'un élève spécifique
  const eleveDrillDown = selectedEleve ? eleves.find(e=>e.id===selectedEleve) : null;
  const valsDrill = selectedEleve ? validations.filter(v=>v.eleve_id===selectedEleve&&new Date(v.date_validation)>=debut&&new Date(v.date_validation)<=fin) : [];
  const recsDrill = selectedEleve ? recitations.filter(r=>r.eleve_id===selectedEleve&&new Date(r.date_validation)>=debut&&new Date(r.date_validation)<=fin) : [];
  const allDrill = [...valsDrill,...recsDrill].sort((a,b)=>new Date(b.date_validation)-new Date(a.date_validation));

  const elevesSearch = eleves.filter(e=>`${e.prenom} ${e.nom}`.toLowerCase().includes(searchEleve.toLowerCase())&&elevesVisiblesIds.has(e.id));

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={()=>navigate('seance')}>{t(lang,'retour')}</button>
        <div style={{fontSize:18,fontWeight:700,color:'#085041'}}>
          📊 {lang==='ar'?'تحليل الحصص':lang==='en'?'Session Analysis':'Analyse des Séances'}
        </div>
        <div style={{fontSize:12,color:'#888'}}>{elevesVisibles.length} {lang==='ar'?'طالب':lang==='en'?'students':'élèves'}</div>
      </div>

      {/* FILTRES */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem'}}>
        {/* Périodes rapides */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {PERIODES_RAPIDES(lang).map((p,i)=>(
            <button key={i} onClick={()=>setPeriodeRapide(i)}
              style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:periodeActive===i?700:400,cursor:'pointer',border:`1.5px solid ${periodeActive===i?'#1D9E75':'#e0e0d8'}`,background:periodeActive===i?'#1D9E75':'#fff',color:periodeActive===i?'#fff':'#666',transition:'all 0.15s'}}>
              {p.label}
            </button>
          ))}
          <button onClick={()=>setPeriodeActive(-1)}
            style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:periodeActive===-1?700:400,cursor:'pointer',border:`1.5px solid ${periodeActive===-1?'#534AB7':'#e0e0d8'}`,background:periodeActive===-1?'#534AB7':'#fff',color:periodeActive===-1?'#fff':'#666'}}>
            {lang==='ar'?'فترة مخصصة':lang==='en'?'Custom':'Personnalisé'}
          </button>
        </div>

        {/* Dates */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:10}}>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'من':lang==='en'?'From':'Du'}</label>
            <input className="field-input" type="date" value={dateDebut} onChange={e=>{setDateDebut(e.target.value);setPeriodeActive(-1);}}/>
          </div>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'إلى':lang==='en'?'To':'Au'}</label>
            <input className="field-input" type="date" value={dateFin} onChange={e=>{setDateFin(e.target.value);setPeriodeActive(-1);}}/>
          </div>
        </div>

        {/* Filtres */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {/* Niveau */}
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'المستوى':lang==='en'?'Level':'Niveau'}</label>
            <select className="field-select" value={filterNiveau} onChange={e=>setFilterNiveau(e.target.value)}>
              <option value="tous">{lang==='ar'?'الكل':lang==='en'?'All':'Tous'}</option>
              {['5B','5A','2M','2','1'].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {/* Instituteur (surveillant seulement) */}
          {user.role==='surveillant'&&(
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'الأستاذ':lang==='en'?'Teacher':'Instituteur'}</label>
              <select className="field-select" value={filterInstituteur} onChange={e=>setFilterInstituteur(e.target.value)}>
                <option value="tous">{lang==='ar'?'الكل':lang==='en'?'All':'Tous'}</option>
                {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
              </select>
            </div>
          )}
          {/* Type */}
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'نوع التسميع':lang==='en'?'Type':'Type'}</label>
            <select className="field-select" value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="tous">{lang==='ar'?'الكل':lang==='en'?'All':'Tous'}</option>
              <option value="sourate">{lang==='ar'?'سور مكتملة':lang==='en'?'Complete surahs':'Sourates complètes'}</option>
              <option value="sequence">{lang==='ar'?'مقاطع':lang==='en'?'Sequences':'Séquences'}</option>
              <option value="tomon">{lang==='ar'?'أثمان':lang==='en'?'Tomon':'Tomon'}</option>
              <option value="hizb">{lang==='ar'?'أحزاب مكتملة':lang==='en'?'Complete Hizb':'Hizb complets'}</option>
            </select>
          </div>
          {/* Élève */}
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'الطالب':lang==='en'?'Student':'Élève'}</label>
            <select className="field-select" value={filterEleve} onChange={e=>setFilterEleve(e.target.value)}>
              <option value="tous">{lang==='ar'?'الكل':lang==='en'?'All':'Tous'}</option>
              {elevesVisibles.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.code_niveau||'?'})</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? <div className="loading">...</div> : (
        <>
          {/* KPI GLOBAUX */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:'1.25rem'}}>
            <StatCard val={elevesActifs.size} lbl={lang==='ar'?'طلاب نشطون':lang==='en'?'Active students':'Élèves actifs'} color="#1D9E75" bg="#E1F5EE" icon="👥"
              sub={`${lang==='ar'?'من':lang==='en'?'of':'sur'} ${elevesVisibles.length} · ${lang==='ar'?'غير نشطين':lang==='en'?'inactive':'inactifs'}: ${inactifs.length}`}/>
            <StatCard val={ptsTotal.toLocaleString()} lbl={lang==='ar'?'نقاط مكتسبة':lang==='en'?'Points earned':'Points générés'} color="#534AB7" bg="#EEEDFE" icon="⭐"
              sub={ptsDelta!==0?`${ptsDelta>0?'▲':'▼'} ${Math.abs(ptsDelta).toLocaleString()} ${lang==='ar'?'مقارنة بالفترة السابقة':lang==='en'?'vs previous period':'vs période préc.'}`:lang==='ar'?'مستقر':lang==='en'?'Stable':'Stable'}/>
            <StatCard val={joursActifs} lbl={lang==='ar'?'أيام نشطة':lang==='en'?'Active days':'Jours actifs'} color="#EF9F27" bg="#FAEEDA" icon="📅"
              sub={`${lang==='ar'?'على':lang==='en'?'out of':'sur'} ${duree} ${lang==='ar'?'يوم':lang==='en'?'days':'jours'}`}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:'1.25rem'}}>
            {[
              {val:tomonTotal,lbl:t(lang,'tomon_abrev'),color:'#378ADD',bg:'#E6F1FB'},
              {val:hizbTotal,lbl:'Hizb',color:'#EF9F27',bg:'#FAEEDA'},
              {val:souratesTotal,lbl:lang==='ar'?'سور كاملة':lang==='en'?'Surahs':'Sourates',color:'#085041',bg:'#E1F5EE'},
              {val:sequencesTotal,lbl:lang==='ar'?'مقاطع':lang==='en'?'Seq.':'Séq.',color:'#888',bg:'#f5f5f0'},
            ].map(k=>(
              <div key={k.lbl} style={{background:k.bg,borderRadius:10,padding:'10px',textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:700,color:k.color}}>{k.val}</div>
                <div style={{fontSize:11,color:k.color,opacity:0.8}}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* TIMELINE */}
          {timelineArr.length>0&&(
            <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem'}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:'#1a1a1a'}}>
                {lang==='ar'?'النشاط اليومي':lang==='en'?'Daily activity':'Activité quotidienne'}
              </div>
              <div style={{display:'flex',gap:3,alignItems:'flex-end',height:80}}>
                {timelineArr.map(d=>(
                  <div key={d.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                    <div style={{width:'100%',background:'linear-gradient(180deg,#1D9E75,#5DCAA5)',borderRadius:'3px 3px 0 0',height:`${Math.max(4,(d.pts/maxPtsDay)*70)}px`,transition:'height 0.3s'}}
                      title={`${d.date}: ${d.pts} pts`}/>
                    <div style={{fontSize:8,color:'#bbb',writing:'vertical',textAlign:'center'}}>{new Date(d.date).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'numeric',month:'numeric'})}</div>
                  </div>
                ))}
              </div>
              {timelineArr.length>0&&(
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888',marginTop:6}}>
                  <span>{lang==='ar'?'الأكثر نشاطاً':lang==='en'?'Most active':'Jour le plus actif'}: <strong style={{color:'#1D9E75'}}>{timelineArr.reduce((m,d)=>d.pts>m.pts?d:m,timelineArr[0])?.date}</strong></span>
                  <span>{lang==='ar'?'متوسط يومي':lang==='en'?'Daily avg':'Moy./jour'}: <strong style={{color:'#1D9E75'}}>{Math.round(ptsTotal/(joursActifs||1))} {t(lang,'pts_abrev')}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* PERFORMANCE PAR ÉLÈVE */}
          {!drillDown&&(
            <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a'}}>
                  {lang==='ar'?'أداء الطلاب':lang==='en'?'Student performance':'Performance par élève'}
                  <span style={{fontSize:11,color:'#888',marginRight:6,marginLeft:6}}>({actifs.length} {lang==='ar'?'نشط':lang==='en'?'active':'actifs'})</span>
                </div>
                <input style={{padding:'5px 10px',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:12,width:160}} placeholder={`🔍 ${lang==='ar'?'بحث':lang==='en'?'Search':'Rechercher'}`} value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}/>
              </div>

              {actifs.filter(s=>!searchEleve||`${s.eleve.prenom} ${s.eleve.nom}`.toLowerCase().includes(searchEleve.toLowerCase())).map((s,idx)=>{
                const nc = NIVEAU_COLORS[s.eleve.code_niveau||'1']||'#888';
                const sl = scoreLabel(s.pts);
                return(
                  <div key={s.eleve.id}
                    onClick={()=>{setSelectedEleve(s.eleve.id);setDrillDown(true);}}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'11px 12px',borderRadius:10,cursor:'pointer',marginBottom:6,border:'0.5px solid #e0e0d8',background:'#fff',transition:'all 0.15s'}}
                    onMouseEnter={ev=>ev.currentTarget.style.background='#f9f9f6'}
                    onMouseLeave={ev=>ev.currentTarget.style.background='#fff'}>
                    <div style={{fontSize:13,fontWeight:600,color:'#bbb',minWidth:22}}>{idx+1}</div>
                    <Avatar prenom={s.eleve.prenom} nom={s.eleve.nom} size={34} bg={nc+'18'} color={nc}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:600}}>{s.eleve.prenom} {s.eleve.nom}</span>
                        <NiveauBadge code={s.eleve.code_niveau}/>
                        <span style={{fontSize:10,color:'#bbb'}}>{s.instituteurNom}</span>
                        {s.trend==='up'&&<span style={{fontSize:11,color:'#1D9E75'}}>📈</span>}
                        {s.trend==='down'&&<span style={{fontSize:11,color:'#E24B4A'}}>📉</span>}
                      </div>
                      <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap'}}>
                        {s.isSourate?(
                          <>
                            {s.sourates>0&&<span style={{fontSize:11,color:'#085041',fontWeight:500}}>{s.sourates} {lang==='ar'?'سور':lang==='en'?'surahs':'sur.'} ✓</span>}
                            {s.seqs>0&&<span style={{fontSize:11,color:'#888'}}>{s.seqs} {lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'}</span>}
                          </>
                        ):(
                          <>
                            {s.tomon>0&&<span style={{fontSize:11,color:'#378ADD',fontWeight:500}}>{s.tomon} {t(lang,'tomon_abrev')}</span>}
                            {s.hizb>0&&<span style={{fontSize:11,color:'#EF9F27',fontWeight:500}}>{s.hizb} Hizb</span>}
                          </>
                        )}
                        <span style={{fontSize:11,color:'#bbb'}}>{s.nbSeances} {lang==='ar'?'حصص':lang==='en'?'sessions':'séances'}</span>
                      </div>
                      {/* Barre de progression objectif */}
                      {s.pctObj!==null&&(
                        <div style={{marginTop:4}}>
                          <div style={{height:4,background:'#e8e8e0',borderRadius:2,overflow:'hidden',width:120}}>
                            <div style={{height:'100%',width:`${s.pctObj}%`,background:s.pctObj>=100?'#1D9E75':s.pctObj>=60?'#EF9F27':'#E24B4A',borderRadius:2}}/>
                          </div>
                          <div style={{fontSize:9,color:'#888',marginTop:1}}>
                            {lang==='ar'?'الهدف':lang==='en'?'Obj.':'Obj.'}: {s.pctObj}% {s.pctObj>=100?'✓':''}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:800,color:nc}}>{s.pts}</div>
                      <div style={{fontSize:9,color:'#888'}}>{t(lang,'pts_abrev')}</div>
                    </div>
                    <div style={{color:'#bbb',fontSize:14}}>›</div>
                  </div>
                );
              })}

              {/* Inactifs */}
              {inactifs.length>0&&(
                <details style={{marginTop:10}}>
                  <summary style={{fontSize:12,color:'#E24B4A',cursor:'pointer',fontWeight:500,padding:'8px 0'}}>
                    ⚠️ {inactifs.length} {lang==='ar'?'طالب غير نشط خلال هذه الفترة':lang==='en'?'inactive students in this period':'élève(s) sans activité sur la période'}
                  </summary>
                  <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:8}}>
                    {inactifs.map(s=>(
                      <div key={s.eleve.id} onClick={()=>{setSelectedEleve(s.eleve.id);setDrillDown(true);}}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,cursor:'pointer',background:'#fff8f8',border:'0.5px solid #E24B4A20'}}>
                        <Avatar prenom={s.eleve.prenom} nom={s.eleve.nom} size={30} bg="#FCEBEB" color="#A32D2D"/>
                        <div style={{flex:1}}>
                          <span style={{fontSize:12,fontWeight:500,color:'#A32D2D'}}>{s.eleve.prenom} {s.eleve.nom}</span>
                          <NiveauBadge code={s.eleve.code_niveau}/>
                        </div>
                        <span style={{fontSize:11,color:'#E24B4A'}}>{s.eleve.derniere?`${joursDepuis(s.eleve.derniere)}${t(lang,'jour')}`:t(lang,'jamais')}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* DRILL-DOWN élève */}
          {drillDown&&eleveDrillDown&&(
            <div style={{background:'#fff',border:'1.5px solid #1D9E75',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'1.25rem'}}>
                <button onClick={()=>{setDrillDown(false);setSelectedEleve(null);}} style={{padding:'4px 10px',border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',fontSize:11,cursor:'pointer'}}>← {t(lang,'retour')}</button>
                <Avatar prenom={eleveDrillDown.prenom} nom={eleveDrillDown.nom} size={40} bg={NIVEAU_COLORS[eleveDrillDown.code_niveau||'1']+'18'} color={NIVEAU_COLORS[eleveDrillDown.code_niveau||'1']||'#888'}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700}}>{eleveDrillDown.prenom} {eleveDrillDown.nom}</div>
                  <div style={{display:'flex',gap:6,alignItems:'center',marginTop:2}}>
                    <NiveauBadge code={eleveDrillDown.code_niveau}/>
                    <span style={{fontSize:11,color:'#888'}}>{instituteurs.find(i=>i.id===eleveDrillDown.instituteur_referent_id)?.prenom||''}</span>
                    {eleveDrillDown.eleve_id_ecole&&<span style={{fontSize:11,color:'#bbb'}}>#{eleveDrillDown.eleve_id_ecole}</span>}
                  </div>
                </div>
                <button onClick={()=>navigate('fiche',eleveDrillDown)} style={{padding:'6px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:11,cursor:'pointer'}}>
                  {lang==='ar'?'الملف الكامل':lang==='en'?'Full profile':'Fiche complète'} →
                </button>
              </div>

              {allDrill.length===0?(
                <div className="empty">{lang==='ar'?'لا نشاط في هذه الفترة':lang==='en'?'No activity in this period':'Aucune activité sur la période'}</div>
              ):(
                <div className="table-wrap">
                  <table><thead><tr>
                    <th style={{width:'14%'}}>{lang==='ar'?'التاريخ':'Date'}</th>
                    <th style={{width:'12%'}}>{lang==='ar'?'الوقت':'Heure'}</th>
                    <th style={{width:'30%'}}>{lang==='ar'?'التفاصيل':'Détails'}</th>
                    <th style={{width:'24%'}}>{lang==='ar'?'السورة/الحزب':'Sourate / Hizb'}</th>
                    <th style={{width:'10%'}}>{t(lang,'valide_par')}</th>
                    <th style={{width:'10%'}}>{t(lang,'pts_abrev')}</th>
                  </tr></thead>
                  <tbody>
                    {allDrill.map((item,i)=>{
                      const isSourateItem = !!item.type_recitation;
                      const sourate = isSourateItem ? souratesDB.find(s=>s.id===item.sourate_id) : null;
                      const pts = isSourateItem ? (item.points||10) : (item.type_validation==='hizb_complet'?100:item.nombre_tomon*10);
                      return(
                        <tr key={i}>
                          <td style={{fontSize:12,color:'#888'}}>{formatDateCourt(item.date_validation)}</td>
                          <td style={{fontSize:12,color:'#888'}}>{new Date(item.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                          <td>{isSourateItem?(item.type_recitation==='complete'?<span className="badge badge-green">{lang==='ar'?'سورة كاملة':lang==='en'?'Complete surah':'Sourate complète'}</span>:<span className="badge badge-blue">V.{item.verset_debut}→V.{item.verset_fin}</span>):(item.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb {item.hizb_valide} ✓</span>:<span className="badge badge-blue">{item.nombre_tomon} {t(lang,'tomon_abrev')}{item.tomon_debut?` (T.${item.tomon_debut}→T.${item.tomon_debut+item.nombre_tomon-1})`:''}</span>)}</td>
                          <td style={{fontFamily:"'Tajawal',Arial",direction:'rtl',fontSize:13}}>{sourate?sourate.nom_ar:(item.hizb_validation?`Hizb ${item.hizb_validation}`:'—')}</td>
                          <td style={{fontSize:11,color:'#888'}}>{item.valideur?`${item.valideur.prenom[0]}. ${item.valideur.nom}`:'—'}</td>
                          <td><span style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>+{pts}</span></td>
                        </tr>
                      );
                    })}
                  </tbody></table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
