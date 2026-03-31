import React, { useState, useEffect } from 'react';
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

export default function HistoriqueSeances({ user, navigate, goBack, lang='fr' }) {
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

  // Auto drill-down when specific student selected
  useEffect(() => {
    if (filterEleve !== 'tous') {
      setSelectedEleve(filterEleve);
      setDrillDown(true);
    } else {
      setDrillDown(false);
      setSelectedEleve(null);
    }
  }, [filterEleve]);
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

  // Export to CSV/Excel
  const exportExcel = async () => {
    // Dynamically load SheetJS
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    
    // Only export what's currently visible (filtered actifs)
    const dataToExport = filterEleve !== 'tous'
      ? actifs.filter(s => s.eleve.id === filterEleve)
      : actifs;
    
    // === SHEET 1: Résumé ===
    const summaryData = [
      [lang==='ar'?'تحليل الحصص':lang==='en'?'Session Analysis':'Analyse des Séances'],
      [`${lang==='ar'?'الفترة':lang==='en'?'Period':'Période'}: ${dateDebut} → ${dateFin}`],
      filterEleve!=='tous'?[`${lang==='ar'?'الطالب':lang==='en'?'Student':'Élève'}: ${eleves.find(e=>e.id===filterEleve)?.prenom||''} ${eleves.find(e=>e.id===filterEleve)?.nom||''}`]:[],
      filterNiveau!=='tous'?[`${lang==='ar'?'المستوى':lang==='en'?'Level':'Niveau'}: ${filterNiveau}`]:[],
      [],
      // KPI row
      [lang==='ar'?'طلاب نشطون':lang==='en'?'Active students':'Élèves actifs',
       lang==='ar'?'نقاط':lang==='en'?'Points':'Points',
       lang==='ar'?'أثمان':lang==='en'?'Tomon':'Tomon',
       'Hizb',
       lang==='ar'?'سور':lang==='en'?'Surahs':'Sourates',
       lang==='ar'?'مقاطع':lang==='en'?'Seq.':'Séq.',
       lang==='ar'?'أيام نشطة':lang==='en'?'Active days':'Jours actifs'],
      [filterEleve!=='tous'?1:elevesActifs.size,
       filterEleve!=='tous'?actifs.find(s=>s.eleve.id===filterEleve)?.pts||0:ptsTotal,
       tomonTotal, hizbTotal, souratesTotal, sequencesTotal, joursActifs],
      [],
      // Headers for student table
      ['#',
       lang==='ar'?'الاسم':lang==='en'?'Name':'Nom',
       lang==='ar'?'المستوى':lang==='en'?'Level':'Niveau',
       lang==='ar'?'الأستاذ':lang==='en'?'Teacher':'Instituteur',
       'Tomon', 'Hizb',
       lang==='ar'?'سور كاملة':lang==='en'?'Surahs':'Sourates',
       lang==='ar'?'مقاطع':lang==='en'?'Seq.':'Séq.',
       lang==='ar'?'النقاط':lang==='en'?'Points':'Points',
       lang==='ar'?'الحصص':lang==='en'?'Sessions':'Séances',
       lang==='ar'?'هدف %':lang==='en'?'Obj %':'Obj %',
       lang==='ar'?'الاتجاه':lang==='en'?'Trend':'Tendance'],
      ...dataToExport.map((s,i)=>[
        i+1,
        `${s.eleve.prenom} ${s.eleve.nom}`,
        s.eleve.code_niveau||'?',
        s.instituteurNom,
        s.tomon, s.hizb, s.sourates, s.seqs, s.pts, s.nbSeances,
        s.pctObj!==null?`${s.pctObj}%`:'—',
        s.trend==='up'?'↑':s.trend==='down'?'↓':'=',
      ]),
    ].filter(r=>r.length>0);

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    // Column widths
    ws1['!cols'] = [{wch:4},{wch:22},{wch:8},{wch:20},{wch:8},{wch:8},{wch:10},{wch:8},{wch:10},{wch:8},{wch:8},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws1, lang==='ar'?'ملخص':lang==='en'?'Summary':'Résumé');

    // === SHEET 2: Timeline ===
    if (timelineArr.length > 0) {
      const timelineData = [
        [lang==='ar'?'التاريخ':'Date', 'Tomon', 'Hizb',
         lang==='ar'?'سور':'Surahs', lang==='ar'?'مقاطع':'Séq.', lang==='ar'?'النقاط':'Points'],
        ...timelineArr.map(d=>[d.date, d.tomon, d.hizb, d.sourate, d.seq, d.pts])
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(timelineData);
      ws2['!cols'] = [{wch:14},{wch:10},{wch:8},{wch:8},{wch:8},{wch:10}];
      XLSX.utils.book_append_sheet(wb, ws2, lang==='ar'?'النشاط اليومي':lang==='en'?'Daily activity':'Activité');
    }

    // === SHEET 3: Détail récitations (if student selected) ===
    if (filterEleve !== 'tous' && allDrill.length > 0) {
      const eleveName = `${eleves.find(e=>e.id===filterEleve)?.prenom||''} ${eleves.find(e=>e.id===filterEleve)?.nom||''}`;
      const detailData = [
        [eleveName],
        [],
        [lang==='ar'?'التاريخ':'Date',
         lang==='ar'?'الوقت':'Heure',
         lang==='ar'?'النوع':'Type',
         lang==='ar'?'التفاصيل':'Détails',
         lang==='ar'?'السورة/الحزب':'Sourate/Hizb',
         lang==='ar'?'صحح بواسطة':'Validé par',
         lang==='ar'?'النقاط':'Points'],
        ...allDrill.map(item => {
          const isSR = !!item.type_recitation;
          const sourate = souratesDB.find(s=>s.id===item.sourate_id);
          const pts = isSR ? (item.points||10) : (item.type_validation==='hizb_complet'?100:item.nombre_tomon*10);
          return [
            new Date(item.date_validation).toLocaleDateString('fr-FR'),
            new Date(item.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
            isSR?(item.type_recitation==='complete'?'Sourate complète':'Séquence'):(item.type_validation==='hizb_complet'?'Hizb complet':'Tomon'),
            isSR?(item.type_recitation==='complete'?'✓':`V.${item.verset_debut}→V.${item.verset_fin}`):(item.type_validation==='hizb_complet'?`Hizb ${item.hizb_valide}`:`${item.nombre_tomon} Tomon`),
            sourate?sourate.nom_ar:(item.hizb_validation?`Hizb ${item.hizb_validation}`:'—'),
            item.valideur?`${item.valideur.prenom} ${item.valideur.nom}`:'—',
            `+${pts}`,
          ];
        })
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(detailData);
      ws3['!cols'] = [{wch:14},{wch:8},{wch:16},{wch:20},{wch:22},{wch:18},{wch:8}];
      XLSX.utils.book_append_sheet(wb, ws3, lang==='ar'?'تفاصيل':'Détail');
    }

    // Save file
    const suffix = filterEleve!=='tous'?(eleves.find(e=>e.id===filterEleve)?.nom||'eleve'):filterNiveau!=='tous'?filterNiveau:'tous';
    XLSX.writeFile(wb, `seances_${dateDebut}_${dateFin}_${suffix}.xlsx`);
  };



  // Export PDF - generates a print-ready HTML page with charts
  const exportPDF = () => {
    const w = window.open('', '', 'width=1100,height=900');
    if (!w) return;
    const dir = lang==='ar'?'rtl':'ltr';
    const font = lang==='ar'?"'Tajawal',Arial":"Arial";
    const dataToExport = filterEleve!=='tous' ? actifs.filter(s=>s.eleve.id===filterEleve) : actifs;
    const filteredName = filterEleve!=='tous' ? `${eleves.find(e=>e.id===filterEleve)?.prenom||''} ${eleves.find(e=>e.id===filterEleve)?.nom||''}` : '';

    // Build timeline SVG
    const maxPts = Math.max(...timelineArr.map(d=>d.pts), 1);
    const tlWidth = 700, tlHeight = 80;
    const barW = timelineArr.length > 0 ? Math.max(4, Math.floor((tlWidth-20)/timelineArr.length)-2) : 10;
    const timelineSVG = timelineArr.length > 0 ? `
      <svg width="${tlWidth}" height="${tlHeight+30}" style="display:block;margin:0 auto">
        <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1D9E75"/><stop offset="100%" stop-color="#5DCAA5"/>
        </linearGradient></defs>
        ${timelineArr.map((d,i)=>{
          const bh = Math.max(4, Math.round((d.pts/maxPts)*tlHeight));
          const x = 10 + i*(barW+2);
          const y = tlHeight - bh;
          return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="url(#g1)" rx="2"/>`;
        }).join('')}
        ${timelineArr.filter((_,i)=>i===0||i===Math.floor(timelineArr.length/2)||i===timelineArr.length-1).map((d,_,arr)=>{
          const origIdx = timelineArr.indexOf(d);
          const x = 10 + origIdx*(barW+2) + barW/2;
          return `<text x="${x}" y="${tlHeight+14}" text-anchor="middle" font-size="9" fill="#888">${new Date(d.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</text>`;
        }).join('')}
      </svg>` : '<div style="color:#bbb;text-align:center;padding:20px">Aucune activité</div>';

    // Build performance bars SVG
    const top5 = dataToExport.slice(0,8);
    const maxPtsEleve = Math.max(...top5.map(s=>s.pts), 1);
    const perfSVG = top5.length > 0 ? `
      <svg width="680" height="${top5.length*28+10}" style="display:block">
        ${top5.map((s,i)=>{
          const bw = Math.max(4, Math.round((s.pts/maxPtsEleve)*400));
          const nc = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[s.eleve.code_niveau||'1']||'#888';
          const y = i*28+4;
          const name = `${s.eleve.prenom} ${s.eleve.nom}`.substring(0,20);
          return `
            <text x="140" y="${y+14}" text-anchor="end" font-size="10" fill="#444">${name}</text>
            <rect x="145" y="${y+2}" width="${bw}" height="18" fill="${nc}" rx="3" opacity="0.85"/>
            <text x="${145+bw+6}" y="${y+14}" font-size="10" fill="${nc}" font-weight="bold">${s.pts} pts${s.pctObj!==null?` · ${s.pctObj}%`:''}</text>
          `;
        }).join('')}
      </svg>` : '';

    w.document.write(`<!DOCTYPE html><html dir="${dir}"><head>
    <meta charset="UTF-8">
    <title>تحليل الحصص</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:${font},sans-serif;background:#fff;color:#1a1a1a;padding:20px;font-size:12px;direction:${dir}}
      .header{background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;padding:16px 20px;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
      .header h1{font-size:18px;font-weight:800}
      .header .meta{font-size:11px;opacity:0.8;margin-top:4px}
      .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
      .kpi{border-radius:10px;padding:12px;text-align:center}
      .kpi-val{font-size:24px;font-weight:800}
      .kpi-lbl{font-size:10px;opacity:0.8;margin-top:2px}
      .kpi2-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
      .kpi2{background:#f5f5f0;border-radius:8px;padding:8px;text-align:center}
      .kpi2-val{font-size:18px;font-weight:700;color:#1D9E75}
      .kpi2-lbl{font-size:10px;color:#888}
      .section{background:#fff;border:0.5px solid #e0e0d8;border-radius:12px;padding:14px;margin-bottom:14px}
      .section h2{font-size:13px;font-weight:600;color:#085041;margin-bottom:10px;border-bottom:2px solid #1D9E75;padding-bottom:6px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#085041;color:#fff;padding:7px 8px;text-align:${dir==='rtl'?'right':'left'};font-size:10px}
      td{padding:6px 8px;border-bottom:1px solid #f0f0ec}
      tr:nth-child(even) td{background:#f9f9f6}
      .badge{padding:2px 6px;border-radius:10px;font-size:9px;font-weight:700;display:inline-block}
      .up{color:#1D9E75} .down{color:#E24B4A} .stable{color:#888}
      .footer{margin-top:16px;font-size:9px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:8px;text-align:center}
      @media print{body{padding:10px}.section{break-inside:avoid}}
    </style></head><body>

    <div class="header">
      <div>
        <h1>📊 ${lang==='ar'?'تحليل الحصص':lang==='en'?'Session Analysis':'Analyse des Séances'}</h1>
        <div class="meta">${dateDebut} → ${dateFin}${filteredName?` · ${filteredName}`:''}${filterNiveau!=='tous'?` · ${lang==='ar'?'المستوى':'Niveau'} ${filterNiveau}`:''}${filterInstituteur!=='tous'?` · ${instituteurs.find(i=>i.id===filterInstituteur)?.prenom||''} ${instituteurs.find(i=>i.id===filterInstituteur)?.nom||''}`:''}
        </div>
      </div>
      <div style="text-align:${dir==='rtl'?'left':'right'};font-size:11px;opacity:0.8">${new Date().toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</div>
    </div>

    <div class="kpi-row">
      <div class="kpi" style="background:#E1F5EE">
        <div class="kpi-val" style="color:#1D9E75">${filterEleve!=='tous'?1:elevesActifs.size}</div>
        <div class="kpi-lbl" style="color:#1D9E75">${lang==='ar'?'طلاب نشطون':lang==='en'?'Active':'Élèves actifs'}</div>
      </div>
      <div class="kpi" style="background:#EEEDFE">
        <div class="kpi-val" style="color:#534AB7">${(filterEleve!=='tous'?actifs.find(s=>s.eleve.id===filterEleve)?.pts||0:ptsTotal).toLocaleString()}</div>
        <div class="kpi-lbl" style="color:#534AB7">${lang==='ar'?'نقاط':lang==='en'?'Points':'Points'}</div>
      </div>
      <div class="kpi" style="background:#FAEEDA">
        <div class="kpi-val" style="color:#EF9F27">${joursActifs}</div>
        <div class="kpi-lbl" style="color:#EF9F27">${lang==='ar'?'أيام نشطة':lang==='en'?'Active days':'Jours actifs'}</div>
      </div>
      <div class="kpi" style="background:#E6F1FB">
        <div class="kpi-val" style="color:#378ADD">${tomonTotal+souratesTotal}</div>
        <div class="kpi-lbl" style="color:#378ADD">${lang==='ar'?'تسميعات':lang==='en'?'Recitations':'Récitations'}</div>
      </div>
    </div>

    <div class="kpi2-row">
      <div class="kpi2"><div class="kpi2-val" style="color:#378ADD">${tomonTotal}</div><div class="kpi2-lbl">Tomon</div></div>
      <div class="kpi2"><div class="kpi2-val" style="color:#EF9F27">${hizbTotal}</div><div class="kpi2-lbl">Hizb</div></div>
      <div class="kpi2"><div class="kpi2-val" style="color:#085041">${souratesTotal}</div><div class="kpi2-lbl">${lang==='ar'?'سور كاملة':lang==='en'?'Surahs':'Sourates'}</div></div>
      <div class="kpi2"><div class="kpi2-val" style="color:#888">${sequencesTotal}</div><div class="kpi2-lbl">${lang==='ar'?'مقاطع':lang==='en'?'Seq.':'Séq.'}</div></div>
    </div>

    ${timelineArr.length>0?`
    <div class="section">
      <h2>📈 ${lang==='ar'?'النشاط اليومي':lang==='en'?'Daily Activity':'Activité quotidienne'}</h2>
      ${timelineSVG}
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#888;margin-top:6px">
        <span>${lang==='ar'?'الأكثر نشاطاً':lang==='en'?'Most active':'Plus actif'}: <strong style="color:#1D9E75">${timelineArr.reduce((m,d)=>d.pts>m.pts?d:m,timelineArr[0]).date}</strong></span>
        <span>${lang==='ar'?'متوسط يومي':lang==='en'?'Daily avg':'Moy./jour'}: <strong style="color:#1D9E75">${Math.round(ptsTotal/(joursActifs||1))} pts</strong></span>
      </div>
    </div>`:''}

    ${top5.length>0?`
    <div class="section">
      <h2>🏆 ${lang==='ar'?'أداء الطلاب':lang==='en'?'Student Performance':'Performance par élève'}</h2>
      ${perfSVG}
    </div>`:''}

    <div class="section">
      <h2>📋 ${lang==='ar'?'تفاصيل الطلاب':lang==='en'?'Student details':'Détail par élève'}</h2>
      <table>
        <thead><tr>
          <th>#</th>
          <th>${lang==='ar'?'الاسم':lang==='en'?'Name':'Nom'}</th>
          <th>${lang==='ar'?'المستوى':'Niv.'}</th>
          <th>${lang==='ar'?'الأستاذ':lang==='en'?'Teacher':'Instituteur'}</th>
          <th>Tomon</th><th>Hizb</th>
          <th>${lang==='ar'?'سور':lang==='en'?'Sur.':'Sur.'}</th>
          <th>${lang==='ar'?'مق.':lang==='en'?'Seq.':'Séq.'}</th>
          <th>${lang==='ar'?'النقاط':lang==='en'?'Points':'Points'}</th>
          <th>${lang==='ar'?'الحصص':lang==='en'?'Sessions':'Séances'}</th>
          <th>${lang==='ar'?'الهدف %':lang==='en'?'Obj %':'Obj %'}</th>
        </tr></thead>
        <tbody>
          ${dataToExport.map((s,i)=>{
            const nc={'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[s.eleve.code_niveau||'1']||'#888';
            const pctColor=s.pctObj!==null?(s.pctObj>=100?'#1D9E75':s.pctObj>=60?'#EF9F27':'#E24B4A'):'#888';
            return `<tr>
              <td>${i+1}</td>
              <td><strong>${s.eleve.prenom} ${s.eleve.nom}</strong></td>
              <td><span class="badge" style="background:${nc}20;color:${nc}">${s.eleve.code_niveau||'?'}</span></td>
              <td style="color:#888">${s.instituteurNom}</td>
              <td>${s.tomon}</td><td>${s.hizb}</td>
              <td>${s.sourates}</td><td>${s.seqs}</td>
              <td><strong style="color:#1D9E75">${s.pts}</strong></td>
              <td>${s.nbSeances}</td>
              <td><strong style="color:${pctColor}">${s.pctObj!==null?s.pctObj+'%':'—'}</strong></td>
            </tr>`;
          }).join('')}
          ${filterEleve==='tous'&&inactifs.length>0?`<tr><td colspan="11" style="text-align:center;color:#E24B4A;padding:8px">⚠️ ${inactifs.length} ${lang==='ar'?'طالب غير نشط':lang==='en'?'inactive':'élève(s) inactif(s)'}</td></tr>`:''}
        </tbody>
      </table>
    </div>

    ${filterEleve!=='tous'&&allDrill.length>0?`
    <div class="section">
      <h2>📖 ${lang==='ar'?'تفاصيل التسميع':lang==='en'?'Recitation details':'Détail des récitations'}</h2>
      <table>
        <thead><tr>
          <th>${lang==='ar'?'التاريخ':'Date'}</th>
          <th>${lang==='ar'?'الوقت':'Heure'}</th>
          <th>${lang==='ar'?'النوع':'Type'}</th>
          <th>${lang==='ar'?'التفاصيل':'Détails'}</th>
          <th>${lang==='ar'?'السورة/الحزب':'Sourate/Hizb'}</th>
          <th>${lang==='ar'?'صحح بواسطة':'Validé par'}</th>
          <th>${lang==='ar'?'النقاط':'Points'}</th>
        </tr></thead>
        <tbody>
          ${allDrill.map(item=>{
            const isSR=!!item.type_recitation;
            const sourate=souratesDB.find(s=>s.id===item.sourate_id);
            const pts=isSR?(item.points||10):(item.type_validation==='hizb_complet'?100:item.nombre_tomon*10);
            return `<tr>
              <td>${new Date(item.date_validation).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</td>
              <td>${new Date(item.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
              <td>${isSR?(item.type_recitation==='complete'?`<span class="badge" style="background:#E1F5EE;color:#085041">${lang==='ar'?'سورة كاملة':'Complète'}</span>`:`<span class="badge" style="background:#E6F1FB;color:#378ADD">${lang==='ar'?'مقطع':'Séquence'}</span>`):(item.type_validation==='hizb_complet'?`<span class="badge" style="background:#FAEEDA;color:#EF9F27">Hizb ✓</span>`:`<span class="badge" style="background:#E6F1FB;color:#378ADD">Tomon</span>`)}</td>
              <td>${isSR?(item.type_recitation==='complete'?'✓':`V.${item.verset_debut}→${item.verset_fin}`):(item.type_validation==='hizb_complet'?`Hizb ${item.hizb_valide}`:`${item.nombre_tomon} T.${item.tomon_debut||''}`)}</td>
              <td style="font-family:'Tajawal',Arial;direction:rtl">${sourate?sourate.nom_ar:(item.hizb_validation?`Hizb ${item.hizb_validation}`:'—')}</td>
              <td style="color:#888">${item.valideur?`${item.valideur.prenom} ${item.valideur.nom}`:'—'}</td>
              <td><strong style="color:#1D9E75">+${pts}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`:''}

    <div class="footer">
      ${lang==='ar'?'أُنشئ بتاريخ':lang==='en'?'Generated on':'Généré le'} ${new Date().toLocaleDateString(lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-FR',{day:'2-digit',month:'long',year:'numeric'})} · متابعة التحفيظ
    </div>
    </body></html>`);
    w.document.close();
    setTimeout(()=>{w.print();w.close();},800);
  };
}
