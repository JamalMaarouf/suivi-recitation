import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcPositionAtteinte, calcUnite, calcPoints, formatDate, formatDateCourt, getInitiales, scoreLabel, calcBadges, calcVitesse, niveauTraduit } from '../lib/helpers';
import { t } from '../lib/i18n';
import FicheSourate from './FicheSourate';

function Avatar({ prenom, nom, size=44, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

function calcStreak(validations) {
  if (!validations.length) return 0;
  const weeks = new Set(validations.map(v => {
    const d = new Date(v.date_validation);
    const start = new Date(d.getFullYear(), 0, 1);
    return `${d.getFullYear()}-${Math.floor((d-start)/(7*24*60*60*1000))}`;
  }));
  const sorted = [...weeks].sort().reverse();
  let streak = 1;
  for (let i = 0; i < sorted.length-1; i++) {
    const [y1,w1]=sorted[i].split('-').map(Number);
    const [y2,w2]=sorted[i+1].split('-').map(Number);
    if((y1-y2)*52+(w1-w2)===1) streak++;
    else break;
  }
  return streak;
}

function calcHeatmap(validations) {
  const map = {};
  validations.forEach(v => {
    const d = new Date(v.date_validation).toLocaleDateString('fr-FR');
    map[d] = (map[d]||0) + (v.type_validation==='hizb_complet'?3:v.nombre_tomon);
  });
  return map;
}

function calcEvolution(validations) {
  const vals = [...validations].sort((a,b)=>new Date(a.date_validation)-new Date(b.date_validation));
  let cumul=0; let hc=new Set();
  const pts = [{score:0,label:'Départ'}];
  vals.forEach(v => {
    if(v.type_validation==='hizb_complet') hc.add(v.hizb_valide); else cumul+=v.nombre_tomon;
    pts.push({score:cumul*10+Math.floor(cumul/2)*25+Math.floor(cumul/4)*60+hc.size*100,label:formatDateCourt(v.date_validation)});
  });
  return pts;
}

const MOIS_FR=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MOIS_AR=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MOIS_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const getMoisCourt=(i,lang)=>lang==='ar'?MOIS_AR[i]:lang==='en'?MOIS_EN[i]:MOIS_FR[i];


// Modal pour exception Hizb/Tomon
function ExceptionHizbModal({ etat, eleve, user, onConfirm, onCancel, lang }) {
  const [selected, setSelected] = React.useState([]);
  if (!etat) return null;

  // Show Hizb range: from hizb_depart to current hizb
  const hizbDepart = eleve.hizb_depart || 1;
  const hizbCurrent = etat.hizbEnCours || 1;
  const hizbList = [];
  for (let h = hizbDepart; h <= hizbCurrent; h++) hizbList.push(h);

  const toggle = (h) => setSelected(prev => prev.includes(h) ? prev.filter(x=>x!==h) : [...prev, h]);

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',maxWidth:460,width:'100%',maxHeight:'80vh',overflow:'auto'}}>
        <div style={{fontSize:15,fontWeight:700,color:'#A32D2D',marginBottom:4}}>🔓 {lang==='ar'?'فتح استثنائي':lang==='en'?'Exceptional unlock':'Déverrouillage exceptionnel'}</div>
        <div style={{fontSize:12,color:'#888',marginBottom:'1rem'}}>
          {lang==='ar'?'اختر الأحزاب التي تريد فتحها. هذا الإجراء مسجّل.':lang==='en'?'Select Hizb to unlock. This action is logged.':'Sélectionnez les Hizb à débloquer. Action enregistrée.'}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6,marginBottom:'1rem'}}>
          {hizbList.map(h=>{
            const isSel = selected.includes(h);
            return(
              <div key={h} onClick={()=>toggle(h)}
                style={{height:40,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:isSel?700:400,cursor:'pointer',border:`1.5px solid ${isSel?'#E24B4A':'#e0e0d8'}`,background:isSel?'#FCEBEB':'#fff',color:isSel?'#A32D2D':'#666',transition:'all 0.1s'}}>
                {h}
              </div>
            );
          })}
        </div>
        {selected.length>0&&(
          <div style={{padding:'8px 12px',background:'#FCEBEB',borderRadius:8,fontSize:12,color:'#A32D2D',marginBottom:'1rem'}}>
            ⚠️ Hizb {selected.sort((a,b)=>a-b).join(', ')} {lang==='ar'?'سيُفتح':lang==='en'?'will be unlocked':'sera(ont) débloqué(s)'}
          </div>
        )}
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>selected.length>0&&onConfirm(selected)} disabled={selected.length===0}
            style={{flex:1,padding:'10px',background:selected.length>0?'#E24B4A':'#f0f0ec',color:selected.length>0?'#fff':'#bbb',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:selected.length>0?'pointer':'default'}}>
            {lang==='ar'?'تأكيد':lang==='en'?'Confirm':'Confirmer'}
          </button>
          <button onClick={onCancel} style={{flex:1,padding:'10px',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:13,cursor:'pointer'}}>
            {lang==='ar'?'إلغاء':lang==='en'?'Cancel':'Annuler'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FicheEleve({ eleve, user, navigate, goBack, lang='fr' }) {
  const [validations, setValidations] = useState([]);
  const [apprentissages, setApprentissages] = useState([]);
  const [objectifs, setObjectifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instituteurNom, setInstituteurNom] = useState('—');
  const [etat, setEtat] = useState(null);
  const [onglet, setOnglet] = useState('apercu');
  const [editObj, setEditObj] = useState(false);
  const [newObjVal, setNewObjVal] = useState('');
  const now = new Date();
  const [selectedMoisObj, setSelectedMoisObj] = useState(now.getMonth());
  const [selectedAnneeObj, setSelectedAnneeObj] = useState(now.getFullYear());

  useEffect(() => { loadData(); }, [eleve.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{data:vals},{data:appr}] = await Promise.all([
        supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').eq('eleve_id',eleve.id).order('date_validation',{ascending:false}),
        supabase.from('apprentissages').select('*').eq('eleve_id',eleve.id).order('date_debut',{ascending:false}),
      ]);
      if (eleve.instituteur_referent_id) {
        const {data:inst}=await supabase.from('utilisateurs').select('prenom,nom').eq('id',eleve.instituteur_referent_id).single();
        if(inst) setInstituteurNom(inst.prenom+' '+inst.nom);
      }
      const e = calcEtatEleve(vals||[],eleve.hizb_depart||1,eleve.tomon_depart||1);
      setEtat(e);
      setValidations(vals||[]);
      setApprentissages(appr||[]);
    } catch(err) {
      console.error('FicheEleve loadData error:', err);
      // Set minimal etat so page renders
      setEtat(calcEtatEleve([],eleve.hizb_depart||1,eleve.tomon_depart||1));
    } finally {
      setLoading(false);
    }
  };



  const handlePrint = () => {
    const w = window.open('','','width=800,height=900');
    if (!w || !etat) return;
    const pts = etat.points;
    const dir = lang==='ar'?'rtl':'ltr';
    const arabicFont = lang==='ar'?"'Tajawal',Arial,sans-serif":"Arial,sans-serif";
    const dateLocale = lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-FR';
    const thAlign = lang==='ar'?'right':'left';
    w.document.write(`<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head>
    <meta charset="UTF-8"><title>${eleve.prenom} ${eleve.nom}</title>
    <style>
      body{font-family:${arabicFont};color:#1a1a1a;padding:30px;direction:${dir}}
      h1{font-size:22px;color:#085041}h2{font-size:14px;margin:20px 0 10px;border-bottom:2px solid #1D9E75;padding-bottom:6px}
      .grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:20px}
      .box{border:1px solid #e0e0d8;border-radius:8px;padding:12px;text-align:center}
      .box-title{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:4px}
      .box-val{font-size:20px;font-weight:700;color:#1D9E75}
      .acquis{background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:12px;margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f9f9f6;text-align:${thAlign};padding:8px;border-bottom:1px solid #e0e0d8;font-size:10px;text-transform:uppercase}
      td{padding:8px;border-bottom:1px solid #f0f0ec;text-align:${thAlign}}
      .pts{color:#1D9E75;font-weight:600}
      .footer{margin-top:30px;font-size:11px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:12px}
    </style></head><body>
    <h1>${eleve.prenom} ${eleve.nom}</h1>
    <p style="color:#888;font-size:13px">${niveauTraduit(eleve.niveau,lang,t)} · ${instituteurNom}</p>
    ${etat.tomonAcquis>0?`<div class="acquis">
      <div><div style="font-size:11px;color:#085041;font-weight:600">🎓 ${t(lang,'acquis_anterieurs')}</div>
      <div style="font-size:13px;color:#0F6E56">${etat.tomonAcquis} ${t(lang,'tomon_abrev')} + ${etat.hizbAcquisComplets} Hizb</div></div>
      <div><div style="font-size:11px;color:#888">${lang==='ar'?'النقاط المقابلة':lang==='en'?'Prior points':'Points antérieurs'}</div>
      <div style="font-size:18px;font-weight:700;color:#1D9E75">+${(pts.ptsAcquisTotal||0).toLocaleString()} ${t(lang,'pts_abrev')}</div></div>
      <div><div style="font-size:11px;color:#888">${lang==='ar'?'منذ بدء المتابعة':lang==='en'?'Since tracking':'Depuis le suivi'}</div>
      <div style="font-size:18px;font-weight:700;color:#378ADD">+${(pts.ptsDepuisSuivi||0).toLocaleString()} ${t(lang,'pts_abrev')}</div></div>
    </div>`:''}
    <div class="grid">
      <div class="box"><div class="box-title">${t(lang,'score_total')}</div><div class="box-val">${pts.total.toLocaleString()} ${t(lang,'pts_abrev')}</div></div>
      <div class="box"><div class="box-title">${t(lang,'hizb_en_cours')}</div><div class="box-val">Hizb ${etat.hizbEnCours}</div></div>
      <div class="box"><div class="box-title">${t(lang,'tomon_valides')}</div><div class="box-val">${etat.tomonTotal||etat.tomonCumul}</div></div>
      <div class="box"><div class="box-title">${t(lang,'hizb_complets')}</div><div class="box-val">${etat.hizbsComplets.size}</div></div>
    </div>
    <h2>${t(lang,'historique')}</h2>
    <table><thead><tr>
      <th>${t(lang,'date_heure')}</th><th>${lang==='ar'?'النوع':'Type'}</th><th>${t(lang,'detail')}</th>
      <th>${t(lang,'duree_apprentissage_col')}</th><th>${t(lang,'points_gagnes')}</th><th>${t(lang,'valide_par')}</th>
    </tr></thead><tbody>
    ${validations.map(v=>{
      const appr=apprentissages.find(a=>a.hizb===v.hizb_validation&&a.tomon===v.tomon_debut);
      const joursAppr=appr?Math.round((new Date(v.date_validation)-new Date(appr.date_debut))/(1000*60*60*24)):null;
      const typeLabel=v.type_validation==='hizb_complet'?t(lang,'hizb_complets_label'):v.nombre_tomon+' '+t(lang,'tomon_abrev');
      const detailLabel=v.type_validation==='hizb_complet'?'Hizb '+v.hizb_valide:(v.tomon_debut?'T.'+v.tomon_debut+'→T.'+(v.tomon_debut+v.nombre_tomon-1):v.nombre_tomon+' '+t(lang,'tomon_abrev'));
      const dureeLabel=joursAppr!==null?joursAppr+' '+t(lang,'jours'):'—';
      return '<tr><td>'+new Date(v.date_validation).toLocaleDateString(dateLocale)+'</td><td>'+typeLabel+'</td><td>'+detailLabel+'</td><td>'+dureeLabel+'</td><td class="pts">+'+(v.type_validation==='hizb_complet'?100:v.nombre_tomon*10)+' '+t(lang,'pts_abrev')+'</td><td>'+(v.valideur?v.valideur.prenom+' '+v.valideur.nom:'—')+'</td></tr>';
    }).join('')}
    </tbody></table>
    <div class="footer">${t(lang,'genere_le')} ${new Date().toLocaleDateString(dateLocale)} · ${t(lang,'app_name')}</div>
    </body></html>`);
    w.document.close();
    setTimeout(()=>{w.print();w.close();},600);
  };

  const sl = etat ? scoreLabel(etat.points.total) : {color:'#888',bg:'#f0f0ec',label:'—'};
  const badges = etat ? calcBadges(validations,etat) : [];
  const vitesse = calcVitesse(validations);
  const streak = calcStreak(validations);
  const heatmap = calcHeatmap(validations);
  const evolution = calcEvolution(validations);
  const maxScore = Math.max(...evolution.map(p=>p.score),1);
  const last90 = Array.from({length:90},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(89-i));return d.toLocaleDateString('fr-FR');});
  const heatColor = (c) => !c?'#e8e8e0':c>=6?'#085041':c>=4?'#1D9E75':c>=2?'#5DCAA5':'#9FE1CB';

  const objActuel = objectifs.find(o=>o.mois===selectedMoisObj+1&&o.annee===selectedAnneeObj);
  const debutMoisSel = new Date(selectedAnneeObj,selectedMoisObj,1);
  const finMoisSel = new Date(selectedAnneeObj,selectedMoisObj+1,0,23,59,59);
  const tomonMoisSel = validations.filter(v=>v.type_validation==='tomon'&&new Date(v.date_validation)>=debutMoisSel&&new Date(v.date_validation)<=finMoisSel).reduce((s,v)=>s+v.nombre_tomon,0);
  const pctObj = objActuel?Math.min(100,Math.round(tomonMoisSel/objActuel.nombre_tomon*100)):null;
  // Guard: wait for data to load
  if (loading || !etat) return (
    <div style={{padding:'2rem',textAlign:'center'}}>
      <div className="loading">...</div>
    </div>
  );

  const pctColor=(p)=>p>=100?'#1D9E75':p>=60?'#EF9F27':'#E24B4A';

  // Redirect 5B/5A AFTER all hooks are declared (React rules of hooks)
  if (['5B','5A','2M'].includes(eleve.code_niveau)) {
    return <FicheSourate eleve={eleve} user={user} navigate={navigate} lang={lang} />;
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>{t(lang,'retour')}</button>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-secondary" onClick={handlePrint} style={{fontSize:12,padding:'6px 14px'}}>{t(lang,'imprimer_pdf')}</button>
          <button className="btn-primary" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={()=>navigate('enregistrer',eleve)}>{t(lang,'enregistrer_recitation')}</button>
        </div>
      </div>

      {loading?<div className="loading">...</div>:(
        <>
          {/* Hero */}
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.5rem',marginBottom:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
              <Avatar prenom={eleve.prenom} nom={eleve.nom} size={60} bg={sl.bg} color={sl.color}/>
              <div style={{flex:1}}>
                <div style={{fontSize:20,fontWeight:700}}>{eleve.prenom} {eleve.nom}</div>
                <div style={{fontSize:13,color:'#888'}}>{niveauTraduit(eleve.niveau,lang,t)} · {instituteurNom}</div>
                <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                  <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:500,background:sl.bg,color:sl.color}}>{sl.label}</span>
                  {streak>0&&<span style={{padding:'2px 10px',borderRadius:20,fontSize:11,background:'#E6F1FB',color:'#0C447C'}}>🔥 {streak} {t(lang,'semaines')}</span>}
                  {vitesse.moyenne>0&&<span style={{padding:'2px 10px',borderRadius:20,fontSize:11,background:'#f5f5f0',color:'#666'}}>{vitesse.tendance==='hausse'?'📈':vitesse.tendance==='baisse'?'📉':'➡️'} {vitesse.moyenne}T/{t(lang,'semaines')}</span>}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:38,fontWeight:800,color:sl.color,letterSpacing:'-2px'}}>{etat?.points.total.toLocaleString()}</div>
                <div style={{fontSize:11,color:'#888'}}>{t(lang,'pts_abrev')}</div>
              </div>
            </div>

            {/* Points breakdown */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
              {[['Tomon',etat?.points.ptsTomon,`${etat?.tomonTotal||etat?.tomonCumul}×10`],['Roboe',etat?.points.ptsRoboe,`${etat?.points.details.nbRoboe}×25`],['Nisf',etat?.points.ptsNisf,`${etat?.points.details.nbNisf}×60`],['Hizb',etat?.points.ptsHizb,`${etat?.points.details.nbHizb}×100`]].map(([l,v,s])=>(
                <div key={l} style={{background:'#f9f9f6',borderRadius:8,padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:700}}>{v}</div>
                  <div style={{fontSize:11,color:'#888'}}>{l}</div>
                  <div style={{fontSize:10,color:'#bbb'}}>{s}</div>
                </div>
              ))}
            </div>

            {/* Acquis antérieurs — bouton accordéon */}
            {etat?.tomonAcquis>0&&(
              <div style={{marginBottom:8}}>
                <button onClick={()=>setShowAcquis(v=>!v)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'10px 14px',border:`1.5px solid ${showAcquis?'#1D9E75':'#9FE1CB'}`,borderRadius:showAcquis?'10px 10px 0 0':'10px',background:showAcquis?'#E1F5EE':'#f0faf6',cursor:'pointer',transition:'all 0.2s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>🎓</span>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#085041'}}>{lang==='ar'?'المكتسبات السابقة':lang==='en'?'Prior achievements':'Acquis antérieurs'}</div>
                      <div style={{fontSize:11,color:'#0F6E56'}}>{etat.tomonAcquis} {t(lang,'tomon_abrev')} · {etat.hizbAcquisComplets} Hizb · <strong>{(etat.points.ptsAcquisTotal||0).toLocaleString()} {t(lang,'pts_abrev')}</strong></div>
                    </div>
                  </div>
                  <span style={{fontSize:16,color:'#1D9E75',fontWeight:700,transition:'transform 0.2s',display:'inline-block',transform:showAcquis?'rotate(180deg)':'rotate(0deg)'}}>{showAcquis?'▲':'▼'}</span>
                </button>
                {showAcquis&&(
                  <div style={{background:'#f0faf6',border:'1.5px solid #1D9E75',borderTop:'none',borderRadius:'0 0 10px 10px',padding:'1rem'}}>
                    {/* Position de départ */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      {[
                        {lbl:lang==='ar'?'حزب الانطلاق':lang==='en'?'Starting Hizb':'Hizb de départ',val:`Hizb ${eleve.hizb_depart}`,icon:'📍',color:'#085041',bg:'#E1F5EE'},
                        {lbl:lang==='ar'?'ثُمن الانطلاق':lang==='en'?'Starting Tomon':'Tomon de départ',val:`T.${eleve.tomon_depart}`,icon:'📍',color:'#085041',bg:'#E1F5EE'},
                        {lbl:lang==='ar'?'ثُمن مكتسب':lang==='en'?'Acquired Tomon':'Tomon acquis',val:etat.tomonAcquis,icon:'✓',color:'#1D9E75',bg:'#fff'},
                        {lbl:lang==='ar'?'حزب مكتمل':lang==='en'?'Complete Hizb':'Hizb complets',val:etat.hizbAcquisComplets,icon:'✓',color:'#EF9F27',bg:'#fff'},
                      ].map(k=>(
                        <div key={k.lbl} style={{background:k.bg,borderRadius:8,padding:'10px 12px',border:'0.5px solid #d0ede4',display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:16}}>{k.icon}</span>
                          <div>
                            <div style={{fontSize:10,color:'#888'}}>{k.lbl}</div>
                            <div style={{fontSize:15,fontWeight:700,color:k.color}}>{k.val}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Détail des points */}
                    <div style={{fontSize:11,color:'#085041',fontWeight:600,marginBottom:6}}>{lang==='ar'?'توزيع النقاط':lang==='en'?'Points breakdown':'Détail des points'}</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:10}}>
                      {[
                        {lbl:t(lang,'tomon_abrev'),val:etat.tomonAcquis*10,sub:`${etat.tomonAcquis}×10`,color:'#1D9E75'},
                        {lbl:'Roboe',val:Math.floor(etat.tomonAcquis/2)*25,sub:`${Math.floor(etat.tomonAcquis/2)}×25`,color:'#378ADD'},
                        {lbl:'Nisf',val:Math.floor(etat.tomonAcquis/4)*60,sub:`${Math.floor(etat.tomonAcquis/4)}×60`,color:'#534AB7'},
                        {lbl:'Hizb',val:etat.hizbAcquisComplets*100,sub:`${etat.hizbAcquisComplets}×100`,color:'#EF9F27'},
                      ].map(k=>(
                        <div key={k.lbl} style={{background:'#fff',borderRadius:8,padding:'8px',textAlign:'center',border:'0.5px solid #d0ede4'}}>
                          <div style={{fontSize:14,fontWeight:700,color:k.color}}>{k.val}</div>
                          <div style={{fontSize:10,color:'#888'}}>{k.lbl}</div>
                          <div style={{fontSize:9,color:'#bbb'}}>{k.sub}</div>
                        </div>
                      ))}
                    </div>
                    {/* Total */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#085041',borderRadius:8,padding:'10px 14px'}}>
                      <span style={{fontSize:12,color:'#9FE1CB'}}>{lang==='ar'?'مجموع نقاط المكتسبات':lang==='en'?'Total prior points':'Total points acquis antérieurs'}</span>
                      <span style={{fontSize:18,fontWeight:800,color:'#fff'}}>{(etat.points.ptsAcquisTotal||0).toLocaleString()} {t(lang,'pts_abrev')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Exception Hizb/Tomon — Surveillant uniquement */}
            {user.role==='surveillant'&&(
              <div style={{marginBottom:8}}>
                <button onClick={()=>setShowExceptionModal(true)}
                  style={{padding:'6px 12px',border:'1px solid #E24B4A',borderRadius:8,background:'#fff',color:'#E24B4A',fontSize:11,cursor:'pointer',fontWeight:500}}>
                  🔓 {lang==='ar'?'فتح استثنائي (Hizb/Tomon)':lang==='en'?'Unlock Hizb/Tomon (exception)':'Exception Hizb/Tomon'}
                </button>
                {exceptionsHizb.length>0&&(
                  <div style={{marginTop:6,padding:'8px 12px',background:'#FCEBEB',border:'1px solid #E24B4A',borderRadius:8}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#A32D2D',marginBottom:4}}>
                      🔓 {lang==='ar'?'استثناءات نشطة':lang==='en'?'Active exceptions':'Exceptions actives'}
                    </div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {exceptionsHizb.map(ex=>(
                        <div key={ex.id} style={{display:'flex',alignItems:'center',gap:4,padding:'2px 8px',background:'#fff',borderRadius:20,border:'1px solid #E24B4A',fontSize:12}}>
                          Hizb {ex.hizb_numero}
                          <span onClick={async()=>{await supabase.from('exceptions_hizb').update({active:false}).eq('id',ex.id);await loadData();}} style={{cursor:'pointer',color:'#E24B4A',fontSize:14,fontWeight:700,marginLeft:2}}>×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Exception modal */}
            {showExceptionModal&&user.role==='surveillant'&&(
              <ExceptionHizbModal
                etat={etat} eleve={eleve} user={user}
                onConfirm={async(hizbs)=>{
                  await supabase.from('exceptions_hizb').insert(hizbs.map(h=>({eleve_id:eleve.id,hizb_numero:h,active:true,cree_par:user.id,date_creation:new Date().toISOString()})));
                  setShowExceptionModal(false);
                  await loadData();
                }}
                onCancel={()=>setShowExceptionModal(false)}
                lang={lang}
              />
            )}



            {/* KPI */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,borderTop:'0.5px solid #e8e8e0',paddingTop:12}}>
              {[['Hizb',`Hizb ${etat?.hizbEnCours}`],['Tomon/Hizb',`${etat?.tomonDansHizbActuel}/8`],[t(lang,'hizb_complets'),etat?.hizbsComplets.size],['Total',etat?.tomonTotal||etat?.tomonCumul]].map(([l,v])=>(
                <div key={l}><div style={{fontSize:10,color:'#999',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:500}}>{v}</div></div>
              ))}
            </div>
          </div>

          {/* Badges */}
          {badges.length>0&&(
            <div style={{marginBottom:'1rem'}}>
              <div className="section-label">{t(lang,'badges')}</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {badges.map(b=>(
                  <div key={b.id} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:b.bg,border:`0.5px solid ${b.color}30`,borderRadius:20}}>
                    <span style={{fontSize:16}}>{b.icon}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:b.color}}>{b.label}</div>
                      <div style={{fontSize:10,color:b.color,opacity:0.8}}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Objectif mensuel */}
          <div className="card" style={{marginBottom:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:600}}>🎯 {t(lang,'objectif_mensuel')}</div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={()=>{if(selectedMoisObj===0){setSelectedMoisObj(11);setSelectedAnneeObj(y=>y-1);}else setSelectedMoisObj(m=>m-1);}} style={{padding:'2px 8px',border:'0.5px solid #e0e0d8',borderRadius:4,background:'#fff',cursor:'pointer'}}>‹</button>
                <span style={{fontSize:12,color:'#888',minWidth:70,textAlign:'center'}}>{getMoisCourt(selectedMoisObj,lang)} {selectedAnneeObj}</span>
                <button onClick={()=>{if(selectedMoisObj===11){setSelectedMoisObj(0);setSelectedAnneeObj(y=>y+1);}else setSelectedMoisObj(m=>m+1);}} style={{padding:'2px 8px',border:'0.5px solid #e0e0d8',borderRadius:4,background:'#fff',cursor:'pointer'}}>›</button>
                {user.role==='surveillant'&&<button className="action-btn" onClick={()=>{setEditObj(!editObj);setNewObjVal(objActuel?.nombre_tomon||'');}}>{editObj?t(lang,'annuler'):t(lang,'definir')}</button>}
              </div>
            </div>
            {editObj&&user.role==='surveillant'&&(
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <input className="field-input" type="number" min="1" max="80" placeholder="Nb Tomon" value={newObjVal} onChange={e=>setNewObjVal(e.target.value)} style={{flex:1}}/>
                <button className="btn-primary" style={{width:'auto',padding:'8px 14px',fontSize:12}} onClick={saveObjectif}>✓</button>
              </div>
            )}
            {objActuel?(
              <div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:6}}>
                  <span>{tomonMoisSel} / {objActuel.nombre_tomon} {t(lang,'tomon_abrev')}</span>
                  <span style={{fontWeight:700,color:pctColor(pctObj)}}>{pctObj}%</span>
                </div>
                <div style={{height:10,background:'#e8e8e0',borderRadius:5,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pctObj}%`,background:pctColor(pctObj),borderRadius:5,transition:'width 0.5s'}}/>
                </div>
                {pctObj>=100&&<div style={{fontSize:12,color:'#1D9E75',marginTop:6}}>{t(lang,'objectif_atteint')}</div>}
              </div>
            ):<div style={{fontSize:12,color:'#bbb',textAlign:'center',padding:'8px 0'}}>{t(lang,'aucun_objectif')}</div>}
          </div>

          {/* Tabs */}
          <div className="tabs-row" style={{marginBottom:'1rem'}}>
            {[['apercu',t(lang,'apercu')],['apprentissage',t(lang,'apprentissage')],['graphique',t(lang,'evolution')],['activite',t(lang,'activite')],['historique',t(lang,'historique')]].map(([k,l])=>(
              <div key={k} className={`tab ${onglet===k?'active':''}`} onClick={()=>setOnglet(k)}>{l}</div>
            ))}
          </div>

          {/* APERÇU */}
          {onglet==='apercu'&&(
            <>
              <div className="position-card">
                <div className="pos-block"><div className="pos-val">{etat?.hizbEnCours}</div><div className="pos-lbl">Hizb</div></div>
                <div className="pos-block"><div className="pos-val">{etat?.tomonDansHizbActuel}/8</div><div className="pos-lbl">{t(lang,'tomon_abrev')}</div></div>
                <div className="pos-block"><div className="pos-val" style={{fontSize:14}}>{etat?.enAttenteHizbComplet?'⏳':etat?.prochainTomon?`T.${etat.prochainTomon}`:'✓'}</div><div className="pos-lbl">{t(lang,'prochain')}</div></div>
              </div>
              <div className="card">
                <div style={{display:'flex',gap:4,marginBottom:8}}>
                  {[1,2,3,4,5,6,7,8].map(n=>(
                    <div key={n} style={{flex:1,height:14,borderRadius:4,background:n<=(etat?.tomonDansHizbActuel||0)?(etat?.enAttenteHizbComplet?'#EF9F27':'#1D9E75'):'#e8e8e0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {n<=(etat?.tomonDansHizbActuel||0)&&<span style={{fontSize:9,color:'#fff'}}>✓</span>}
                    </div>
                  ))}
                </div>
                {etat?.enAttenteHizbComplet&&<div style={{padding:'8px 12px',background:'#FAEEDA',borderRadius:8,fontSize:12,color:'#633806'}}>{t(lang,'validation_hizb_requise')}</div>}
              </div>
            </>
          )}

          {/* APPRENTISSAGE */}
          {onglet==='apprentissage'&&(
            <>
              <div className="section-label">{t(lang,'suivi_apprentissage')}</div>
              {apprentissages.length===0?<div className="empty">{t(lang,'aucun_suivi')}</div>:(
                <>
                  <div className="table-wrap">
                    <table><thead><tr>
                      <th style={{width:'22%'}}>{t(lang,'tomon_abrev')}</th>
                      <th style={{width:'26%'}}>{t(lang,'debut_apprentissage')}</th>
                      <th style={{width:'26%'}}>{t(lang,'validation_label')}</th>
                      <th style={{width:'14%'}}>{t(lang,'duree')}</th>
                      <th style={{width:'12%'}}>{t(lang,'statut')}</th>
                    </tr></thead>
                    <tbody>
                      {apprentissages.map(appr=>{
                        const validation=validations.find(v=>v.type_validation==='tomon'&&v.hizb_validation===appr.hizb&&v.tomon_debut<=appr.tomon&&(v.tomon_debut+v.nombre_tomon-1)>=appr.tomon);
                        const jours=validation?Math.round((new Date(validation.date_validation)-new Date(appr.date_debut))/(1000*60*60*24)):Math.round((new Date()-new Date(appr.date_debut))/(1000*60*60*24));
                        return(
                          <tr key={appr.id}>
                            <td style={{fontSize:13,fontWeight:500}}>Hizb {appr.hizb}, T.{appr.tomon}</td>
                            <td style={{fontSize:12,color:'#888'}}>{formatDate(appr.date_debut)}</td>
                            <td style={{fontSize:12,color:'#888'}}>{validation?formatDate(validation.date_validation):'—'}</td>
                            <td><span style={{fontSize:12,fontWeight:600,color:jours>14?'#E24B4A':jours>7?'#EF9F27':'#1D9E75'}}>{jours}{t(lang,'jour')}</span></td>
                            <td>{validation?<span className="badge badge-green" style={{fontSize:10}}>✓</span>:<span className="badge badge-amber" style={{fontSize:10}}>{t(lang,'en_cours')}</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                  {(()=>{
                    const valides=apprentissages.filter(a=>validations.find(v=>v.type_validation==='tomon'&&v.hizb_validation===a.hizb&&v.tomon_debut<=a.tomon&&(v.tomon_debut+v.nombre_tomon-1)>=a.tomon));
                    const durees=valides.map(a=>{const v=validations.find(vv=>vv.type_validation==='tomon'&&vv.hizb_validation===a.hizb&&vv.tomon_debut<=a.tomon&&(vv.tomon_debut+vv.nombre_tomon-1)>=a.tomon);return Math.round((new Date(v.date_validation)-new Date(a.date_debut))/(1000*60*60*24));});
                    const moy=durees.length>0?Math.round(durees.reduce((s,d)=>s+d,0)/durees.length):0;
                    const maxD=durees.length>0?Math.max(...durees):0;
                    const minD=durees.length>0?Math.min(...durees):0;
                    return(
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:'1rem'}}>
                        {[{l:t(lang,'duree_moy'),v:`${moy}${t(lang,'jour')}`,c:'#1D9E75',bg:'#E1F5EE'},{l:t(lang,'plus_rapide'),v:`${minD}${t(lang,'jour')}`,c:'#378ADD',bg:'#E6F1FB'},{l:t(lang,'plus_long'),v:`${maxD}${t(lang,'jour')}`,c:maxD>14?'#E24B4A':'#EF9F27',bg:maxD>14?'#FCEBEB':'#FAEEDA'}].map(s=>(
                          <div key={s.l} style={{background:s.bg,borderRadius:10,padding:'12px',textAlign:'center'}}>
                            <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
                            <div style={{fontSize:11,color:s.c,opacity:0.8}}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {/* GRAPHIQUE */}
          {onglet==='graphique'&&(
            <div className="card">
              <div style={{fontSize:13,fontWeight:500,marginBottom:'1rem'}}>{t(lang,'evolution_score')}</div>
              {evolution.length<2?<div className="empty">{t(lang,'pas_assez_donnees')}</div>:(
                <div style={{position:'relative',height:200}}>
                  {[0,25,50,75,100].map(pct=>(
                    <div key={pct} style={{position:'absolute',left:0,right:0,top:`${100-pct}%`,borderTop:'0.5px solid #e8e8e0'}}>
                      <span style={{fontSize:9,color:'#bbb',marginLeft:2}}>{Math.round(maxScore*pct/100)}</span>
                    </div>
                  ))}
                  <svg style={{position:'absolute',left:36,top:0,width:'calc(100% - 36px)',height:'90%'}}>
                    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1D9E75" stopOpacity="0.3"/><stop offset="100%" stopColor="#1D9E75" stopOpacity="0.02"/></linearGradient></defs>
                    {(()=>{const w=100/(evolution.length-1);const pts=evolution.map((p,i)=>`${i*w}%,${100-(p.score/maxScore)*90}%`).join(' ');return(<><polygon points={`0%,100% ${pts} 100%,100%`} fill="url(#g)"/><polyline points={pts} fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinejoin="round"/>{evolution.map((p,i)=><circle key={i} cx={`${i*w}%`} cy={`${100-(p.score/maxScore)*90}%`} r="3" fill="#1D9E75"/>)}</>);})()}
                  </svg>
                </div>
              )}
              <div style={{marginTop:12,display:'flex',gap:16,fontSize:12,color:'#888',flexWrap:'wrap'}}>
                <span>{t(lang,'score_total')}: <strong style={{color:'#1D9E75'}}>{etat?.points.total.toLocaleString()} {t(lang,'pts_abrev')}</strong></span>
                <span>{lang==='ar'?'السرعة':lang==='en'?'Speed':'Vitesse'}: <strong style={{color:vitesse.tendance==='hausse'?'#1D9E75':vitesse.tendance==='baisse'?'#E24B4A':'#888'}}>{vitesse.moyenne} T/{t(lang,'semaines')} {vitesse.tendance==='hausse'?'📈':vitesse.tendance==='baisse'?'📉':'➡️'}</strong></span>
              </div>
            </div>
          )}

          {/* ACTIVITÉ */}
          {onglet==='activite'&&(
            <>
              <div className="card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:500}}>{t(lang,'activite_90')}</div>
                  <div style={{display:'flex',gap:3,alignItems:'center',fontSize:10,color:'#888'}}>
                    <span>{t(lang,'faible')}</span>
                    {['#e8e8e0','#9FE1CB','#5DCAA5','#1D9E75','#085041'].map(c=><div key={c} style={{width:10,height:10,borderRadius:2,background:c}}/>)}
                    <span>{t(lang,'fort')}</span>
                  </div>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {last90.map(day=><div key={day} title={day} style={{width:12,height:12,borderRadius:2,background:heatColor(heatmap[day]||0)}}/>)}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
                {[{lbl:t(lang,'streak_actuel'),val:`${streak} ${t(lang,'semaines')}`,icon:'🔥',color:'#EF9F27',bg:'#FAEEDA'},{lbl:t(lang,'jours_actifs'),val:Object.keys(heatmap).filter(d=>{const p=d.split('/');return(new Date()-new Date(p[2],p[1]-1,p[0]))/(1000*60*60*24)<=90;}).length,icon:'📅',color:'#1D9E75',bg:'#E1F5EE'},{lbl:t(lang,'moy_seance'),val:validations.filter(v=>v.type_validation==='tomon').length>0?(etat?.tomonCumul/validations.filter(v=>v.type_validation==='tomon').length).toFixed(1):'0',icon:'📊',color:'#378ADD',bg:'#E6F1FB'}].map(s=>(
                  <div key={s.lbl} style={{background:s.bg,borderRadius:12,padding:'1rem',textAlign:'center'}}>
                    <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                    <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.val}</div>
                    <div style={{fontSize:11,color:s.color,opacity:0.8}}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* HISTORIQUE */}
          {onglet==='historique'&&(
            validations.length===0?<div className="empty">{t(lang,'aucune_recitation_label')}</div>:(
              <div className="table-wrap">
                <table><thead><tr>
                  <th style={{width:'18%'}}>{t(lang,'date_heure')}</th>
                  <th style={{width:'18%'}}>{t(lang,'statut')}</th>
                  <th style={{width:'24%'}}>{t(lang,'detail')}</th>
                  <th style={{width:'14%'}}>{t(lang,'duree_apprentissage_col')}</th>
                  <th style={{width:'12%'}}>{t(lang,'pts_abrev')}</th>
                  <th style={{width:'14%'}}>{t(lang,'valide_par')}</th>
                </tr></thead>
                <tbody>
                  {validations.map(v=>{
                    const appr=apprentissages.find(a=>a.hizb===v.hizb_validation&&a.tomon===v.tomon_debut);
                    const joursAppr=appr?Math.round((new Date(v.date_validation)-new Date(appr.date_debut))/(1000*60*60*24)):null;
                    return(
                      <tr key={v.id}>
                        <td style={{fontSize:12,color:'#888'}}>{formatDate(v.date_validation)}</td>
                        <td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">{t(lang,'hizb_complets_label')}</span>:<span className="badge badge-blue">{v.nombre_tomon} {t(lang,'tomon_abrev')}</span>}</td>
                        <td style={{fontSize:12,color:'#888'}}>{v.type_validation==='hizb_complet'?`Hizb ${v.hizb_valide}`:v.tomon_debut?`T.${v.tomon_debut}→T.${v.tomon_debut+v.nombre_tomon-1} · H.${v.hizb_validation}`:`${v.nombre_tomon} ${t(lang,'tomon_abrev')}`}</td>
                        <td>{joursAppr!==null?<span style={{fontSize:12,fontWeight:600,color:joursAppr>14?'#E24B4A':joursAppr>7?'#EF9F27':'#1D9E75'}}>{joursAppr}{t(lang,'jour')}</span>:<span style={{color:'#bbb',fontSize:12}}>—</span>}</td>
                        <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{v.type_validation==='hizb_complet'?100:v.nombre_tomon*10} {t(lang,'pts_abrev')}</span></td>
                        <td style={{fontSize:12,color:'#888'}}>{v.valideur?`${v.valideur.prenom} ${v.valideur.nom}`:'—'}</td>
                      </tr>
                    );
                  })}
                </tbody></table>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
