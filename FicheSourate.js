import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, niveauTraduit, calcStats, formatDate, formatDateCourt, isInactif, joursDepuis, getInitiales, scoreLabel } from '../lib/helpers';
import { t } from '../lib/i18n';

const C = { green:'#1D9E75',greenBg:'#E1F5EE',blue:'#378ADD',blueBg:'#E6F1FB',amber:'#EF9F27',amberBg:'#FAEEDA',red:'#E24B4A',redBg:'#FCEBEB',border:'#e0e0d8',muted:'#888',dark:'#1a1a1a' };
// Couleurs niveaux — fallback sur des valeurs par défaut si niveaux pas encore chargés
const NIVEAU_COLORS_FALLBACK = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };
const getNiveauColor = (code, niveaux) => {
  if (niveaux && niveaux.length > 0) return niveaux.find(n=>n.code===code)?.couleur || '#888';
  return NIVEAU_COLORS_FALLBACK[code] || '#888';
};
function NiveauBadge({ code }) {
  const c = getNiveauColor(code||'', niveaux||[]) || '#888';
  return code ? <span style={{padding:'1px 6px',borderRadius:10,fontSize:9,fontWeight:700,background:c+'18',color:c,border:`0.5px solid ${c}40`}}>{code}</span> : null;
}
function Avatar({ prenom, nom, size=36, bg=C.greenBg, color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}
function Medaille({ idx }) {
  const colors=['#EF9F27','#B0B0B0','#CD7F32'];
  if(idx>2) return <span style={{fontSize:11,color:'#bbb',width:22,display:'inline-block',textAlign:'center'}}>{idx+1}</span>;
  return <div style={{width:22,height:22,borderRadius:'50%',background:colors[idx],display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',fontWeight:700,flexShrink:0}}>{idx+1}</div>;
}
function Bar8({ done, color=C.green }) {
  return <div style={{display:'flex',gap:2}}>{[1,2,3,4,5,6,7,8].map(n=><div key={n} style={{flex:1,height:5,borderRadius:2,background:n<=done?color:'#e8e8e0'}}/>)}</div>;
}

function calcAlertes(eleves, allValidations, lang) {
  const alertes = [];
  const maintenant = new Date();
  const semaineDerniere = new Date(maintenant); semaineDerniere.setDate(maintenant.getDate()-7);
  const deuxSemaines = new Date(maintenant); deuxSemaines.setDate(maintenant.getDate()-14);
  eleves.forEach(e => {
    const vals = allValidations.filter(v => v.eleve_id === e.id);
    const valsSemaine = vals.filter(v => new Date(v.date_validation) >= semaineDerniere);
    const valsPrec = vals.filter(v => new Date(v.date_validation) >= deuxSemaines && new Date(v.date_validation) < semaineDerniere);
    const tomonS = valsSemaine.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
    const tomonP = valsPrec.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
    const joursSans = joursDepuis(vals[0]?.date_validation);
    if (tomonS===0 && tomonP>0) alertes.push({ type:'stagnation', eleve:e, msg:`${e.prenom} ${e.nom} — ${lang==='ar'?'لا استظهار هذا الأسبوع':'Aucune récitation cette semaine'}`, color:C.red, bg:C.redBg, icon:'📉' });
    if (tomonS>=6) alertes.push({ type:'rapide', eleve:e, msg:`${e.prenom} ${e.nom} — ${lang==='ar'?`أداء ممتاز: ${tomonS} أثمان`:`Excellente semaine — ${tomonS} Tomon`}`, color:C.green, bg:C.greenBg, icon:'🚀' });
    if (e.etat.enAttenteHizbComplet && joursSans>7) alertes.push({ type:'hizb_bloque', eleve:e, msg:`${e.prenom} ${e.nom} — ${lang==='ar'?`الحزب ${e.etat.hizbEnCours} في انتظار التصحيح منذ ${joursSans} يوم`:`Hizb ${e.etat.hizbEnCours} en attente depuis ${joursSans} jours`}`, color:C.amber, bg:C.amberBg, icon:'⏳' });
  });
  return alertes.sort((a,b)=>({stagnation:0,hizb_bloque:1,rapide:2}[a.type]||3)-({stagnation:0,hizb_bloque:1,rapide:2}[b.type]||3));
}

export default function Dashboard({ user, navigate, goBack, lang, isMobile=false }) {
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('general');
  const [stats, setStats] = useState({});
  const [exportMsg, setExportMsg] = useState('');
  const [selectedEleves, setSelectedEleves] = useState([]);
  const [searchEleve, setSearchEleve] = useState('');
  const [filtreInst, setFiltreInst] = useState('tous');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [filtreNiveau, setFiltreNiveau] = useState('tous');
  const [tri, setTri] = useState('points_desc');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: ed },{ data: id },{ data: vd }] = await Promise.all([
      supabase.from('eleves').select('id,prenom,nom,code_niveau,niveau,hizb_depart,tomon_depart,sourates_acquises,instituteur_referent_id,ecole_id').eq('ecole_id', user.ecole_id).order('nom'),
      supabase.from('utilisateurs').select('id,prenom,nom,role').eq('role','instituteur').eq('ecole_id', user.ecole_id),
      supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,tomon_debut,date_validation,valide_par,ecole_id,valideur:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false})
    ]);
    const elevesData = (ed||[]).map(eleve => {
      const vals = (vd||[]).filter(v=>v.eleve_id===eleve.id);
      const etat = calcEtatEleve(vals,eleve.hizb_depart,eleve.tomon_depart);
      const derniere = vals[0]?.date_validation||null;
      const inst = (id||[]).find(i=>i.id===eleve.instituteur_referent_id);
      return {...eleve,etat,derniere,jours:joursDepuis(derniere),instituteurNom:inst?`${inst.prenom} ${inst.nom}`:'—',instituteur:inst,inactif:isInactif(derniere)};
    });
    setEleves(elevesData); setInstituteurs(id||[]); setAllValidations(vd||[]); setStats(calcStats(vd||[])); setLoading(false);
  };

  const alertes = useMemo(() => calcAlertes(eleves, allValidations, lang), [eleves, allValidations, lang]);
  const totalPoints = eleves.reduce((s,e)=>s+e.etat.points.total,0);
  const totalTomon = eleves.reduce((s,e)=>s+e.etat.tomonCumul,0);
  const totalHizb = eleves.reduce((s,e)=>s+e.etat.hizbsComplets.size,0);
  const nbInactifs = eleves.filter(e=>e.inactif).length;
  const nbAttente = eleves.filter(e=>e.etat.enAttenteHizbComplet).length;
  const nbActifsSemaine = eleves.filter(e=>e.jours!=null&&e.jours<=7).length;
  const tauxSemaine = eleves.length>0 ? Math.round(nbActifsSemaine/eleves.length*100) : 0;
  const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);

  const recapMois = useMemo(() => {
    const vMois = allValidations.filter(v=>new Date(v.date_validation)>=debutMois);
    return { nbRecit: vMois.length, mois: new Date().toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{month:'long'}) };
  }, [allValidations, eleves]);

  const elevesFiltres = useMemo(() => {
    let list = [...eleves];
    if(searchEleve) list=list.filter(e=>`${e.prenom} ${e.nom}`.toLowerCase().includes(searchEleve.toLowerCase()));
    if(filtreInst!=='tous') list=list.filter(e=>e.instituteur_referent_id===filtreInst);
    if(filtreStatut==='actifs') list=list.filter(e=>!e.inactif);
    if(filtreStatut==='inactifs') list=list.filter(e=>e.inactif);
    if(filtreStatut==='attente') list=list.filter(e=>e.etat.enAttenteHizbComplet);
    if(filtreNiveau!=='tous') list=list.filter(e=>e.niveau===filtreNiveau);
    switch(tri){
      case 'points_desc': list.sort((a,b)=>b.etat.points.total-a.etat.points.total); break;
      case 'points_asc': list.sort((a,b)=>a.etat.points.total-b.etat.points.total); break;
      case 'hizb_desc': list.sort((a,b)=>b.etat.hizbEnCours-a.etat.hizbEnCours); break;
      case 'hizb_asc': list.sort((a,b)=>a.etat.hizbEnCours-b.etat.hizbEnCours); break;
      case 'nom_asc': list.sort((a,b)=>a.nom.localeCompare(b.nom)); break;
      case 'inactif': list.sort((a,b)=>(b.jours||0)-(a.jours||0)); break;
      case 'recente': list.sort((a,b)=>new Date(b.derniere||0)-new Date(a.derniere||0)); break;
      default: break;
    }
    return list;
  }, [eleves,searchEleve,filtreInst,filtreStatut,filtreNiveau,tri]);

  const statsInst = useMemo(() => instituteurs.map(inst => {
    const ei = eleves.filter(e=>e.instituteur_referent_id===inst.id);
    return {...inst,nbEleves:ei.length,totalPoints:ei.reduce((s,e)=>s+e.etat.points.total,0),totalTomon:ei.reduce((s,e)=>s+e.etat.tomonCumul,0),totalHizb:ei.reduce((s,e)=>s+e.etat.hizbsComplets.size,0),nbInactifs:ei.filter(e=>e.inactif).length,nbAttente:ei.filter(e=>e.etat.enAttenteHizbComplet).length,meilleur:[...ei].sort((a,b)=>b.etat.points.total-a.etat.points.total)[0]||null};
  }), [instituteurs,eleves]);

  const exportExcel = () => {
    const rang=[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total);
    const rows=[['#',t(lang,'prenom'),t(lang,'nom_label'),t(lang,'niveau'),t(lang,'referent'),t(lang,'hizb_en_cours'),t(lang,'tomon_valides'),lang==='ar'?'مجموع الثُّمن':'Total Tomon',lang==='ar'?'الأحزاب المكتملة':'Hizb complets',t(lang,'pts_label'),t(lang,'statut')],
      ...rang.map((e,idx)=>[idx+1,e.prenom,e.nom,e.niveau,e.instituteurNom,e.etat.hizbEnCours,e.etat.tomonDansHizbActuel,e.etat.tomonCumul,e.etat.hizbsComplets.size,e.etat.points.total,e.etat.enAttenteHizbComplet?t(lang,'attente_hizb'):e.inactif?t(lang,'inactif'):t(lang,'actif')])];
    const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download=`suivi-${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.csv`; a.click();
    setExportMsg('✓'); setTimeout(()=>setExportMsg(''),2000);
  };
  const backupJSON = async () => {
    const [{data:ea},{data:va},{data:ua}]=await Promise.all([supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id),supabase.from('validations').select('*').eq('ecole_id', user.ecole_id),supabase.from('utilisateurs').select('id,prenom,nom,identifiant,role')]);
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify({date:new Date().toISOString(),eleves:ea,validations:va,utilisateurs:ua},null,2)],{type:'application/json'})); a.download=`backup-${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.json`; a.click();
    setExportMsg('✓ Backup'); setTimeout(()=>setExportMsg(''),2000);
  };
  const tabs = [{key:'general',icon:'🏠',labelKey:'vue_generale'},{key:'eleves',icon:'👥',labelKey:'eleves'},{key:'instituteurs',icon:'👨‍🏫',labelKey:'instituteurs'},...(user.role==='surveillant'?[{key:'rapport',icon:'📊',labelKey:'rapport_tab'}]:[])];

  if (isMobile) {
    const podium = [...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).slice(0,3);
    const inactifs30 = eleves.filter(e=>e.jours!=null&&e.jours>30);
    const inactifs14 = eleves.filter(e=>e.jours!=null&&e.jours>14&&e.jours<=30);
    const sansRecit  = eleves.filter(e=>e.jours==null);
    const navModules = [
      {icon:'⚙️', label:lang==='ar'?'الإدارة':'Administration',  sub:lang==='ar'?'إدارة':'Gestion',        page:'gestion',            color:'#085041', bg:'#E1F5EE'},
      {icon:'💰', label:lang==='ar'?'المالية':'Finance',           sub:lang==='ar'?'الاشتراكات':'Cotisations',page:'finance',            color:'#E24B4A', bg:'#FCEBEB'},
      {icon:'👥', label:lang==='ar'?'الطلاب':'Élèves',            sub:`${eleves.length} ${lang==='ar'?'طالب':'inscrits'}`,            page:'gestion',  color:'#378ADD', bg:'#E6F1FB'},
      {icon:'🎯', label:lang==='ar'?'الأهداف':'Objectifs',         sub:lang==='ar'?'متابعة':'Suivi',          page:'objectifs',          color:'#534AB7', bg:'#EEEDFE'},
      {icon:'📊', label:lang==='ar'?'السجل':'السجل',               sub:lang==='ar'?'تحليل':'Historique',       page:'historique_seances', color:'#378ADD', bg:'#E6F1FB'},
      {icon:'📖', label:lang==='ar'?'مراجعة':"Murajaʼa",           sub:lang==='ar'?'جماعية':'Collective',      page:'muraja',             color:'#534AB7', bg:'#F0EEFF'},
      {icon:'📋', label:lang==='ar'?'التقرير الشهري':'Rapport mensuel', sub:lang==='ar'?'إحصائيات':'Statistiques',  page:'rapport_mensuel',    color:'#D85A30', bg:'#FAECE7'},
    ].filter(m => m.page!=='finance'||user.role==='surveillant')
     .filter(m => m.page!=='objectifs'||user.role==='surveillant')
     .filter(m => m.page!=='rapport_mensuel'||user.role==='surveillant');

    const podiumColors = ['#EF9F27','#B0B0B0','#CD7F32'];
    const podiumBg     = ['#FAEEDA','#f5f5f0','#f9f3ec'];
    const podiumH      = [80,60,44];
    const podiumOrder  = [1,0,2];

    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>

        {/* ── HEADER GRADIENT ── */}
        <div style={{background:'linear-gradient(135deg,#064e3b 0%,#085041 40%,#1D9E75 100%)',
          padding:'48px 18px 20px', position:'relative', overflow:'hidden'}}>
          {/* cercles décoratifs */}
          <div style={{position:'absolute',top:-30,right:-30,width:120,height:120,
            borderRadius:'50%',background:'rgba(255,255,255,0.06)'}}/>
          <div style={{position:'absolute',bottom:-20,left:-20,width:80,height:80,
            borderRadius:'50%',background:'rgba(255,255,255,0.04)'}}/>

          <div style={{fontSize:13,color:'rgba(255,255,255,0.75)',marginBottom:2,position:'relative'}}>
            {lang==='ar'?'مرحباً':'Bonjour'} {user.prenom} 👋
          </div>
          <div style={{fontSize:21,fontWeight:800,color:'#fff',marginBottom:16,position:'relative'}}>
            {lang==='ar'?'لوحة التحكم':'Tableau de bord'}
          </div>

          {/* KPIs row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,position:'relative'}}>
            {[
              {val:eleves.length,        lbl:lang==='ar'?'طالب':'Élèves'},
              {val:eleves.filter(e=>!e.inactif).length, lbl:lang==='ar'?'نشيط':'Actifs'},
              {val:nbInactifs,           lbl:lang==='ar'?'غير نشيط':'Inactifs', warn:nbInactifs>0},
              {val:instituteurs.length,  lbl:lang==='ar'?'أستاذ':'Profs'},
            ].map((k,i)=>(
              <div key={i} style={{background:'rgba(255,255,255,0.15)',borderRadius:12,
                padding:'10px 8px',textAlign:'center',backdropFilter:'blur(4px)'}}>
                <div style={{fontSize:22,fontWeight:800,color:k.warn?'#FAEEDA':'#fff'}}>{k.val}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.72)',marginTop:2}}>{k.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {loading ? <div style={{textAlign:'center',padding:'3rem',color:'#888'}}>...</div> : (<>

          {/* ── SCORE ÉCOLE ── */}
          <div style={{margin:'12px 12px 0',background:'linear-gradient(135deg,#085041,#1D9E75)',
            borderRadius:16,padding:'16px 18px',color:'#fff'}}>
            <div style={{fontSize:9,opacity:0.65,textTransform:'uppercase',letterSpacing:'2px',marginBottom:2}}>
              {t(lang,'score_ecole')}
            </div>
            <div style={{fontSize:38,fontWeight:800,letterSpacing:'-1.5px',lineHeight:1}}>
              {totalPoints.toLocaleString()}
            </div>
            <div style={{display:'flex',gap:20,marginTop:10}}>
              {[
                {v:totalTomon,          l:t(lang,'tomon_abrev')},
                {v:totalHizb,           l:t(lang,'hizb_abrev')},
                {v:tauxSemaine+'%',     l:lang==='ar'?'نشاط':'Activité'},
                {v:recapMois.nbRecit,   l:lang==='ar'?'هذا الشهر':'Ce mois'},
              ].map(k=>(
                <div key={k.l}>
                  <div style={{fontSize:16,fontWeight:700}}>{k.v}</div>
                  <div style={{fontSize:10,opacity:0.7}}>{k.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ALERTES ── */}
          <div style={{padding:'10px 12px 0'}}>
            {inactifs30.length>0&&(
              <div onClick={()=>navigate('inactifs')}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                  background:'#FCEBEB',borderRadius:12,marginBottom:8,cursor:'pointer',
                  border:'0.5px solid #E24B4A30'}}>
                <span style={{fontSize:18}}>🚨</span>
                <div style={{flex:1,fontSize:13,fontWeight:700,color:'#A32D2D'}}>
                  {inactifs30.length} {lang==='ar'?'طالب غائب +30 يوم':'inactif(s) depuis +30 jours'}
                </div>
                <span style={{color:'#E24B4A',fontSize:16}}>›</span>
              </div>
            )}
            {nbAttente>0&&(
              <div onClick={()=>navigate('inactifs')}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                  background:'#FAEEDA',borderRadius:12,marginBottom:8,cursor:'pointer',
                  border:'0.5px solid #EF9F2730'}}>
                <span style={{fontSize:18}}>⏳</span>
                <div style={{flex:1,fontSize:13,fontWeight:700,color:'#633806'}}>
                  {nbAttente} {lang==='ar'?'في انتظار تصحيح الحزب':'en attente validation Hizb'}
                </div>
                <span style={{color:'#EF9F27',fontSize:16}}>›</span>
              </div>
            )}
            {inactifs14.length>0&&!inactifs30.length&&(
              <div onClick={()=>navigate('inactifs')}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                  background:'#FFF3CD',borderRadius:12,marginBottom:8,cursor:'pointer',
                  border:'0.5px solid #EF9F2730'}}>
                <span style={{fontSize:18}}>⚠️</span>
                <div style={{flex:1,fontSize:13,fontWeight:700,color:'#856404'}}>
                  {inactifs14.length} {lang==='ar'?'طالب غائب 14-30 يوم':'inactif(s) depuis 14-30 jours'}
                </div>
                <span style={{color:'#EF9F27',fontSize:16}}>›</span>
              </div>
            )}
          </div>

          {/* ── NAVIGATION 6 MODULES ── */}
          <div style={{padding:'12px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
              letterSpacing:'1px',marginBottom:10}}>
              {lang==='ar'?'القائمة الرئيسية':'Navigation'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {navModules.map(m=>(
                <div key={m.page+m.label} onClick={()=>navigate(m.page)}
                  style={{background:'#fff',borderRadius:14,padding:'14px 10px',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:7,
                    border:'0.5px solid #e0e0d8',cursor:'pointer',
                    boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                  <div style={{width:40,height:40,borderRadius:12,background:m.bg,
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
                    {m.icon}
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:'#1a1a1a',textAlign:'center',
                    lineHeight:1.2}}>{m.label}</div>
                  <div style={{fontSize:10,color:'#888',textAlign:'center'}}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── STATS SEMAINE ── */}
          <div style={{padding:'12px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
              letterSpacing:'1px',marginBottom:10}}>
              {lang==='ar'?'إحصائيات الأسبوع':'Cette semaine'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
              {[
                {val:stats.tomonSemaine||0,  lbl:t(lang,'tomon_semaine'),       color:'#1D9E75',bg:'#E1F5EE'},
                {val:stats.hizbsCompletsMois||0,lbl:t(lang,'hizb_ce_mois'),     color:'#378ADD',bg:'#E6F1FB'},
                {val:tauxSemaine+'%',         lbl:lang==='ar'?'نسبة النشاط':'Taux activité',color:'#534AB7',bg:'#EEEDFE'},
                {val:recapMois.nbRecit,       lbl:lang==='ar'?'استظهارات الشهر':'Récit. ce mois',color:'#EF9F27',bg:'#FAEEDA'},
              ].map((k,i)=>(
                <div key={i} style={{background:k.bg,borderRadius:12,padding:'14px',textAlign:'center'}}>
                  <div style={{fontSize:28,fontWeight:800,color:k.color}}>{k.val}</div>
                  <div style={{fontSize:11,color:k.color,opacity:0.85,marginTop:4}}>{k.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── PODIUM TOP 3 ── */}
          {podium.length>=2&&(
            <div style={{padding:'12px 12px 4px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
                letterSpacing:'1px',marginBottom:10}}>
                {lang==='ar'?'المتصدرون':'Classement'}
              </div>
              <div style={{background:'#fff',borderRadius:16,padding:'16px 12px 12px',
                border:'0.5px solid #e0e0d8'}}>
                <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:6}}>
                  {podiumOrder.map(rank=>{
                    const e=podium[rank]; if(!e) return null;
                    return(
                      <div key={e.id} onClick={()=>navigate('fiche',e)}
                        style={{flex:1,display:'flex',flexDirection:'column',
                          alignItems:'center',cursor:'pointer'}}>
                        {rank===0&&<div style={{fontSize:18,marginBottom:4}}>👑</div>}
                        <div style={{width:rank===0?46:38,height:rank===0?46:38,borderRadius:'50%',
                          background:podiumBg[rank],display:'flex',alignItems:'center',
                          justifyContent:'center',fontWeight:700,fontSize:rank===0?14:12,
                          color:podiumColors[rank],border:`1.5px solid ${podiumColors[rank]}40`,
                          marginBottom:6}}>
                          {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                        </div>
                        <div style={{fontSize:11,fontWeight:600,textAlign:'center',
                          color:'#1a1a1a',maxWidth:80,overflow:'hidden',
                          textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {e.prenom}
                        </div>
                        <div style={{fontSize:rank===0?13:11,fontWeight:700,
                          color:podiumColors[rank],marginTop:2}}>
                          {e.etat.points.total.toLocaleString()}
                        </div>
                        <div style={{width:'100%',height:podiumH[rank],marginTop:6,
                          background:podiumBg[rank],borderRadius:'8px 8px 0 0',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          border:`0.5px solid ${podiumColors[rank]}30`}}>
                          <span style={{fontSize:rank===0?28:22,fontWeight:800,
                            color:podiumColors[rank],opacity:0.7}}>
                            {rank+1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div onClick={()=>navigate('honneur')}
                  style={{marginTop:12,textAlign:'center',padding:'8px',
                    background:'#f5f5f0',borderRadius:10,fontSize:12,
                    fontWeight:600,color:'#085041',cursor:'pointer'}}>
                  🏆 {lang==='ar'?'عرض الترتيب الكامل':'Voir classement complet'}
                </div>
              </div>
            </div>
          )}

          {/* ── ACTIVITÉ RÉCENTE ── */}
          <div style={{padding:'12px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
              letterSpacing:'1px',marginBottom:10}}>
              {lang==='ar'?'آخر الاستظهارات':'Activité récente'}
            </div>
            {allValidations.slice(0,5).map(v=>{
              const el=eleves.find(e=>e.id===v.eleve_id);
              const nc=getNiveauColor(el?.code_niveau||'1', niveaux||[])||'#888';
              return(
                <div key={v.id} onClick={()=>el&&navigate('fiche',el)}
                  style={{background:'#fff',borderRadius:12,padding:'11px 14px',
                    marginBottom:8,border:'0.5px solid #e0e0d8',
                    display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:`${nc}20`,
                    color:nc,display:'flex',alignItems:'center',justifyContent:'center',
                    fontWeight:700,fontSize:13,flexShrink:0}}>
                    {el?((el.prenom||'?')[0])+((el.nom||'?')[0]):'?'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13}}>
                      {el?`${el.prenom} ${el.nom}`:'—'}
                    </div>
                    <div style={{fontSize:11,color:'#888',marginTop:1}}>
                      {formatDateCourt(v.date_validation)}
                    </div>
                  </div>
                  <div>
                    {v.type_validation==='hizb_complet'
                      ? <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',
                          borderRadius:20,background:'#E1F5EE',color:'#085041'}}>
                          Hizb ✓
                        </span>
                      : <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',
                          borderRadius:20,background:'#E6F1FB',color:'#0C447C'}}>
                          {v.nombre_tomon} {t(lang,'tomon_abrev')}
                        </span>
                    }
                  </div>
                </div>
              );
            })}
            {allValidations.length===0&&(
              <div style={{textAlign:'center',color:'#aaa',padding:'1.5rem',
                background:'#fff',borderRadius:12,fontSize:13}}>
                {t(lang,'aucune_activite')}
              </div>
            )}
          </div>

          {/* ── ÉLÈVES À RELANCER ── */}
          {eleves.filter(e=>e.inactif).length>0&&(
            <div style={{padding:'12px 12px 16px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
                letterSpacing:'1px',marginBottom:10}}>
                {lang==='ar'?'يحتاجون متابعة':'À relancer'}
              </div>
              {[...eleves].filter(e=>e.inactif)
                .sort((a,b)=>(b.jours||0)-(a.jours||0)).slice(0,4).map(e=>(
                <div key={e.id} onClick={()=>navigate('fiche',e)}
                  style={{background:'#fff',borderRadius:12,padding:'11px 14px',
                    marginBottom:8,border:`0.5px solid ${e.jours>30?'#E24B4A30':'#EF9F2730'}`,
                    display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <div style={{width:38,height:38,borderRadius:'50%',
                    background:e.jours>30?'#FCEBEB':'#FAEEDA',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontWeight:700,fontSize:13,
                    color:e.jours>30?'#E24B4A':'#EF9F27',flexShrink:0}}>
                    {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13}}>{e.prenom} {e.nom}</div>
                    <div style={{fontSize:11,color:'#888'}}>{e.instituteurNom}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,
                    color:e.jours>30?'#E24B4A':'#EF9F27'}}>
                    {e.jours!=null?`${e.jours}j`:'∞'}
                  </div>
                </div>
              ))}
              {eleves.filter(e=>e.inactif).length>4&&(
                <div onClick={()=>navigate('inactifs')}
                  style={{textAlign:'center',padding:'10px',background:'#f5f5f0',
                    borderRadius:10,fontSize:12,fontWeight:600,color:'#666',cursor:'pointer'}}>
                  {lang==='ar'?'عرض الكل':'Voir tous'} ({eleves.filter(e=>e.inactif).length})
                </div>
              )}
            </div>
          )}

        </>)}
      </div>
    );
  }


  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:20,fontWeight:700}}>{t(lang,tabs.find(tb=>tb.key===vue)?.labelKey||'tableau_de_bord')}</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {exportMsg&&<span style={{fontSize:12,color:C.green,fontWeight:600}}>{exportMsg}</span>}
          {user.role==='surveillant'&&<><button onClick={exportExcel} style={{padding:'6px 10px',border:`0.5px solid ${C.border}`,borderRadius:8,background:'#fff',fontSize:11,cursor:'pointer'}}>📥 Excel</button><button onClick={backupJSON} style={{padding:'6px 10px',border:`0.5px solid ${C.border}`,borderRadius:8,background:'#fff',fontSize:11,cursor:'pointer'}}>💾 Backup</button></>}
          <button onClick={()=>navigate('honneur')} style={{padding:'6px 10px',background:C.green,color:'#fff',border:'none',borderRadius:8,fontSize:11,cursor:'pointer',fontWeight:600}}>🏆 {t(lang,'honneur')}</button>
          <button onClick={()=>navigate('comparaison')} style={{padding:'6px 10px',border:`0.5px solid ${C.border}`,borderRadius:8,background:'#fff',fontSize:11,cursor:'pointer'}}>📈 {t(lang,'comparer')}</button>
        </div>
      </div>
      <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3,marginBottom:'1.25rem',width:'fit-content',flexWrap:'wrap'}}>
        {tabs.map(tb=><div key={tb.key} onClick={()=>setVue(tb.key)} style={{padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:vue===tb.key?700:400,cursor:'pointer',background:vue===tb.key?'#fff':'transparent',color:vue===tb.key?C.dark:C.muted,border:vue===tb.key?`0.5px solid ${C.border}`:'none',transition:'all 0.15s',whiteSpace:'nowrap'}}>{tb.icon} {t(lang,tb.labelKey)}</div>)}
      </div>
      {loading&&<div className="loading">...</div>}
      {!loading&&vue==='general'&&(
        <>
          <div style={{background:'linear-gradient(135deg,#085041 0%,#1D9E75 100%)',borderRadius:16,padding:'1.5rem',marginBottom:'1.25rem',color:'#fff',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',right:-20,top:-20,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.05)'}}/>
            <div style={{fontSize:10,opacity:0.7,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6}}>{t(lang,'score_ecole')}</div>
            <div style={{fontSize:44,fontWeight:800,letterSpacing:'-2px',lineHeight:1}}>{totalPoints.toLocaleString()}</div>
            <div style={{fontSize:12,opacity:0.7,marginTop:4,marginBottom:14}}>{t(lang,'points_cumules')}</div>
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
              {[{v:totalTomon,l:t(lang,'tomon_recites')},{v:totalHizb,l:t(lang,'hizb_complets')},{v:eleves.length,l:t(lang,'eleves')},{v:instituteurs.length,l:t(lang,'instituteurs')}].map(k=>(
                <div key={k.l}><div style={{fontSize:20,fontWeight:700}}>{k.v}</div><div style={{fontSize:11,opacity:0.65}}>{k.l}</div></div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#fff',borderRadius:10,marginBottom:8,border:'0.5px solid '+C.border}}>
            <div style={{flex:1}}><span style={{fontSize:12,color:C.muted}}>{lang==='ar'?'شهر ':'Mois de '}{recapMois.mois} — </span><span style={{fontSize:12,fontWeight:600,color:C.green}}>{recapMois.nbRecit} {lang==='ar'?'استظهار':'récitations'}</span></div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{fontSize:11,color:C.muted}}>{lang==='ar'?'نشاط الأسبوع':'Actifs semaine'}</div>
              <div style={{padding:'3px 10px',borderRadius:20,background:tauxSemaine>=70?C.greenBg:tauxSemaine>=40?C.amberBg:C.redBg,color:tauxSemaine>=70?C.green:tauxSemaine>=40?C.amber:C.red,fontSize:13,fontWeight:700}}>{tauxSemaine}%</div>
            </div>
          </div>
          <div>
            {eleves.filter(e=>e.jours!=null&&e.jours>30).length>0&&(<div onClick={()=>navigate('inactifs')} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#FCEBEB',borderRadius:12,marginBottom:8,cursor:'pointer',border:'1.5px solid #E24B4A30'}}><span style={{fontSize:20}}>🚨</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:'#E24B4A'}}>{eleves.filter(e=>e.jours!=null&&e.jours>30).length} {lang==='ar'?'طالب غائب أكثر من 30 يوماً':'élève(s) inactif(s) depuis +30 jours'}</div><div style={{fontSize:11,color:'#E24B4A',opacity:0.7}}>{lang==='ar'?'انقر لعرض القائمة':'Cliquer pour voir la liste'}</div></div><span style={{fontSize:11,color:'#E24B4A',fontWeight:600}}>›</span></div>)}
            {eleves.filter(e=>e.jours!=null&&e.jours>14&&e.jours<=30).length>0&&(<div onClick={()=>navigate('inactifs')} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#FFF3CD',borderRadius:12,marginBottom:8,cursor:'pointer',border:'1.5px solid #EF9F2730'}}><span style={{fontSize:20}}>⚠️</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:'#856404'}}>{eleves.filter(e=>e.jours!=null&&e.jours>14&&e.jours<=30).length} {lang==='ar'?'طالب غائب 14-30 يوماً':'élève(s) inactif(s) depuis 14-30 jours'}</div></div><span style={{fontSize:11,color:'#856404',fontWeight:600}}>›</span></div>)}
            {eleves.filter(e=>e.jours==null).length>0&&(<div onClick={()=>navigate('inactifs')} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#F0EEFF',borderRadius:12,marginBottom:8,cursor:'pointer',border:'1.5px solid #534AB730'}}><span style={{fontSize:20}}>📋</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:'#534AB7'}}>{eleves.filter(e=>e.jours==null).length} {lang==='ar'?'طالب لم يستظهر بعد':'élève(s) sans aucune récitation'}</div></div><span style={{fontSize:11,color:'#534AB7',fontWeight:600}}>›</span></div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:'1.25rem'}}>
            {[{val:stats.tomonSemaine||0,lbl:t(lang,'tomon_semaine'),color:C.green},{val:stats.hizbsCompletsMois||0,lbl:t(lang,'hizb_ce_mois'),color:C.blue},{val:nbAttente,lbl:t(lang,'attente_hizb'),color:C.amber},{val:nbInactifs,lbl:t(lang,'inactifs'),color:C.red}].map((k,i)=>(
              <div key={i} style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:12,padding:'12px',borderTop:`3px solid ${k.color}`}}>
                <div style={{fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4}}>{k.lbl}</div>
              </div>
            ))}
          </div>
          {alertes.length>0&&(<><div className="section-label">{t(lang,'alertes')} ({alertes.length})</div><div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:'1.25rem'}}>{alertes.slice(0,5).map((a,i)=>(<div key={i} onClick={()=>navigate('fiche',a.eleve)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:a.bg,borderLeft:`4px solid ${a.color}`,borderRadius:'0 10px 10px 0',cursor:'pointer'}}><span style={{fontSize:18}}>{a.icon}</span><span style={{fontSize:13,color:a.color,flex:1}}>{a.msg}</span><span style={{fontSize:11,color:a.color,opacity:0.6}}>›</span></div>))}</div></>)}
          <div className="section-label">{t(lang,'podium')}</div>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:10,marginBottom:'1.5rem'}}>
            {[1,0,2].map(rank=>{
              const e=[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total)[rank];
              if(!e) return null;
              const pc=['#EF9F27','#B0B0B0','#CD7F32'],pb=['#FAEEDA','#f5f5f0','#f9f3ec'],ph=[140,110,90];
              return(<div key={e.id} onClick={()=>navigate('fiche',e)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',maxWidth:160}}>{rank===0&&<div style={{fontSize:20,marginBottom:2}}>👑</div>}<Avatar prenom={e.prenom} nom={e.nom} size={rank===0?52:42} bg={pb[rank]} color={pc[rank]}/><div style={{fontSize:rank===0?13:12,fontWeight:600,marginTop:6,textAlign:'center'}}>{e.prenom} {e.nom}</div><div style={{fontSize:rank===0?15:13,fontWeight:700,color:pc[rank],margin:'4px 0'}}>{e.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</div><div style={{width:'100%',height:ph[rank],background:pb[rank],border:`0.5px solid ${pc[rank]}40`,borderRadius:'8px 8px 0 0',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:rank===0?36:28,fontWeight:800,color:pc[rank],opacity:0.7}}>{rank+1}</span></div></div>);
            })}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
            <div><div className="section-label">{t(lang,'a_relancer')}</div>{eleves.filter(e=>e.inactif).length===0?<div style={{padding:'1rem',background:C.greenBg,borderRadius:10,fontSize:13,color:'#085041',textAlign:'center'}}>{t(lang,'tous_actifs')}</div>:(<div style={{display:'flex',flexDirection:'column',gap:6}}>{[...eleves].filter(e=>e.inactif).sort((a,b)=>(b.jours||0)-(a.jours||0)).slice(0,5).map(e=>(<div key={e.id} onClick={()=>navigate('fiche',e)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:e.jours>30?C.redBg:C.amberBg,borderRadius:10,cursor:'pointer'}}><Avatar prenom={e.prenom} nom={e.nom} size={30} bg="transparent" color={e.jours>30?C.red:'#633806'}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:e.jours>30?C.red:'#412402'}}>{e.prenom} {e.nom}</div><div style={{fontSize:11,color:e.jours>30?'#A32D2D':'#854F0B',opacity:0.8}}>{e.instituteurNom}</div></div><div style={{fontSize:13,fontWeight:700,color:e.jours>30?C.red:'#633806'}}>{e.jours!=null?`${e.jours} ${t(lang,'jour')}`:'∞'}</div></div>))}</div>)}</div>
            <div><div className="section-label">{t(lang,'attente_hizb')}</div>{nbAttente===0?<div style={{padding:'1rem',background:C.greenBg,borderRadius:10,fontSize:13,color:'#085041',textAlign:'center'}}>{t(lang,'aucun_attente')}</div>:(<div style={{display:'flex',flexDirection:'column',gap:6}}>{eleves.filter(e=>e.etat.enAttenteHizbComplet).map(e=>(<div key={e.id} onClick={()=>navigate('enregistrer',e)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:C.amberBg,border:`0.5px solid ${C.amber}40`,borderRadius:10,cursor:'pointer'}}><Avatar prenom={e.prenom} nom={e.nom} size={30} bg="#FAC775" color="#412402"/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:'#412402'}}>{e.prenom} {e.nom}</div><div style={{fontSize:11,color:'#854F0B'}}>Hizb {e.etat.hizbEnCours} · {e.instituteurNom}</div></div><span style={{fontSize:10,background:C.amber,color:'#fff',borderRadius:20,padding:'2px 8px',fontWeight:600}}>{t(lang,'valider')}</span></div>))}</div>)}</div>
          </div>
          <div className="section-label">{t(lang,'activite_recente')}</div>
          <div className="table-wrap"><table><thead><tr><th style={{width:'18%'}}>{lang==='ar'?'التاريخ':'Date'}</th><th style={{width:'28%'}}>{t(lang,'eleve')}</th><th style={{width:'30%'}}>{lang==='ar'?'الاستظهار':'Validation'}</th><th style={{width:'24%'}}>{t(lang,'valide_par')}</th></tr></thead><tbody>{allValidations.slice(0,8).length===0&&<tr><td colSpan={4} className="empty">{t(lang,'aucune_activite')}</td></tr>}{allValidations.slice(0,8).map(v=>{const e=eleves.find(el=>el.id===v.eleve_id);return(<tr key={v.id} className={e?'clickable':''} onClick={()=>e&&navigate('fiche',e)}><td style={{fontSize:12,color:C.muted}}>{formatDateCourt(v.date_validation)}</td><td>{e?<div style={{display:'flex',alignItems:'center',gap:6}}><Avatar prenom={e.prenom} nom={e.nom} size={22}/><span style={{fontSize:13}}>{e.prenom} {e.nom}</span></div>:'—'}</td><td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb {v.hizb_valide} {lang==='ar'?'مكتمل':'complet'}</span>:<span className="badge badge-blue">{v.nombre_tomon} {t(lang,'tomon_abrev')}{v.tomon_debut?` (T.${v.tomon_debut}→${v.tomon_debut+v.nombre_tomon-1})`:''}</span>}</td><td style={{fontSize:12,color:C.muted}}>{v.valideur?`${v.valideur.prenom} ${v.valideur.nom}`:'—'}</td></tr>);})}</tbody></table></div>
        </>
      )}
      {!loading&&vue==='eleves'&&(
        <>
          {selectedEleves.length>0&&(<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:C.blueBg,border:`0.5px solid ${C.blue}`,borderRadius:10,marginBottom:'1rem'}}><span style={{fontSize:12,color:'#0C447C'}}>{selectedEleves.length} {t(lang,'eleves')}</span><button onClick={()=>navigate('comparaison',selectedEleves)} style={{padding:'4px 12px',background:C.blue,color:'#fff',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',marginLeft:'auto'}}>📈 {t(lang,'comparer')}</button><button onClick={()=>setSelectedEleves([])} style={{padding:'4px 10px',border:`0.5px solid ${C.border}`,borderRadius:6,background:'#fff',fontSize:11,cursor:'pointer'}}>✕</button></div>)}
          <div style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
              <input className="field-input" style={{flex:2,minWidth:160}} placeholder={t(lang,'rechercher_eleve')} value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}/>
              <select className="field-select" style={{flex:1,minWidth:130}} value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}><option value="tous">{t(lang,'tous_instituteurs')}</option>{instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}</select>
              <select className="field-select" style={{flex:1,minWidth:110}} value={filtreStatut} onChange={e=>setFiltreStatut(e.target.value)}><option value="tous">{t(lang,'tous_statuts')}</option><option value="actifs">{t(lang,'actifs')}</option><option value="inactifs">{t(lang,'inactifs_filter')}</option><option value="attente">{t(lang,'attente_filter')}</option></select>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {[['points_desc',t(lang,'tri_score_desc')],['points_asc',t(lang,'tri_score_asc')],['hizb_desc',t(lang,'tri_hizb_desc')],['hizb_asc',t(lang,'tri_hizb_asc')],['nom_asc',t(lang,'tri_nom')],['recente',t(lang,'tri_recente')],['inactif',t(lang,'tri_inactif')]].map(([k,l])=>(
                <div key={k} onClick={()=>setTri(k)} style={{padding:'4px 12px',borderRadius:20,fontSize:11,cursor:'pointer',background:tri===k?C.greenBg:'#f5f5f0',color:tri===k?'#085041':C.muted,border:`0.5px solid ${tri===k?C.green:C.border}`,fontWeight:tri===k?500:400}}>{l}</div>
              ))}
              <span style={{fontSize:11,color:C.muted,marginLeft:'auto'}}>{elevesFiltres.length} {t(lang,'eleves')}</span>
            </div>
          </div>
          {elevesFiltres.length===0?<div className="empty">{t(lang,'aucun_eleve')}</div>:(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
              {elevesFiltres.map(eleve=>{
                const rang=[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).findIndex(e=>e.id===eleve.id)+1;
                const sl=scoreLabel(eleve.etat.points.total);
                const isSelected=selectedEleves.find(s=>s.id===eleve.id);
                return(
                  <div key={eleve.id} style={{background:'#fff',border:`${isSelected?'2px':'0.5px'} solid ${isSelected?C.blue:eleve.etat.enAttenteHizbComplet?C.amber:eleve.inactif?C.red:C.border}`,borderRadius:14,padding:'1.25rem',cursor:'pointer',transition:'transform 0.15s',position:'relative'}}
                    onMouseEnter={ev=>ev.currentTarget.style.transform='translateY(-2px)'}
                    onMouseLeave={ev=>ev.currentTarget.style.transform='translateY(0)'}>
                    <div onClick={e=>{e.stopPropagation();const isS=selectedEleves.find(s=>s.id===eleve.id);if(isS)setSelectedEleves(selectedEleves.filter(s=>s.id!==eleve.id));else if(selectedEleves.length<6)setSelectedEleves([...selectedEleves,eleve]);}} style={{position:'absolute',top:10,left:10,width:18,height:18,borderRadius:4,border:`1.5px solid ${isSelected?C.blue:C.border}`,background:isSelected?C.blue:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>{isSelected&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}</div>
                    <div onClick={()=>navigate('fiche',eleve)}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12,paddingLeft:24}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <Avatar prenom={eleve.prenom} nom={eleve.nom} size={42} bg={sl.bg} color={sl.color}/>
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}><div style={{fontSize:14,fontWeight:600}}>{eleve.prenom} {eleve.nom}</div><NiveauBadge code={eleve.code_niveau}/></div>
                            <div style={{fontSize:11,color:C.muted}}>{eleve.instituteurNom}</div>
                            <span style={{padding:'1px 8px',borderRadius:20,fontSize:10,fontWeight:500,background:sl.bg,color:sl.color}}>{sl.label}</span>
                          </div>
                        </div>
                        <Medaille idx={rang-1}/>
                      </div>
                      <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:10}}><span style={{fontSize:28,fontWeight:800,color:sl.color,letterSpacing:'-1px'}}>{eleve.etat.points.total.toLocaleString()}</span><span style={{fontSize:12,color:C.muted}}>{t(lang,'pts_abrev')}</span></div>
                      {['5B','5A','2M'].includes(eleve.code_niveau||'')?(<div style={{fontSize:11,color:C.muted,marginBottom:6}}>{lang==='ar'?'سور':lang==='en'?'Surahs':'Sourates'}</div>):(<div style={{fontSize:11,color:C.muted,marginBottom:6}}>Hizb {eleve.etat.hizbEnCours} · {eleve.etat.tomonCumul} {t(lang,'tomon_abrev')} · {eleve.etat.hizbsComplets.size} {t(lang,'hizb_abrev')}</div>)}
                      <Bar8 done={eleve.etat.tomonDansHizbActuel} color={eleve.etat.enAttenteHizbComplet?C.amber:C.green}/>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                        <div style={{fontSize:11,color:C.muted}}>{eleve.derniere?formatDateCourt(eleve.derniere):t(lang,'jamais')}</div>
                        {eleve.etat.enAttenteHizbComplet?<span className="badge badge-amber" style={{fontSize:9}}>{t(lang,'en_attente')}</span>:eleve.inactif?<span className="badge badge-alert" style={{fontSize:9}}>{eleve.jours}{t(lang,'jours')}</span>:<span className="badge badge-green" style={{fontSize:9}}>{t(lang,'actif')}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {!loading&&vue==='instituteurs'&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
          {statsInst.sort((a,b)=>b.totalPoints-a.totalPoints).map((inst,idx)=>(
            <div key={inst.id} style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:14,padding:'1.25rem',cursor:'pointer'}} onClick={()=>navigate('profil_instituteur',inst)}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}><Avatar prenom={inst.prenom} nom={inst.nom} size={48}/><div style={{flex:1}}><div style={{fontSize:15,fontWeight:600}}>{inst.prenom} {inst.nom}</div><div style={{fontSize:11,color:C.muted}}>{inst.nbEleves} {t(lang,'eleves_referents')} · {t(lang,'voir_profil')}</div></div><Medaille idx={idx}/></div>
              <div style={{background:C.greenBg,borderRadius:10,padding:'12px',marginBottom:12,textAlign:'center'}}><div style={{fontSize:10,color:'#0F6E56',textTransform:'uppercase',letterSpacing:'1px',marginBottom:2}}>{t(lang,'score_groupe')}</div><div style={{fontSize:30,fontWeight:800,color:'#085041',letterSpacing:'-1px'}}>{inst.totalPoints.toLocaleString()}</div></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:12}}>{[{l:t(lang,'tomon_abrev'),v:inst.totalTomon,bg:C.blueBg,c:'#0C447C'},{l:t(lang,'hizb_abrev'),v:inst.totalHizb,bg:C.greenBg,c:'#085041'},{l:t(lang,'inactifs_filter'),v:inst.nbInactifs,bg:inst.nbInactifs>0?C.redBg:'#f9f9f6',c:inst.nbInactifs>0?'#A32D2D':'#bbb'},{l:t(lang,'en_attente'),v:inst.nbAttente,bg:inst.nbAttente>0?C.amberBg:'#f9f9f6',c:inst.nbAttente>0?'#633806':'#bbb'}].map(s=>(<div key={s.l} style={{background:s.bg,borderRadius:8,padding:'8px 4px',textAlign:'center'}}><div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:s.c,opacity:0.8}}>{s.l}</div></div>))}</div>
              {inst.meilleur&&<div style={{borderTop:`0.5px solid ${C.border}`,paddingTop:10}}><div style={{fontSize:10,color:C.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:'1px'}}>{t(lang,'meilleur_eleve')}</div><div onClick={e=>{e.stopPropagation();navigate('fiche',inst.meilleur);}} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><Avatar prenom={inst.meilleur.prenom} nom={inst.meilleur.nom} size={28} bg="#FAEEDA" color="#412402"/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{inst.meilleur.prenom} {inst.meilleur.nom}</div><div style={{fontSize:11,color:C.muted}}>Hizb {inst.meilleur.etat.hizbEnCours} · {inst.meilleur.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</div></div></div></div>}
            </div>
          ))}
        </div>
      )}
      {!loading&&vue==='rapport'&&user.role==='surveillant'&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:'1.5rem'}}>{[{val:totalPoints.toLocaleString(),lbl:t(lang,'score_total'),color:C.green},{val:stats.hizbsCompletsMois||0,lbl:t(lang,'hizb_ce_mois'),color:C.blue},{val:stats.tomonSemaine||0,lbl:t(lang,'tomon_semaine'),color:C.amber},{val:stats.recitationsMois||0,lbl:t(lang,'recitations_ce_mois'),color:C.muted}].map((k,i)=>(<div key={i} style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px',borderTop:`3px solid ${k.color}`}}><div style={{fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{k.lbl}</div></div>))}</div>
          <div className="section-label">{t(lang,'classement_complet')}</div>
          <div className="table-wrap" style={{marginBottom:'1.5rem'}}><table><thead><tr><th style={{width:'5%'}}>#</th><th style={{width:'22%'}}>{t(lang,'eleve')}</th><th style={{width:'14%'}}>{t(lang,'niveau')}</th><th style={{width:'15%'}}>{t(lang,'referent')}</th><th style={{width:'10%'}}>{t(lang,'hizb_en_cours')}</th><th style={{width:'8%'}}>{t(lang,'tomon_abrev')}</th><th style={{width:'10%'}}>{t(lang,'hizb_complets')}</th><th style={{width:'16%'}}>{t(lang,'score_total')}</th></tr></thead><tbody>{[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).map((e,idx)=>{const sl=scoreLabel(e.etat.points.total);return(<tr key={e.id} className="clickable" onClick={()=>navigate('fiche',e)}><td><Medaille idx={idx}/></td><td><div style={{display:'flex',alignItems:'center',gap:6}}><Avatar prenom={e.prenom} nom={e.nom} size={24}/><span style={{fontSize:13}}>{e.prenom} {e.nom}</span></div></td><td><span className={`badge ${['Avancé','Advanced','متقدم'].some(v=>v.toLowerCase()===e.niveau?.toLowerCase())?'badge-green':['Intermédiaire','Intermediate','متوسط'].some(v=>v.toLowerCase()===e.niveau?.toLowerCase())?'badge-blue':'badge-amber'}`} style={{fontSize:10}}>{niveauTraduit(e.niveau,lang,t)}</span></td><td style={{fontSize:11,color:C.muted}}>{e.instituteurNom}</td><td style={{fontSize:12}}>Hizb {e.etat.hizbEnCours}</td><td><span className="badge badge-blue" style={{fontSize:10}}>{e.etat.tomonCumul}</span></td><td><span className="badge badge-green" style={{fontSize:10}}>{e.etat.hizbsComplets.size}</span></td><td><span style={{fontSize:13,fontWeight:700,color:sl.color}}>{e.etat.points.total.toLocaleString()}</span></td></tr>);})}</tbody></table></div>
        </>
      )}
    </div>
  );
}
