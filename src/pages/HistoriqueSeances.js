import React, { useState, useEffect } from 'react';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { getInitiales, joursDepuis, scoreLabel, formatDateCourt , loadBareme, BAREME_DEFAUT } from '../lib/helpers';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';

const IS_SOURATE = (code) => ['5B','5A','2M'].includes(code||'');
const NIVEAU_COLORS = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };

function Avatar({ prenom, nom, size=36, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}
function NiveauBadge({ code }) {
  const c = NIVEAU_COLORS[code||'1']||'#888';
  return <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:c+'18',color:c,border:'0.5px solid '+c+'30'}}>{code}</span>;
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

const PERIODES = [
  { label: 'Aujourd\'hui', labelAr: 'اليوم', jours: 0 },
  { label: 'Hier', labelAr: 'أمس', jours: 1 },
  { label: '7 jours', labelAr: '7 أيام', jours: 7 },
  { label: '15 jours', labelAr: '15 يوم', jours: 15 },
  { label: 'Mois', labelAr: 'شهر', jours: 30 },
  { label: 'Trimestre', labelAr: 'فصل', jours: 90 },
];

export default function HistoriqueSeances({ user, navigate, goBack, lang='fr', isMobile , niveaux=[] }) {
  const { toast } = useToast();
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [validations, setValidations] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [objectifs, setObjectifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bareme, setBareme] = React.useState({...BAREME_DEFAUT});

  const [dateDebut, setDateDebut] = useState(() => { const d=new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]; });
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterNiveau, setFilterNiveau] = useState('tous');
  const [filterInstituteur, setFilterInstituteur] = useState('tous');
  const [filterEleve, setFilterEleve] = useState('tous');
  const [filterType, setFilterType] = useState('tous');
  const [periodeActive, setPeriodeActive] = useState(2);
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [drillDown, setDrillDown] = useState(false);
  const [searchEleve, setSearchEleve] = useState('');
  const [searchFiltreEleve, setSearchFiltreEleve] = useState('');

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (filterEleve !== 'tous') {
      setSelectedEleve(filterEleve);
      setDrillDown(true);
    } else {
      setDrillDown(false);
      setSelectedEleve(null);
    }
  }, [filterEleve]);

  const loadData = async () => {
    loadBareme(supabase, user.ecole_id).then(b=>setBareme({...BAREME_DEFAUT,...b.unites}));
    setLoading(true);
    try {
      const [r1, r2, r3Data, r4Data, r5, r6] = await Promise.all([
        supabase.from('eleves').select('*')
        .eq('ecole_id', user.ecole_id).order('nom'),
        supabase.from('utilisateurs').select('*').eq('role','instituteur').eq('ecole_id', user.ecole_id),
        fetchAll(supabase.from('validations').select('*, valideur:valide_par(prenom,nom)')
          .eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false})),
        fetchAll(supabase.from('recitations_sourates').select('*, valideur:valide_par(prenom,nom)')
          .eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false})),
        supabase.from('sourates').select('*'),
        supabase.from('objectifs_globaux').select('*')
        .eq('ecole_id', user.ecole_id).order('created_at',{ascending:false}),
      ]);
      setEleves(r1.data||[]);
      setInstituteurs(r2.data||[]);
      setValidations(r3Data||[]);
      setRecitations(r4Data||[]);
      setSouratesDB(r5.data||[]);
      setObjectifs(r6.data||[]);
    } catch(e) { toast.error('Erreur de chargement'); }
    setLoading(false);
  };

  const setPeriodeRapide = (idx) => {
    setPeriodeActive(idx);
    const p = PERIODES[idx];
    const fin = new Date();
    const debut = new Date();
    if (p.jours === 1) { debut.setDate(debut.getDate()-1); fin.setDate(fin.getDate()-1); }
    else debut.setDate(debut.getDate()-p.jours);
    setDateDebut(debut.toISOString().split('T')[0]);
    setDateFin(fin.toISOString().split('T')[0]);
  };

  const debut = new Date(dateDebut); debut.setHours(0,0,0,0);
  const fin = new Date(dateFin); fin.setHours(23,59,59,999);

  const elevesVisibles = eleves.filter(e => {
    if (filterNiveau !== 'tous' && (e.code_niveau||'1') !== filterNiveau) return false;
    if (filterInstituteur !== 'tous' && e.instituteur_referent_id !== filterInstituteur) return false;
    if (user.role === 'instituteur' && e.instituteur_referent_id !== user.id) return false;
    return true;
  });
  const elevesVisiblesIds = new Set(elevesVisibles.map(e=>e.id));

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

  const recsFiltrees = recitations.filter(r => {
    const d = new Date(r.date_validation);
    if (d < debut || d > fin) return false;
    if (!elevesVisiblesIds.has(r.eleve_id)) return false;
    if (filterEleve !== 'tous' && r.eleve_id !== filterEleve) return false;
    if (filterType === 'sourate' && r.type_recitation !== 'complete') return false;
    if (filterType === 'sequence' && r.type_recitation !== 'sequence') return false;
    if (filterType === 'tomon' || filterType === 'hizb') return false;
    return true;
  });

  const tomonTotal = valsFiltrees.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
  const hizbTotal = valsFiltrees.filter(v=>v.type_validation==='hizb_complet').length;
  const souratesTotal = recsFiltrees.filter(r=>r.type_recitation==='complete').length;
  const sequencesTotal = recsFiltrees.filter(r=>r.type_recitation==='sequence').length;
  const ptsTotal = tomonTotal*(bareme.tomon||10)+Math.floor(tomonTotal/2)*25+Math.floor(tomonTotal/4)*60+hizbTotal*100+recsFiltrees.reduce((s,r)=>s+(r.points||0),0);
  const elevesActifs = new Set([...valsFiltrees.map(v=>v.eleve_id),...recsFiltrees.map(r=>r.eleve_id)]);
  const joursActifs = new Set([...valsFiltrees,...recsFiltrees].map(x=>new Date(x.date_validation).toDateString())).size;

  const duree = Math.max(1,Math.ceil((fin-debut)/(1000*60*60*24)));
  const debutPrec = new Date(debut); debutPrec.setDate(debutPrec.getDate()-duree);
  const finPrec = new Date(debut); finPrec.setDate(finPrec.getDate()-1);
  const valsPrec = validations.filter(v=>{const d=new Date(v.date_validation);return d>=debutPrec&&d<=finPrec&&elevesVisiblesIds.has(v.eleve_id);});
  const recsPrec = recitations.filter(r=>{const d=new Date(r.date_validation);return d>=debutPrec&&d<=finPrec&&elevesVisiblesIds.has(r.eleve_id);});
  const ptsPrec = valsPrec.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0)*10+recsPrec.reduce((s,r)=>s+(r.points||0),0);
  const ptsDelta = ptsTotal - ptsPrec;

  const statsParEleve = (elevesVisibles||[]).map(eleve => {
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
    const objEleve = objectifs.find(o=>o.type_cible==='eleve'&&o.eleve_id===eleve.id&&new Date(o.date_debut)<=fin&&new Date(o.date_fin)>=debut);
    const objNiveau = objectifs.find(o=>o.type_cible==='niveau'&&o.code_niveau===(eleve.code_niveau||'1')&&new Date(o.date_debut)<=fin&&new Date(o.date_fin)>=debut);
    const obj = objEleve||objNiveau;
    let pctObj = null;
    if (obj) {
      let r = 0;
      if (obj.metrique==='tomon') r=tomon;
      else if (obj.metrique==='hizb') r=hizb;
      else if (obj.metrique==='sourate') r=sourates;
      else if (obj.metrique==='sequence') r=seqs;
      else if (obj.metrique==='points') r=pts;
      else if (obj.metrique==='seances') r=nbSeances;
      pctObj = Math.min(100,Math.round(r/obj.valeur_cible*100));
    }
    const vEPrec = valsPrec.filter(v=>v.eleve_id===eleve.id);
    const rEPrec = recsPrec.filter(r=>r.eleve_id===eleve.id);
    const ptsPrec2 = vEPrec.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0)*10+rEPrec.reduce((s,r)=>s+(r.points||0),0);
    const trend = pts>ptsPrec2?'up':pts<ptsPrec2?'down':'stable';
    const inst = instituteurs.find(i=>i.id===eleve.instituteur_referent_id);
    return { eleve, tomon, hizb, sourates, seqs, pts, nbSeances, derniere, isSourate, obj, pctObj, trend, instituteurNom:inst?inst.prenom+' '+inst.nom:'—' };
  });

  const actifs = (statsParEleve||[]).filter(s=>s.pts>0||s.nbSeances>0).sort((a,b)=>b.pts-a.pts);
  const inactifs = (statsParEleve||[]).filter(s=>s.pts===0&&s.nbSeances===0);

  const timeline = {};
  [...valsFiltrees,...recsFiltrees].forEach(item=>{
    const key=new Date(item.date_validation).toISOString().split('T')[0];
    if(!timeline[key]) timeline[key]={date:key,pts:0,tomon:0,hizb:0,sourate:0,seq:0};
    if(item.type_validation==='tomon'){timeline[key].tomon+=item.nombre_tomon;timeline[key].pts+=item.nombre_tomon*(bareme.tomon||10);}
    else if(item.type_validation==='hizb_complet'){timeline[key].hizb++;timeline[key].pts+=(bareme.hizb_complet||100);}
    else if(item.type_recitation==='complete'){timeline[key].sourate++;timeline[key].pts+=(item.points||30);}
    else if(item.type_recitation==='sequence'){timeline[key].seq++;timeline[key].pts+=(item.points||10);}
  });
  const timelineArr = Object.values(timeline).sort((a,b)=>a.date.localeCompare(b.date));
  const maxPtsDay = Math.max(...timelineArr.map(d=>d.pts),1);

  const eleveDrillDown = selectedEleve ? eleves.find(e=>e.id===selectedEleve) : null;
  const valsDrill = selectedEleve ? validations.filter(v=>v.eleve_id===selectedEleve&&new Date(v.date_validation)>=debut&&new Date(v.date_validation)<=fin) : [];
  const recsDrill = selectedEleve ? recitations.filter(r=>r.eleve_id===selectedEleve&&new Date(r.date_validation)>=debut&&new Date(r.date_validation)<=fin) : [];
  const allDrill = [...valsDrill,...recsDrill].sort((a,b)=>new Date(b.date_validation)-new Date(a.date_validation));

  // Export Excel
  const exportExcel = async () => {
    if (!window.XLSX) {
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload=resolve; s.onerror=reject;
        document.head.appendChild(s);
      });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const dataToExport = filterEleve!=='tous' ? actifs.filter(s=>s.eleve.id===filterEleve) : actifs;
    const filtreNom = filterEleve!=='tous' ? (eleves.find(e=>e.id===filterEleve)||{prenom:'',nom:''}) : null;

    const ws1 = XLSX.utils.aoa_to_sheet([
      [lang==='ar'?'تحليل الحصص':lang==='ar'?'تحليل الحصص':lang==='ar'?'تحليل الحصص':(lang==='ar'?'تحليل الحصص':(lang==='ar'?'تحليل الحصص':'Analyse des Séances'))],
      [(lang==='ar'?'الفترة: ':'Période: ')+dateDebut+' → '+dateFin],
      filtreNom ? [(lang==='ar'?'الطالب: ':'Élève: ')+filtreNom.prenom+' '+filtreNom.nom] : [],
      filterNiveau!=='tous' ? [(lang==='ar'?'المستوى: ':'Niveau: ')+filterNiveau] : [],
      [],
      [lang==='ar'?'الطلاب النشطون':(lang==='ar'?'الطلاب النشطون':'Élèves actifs'),lang==='ar'?'النقاط':lang==='ar'?'النقاط':(lang==='ar'?'النقاط':'Points'),(lang==='ar'?'الثُّمن':'Tomon'),'Hizb',lang==='ar'?'السور':'Sourates',lang==='ar'?'المقاطع':(lang==='ar'?'المقاطع':'Séquences'),lang==='ar'?'أيام النشاط':(lang==='ar'?'أيام النشاط':'Jours actifs')],
      [(filterEleve!=='tous'?1:elevesActifs.size),(filterEleve!=='tous'?(actifs.find(s=>s.eleve.id===filterEleve)||{pts:0}).pts:ptsTotal),tomonTotal,hizbTotal,souratesTotal,sequencesTotal,joursActifs],
      [],
      ['#',lang==='ar'?'الاسم':'Nom',lang==='ar'?'المستوى':'Niveau',lang==='ar'?'الأستاذ':(lang==='ar'?'الأستاذ':'Instituteur'),(lang==='ar'?'الثُّمن':'Tomon'),'Hizb',lang==='ar'?'السور':'Sourates',lang==='ar'?'مقاطع':'Séq.',lang==='ar'?'النقاط':(lang==='ar'?'النقاط':'Points'),(lang==='ar'?'الحصص':'Séances'),'Obj %',(lang==='ar'?'التوجه':(lang==='ar'?'التوجه':'Tendance'))],
      ...dataToExport.map((s,i)=>[i+1,s.eleve.prenom+' '+s.eleve.nom,s.eleve.code_niveau||'?',s.instituteurNom,s.tomon,s.hizb,s.sourates,s.seqs,s.pts,s.nbSeances,s.pctObj!==null?s.pctObj+'%':'—',s.trend==='up'?'↑':s.trend==='down'?'↓':'=']),
    ].filter(r=>r.length>0));
    ws1['!cols']=[{wch:4},{wch:24},{wch:8},{wch:20},{wch:8},{wch:8},{wch:10},{wch:8},{wch:10},{wch:8},{wch:8},{wch:10}];
    XLSX.utils.book_append_sheet(wb,ws1,lang==='ar'?'ملخص':(lang==='ar'?'ملخص':'Résumé'));

    if (timelineArr.length>0) {
      const ws2 = XLSX.utils.aoa_to_sheet([
        [lang==='ar'?'التاريخ':'Date',(lang==='ar'?'الثُّمن':'Tomon'),'Hizb','Sourates',(lang==='ar'?'المقاطع':'Séquences'),lang==='ar'?'النقاط':(lang==='ar'?'النقاط':'Points')],
        ...timelineArr.map(d=>[d.date,d.tomon,d.hizb,d.sourate,d.seq,d.pts])
      ]);
      ws2['!cols']=[{wch:14},{wch:10},{wch:8},{wch:10},{wch:10},{wch:10}];
      XLSX.utils.book_append_sheet(wb,ws2,lang==='ar'?'النشاط':'Activité');
    }

    if (filterEleve!=='tous'&&allDrill.length>0) {
      const ws3 = XLSX.utils.aoa_to_sheet([
        [eleveDrillDown?eleveDrillDown.prenom+' '+eleveDrillDown.nom:''],
        [],
        [lang==='ar'?'التاريخ':'Date',lang==='ar'?'الوقت':'Heure',lang==='ar'?'النوع':'Type',lang==='ar'?'التفاصيل':'Détails',lang==='ar'?'السورة/الحزب':'Sourate/Hizb',(lang==='ar'?'صحَّح بواسطة':'Validé par'),lang==='ar'?'النقاط':(lang==='ar'?'النقاط':'Points')],
        ...allDrill.map(item=>{
          const isSR=!!item.type_recitation;
          const sourate=souratesDB.find(s=>s.id===item.sourate_id);
          const pts=isSR?(item.points||10):(item.type_validation==='hizb_complet'?100:item.nombre_tomon*(bareme.tomon||10));
          const type=isSR?(item.type_recitation==='complete'?lang==='ar'?'سورة كاملة':(lang==='ar'?'سورة كاملة':'Sourate complète'):(lang==='ar'?'مقطع':'Séquence')):(item.type_validation==='hizb_complet'?lang==='ar'?'حزب كامل':(lang==='ar'?'حزب كامل':'Hizb complet'):(lang==='ar'?'الثُّمن':'Tomon'));
          const detail=isSR?(item.type_recitation==='complete'?'✓':'V.'+item.verset_debut+'→V.'+item.verset_fin):(item.type_validation==='hizb_complet'?'Hizb '+item.hizb_valide:item.nombre_tomon+' Tomon');
          const surateNom=sourate?sourate.nom_ar:(item.hizb_validation?'Hizb '+item.hizb_validation:'—');
          const valideur=item.valideur?item.valideur.prenom+' '+item.valideur.nom:'—';
          return [new Date(item.date_validation).toLocaleDateString('fr-FR'),new Date(item.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),type,detail,surateNom,valideur,'+'+pts];
        })
      ]);
      ws3['!cols']=[{wch:14},{wch:8},{wch:16},{wch:22},{wch:24},{wch:18},{wch:8}];
      XLSX.utils.book_append_sheet(wb,ws3,lang==='ar'?'التفصيل':'Détail');
    }

    const suffix=filterEleve!=='tous'?(eleves.find(e=>e.id===filterEleve)||{nom:'eleve'}).nom:filterNiveau!=='tous'?filterNiveau:'rapport';
    XLSX.writeFile(wb,'seances_'+dateDebut+'_'+dateFin+'_'+suffix+'.xlsx');
  };

  // Export PDF
  const exportPDF = () => {
    const w = window.open('','_blank','width=1100,height=900');
    if (!w) { toast.warning(lang==='ar'?'يرجى السماح بالنوافذ المنبثقة':'Autorisez les popups pour exporter le PDF'); return; }
    const dir = lang==='ar'?'rtl':'ltr';
    const dataToExport = filterEleve!=='tous' ? actifs.filter(s=>s.eleve.id===filterEleve) : actifs;
    const filtreNom = filterEleve!=='tous' ? eleves.find(e=>e.id===filterEleve) : null;
    const instNom = filterInstituteur!=='tous' ? (instituteurs.find(i=>i.id===filterInstituteur)||{prenom:'',nom:''}) : null;

    const maxPts = Math.max(...timelineArr.map(d=>d.pts),1);
    const tlW = 600; const tlH = 70;
    const bW = timelineArr.length>0 ? Math.max(3,Math.floor((tlW-20)/timelineArr.length)-2) : 10;

    const tlBars = timelineArr.map((d,i)=>{
      const bh = Math.max(3,Math.round((d.pts/maxPts)*tlH));
      const x = 10+i*(bW+2);
      const y = tlH-bh;
      return '<rect x="'+x+'" y="'+y+'" width="'+bW+'" height="'+bh+'" fill="#1D9E75" rx="2" opacity="0.85"/>';
    }).join('');

    const tlLabels = timelineArr.length>1 ? [0,Math.floor(timelineArr.length/2),timelineArr.length-1].map(i=>{
      const d=timelineArr[i];
      const x=10+i*(bW+2)+bW/2;
      const dt=new Date(d.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
      return '<text x="'+x+'" y="'+(tlH+14)+'" text-anchor="middle" font-size="9" fill="#888">'+dt+'</text>';
    }).join('') : '';

    const timelineSVG = timelineArr.length>0
      ? '<svg width="'+tlW+'" height="'+(tlH+20)+'" style="display:block;margin:0 auto">'+tlBars+tlLabels+'</svg>'
      : '<p style="color:#bbb;text-align:center">Aucune activité</p>';

    const maxPtsE = Math.max(...dataToExport.slice(0,8).map(s=>s.pts),1);
    const perfBars = dataToExport.slice(0,8).map((s,i)=>{
      const nc = NIVEAU_COLORS[s.eleve.code_niveau||'1']||'#888';
      const bw = Math.max(4,Math.round((s.pts/maxPtsE)*380));
      const y = i*30+4;
      const name = (s.eleve.prenom+' '+s.eleve.nom).substring(0,22);
      const pct = s.pctObj!==null ? ' · '+s.pctObj+'%' : '';
      return '<text x="145" y="'+(y+14)+'" text-anchor="end" font-size="10" fill="#555">'+name+'</text>'
        +'<rect x="150" y="'+(y+3)+'" width="'+bw+'" height="16" fill="'+nc+'" rx="3" opacity="0.8"/>'
        +'<text x="'+(155+bw)+'" y="'+(y+14)+'" font-size="10" fill="'+nc+'" font-weight="bold">'+s.pts+pct+'</text>';
    }).join('');
    const perfSVG = dataToExport.length>0
      ? '<svg width="560" height="'+(Math.min(8,dataToExport.length)*30+10)+'" style="display:block">'+perfBars+'</svg>'
      : '';

    const lignesTableau = dataToExport.map((s,i)=>{
      const nc = NIVEAU_COLORS[s.eleve.code_niveau||'1']||'#888';
      const bg = i%2===0?'#fff':'#f9f9f6';
      const pctStr = s.pctObj!==null?s.pctObj+'%':'—';
      const pctColor = s.pctObj!==null?(s.pctObj>=100?'#1D9E75':s.pctObj>=60?'#EF9F27':'#E24B4A'):'#888';
      return '<tr style="background:'+bg+'"><td>'+(i+1)+'</td>'
        +'<td><strong>'+s.eleve.prenom+' '+s.eleve.nom+'</strong></td>'
        +'<td><span style="padding:2px 6px;border-radius:10px;font-size:9px;font-weight:700;background:'+nc+'22;color:'+nc+'">'+( s.eleve.code_niveau||'?')+'</span></td>'
        +'<td style="color:#888;font-size:10px">'+s.instituteurNom+'</td>'
        +'<td>'+s.tomon+'</td><td>'+s.hizb+'</td><td>'+s.sourates+'</td><td>'+s.seqs+'</td>'
        +'<td><strong style="color:#1D9E75">'+s.pts+'</strong></td>'
        +'<td>'+s.nbSeances+'</td>'
        +'<td><strong style="color:'+pctColor+'">'+pctStr+'</strong></td></tr>';
    }).join('');

    const lignesDrill = allDrill.map((item,i)=>{
      const isSR = !!item.type_recitation;
      const sourate = souratesDB.find(s=>s.id===item.sourate_id);
      const pts = isSR?(item.points||10):(item.type_validation==='hizb_complet'?100:item.nombre_tomon*(bareme.tomon||10));
      const bg = i%2===0?'#fff':'#f9f9f6';
      const typeStr = isSR
        ? (item.type_recitation==='complete'?'<span style="background:#E1F5EE;color:#085041;padding:1px 5px;border-radius:4px;font-size:9px">Complète</span>':'<span style="background:#E6F1FB;color:#378ADD;padding:1px 5px;border-radius:4px;font-size:9px">Séquence</span>')
        : (item.type_validation==='hizb_complet'?'<span style="background:#FAEEDA;color:#EF9F27;padding:1px 5px;border-radius:4px;font-size:9px">Hizb ✓</span>':'<span style="background:#E6F1FB;color:#378ADD;padding:1px 5px;border-radius:4px;font-size:9px">Tomon</span>');
      const detail = isSR
        ? (item.type_recitation==='complete'?'✓':('V.'+item.verset_debut+'→'+item.verset_fin))
        : (item.type_validation==='hizb_complet'?('Hizb '+item.hizb_valide):(item.nombre_tomon+' T.'));
      const surateNom = sourate?sourate.nom_ar:(item.hizb_validation?'Hizb '+item.hizb_validation:'—');
      const valideur = item.valideur?item.valideur.prenom+' '+item.valideur.nom:'—';
      const dateStr = new Date(item.date_validation).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
      const heureStr = new Date(item.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      return '<tr style="background:'+bg+'"><td>'+dateStr+'</td><td>'+heureStr+'</td><td>'+typeStr+'</td><td>'+detail+'</td>'
        +'<td style="font-family:Arial;direction:rtl">'+surateNom+'</td>'
        +'<td style="color:#888;font-size:10px">'+valideur+'</td>'
        +'<td><strong style="color:#1D9E75">+'+pts+'</strong></td></tr>';
    }).join('');

    const subtitle = (filtreNom?filtreNom.prenom+' '+filtreNom.nom+' · ':'')
      +(filterNiveau!=='tous'?(lang==='ar'?'المستوى ':' Niveau ')+filterNiveau+' · ':'')
      +(instNom?instNom.prenom+' '+instNom.nom+' · ':'')
      +dateDebut+' → '+dateFin;

    const html = '<!DOCTYPE html><html dir="'+dir+'"><head><meta charset="UTF-8">'
      +'<title>Analyse des Séances</title>'
      +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Tajawal,Arial,sans-serif;color:#1a1a1a;padding:20px;font-size:12px}'
      +'.header{background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px}'
      +'.header h1{font-size:18px;font-weight:800;margin-bottom:4px}'
      +'.header .sub{font-size:11px;opacity:0.8}'
      +'.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}'
      +'.kpi{border-radius:8px;padding:10px;text-align:center}'
      +'.kpi-val{font-size:22px;font-weight:800}'
      +'.kpi-lbl{font-size:10px;opacity:0.8;margin-top:2px}'
      +'.sec{border:0.5px solid #e0e0d8;border-radius:10px;padding:14px;margin-bottom:12px}'
      +'.sec h2{font-size:13px;font-weight:600;color:#085041;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #1D9E75}'
      +'table{width:100%;border-collapse:collapse;font-size:11px}'
      +'th{background:#085041;color:#fff;padding:7px 8px;text-align:'+(dir==='rtl'?'right':'left')+'}'
      +'td{padding:6px 8px;border-bottom:1px solid #f0f0ec}'
      +'.footer{margin-top:14px;font-size:9px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:8px;text-align:center}'
      +'@media print{.sec{break-inside:avoid}}</style></head><body>'
      +'<div class="header"><h1>📊 Analyse des Séances — تحليل الحصص</h1><div class="sub">'+subtitle+'</div></div>'
      +'<div class="kpi-row">'
      +'<div class="kpi" style="background:#E1F5EE"><div class="kpi-val" style="color:#1D9E75">'+(filterEleve!=='tous'?1:elevesActifs.size)+'</div><div class="kpi-lbl" style="color:#1D9E75">Élèves actifs</div></div>'
      +'<div class="kpi" style="background:#EEEDFE"><div class="kpi-val" style="color:#534AB7">'+(filterEleve!=='tous'?(actifs.find(s=>s.eleve.id===filterEleve)||{pts:0}).pts:ptsTotal)+'</div><div class="kpi-lbl" style="color:#534AB7">Points</div></div>'
      +'<div class="kpi" style="background:#FAEEDA"><div class="kpi-val" style="color:#EF9F27">'+joursActifs+'</div><div class="kpi-lbl" style="color:#EF9F27">Jours actifs</div></div>'
      +'<div class="kpi" style="background:#E6F1FB"><div class="kpi-val" style="color:#378ADD">'+(tomonTotal+souratesTotal)+'</div><div class="kpi-lbl" style="color:#378ADD">Récitations</div></div>'
      +'</div>'
      +(timelineArr.length>0?'<div class="sec"><h2>📈 Activité quotidienne</h2>'+timelineSVG+'</div>':'')
      +(dataToExport.length>0?'<div class="sec"><h2>🏆 Performance par élève</h2>'+perfSVG+'</div>':'')
      +'<div class="sec"><h2>📋 Détail par élève</h2>'
      +'<table><thead><tr><th>#</th><th>'+(lang==='ar'?'الاسم':'Nom')+'</th><th>'+(lang==='ar'?'المستوى':'Niv.')+'</th><th>'+(lang==='ar'?'الأستاذ':(lang==='ar'?'الأستاذ':'Instituteur'))+'</th><th>'+(lang==='ar'?'ثُمن':(lang==='ar'?'الثُّمن':'Tomon'))+'</th><th>Hizb</th><th>'+(lang==='ar'?'السور':'Sourates')+'</th><th>'+(lang==='ar'?'مقاطع':'Séq.')+'</th><th>'+(lang==='ar'?'النقاط':(lang==='ar'?'النقاط':'Points'))+'</th><th>'+(lang==='ar'?'حصص':(lang==='ar'?'الحصص':'Séances'))+'</th><th>'+(lang==='ar'?'%الهدف':'Obj %')+'</th></tr></thead>'
      +'<tbody>'+lignesTableau+(inactifs.length>0&&filterEleve==='tous'?'<tr><td colspan="11" style="text-align:center;color:#E24B4A;padding:8px">⚠️ '+inactifs.length+' élève(s) inactif(s)</td></tr>':'')+'</tbody></table></div>'
      +(filterEleve!=='tous'&&allDrill.length>0?'<div class="sec"><h2>📖 Détail des récitations</h2>'
        +'<table><thead><tr><th>Date</th><th>Heure</th><th>Type</th><th>Détails</th><th>Sourate/Hizb</th><th>Validé par</th><th>Points</th></tr></thead>'
        +'<tbody>'+lignesDrill+'</tbody></table></div>':'')
      +'<div class="footer">Généré le '+new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})+' · متابعة التحفيظ</div>'
      +'</body></html>';

    w.document.write(html);
    w.document.close();
    setTimeout(function(){ w.print(); }, 800);
  };

  const medals = ['🥇','🥈','🥉'];

  if (isMobile) {
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        {/* Header sticky */}
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 16px 8px'}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')} style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#fff'}}>
              📊 {lang==='ar'?'السجل':'Historique'}
            </div>
          </div>

          {/* Périodes rapides scrollables */}
          <div style={{display:'flex',gap:4,overflowX:'auto',scrollbarWidth:'none',padding:'0 12px 10px'}}>
            {PERIODES.map((p,i)=>(
              <div key={i} onClick={()=>setPeriodeRapide(i)}
                style={{padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                  flexShrink:0,cursor:'pointer',
                  background:periodeActive===i?'#1D9E75':'#f0f0ec',
                  color:periodeActive===i?'#fff':'#666'}}>
                {lang==='ar'?p.labelAr:p.label}
              </div>
            ))}
          </div>

          {/* Dates personnalisées */}
          <div style={{display:'flex',gap:8,padding:'0 12px 8px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:'#888',marginBottom:4}}>{lang==='ar'?'من':'Du'}</div>
              <input type="date" value={dateDebut} onChange={e=>{setDateDebut(e.target.value);setPeriodeActive(-1);}}
                style={{width:'100%',padding:'8px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',
                  fontSize:13,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:'#888',marginBottom:4}}>{lang==='ar'?'إلى':'Au'}</div>
              <input type="date" value={dateFin} onChange={e=>{setDateFin(e.target.value);setPeriodeActive(-1);}}
                style={{width:'100%',padding:'8px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',
                  fontSize:13,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}/>
            </div>
          </div>

          {/* Filtres rapides dans le header */}
          <div style={{padding:'0 12px 12px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <select value={filterNiveau} onChange={e=>setFilterNiveau(e.target.value)}
              style={{padding:'8px 10px',borderRadius:10,border:'none',fontSize:13,fontFamily:'inherit',background:'rgba(255,255,255,0.2)',color:'#fff'}}>
              <option value="tous" style={{color:'#333'}}>{lang==='ar'?'كل المستويات':'Tous niveaux'}</option>
              {(niveaux||[]).map(n=><option key={n.code} value={n.code} style={{color:'#333'}}>{n.code}</option>)}
            </select>
            <select value={filterType} onChange={e=>setFilterType(e.target.value)}
              style={{padding:'8px 10px',borderRadius:10,border:'none',fontSize:13,fontFamily:'inherit',background:'rgba(255,255,255,0.2)',color:'#fff'}}>
              <option value="tous" style={{color:'#333'}}>{lang==='ar'?'كل الأنواع':'Tous types'}</option>
              <option value="sourate" style={{color:'#333'}}>{lang==='ar'?'سور':'Sourates'}</option>
              <option value="tomon" style={{color:'#333'}}>Tomon</option>
              <option value="hizb" style={{color:'#333'}}>Hizb</option>
            </select>
          </div>
        </div>
        {/* Recherche élève — EN DEHORS du header sticky pour éviter le clipping */}
        <div style={{background:'#fff',padding:'10px 12px',borderBottom:'0.5px solid #e0e0d8'}}>
          <input value={filterEleve==='tous'?searchFiltreEleve:
            ((eleves.find(e=>e.id===filterEleve)?.eleve_id_ecole?'#'+eleves.find(e=>e.id===filterEleve)?.eleve_id_ecole+' — ':'')+
            (eleves.find(e=>e.id===filterEleve)?.prenom||'')+' '+(eleves.find(e=>e.id===filterEleve)?.nom||''))}
            onChange={e=>{setSearchFiltreEleve(e.target.value);setFilterEleve('tous');}}
            placeholder={lang==='ar'?'🔍 ابحث بالاسم أو رقم التعريف...':'🔍 Nom ou N° élève...'}
            style={{width:'100%',padding:'10px 14px',borderRadius:12,border:'0.5px solid #e0e0d8',
              fontSize:14,fontFamily:'inherit',boxSizing:'border-box',background:'#f9f9f6'}}/>
          {/* Liste résultats — plus de position:absolute, liste inline */}
          {searchFiltreEleve && filterEleve==='tous' && (
            <div style={{background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8',
              marginTop:6,maxHeight:220,overflowY:'auto',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
              <div onTouchEnd={()=>{setFilterEleve('tous');setSearchFiltreEleve('');}}
                onClick={()=>{setFilterEleve('tous');setSearchFiltreEleve('');}}
                style={{padding:'10px 14px',fontSize:12,color:'#888',borderBottom:'0.5px solid #f0f0ec',cursor:'pointer'}}>
                {lang==='ar'?'كل الطلاب':'Tous les élèves'}
              </div>
              {(elevesVisibles||[]).filter(e=>
                `${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(searchFiltreEleve.toLowerCase()) ||
                String(e.eleve_id_ecole||'').includes(searchFiltreEleve)
              ).map(e=>{
                // Sur mobile : trouver l'objet élève complet pour naviguer vers la fiche
                const eleveComplet = eleves.find(el=>el.id===e.id) || e;
                const nc = (niveaux||[]).find(n=>n.code===eleveComplet.code_niveau)?.couleur ||
                  {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[eleveComplet.code_niveau||''] || '#888';
                return (
                <div key={e.id}
                  onTouchEnd={()=>{ setSearchFiltreEleve(''); navigate('fiche', eleveComplet); }}
                  onClick={()=>{ setSearchFiltreEleve(''); navigate('fiche', eleveComplet); }}
                  style={{padding:'12px 14px',fontSize:13,borderBottom:'0.5px solid #f0f0ec',
                    display:'flex',gap:12,alignItems:'center',cursor:'pointer',background:'#fff'}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:`${nc}20`,color:nc,
                    display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,flexShrink:0}}>
                    {(eleveComplet.prenom||'?')[0]}{(eleveComplet.nom||'?')[0]}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14}}>{eleveComplet.prenom} {eleveComplet.nom}</div>
                    <div style={{display:'flex',gap:6,marginTop:2,alignItems:'center'}}>
                      {eleveComplet.eleve_id_ecole&&(
                        <span style={{background:`${nc}20`,color:nc,padding:'1px 6px',
                          borderRadius:6,fontSize:10,fontWeight:700}}>
                          #{eleveComplet.eleve_id_ecole}
                        </span>
                      )}
                      <span style={{fontSize:10,color:'#888'}}>{eleveComplet.code_niveau||'?'}</span>
                    </div>
                  </div>
                  <span style={{color:'#ccc',fontSize:18}}>›</span>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {loading ? <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div> : (
          <div style={{padding:'12px'}}>
            {/* KPIs 2x2 */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:14}}>
              {[
                {label:lang==='ar'?'أيام نشطة':'Jours actifs',val:timelineArr.length,color:'#1D9E75',bg:'#E1F5EE'},
                {label:lang==='ar'?'إجمالي النقاط':'Total points',val:(actifs||[]).reduce((s,e)=>s+(e.pts||0),0).toLocaleString(),color:'#534AB7',bg:'#F0EEFF'},
                {label:lang==='ar'?'الثُّمنات':'Tomon',val:(actifs||[]).reduce((s,e)=>s+(e.tomon||0),0),color:'#378ADD',bg:'#E6F1FB'},
                {label:lang==='ar'?'الأحزاب':'Hizb',val:(actifs||[]).reduce((s,e)=>s+(e.hizb||0),0),color:'#EF9F27',bg:'#FAEEDA'},
              ].map((k,i)=>(
                <div key={i} style={{background:k.bg,borderRadius:12,padding:'14px',textAlign:'center',border:`0.5px solid ${k.color}20`}}>
                  <div style={{fontSize:24,fontWeight:800,color:k.color}}>{k.val}</div>
                  <div style={{fontSize:11,color:k.color,marginTop:4,opacity:0.8}}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Liste élèves */}
            <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:8}}>
              {lang==='ar'?'أداء الطلاب':'Performance des élèves'} ({elevesVisibles?.length||0})
            </div>
            {(elevesVisibles||[]).map((e,idx)=>{
              const nc={'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[e.code_niveau||'1']||'#888';
              return(
                <div key={e.id} onTouchEnd={()=>navigate('fiche',e)} onClick={()=>navigate('fiche',e)}
                  style={{background:'#fff',borderRadius:12,padding:'13px 14px',marginBottom:8,
                    border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:`${nc}20`,color:nc,
                    display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,flexShrink:0}}>
                    {idx+1}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14}}>{e.prenom} {e.nom}</div>
                    <div style={{display:'flex',gap:6,alignItems:'center',marginTop:2}}>
                      <span style={{padding:'1px 7px',borderRadius:8,background:`${nc}20`,color:nc,fontSize:11,fontWeight:700}}>{e.code_niveau||'?'}</span>
                      <span style={{fontSize:11,color:'#888'}}>{e.joursActifs||0} j · {e.tomon||0} T</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:18,fontWeight:800,color:'#1D9E75'}}>{(e.pts||0).toLocaleString()}</div>
                    <div style={{fontSize:10,color:'#888'}}>pts</div>
                  </div>
                  {e.trend==='up'&&<span style={{fontSize:14}}>📈</span>}
                  {e.trend==='down'&&<span style={{fontSize:14}}>📉</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }


  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}></button>
        <div style={{fontSize:18,fontWeight:700,color:'#085041'}}>📊 {lang==='ar'?'تحليل الحصص':lang==='en'?'Session Analysis':lang==='ar'?'تحليل الحصص':lang==='ar'?'تحليل الحصص':(lang==='ar'?'تحليل الحصص':(lang==='ar'?'تحليل الحصص':'Analyse des Séances'))}</div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:12,color:'#888'}}>{elevesVisibles.length} {lang==='ar'?'طالب':lang==='en'?'students':'élèves'}</span>
          <button onClick={exportExcel} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#f5f5f0',color:'#085041',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>📊 Excel</button>
          <button onClick={exportPDF} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#f5f5f0',color:'#534AB7',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>🖨️ PDF</button>
        </div>
      </div>

      {/* FILTRES */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {PERIODES.map((p,i)=>(
            <button key={i} onClick={()=>setPeriodeRapide(i)} style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:periodeActive===i?700:400,cursor:'pointer',border:'1.5px solid '+(periodeActive===i?'#1D9E75':'#e0e0d8'),background:periodeActive===i?'#1D9E75':'#fff',color:periodeActive===i?'#fff':'#666'}}>
              {lang==='ar'?p.labelAr:p.label}
            </button>
          ))}
          <button onClick={()=>setPeriodeActive(-1)} style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:periodeActive===-1?700:400,cursor:'pointer',border:'1.5px solid '+(periodeActive===-1?'#534AB7':'#e0e0d8'),background:periodeActive===-1?'#534AB7':'#fff',color:periodeActive===-1?'#fff':'#666'}}>
            {lang==='ar'?'فترة مخصصة':lang==='en'?'Custom':(lang==='ar'?'مخصص':'Personnalisé')}
          </button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          <div className="field-group"><label className="field-lbl">{lang==='ar'?'من':'Du'}</label><input className="field-input" type="date" value={dateDebut} onChange={e=>{setDateDebut(e.target.value);setPeriodeActive(-1);}}/></div>
          <div className="field-group"><label className="field-lbl">{lang==='ar'?'إلى':'Au'}</label><input className="field-input" type="date" value={dateFin} onChange={e=>{setDateFin(e.target.value);setPeriodeActive(-1);}}/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          <div className="field-group"><label className="field-lbl">{lang==='ar'?'المستوى':'Niveau'}</label>
            <select className="field-select" value={filterNiveau} onChange={e=>setFilterNiveau(e.target.value)}>
              <option value="tous">{lang==='ar'?'الكل':'Tous'}</option>
              {['5B','5A','2M','2','1'].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {user.role==='surveillant'&&<div className="field-group"><label className="field-lbl">{lang==='ar'?'الأستاذ':(lang==='ar'?'الأستاذ':'Instituteur')}</label>
            <select className="field-select" value={filterInstituteur} onChange={e=>setFilterInstituteur(e.target.value)}>
              <option value="tous">{lang==='ar'?'الكل':'Tous'}</option>
              {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
            </select>
          </div>}
          <div className="field-group"><label className="field-lbl">{lang==='ar'?'نوع الاستظهار':lang==='ar'?'النوع':'Type'}</label>
            <select className="field-select" value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="tous">{lang==='ar'?'الكل':'Tous'}</option>
              <option value="sourate">{lang==='ar'?'سور مكتملة':'Sourates'}</option>
              <option value="sequence">{lang==='ar'?'مقاطع':(lang==='ar'?'المقاطع':'Séquences')}</option>
              <option value="tomon">Tomon</option>
              <option value="hizb">Hizb</option>
            </select>
          </div>
          <div className="field-group"><label className="field-lbl">{lang==='ar'?'الطالب':'Élève'}</label>
            <div style={{position:'relative'}}>
              <input className="field-input"
                value={filterEleve==='tous' ? searchFiltreEleve : (eleves.find(e=>e.id===filterEleve) ? (eleves.find(e=>e.id===filterEleve)?.eleve_id_ecole?'#'+eleves.find(e=>e.id===filterEleve)?.eleve_id_ecole+' — ':'')+eleves.find(e=>e.id===filterEleve)?.prenom+' '+eleves.find(e=>e.id===filterEleve)?.nom : '')}
                onChange={e=>{setSearchFiltreEleve(e.target.value);setFilterEleve('tous');}}
                placeholder={lang==='ar'?'🔍 كل الطلاب أو رقم التعريف':'🔍 Tous ou N° élève'}/>
              {searchFiltreEleve && filterEleve==='tous' && (
                <div style={{position:'absolute',top:'9999%',right:0,left:0,background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:8,zIndex:9999,maxHeight:200,overflowY:'auto',boxShadow:'0 4px 12px #0001'}}>
                  <div onClick={()=>{setFilterEleve('tous');setSearchFiltreEleve('');}} style={{padding:'8px 12px',cursor:'pointer',fontSize:12,color:'#888',borderBottom:'0.5px solid #f0f0ec'}}>{lang==='ar'?'كل الطلاب':'Tous les élèves'}</div>
                  {(elevesVisibles||[]).filter(e=>`${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(searchFiltreEleve.toLowerCase())||String(e.eleve_id_ecole||'').includes(searchFiltreEleve)).map(e=>(
                    <div key={e.id} onTouchEnd={()=>{setFilterEleve(e.id);setSearchFiltreEleve('');}} onClick={()=>{setFilterEleve(e.id);setSearchFiltreEleve('');}}
                      style={{padding:'8px 12px',cursor:'pointer',fontSize:12,borderBottom:'0.5px solid #f0f0ec',display:'flex',gap:8,alignItems:'center'}}>
                      {e.eleve_id_ecole&&<span style={{background:'#E1F5EE',color:'#085041',padding:'1px 5px',borderRadius:4,fontSize:10,fontWeight:700}}>#{e.eleve_id_ecole}</span>}
                      <span>{e.prenom} {e.nom} ({e.code_niveau||'?'})</span>
                    </div>
                  ))}
                  {(elevesVisibles||[]).filter(e=>`${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(searchFiltreEleve.toLowerCase())).length===0&&
                    <div style={{padding:'8px 12px',color:'#aaa',fontSize:12}}>{lang==='ar'?'لا نتائج':'Aucun résultat'}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="loading">...</div> : (<>
        {/* KPI */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:'1rem'}}>
          <StatCard icon="👥" val={filterEleve!=='tous'?1:elevesActifs.size} lbl={lang==='ar'?'طلاب نشطون':(lang==='ar'?'الطلاب النشطون':'Élèves actifs')} color="#1D9E75" bg="#E1F5EE"
            sub={filterEleve!=='tous'?(eleves.find(e=>e.id===filterEleve)||{prenom:'',nom:''}).prenom+' '+(eleves.find(e=>e.id===filterEleve)||{nom:''}).nom:(elevesActifs.size+'/'+elevesVisibles.length+' · inactifs: '+inactifs.length)}/>
          <StatCard icon="⭐" val={(filterEleve!=='tous'?(actifs.find(s=>s.eleve.id===filterEleve)||{pts:0}).pts:ptsTotal).toLocaleString()} lbl={lang==='ar'?'نقاط':lang==='ar'?'النقاط':(lang==='ar'?'النقاط':'Points')} color="#534AB7" bg="#EEEDFE"
            sub={ptsDelta!==0?(ptsDelta>0?'▲ ':'▼ ')+Math.abs(ptsDelta)+' vs période préc.':'Stable'}/>
          <StatCard icon="📅" val={joursActifs} lbl={lang==='ar'?'أيام نشطة':(lang==='ar'?'أيام النشاط':'Jours actifs')} color="#EF9F27" bg="#FAEEDA" sub={joursActifs+'/'+duree+' jours'}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:'1rem'}}>
          {[{val:tomonTotal,lbl:(lang==='ar'?'الثُّمن':'Tomon'),color:'#378ADD',bg:'#E6F1FB'},{val:hizbTotal,lbl:'Hizb',color:'#EF9F27',bg:'#FAEEDA'},{val:souratesTotal,lbl:lang==='ar'?'سور':'Sourates',color:'#085041',bg:'#E1F5EE'},{val:sequencesTotal,lbl:lang==='ar'?'مقاطع':'Séq.',color:'#888',bg:'#f5f5f0'}].map(k=>(
            <div key={k.lbl} style={{background:k.bg,borderRadius:10,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:700,color:k.color}}>{k.val}</div>
              <div style={{fontSize:11,color:k.color,opacity:0.8}}>{k.lbl}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        {timelineArr.length>0&&(
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1rem'}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{lang==='ar'?'النشاط اليومي':(lang==='ar'?'النشاط اليومي':(lang==='ar'?'النشاط اليومي':'Activité quotidienne'))}</div>
            <div style={{display:'flex',gap:2,alignItems:'flex-end',height:80,padding:'0 4px'}}>
              {timelineArr.map(d=>(
                <div key={d.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}} title={d.date+': '+d.pts+' pts'}>
                  <div style={{width:'100%',background:'#1D9E75',borderRadius:'2px 2px 0 0',height:Math.max(3,(d.pts/maxPtsDay)*70)+'px',opacity:0.85}}/>
                  {timelineArr.length<=14&&<div style={{fontSize:8,color:'#bbb',textAlign:'center'}}>{new Date(d.date).toLocaleDateString('fr-FR',{day:'numeric',month:'numeric'})}</div>}
                </div>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888',marginTop:6}}>
              <span>{lang==='ar'?'الأكثر نشاطاً':'Plus actif'}: <strong style={{color:'#1D9E75'}}>{timelineArr.reduce((m,d)=>d.pts>m.pts?d:m,timelineArr[0]).date}</strong></span>
              <span>{lang==='ar'?'متوسط يومي':'Moy./jour'}: <strong style={{color:'#1D9E75'}}>{Math.round(ptsTotal/(joursActifs||1))} pts</strong></span>
            </div>
          </div>
        )}

        {/* Performance list */}
        {(!drillDown||filterEleve==='tous')&&(
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
              <div style={{fontSize:13,fontWeight:600}}>{lang==='ar'?'أداء الطلاب':(lang==='ar'?'الأداء حسب الطالب':(lang==='ar'?'الأداء حسب الطالب':'Performance par élève'))} <span style={{fontSize:11,color:'#888'}}>({actifs.length})</span></div>
              <input style={{padding:'7px 12px',border:'1.5px solid #e0e0d8',borderRadius:8,fontSize:13,width:220,fontFamily:'inherit'}} placeholder={lang==='ar'?'🔍 اسم أو رقم التعريف...':'🔍 Nom ou N° élève...'} value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}/>
            </div>
            {(searchEleve ? [...actifs, ...inactifs] : actifs).filter(s=>!searchEleve||(`${s.eleve.prenom} ${s.eleve.nom} ${s.eleve.eleve_id_ecole||''}`.toLowerCase().includes(searchEleve.toLowerCase()))||String(s.eleve.eleve_id_ecole||'').includes(searchEleve.trim())).map((s,idx)=>{
              const nc=NIVEAU_COLORS[s.eleve.code_niveau||'1']||'#888';
              return(
                <div key={s.eleve.id} onClick={()=>{setSelectedEleve(s.eleve.id);setDrillDown(true);}} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,cursor:'pointer',marginBottom:6,border:'0.5px solid #e0e0d8',background:'#fff'}}>
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
                    <div style={{display:'flex',gap:8,marginTop:3,flexWrap:'wrap'}}>
                      {s.isSourate?(<>{s.sourates>0&&<span style={{fontSize:11,color:'#085041',fontWeight:500}}>{s.sourates} sur. ✓</span>}{s.seqs>0&&<span style={{fontSize:11,color:'#888'}}>{s.seqs} séq.</span>}</>):(<>{s.tomon>0&&<span style={{fontSize:11,color:'#378ADD',fontWeight:500}}>{s.tomon} T.</span>}{s.hizb>0&&<span style={{fontSize:11,color:'#EF9F27',fontWeight:500}}>{s.hizb} Hizb</span>}</>)}
                      <span style={{fontSize:11,color:'#bbb'}}>{s.nbSeances} séance(s)</span>
                    </div>
                    {s.pctObj!==null&&<div style={{marginTop:4}}><div style={{height:4,background:'#e8e8e0',borderRadius:2,overflow:'hidden',width:100}}><div style={{height:'100%',width:s.pctObj+'%',background:s.pctObj>=100?'#1D9E75':s.pctObj>=60?'#EF9F27':'#E24B4A',borderRadius:2}}/></div><div style={{fontSize:9,color:'#888',marginTop:1}}>Obj: {s.pctObj}%{s.pctObj>=100?' ✓':''}</div></div>}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:16,fontWeight:800,color:nc}}>{s.pts}</div>
                    <div style={{fontSize:9,color:'#888'}}>pts</div>
                  </div>
                  <div style={{color:'#bbb',fontSize:14}}>›</div>
                </div>
              );
            })}
            {inactifs.length>0&&!searchEleve&&(
              <details style={{marginTop:10}}>
                <summary style={{fontSize:12,color:'#E24B4A',cursor:'pointer',fontWeight:500,padding:'8px 0'}}>⚠️ {inactifs.length} {lang==='ar'?'طالب غير نشط':'élève(s) inactif(s)'}</summary>
                <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:6}}>
                  {inactifs.map(s=>(
                    <div key={s.eleve.id} onClick={()=>{setSelectedEleve(s.eleve.id);setDrillDown(true);}} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 12px',borderRadius:8,cursor:'pointer',background:'#fff8f8',border:'0.5px solid #E24B4A20'}}>
                      <Avatar prenom={s.eleve.prenom} nom={s.eleve.nom} size={28} bg="#FCEBEB" color="#A32D2D"/>
                      <span style={{fontSize:12,fontWeight:500,color:'#A32D2D'}}>{s.eleve.prenom} {s.eleve.nom}</span>
                      <NiveauBadge code={s.eleve.code_niveau}/>
                      <span style={{marginRight:'auto'}}/>
                      <span style={{fontSize:11,color:'#E24B4A'}}>{s.derniere?joursDepuis(s.derniere)+'j':'—'}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Drill-down */}
        {drillDown&&eleveDrillDown&&(
          <div style={{background:'#fff',border:'1.5px solid #1D9E75',borderRadius:16,padding:'1.25rem',marginBottom:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'1rem'}}>
              <button onClick={()=>{setDrillDown(false);setSelectedEleve(null);setFilterEleve('tous');}} style={{padding:'4px 10px',border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',fontSize:11,cursor:'pointer'}}>←</button>
              <Avatar prenom={eleveDrillDown.prenom} nom={eleveDrillDown.nom} size={38} bg={(NIVEAU_COLORS[eleveDrillDown.code_niveau||'1']||'#888')+'18'} color={NIVEAU_COLORS[eleveDrillDown.code_niveau||'1']||'#888'}/>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>{eleveDrillDown.prenom} {eleveDrillDown.nom}</div><div style={{display:'flex',gap:6,marginTop:2}}><NiveauBadge code={eleveDrillDown.code_niveau}/></div></div>
              <button onClick={()=>navigate('fiche',eleveDrillDown)} style={{padding:'6px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:11,cursor:'pointer'}}>Fiche →</button>
            </div>
            {allDrill.length===0?<div className="empty">{lang==='ar'?'لا نشاط في هذه الفترة':'Aucune activité sur la période'}</div>:(
              <div className="table-wrap">
                <table><thead><tr>
                  <th>Date</th><th>Heure</th><th>Type</th><th>Détails</th>
                  <th>{lang==='ar'?'السورة/الحزب':lang==='ar'?'السورة/الحزب':'Sourate/Hizb'}</th>
                  <th>{lang==='ar'?'صحح':'Validé'}</th><th>pts</th>
                </tr></thead>
                <tbody>
                  {allDrill.map((item,i)=>{
                    const isSR=!!item.type_recitation;
                    const sourate=souratesDB.find(s=>s.id===item.sourate_id);
                    const pts=isSR?(item.points||10):(item.type_validation==='hizb_complet'?100:item.nombre_tomon*(bareme.tomon||10));
                    return(
                      <tr key={i}>
                        <td style={{fontSize:12,color:'#888'}}>{new Date(item.date_validation).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</td>
                        <td style={{fontSize:12,color:'#888'}}>{new Date(item.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td>{isSR?(item.type_recitation==='complete'?<span className="badge badge-green">Complète</span>:<span className="badge badge-blue">Séquence</span>):(item.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb ✓</span>:<span className="badge badge-blue">Tomon</span>)}</td>
                        <td>{isSR?(item.type_recitation==='complete'?'✓':('V.'+item.verset_debut+'→'+item.verset_fin)):(item.type_validation==='hizb_complet'?('Hizb '+item.hizb_valide):(item.nombre_tomon+' T.'+( item.tomon_debut||'')))}</td>
                        <td style={{fontFamily:"'Tajawal',Arial",direction:'rtl',fontSize:13}}>{sourate?sourate.nom_ar:(item.hizb_validation?'Hizb '+item.hizb_validation:'—')}</td>
                        <td style={{fontSize:11,color:'#888'}}>{item.valideur?item.valideur.prenom[0]+'. '+item.valideur.nom:'—'}</td>
                        <td><span style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>+{pts}</span></td>
                      </tr>
                    );
                  })}
                </tbody></table>
              </div>
            )}
          </div>
        )}
      </>)}
    </div>
  );
}
