import React, { useState, useEffect } from 'react';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, isSourateNiveauDyn, calcPositionAtteinte, calcUnite, calcPoints, formatDate, formatDateCourt, getInitiales, scoreLabel, calcBadges, calcVitesse, niveauTraduit, calcPointsPeriode, loadBareme, BAREME_DEFAUT } from '../lib/helpers';
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


function PassageNiveauModal({ show, onClose, eleve, etat, user, lang, niveauxDisponibles, niveauxDyn, NIVEAUX_LABELS, nouveauNiveau, setNouveauNiveau, notePassage, setNotePassage, onConfirm, saving, nbSouratesCompletes, totalPtsSourates }) {
  if (!show) return null;
  const estSourateActuel = (niveauxDyn||[]).find(n=>n.code===eleve.code_niveau)?.type==='sourate' || ['5B','5A','2M'].includes(eleve.code_niveau||'');
  const estSourateCible  = nouveauNiveau ? ((niveauxDyn||[]).find(n=>n.code===nouveauNiveau)?.type==='sourate' || ['5B','5A','2M'].includes(nouveauNiveau)) : null;

  // Calcul position de départ dans le nouveau niveau
  const getPositionDepart = () => {
    if (!nouveauNiveau) return null;
    if (estSourateActuel && estSourateCible) {
      return lang==='ar'
        ? `📖 سيبدأ من السورة رقم ${nbSouratesCompletes + 1} في برنامج المستوى الجديد`
        : `📖 Commencera à la sourate n°${nbSouratesCompletes + 1} du programme du nouveau niveau`;
    } else if (!estSourateActuel && !estSourateCible) {
      return lang==='ar'
        ? `📍 سيبدأ من الحزب ${etat?.hizbEnCours||1} الثُّمن ${etat?.prochainTomon||1}`
        : `📍 Commencera au Hizb ${etat?.hizbEnCours||1} T.${etat?.prochainTomon||1}`;
    } else if (estSourateActuel && !estSourateCible) {
      return lang==='ar' ? '📍 سيبدأ من بداية نظام الأحزاب (Hizb 60)' : '📍 Commencera au début du système Hizb (Hizb 60)';
    } else {
      return lang==='ar' ? '📍 سيبدأ من بداية برنامج السور' : '📍 Commencera au début du programme Sourates';
    }
  };
  const positionDepart = getPositionDepart();

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',maxWidth:500,width:'100%'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:'#534AB7',marginBottom:'1rem'}}>
          🎓 {lang==='ar'?'تغيير مستوى الطالب':'Passage de niveau'}
        </div>

        {/* Acquis actuels */}
        <div style={{background:'#F0EEFF',borderRadius:10,padding:'12px',marginBottom:'1rem',fontSize:13}}>
          <div style={{fontWeight:600,color:'#534AB7',marginBottom:8}}>
            {lang==='ar'?'المكتسبات الحالية (ستُحفظ في الأرشيف):':'Acquis actuels (seront archivés) :'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:12}}>
            <div style={{color:'#555'}}>{lang==='ar'?'المستوى:':'Niveau :'} <strong>{eleve.code_niveau}</strong></div>
            <div style={{color:'#555'}}>Pts: <strong>{estSourateActuel ? totalPtsSourates : (etat?.points?.total||0)}</strong></div>
            {estSourateActuel
              ? <div style={{color:'#1D9E75',fontWeight:600}}>📖 {nbSouratesCompletes} {lang==='ar'?'سورة مكتملة':'sourates complètes'}</div>
              : <>
                  <div style={{color:'#555'}}>Tomon: <strong>{etat?.tomonCumul||0}</strong></div>
                  <div style={{color:'#555'}}>Hizb ✓: <strong>{etat?.hizbsComplets?.size||0}</strong></div>
                </>
            }
          </div>
        </div>

        {/* Nouveau niveau */}
        <div className="field-group" style={{marginBottom:'1rem'}}>
          <label className="field-lbl">{lang==='ar'?'المستوى الجديد:':'Nouveau niveau :'}</label>
          <select className="field-select" value={nouveauNiveau} onChange={e=>setNouveauNiveau(e.target.value)}>
            <option value="">{lang==='ar'?'— اختر المستوى —':'— Choisir le niveau —'}</option>
            {niveauxDisponibles.map(n=>(
              <option key={n} value={n}>{NIVEAUX_LABELS[n]||n}</option>
            ))}
          </select>
        </div>

        {/* Position de départ calculée */}
        {positionDepart && (
          <div style={{background:'#E1F5EE',borderRadius:10,padding:'10px 12px',marginBottom:'1rem',fontSize:12,color:'#085041',fontWeight:500}}>
            {positionDepart}
            <div style={{fontSize:11,color:'#1D9E75',marginTop:4,opacity:0.8}}>
              {lang==='ar'?'سيستمر الطالب من حيث توقف تلقائياً':'L\'élève reprend automatiquement là où il s\'est arrêté'}
            </div>
          </div>
        )}

        <div className="field-group" style={{marginBottom:'1.2rem'}}>
          <label className="field-lbl">{lang==='ar'?'ملاحظة (اختياري):':'Note (optionnelle) :'}</label>
          <input className="field-input" value={notePassage} onChange={e=>setNotePassage(e.target.value)} placeholder={lang==='ar'?'سبب الانتقال...':'Raison du passage...'}/>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} className="back-link">{lang==='ar'?'إلغاء':'Annuler'}</button>
          <button onClick={onConfirm} disabled={!nouveauNiveau||saving}
            style={{flex:1,padding:'10px',background:nouveauNiveau&&!saving?'#534AB7':'#ccc',color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:nouveauNiveau?'pointer':'default'}}>
            {saving?'...':(lang==='ar'?'✓ تأكيد الانتقال':'✓ Confirmer le passage')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FicheEleve({ eleve, user, navigate, goBack, lang, isMobile='fr' }) {
  const { toast } = useToast();
  const [validations, setValidations] = useState([]);
  const [apprentissages, setApprentissages] = useState([]);
  const [objectifs, setObjectifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instituteurNom, setInstituteurNom] = useState('—');
  const [etat, setEtat] = useState(null);
  const [onglet, setOnglet] = useState('apercu');
  const [showAcquis, setShowAcquis] = useState(false);
  const [exceptionsHizb, setExceptionsHizb] = useState([]);
  const [murajaa, setMurajaa] = useState([]);
  const [murajaaS, setMurajaaS] = useState([]);
  const [recitationsSouratesEleve, setRecitationsSouratesEleve] = useState([]);
  const [passages, setPassages] = useState([]);
  const [showPassageModal, setShowPassageModal] = useState(false);
  const [nouveauNiveau, setNouveauNiveau] = useState('');
  const [notePassage, setNotePassage] = useState('');
  const [savingPassage, setSavingPassage] = useState(false); // sourate muraja'a
  const [examens, setExamens] = useState([]);
  const [certificats, setCertificats] = useState([]);
  const [jalonsDisp, setJalonsDisp] = useState([]);
  const [periodesDisp, setPeriodesDisp] = useState([]);
  const [baremeEleve, setBaremeEleve] = useState({...BAREME_DEFAUT});
  const [pointsEvenements, setPointsEvenements] = useState([]);
  const [periodeSelectId, setPeriodeSelectId] = useState('mois');
  const [showAddCert, setShowAddCert] = useState(false);
  const [newCertJalonId, setNewCertJalonId] = useState('');
  const [savingCert, setSavingCert] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const now = new Date();
  const [selectedMoisObj, setSelectedMoisObj] = useState(now.getMonth());
  const [selectedAnneeObj, setSelectedAnneeObj] = useState(now.getFullYear());

  useEffect(() => { loadData(); }, [eleve.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).eq('eleve_id',eleve.id).order('date_validation',{ascending:false}),
        supabase.from('apprentissages').select('*')
        .eq('ecole_id', user.ecole_id).eq('eleve_id',eleve.id).order('date_debut',{ascending:false}),
        supabase.from('exceptions_hizb').select('*')
        .eq('ecole_id', user.ecole_id).eq('eleve_id',eleve.id).eq('active',true),
        supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).eq('eleve_id',eleve.id).in('type_validation',['tomon_muraja','hizb_muraja']).order('date_validation',{ascending:false}),
        supabase.from('recitations_sourates').select('*, sourate:sourate_id(nom_ar,numero), valideur:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).eq('eleve_id',eleve.id).eq('is_muraja',true).order('date_validation',{ascending:false}),
        supabase.from('recitations_sourates').select('id,type_recitation,sourate_id,verset_debut,verset_fin,date_validation,valide_par,points,sourate:sourate_id(nom_ar,numero),valideur:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).eq('eleve_id',eleve.id),
        supabase.from('passages_niveau').select('*, valide_par_u:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).eq('eleve_id',eleve.id).order('date_passage',{ascending:false}),
        supabase.from('objectifs').select('*').eq('ecole_id', user.ecole_id).eq('eleve_id',eleve.id).order('created_at',{ascending:false}),
      ]);
      const [r0,r1,r2,r3,r4,r5,r6,r7] = results.map(r=>r.status==='fulfilled'?r.value:{data:[]});
      const vals=r0.data||[], appr=r1.data||[], exhizb=r2.data||[], mval=r3.data||[], mrec=r4.data||[], recSourates=r5.data||[], passData=r6.data||[], objData=r7.data||[];
      setRecitationsSouratesEleve(recSourates);
      if (eleve.instituteur_referent_id) {
        const {data:inst}=await supabase.from('utilisateurs').select('prenom,nom').eq('id',eleve.instituteur_referent_id).single();
        // Charger examens et certificats (tables optionnelles)
        try {
          const exRes = await supabase.from('resultats_examens')
            .select('*').eq('eleve_id',eleve.id).order('created_at',{ascending:false});
          if (exRes.data && exRes.data.length > 0) {
            const examIds = [...new Set(exRes.data.map(r=>r.examen_id).filter(Boolean))];
            const {data:examData} = await supabase.from('examens').select('id,nom,description,score_minimum,bloquant').in('id',examIds);
            const examMap = Object.fromEntries((examData||[]).map(e=>[e.id,e]));
            setExamens(exRes.data.map(r=>({...r, examen:examMap[r.examen_id]||null})));
          } else {
            setExamens([]);
          }
        } catch(e) { setExamens([]); }
        // Charger les vrais certificats depuis certificats_eleves
        try {
          const certRes = await supabase.from('certificats_eleves')
            .select('*').eq('eleve_id',eleve.id).order('created_at',{ascending:false});
          setCertificats(certRes.data || []);
        } catch(e) { setCertificats([]); }
        // Charger barème et points événements
        loadBareme(supabase, eleve.ecole_id).then(b => setBaremeEleve(b));
        supabase.from('points_eleves').select('*').eq('eleve_id', eleve.id).order('date_event')
          .then(({data}) => setPointsEvenements(data||[]));
        // Charger jalons
        try {
          const jalRes = await supabase.from('jalons').select('id,nom,nom_ar').eq('ecole_id',eleve.ecole_id).eq('actif',true).order('created_at');
          setJalonsDisp(jalRes.data || []);
        } catch(e) { setJalonsDisp([]); }

        if(inst) setInstituteurNom(inst.prenom+' '+inst.nom);
      }
      const e = calcEtatEleve(vals||[],eleve.hizb_depart,eleve.tomon_depart);
      setEtat(e);
      setValidations(vals||[]);
      setApprentissages(appr||[]);
      setExceptionsHizb(exhizb||[]);
      setMurajaa(mval||[]);
      setMurajaaS(mrec||[]);
      setPassages(passData||[]);
      setObjectifs(objData||[]);
    } catch(err) {
      toast.error(lang==='ar'?'خطأ في تحميل البيانات':'Erreur de chargement des données');
      // Set minimal etat so page renders
      setEtat(calcEtatEleve([],eleve.hizb_depart,eleve.tomon_depart));
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
      <div><div style="font-size:11px;color:#888">${lang==='ar'?'النقاط المقابلة':lang==='en'?lang==='ar'?'النقاط السابقة':'Prior points':lang==='ar'?'النقاط السابقة':'Points antérieurs'}</div>
      <div style="font-size:18px;font-weight:700;color:#1D9E75">+${(pts.ptsAcquisTotal||0).toLocaleString()} ${t(lang,'pts_abrev')}</div></div>
      <div><div style="font-size:11px;color:#888">${lang==='ar'?'منذ بدء المتابعة':lang==='en'?lang==='ar'?'منذ المتابعة':'Since tracking':lang==='ar'?'منذ المتابعة':'Depuis le suivi'}</div>
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
      <th>${t(lang,'date_heure')}</th><th>${lang==='ar'?'النوع':(lang==='ar'?'النوع':'Type')}</th><th>${t(lang,'detail')}</th>
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



  const objActuel = objectifs.find(o=>o.mois===selectedMoisObj+1&&o.annee===selectedAnneeObj);
  const debutMoisSel = new Date(selectedAnneeObj,selectedMoisObj,1);
  const finMoisSel = new Date(selectedAnneeObj,selectedMoisObj+1,0,23,59,59);
  const tomonMoisSel = validations.filter(v=>v.type_validation==='tomon'&&new Date(v.date_validation)>=debutMoisSel&&new Date(v.date_validation)<=finMoisSel).reduce((s,v)=>s+v.nombre_tomon,0);
  const pctObj = objActuel?Math.min(100,Math.round(tomonMoisSel/objActuel.nombre_tomon*100)):null;
  // Guard: wait for data to load
  if (loading || !etat) return (
    <div style={{padding:'2rem',textAlign:'center'}}>
      <div className="loading">...</div>
      <div style={{marginTop:'1rem',fontSize:13,color:'#888'}}>{eleve?.prenom} {eleve?.nom}</div>
      <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link" style={{marginTop:'1rem'}}>
        ← {lang==='ar'?'رجوع':'Retour'}
      </button>
    </div>
  );

  const pctColor=(p)=>p>=100?'#1D9E75':p>=60?'#EF9F27':'#E24B4A';

  // Redirect 5B/5A AFTER all hooks are declared (React rules of hooks)
  // -- Passage de niveau --
  const NIVEAUX_ORDRE = ['5B','5A','2M','2','1'];
  const NIVEAUX_LABELS = {'5B':'Préscolaire (5B)','5A':'Primaire 1-2 (5A)','2M':'Primaire 3-4 (2M)','2':'Primaire 5-6 (2)','1':'Collège/Lycée (1)'};
  const niveauActuelIdx = NIVEAUX_ORDRE.indexOf(eleve.code_niveau||'1');
  const niveauxDisponibles = NIVEAUX_ORDRE.filter(n=>n!==eleve.code_niveau);

  const handlePassageNiveau = async () => {
    if (!nouveauNiveau) return;
    setSavingPassage(true);
    try {
      // Déterminer le type du niveau actuel et du niveau cible
      const niveauxCtxP = typeof niveaux !== 'undefined' ? niveaux : [];
      const estSourateActuel = isSourateNiveauDyn(eleve.code_niveau, niveauxCtxP);
      const estSourateCible  = isSourateNiveauDyn(nouveauNiveau, niveauxCtxP);

      // Calcul des acquis actuels
      const nbSouratesActuelles = recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length;
      const hizbActuel  = etat?.hizbEnCours || 1;
      const tomonActuel = etat?.prochainTomon || 1;

      // Chercher une règle configurée pour ce passage
      const { data: regleData } = await supabase.from('regles_passage_niveau')
        .select('*')
        .eq('ecole_id', user.ecole_id)
        .eq('niveau_from', eleve.code_niveau)
        .eq('niveau_to', nouveauNiveau)
        .eq('actif', true)
        .maybeSingle();

      // 1. Archive les acquis du niveau actuel
      const acquis = {
        eleve_id: eleve.id,
        ecole_id: user.ecole_id,
        niveau_from: eleve.code_niveau,
        niveau_to: nouveauNiveau,
        valide_par: user.id,
        acquis_tomon: etat?.tomonCumul||0,
        acquis_hizb: etat?.hizbsComplets?.size||0,
        acquis_sourates: estSourateActuel ? nbSouratesActuelles : parseInt(eleve.sourates_acquises)||0,
        acquis_points: estSourateActuel ? totalPtsSourates : (etat?.points?.total||0),
        note: notePassage||null,
        date_passage: new Date().toISOString(),
      };
      const { error: errPassage } = await supabase.from('passages_niveau').insert(acquis);
      if (errPassage) throw errPassage;

      // 2. Calculer la position de départ dans le nouveau niveau
      let resetData = { code_niveau: nouveauNiveau };

      if (regleData) {
        // Règle configurée par l'école — s'applique en priorité
        if (regleData.type_depart === 'personnalise') {
          resetData.hizb_depart = regleData.hizb_depart_fixe || 0;
          resetData.tomon_depart = regleData.tomon_depart_fixe || 1;
          resetData.sourates_acquises = regleData.sourates_acquises_fixe || 0;
        } else if (regleData.type_depart === 'debut') {
          resetData.hizb_depart = 0;
          resetData.tomon_depart = 1;
          resetData.sourates_acquises = 0;
        } else { // 'continuer' — comportement intelligent
          if (estSourateActuel && estSourateCible) {
            resetData.sourates_acquises = nbSouratesActuelles;
            resetData.hizb_depart = 0;
            resetData.tomon_depart = 1;
          } else if (!estSourateActuel && !estSourateCible) {
            resetData.hizb_depart = hizbActuel;
            resetData.tomon_depart = tomonActuel;
            resetData.sourates_acquises = 0;
          } else {
            resetData.hizb_depart = 0;
            resetData.tomon_depart = 1;
            resetData.sourates_acquises = 0;
          }
        }
      } else {
        // Pas de règle → comportement par défaut : continuer depuis position actuelle
        if (estSourateActuel && estSourateCible) {
          resetData.sourates_acquises = nbSouratesActuelles;
          resetData.hizb_depart = 0;
          resetData.tomon_depart = 1;
        } else if (!estSourateActuel && !estSourateCible) {
          resetData.hizb_depart = hizbActuel;
          resetData.tomon_depart = tomonActuel;
          resetData.sourates_acquises = 0;
        } else {
          resetData.hizb_depart = 0;
          resetData.tomon_depart = 1;
          resetData.sourates_acquises = 0;
        }
      }

      const { error: errEleve } = await supabase.from('eleves').update(resetData).eq('id', eleve.id);
      if (errEleve) throw errEleve;

      // 3. Archiver les validations du niveau actuel (optionnel — on les garde pour historique)
      // Les recitations_sourates et validations restent en DB pour l'historique

      setShowPassageModal(false);
      setNouveauNiveau('');
      setNotePassage('');
      await loadData();
      toast.success(lang==='ar'?'✅ تم تغيير المستوى بنجاح':'✅ Passage de niveau enregistré !');
      navigate('dashboard');
    } catch(err) {
      toast.error(lang==='ar'?'خطأ في تغيير المستوى':'Erreur passage de niveau: '+err.message);
    }
    setSavingPassage(false);
  };

  const ajouterCertificatManuellement = async () => {
    if (!newCertJalonId) return;
    setSavingCert(true);
    const jalon = jalonsDisp.find(j=>j.id===newCertJalonId);
    await supabase.from('certificats_eleves').insert({
      eleve_id: eleve.id,
      ecole_id: eleve.ecole_id,
      jalon_id: newCertJalonId,
      nom_certificat: jalon?.nom_ar || jalon?.nom || 'شهادة',
      nom_certificat_ar: jalon?.nom_ar || null,
      date_obtention: new Date().toISOString(),
      valide_par: user?.id || null,
    });
    const certRes = await supabase.from('certificats_eleves').select('*').eq('eleve_id',eleve.id).order('created_at',{ascending:false});
    setCertificats(certRes.data || []);
    setShowAddCert(false);
    setNewCertJalonId('');
    setSavingCert(false);
  };

  const _niveauxCtx = typeof niveaux !== 'undefined' ? niveaux : [];
  const estSourateEleve = isSourateNiveauDyn(eleve.code_niveau, _niveauxCtx);

  const totalPtsSourates = recitationsSouratesEleve.reduce((s,r)=>s+(r.points||0),0);
  const nbSouratesCompletes = recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length;
  const sl = estSourateEleve
    ? scoreLabel(nbSouratesCompletes * 30) // simulate score for label color
    : (etat ? scoreLabel(etat.points.total) : {color:'#888',bg:'#f0f0ec',label:'—'});
  const badges = etat ? calcBadges(validations,etat) : [];

  const validationsOuRecitations = estSourateEleve ? [] : validations;
  const vitesse = estSourateEleve ? (() => {
    const nbCompletes = recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length;
    if (nbCompletes === 0) return { moyenne: 0, tendance: 'stable' };
    const oldest = recitationsSouratesEleve.filter(r=>r.date_validation).sort((a,b)=>new Date(a.date_validation)-new Date(b.date_validation))[0];
    const semaines = oldest ? Math.max(1, Math.ceil((new Date() - new Date(oldest.date_validation)) / (1000*60*60*24*7))) : 1;
    return { moyenne: (nbCompletes / semaines).toFixed(1), tendance: 'stable' };
  })() : calcVitesse(validations);
  const streak = estSourateEleve ? 0 : calcStreak(validations);
  const heatmapSourates = {};
  recitationsSouratesEleve.forEach(r => {
    if (r.date_validation) {
      const d = new Date(r.date_validation).toLocaleDateString('fr-FR');
      heatmapSourates[d] = (heatmapSourates[d]||0) + 1;
    }
  });
  const heatmap = estSourateEleve ? heatmapSourates : calcHeatmap(validations);
  const evolutionSourates = (() => {
    let cumul = 0;
    return [...recitationsSouratesEleve].reverse().map(r => { cumul += (r.points||0); return { score: cumul, date: r.date_validation }; });
  })();
  const evolution = estSourateEleve ? evolutionSourates : calcEvolution(validations);
  const maxScore = Math.max(...evolution.map(p=>p.score),1);
  const last90 = Array.from({length:90},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(89-i));return d.toLocaleDateString('fr-FR');});
  const heatColor = (c) => !c?'#e8e8e0':c>=6?'#085041':c>=4?'#1D9E75':c>=2?'#5DCAA5':'#9FE1CB';
  // Tous les élèves utilisent FicheEleve (FicheSourate gardé pour compatibilité)
  // if (_niveauxCtx.some(n=>n.code===eleve.code_niveau&&n.type==='sourate') || ['5B','5A','2M'].includes(eleve.code_niveau)) {
  //   return <FicheSourate eleve={eleve} user={user} navigate={navigate} lang={lang} />;
  // }

  // Helper couleur niveau
  const getNiveauColor = (code, niveauxList=[]) =>
    (niveauxList||[]).find(n=>n.code===code)?.couleur ||
    {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[code] || '#888';

  if (isMobile) {
    const sl2 = estSourateEleve ? scoreLabel(totalPtsSourates) : (etat ? scoreLabel(etat.points.total) : {color:'#888',bg:'#f0f0ec',label:'—'});
    const _niveauxFe = typeof niveaux !== 'undefined' ? niveaux : [];
    const nc = getNiveauColor(eleve.code_niveau||'1', _niveauxFe);
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        {/* Sticky header */}
        <div style={{background:`linear-gradient(135deg,#378ADD,#0C447C)`, position:'sticky', top:0, zIndex:100}}>
          <div style={{display:'flex', alignItems:'center', gap:12, padding:'48px 16px 12px'}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', borderRadius:10, padding:'8px 12px', color:'#fff', fontSize:16}}>
              
            </button>
            <div style={{flex:1}}>
              <div style={{fontSize:17, fontWeight:800}}>{eleve.prenom} {eleve.nom}</div>
              <div style={{display:'flex', gap:6, alignItems:'center', marginTop:2}}>
                <span style={{padding:'1px 8px', borderRadius:10, fontSize:11, fontWeight:700, background:`${nc}20`, color:nc}}>
                  {eleve.code_niveau||'?'}
                </span>
                <span style={{fontSize:12, color:'#888'}}>{instituteurNom}</span>
              </div>
            </div>
            <button onClick={()=>navigate('enregistrer', eleve)}
              style={{background:'#1D9E75', color:'#fff', border:'none', borderRadius:10,
                padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
              + {lang==='ar'?'استظهار':'Récit.'}
            </button>
          </div>
          {/* Score banner */}
          <div style={{background:`${sl2.bg}`, padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{fontSize:13, color:sl2.color, fontWeight:600}}>{sl2.label}</div>
            <div style={{fontSize:26, fontWeight:800, color:sl2.color}}>{estSourateEleve?totalPtsSourates.toLocaleString():(etat?.points?.total?.toLocaleString()||0)} pts</div>
          </div>
          {/* Onglets scrollables */}
          <div style={{display:'flex', overflowX:'auto', scrollbarWidth:'none', borderTop:'0.5px solid #f0f0ec'}}>
            {[
              {k:'apercu',      label: lang==='ar'?'السجل':'Aperçu'},
              {k:'progression', label: lang==='ar'?'التقدم':'Progression'},
              {k:'historique',  label: lang==='ar'?'التاريخ':'Historique'},
              {k:'muraja',      label: lang==='ar'?'المراجعة':"Murajaʼa"},
              {k:'objectifs',   label: lang==='ar'?'الأهداف':'Objectifs'},
              {k:'examens',     label: lang==='ar'?'الامتحانات':'Examens'},
              {k:'certificats', label: lang==='ar'?'الشهادات':'Certificats'},
              {k:'notes',       label: lang==='ar'?'النقاط':'Points'},
            ].map(tab=>(
              <div key={tab.k} onClick={()=>setOnglet(tab.k)}
                style={{padding:'10px 16px', fontSize:13, fontWeight:600, whiteSpace:'nowrap',
                  cursor:'pointer', flexShrink:0,
                  color: onglet===tab.k ? '#085041' : '#888',
                  borderBottom: onglet===tab.k ? '2px solid #1D9E75' : '2px solid transparent',
                  transition:'all 0.15s'}}>
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && <div style={{textAlign:'center', padding:'2rem', color:'#888'}}>...</div>}

        {/* Content */}
        {!loading && (
          <div style={{padding:'12px 12px'}}>
            {onglet==='progression' && (
              <div>
                {/* KPI cards */}
                <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:12}}>
                  {(estSourateEleve ? [
                    {label:lang==='ar'?'السور المكتملة':'Sourates complètes', val:recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length, color:'#1D9E75', bg:'#E1F5EE'},
                    {label:lang==='ar'?'المقاطع':'Séquences', val:recitationsSouratesEleve.filter(r=>r.type_recitation==='sequence').length, color:'#534AB7', bg:'#F0EEFF'},
                    {label:lang==='ar'?'المحفوظات':'Acquis', val:eleve.sourates_acquises||0, color:'#378ADD', bg:'#E6F1FB'},
                    {label:'Total', val:totalPtsSourates||0, color:'#EF9F27', bg:'#FAEEDA'},
                  ] : [
                    {label:lang==='ar'?'الثُّمن الحالي':'Tomon actuel', val:`T.${etat?.prochainTomon||'—'}`, color:'#1D9E75', bg:'#E1F5EE'},
                    {label:lang==='ar'?'الحزب الحالي':'Hizb en cours', val:`H.${etat?.hizbEnCours||'—'}`, color:'#534AB7', bg:'#F0EEFF'},
                    {label:lang==='ar'?'الثُّمنات المكتملة':'Tomon cumulés', val:etat?.tomonCumul||0, color:'#378ADD', bg:'#E6F1FB'},
                    {label:lang==='ar'?'الأحزاب المكتملة':'Hizb complets', val:etat?.hizbsComplets?.size||0, color:'#EF9F27', bg:'#FAEEDA'},
                  ]).map((k,i)=>(
                    <div key={i} style={{background:k.bg, borderRadius:12, padding:'14px', textAlign:'center', border:`0.5px solid ${k.color}20`}}>
                      <div style={{fontSize:24, fontWeight:800, color:k.color}}>{k.val}</div>
                      <div style={{fontSize:11, color:k.color, marginTop:4, opacity:0.8}}>{k.label}</div>
                    </div>
                  ))}
                </div>
                {/* Streak + badges */}
                {streak>0 && (
                  <div style={{background:'#E6F1FB', borderRadius:12, padding:'12px 14px', marginBottom:10,
                    display:'flex', alignItems:'center', gap:10}}>
                    <span style={{fontSize:24}}>🔥</span>
                    <div>
                      <div style={{fontWeight:700, color:'#0C447C'}}>{streak} jours de suite</div>
                      <div style={{fontSize:12, color:'#378ADD'}}>Continuez comme ça !</div>
                    </div>
                  </div>
                )}
                {etat?.enAttenteHizbComplet && (
                  <div style={{background:'#FAEEDA', borderRadius:12, padding:'12px 14px', marginBottom:10,
                    display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontWeight:700, color:'#633806'}}>🎉 Hizb complet !</div>
                      <div style={{fontSize:12, color:'#856404'}}>Prêt pour validation</div>
                    </div>
                    <button onClick={()=>navigate('enregistrer', eleve)}
                      style={{background:'#EF9F27', color:'#fff', border:'none', borderRadius:10,
                        padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
                      Valider
                    </button>
                  </div>
                )}
              </div>
            )}
            {onglet==='historique' && (
              <div>
                {passages.length>0 && (
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:6}}>
                      {lang==='ar'?'سجل الانتقالات':'Passages de niveau'}
                    </div>
                    {passages.map(p=>(
                      <div key={p.id} style={{background:'#F0EEFF',borderRadius:10,padding:'10px 12px',marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:16}}>🎓</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,color:'#534AB7',fontSize:13}}>{p.niveau_from} → {p.niveau_to}</div>
                          <div style={{fontSize:11,color:'#888'}}>{new Date(p.date_passage).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</div>
                        </div>
                        <div style={{fontSize:12,color:'#888'}}>+{p.acquis_points} pts</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:6}}>
                  {lang==='ar'?'آخر الاستظهارات':'Dernières récitations'}
                </div>
                {estSourateEleve ? (
                  <>
                    {recitationsSouratesEleve.slice(0,20).map(r=>(
                      <div key={r.id} style={{background:'#fff',borderRadius:10,padding:'10px 12px',marginBottom:6,
                        border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:10}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13,direction:'rtl'}}>
                            {r.sourate?.nom_ar || '—'}
                            {r.type_recitation==='sequence'&&r.verset_debut&&
                              <span style={{fontSize:11,color:'#888',marginRight:6}}> (V.{r.verset_debut}→{r.verset_fin})</span>}
                          </div>
                          <div style={{fontSize:11,color:'#888'}}>{new Date(r.date_validation||r.created_at).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</div>
                        </div>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                          background:r.type_recitation==='complete'?'#E1F5EE':'#F0EEFF',
                          color:r.type_recitation==='complete'?'#1D9E75':'#534AB7',fontWeight:600}}>
                          {r.type_recitation==='complete'?(lang==='ar'?'كاملة':'Complète'):(lang==='ar'?'مقطع':'Séquence')}
                        </span>
                      </div>
                    ))}
                    {recitationsSouratesEleve.length===0&&(
                      <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>{t(lang,'aucune_recitation_label')}</div>
                    )}
                  </>
                ) : (
                  <>
                    {validations.slice(0,20).map(v=>(
                      <div key={v.id} style={{background:'#fff',borderRadius:10,padding:'10px 12px',marginBottom:6,
                        border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:10}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13}}>
                            {v.type_validation==='hizb_complet'?'Hizb complet':`T.${v.tomon_debut} ×${v.nombre_tomon}`}
                          </div>
                          <div style={{fontSize:11,color:'#888'}}>{new Date(v.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</div>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:'#1D9E75'}}>
                          +{v.type_validation==='hizb_complet'?100:v.nombre_tomon*30} pts
                        </span>
                      </div>
                    ))}
                    {validations.length===0&&(
                      <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>{t(lang,'aucune_recitation_label')}</div>
                    )}
                  </>
                )}
              </div>
            )}
            {onglet==='apercu' && (
              <div>
                <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:8}}>
                  {lang==='ar'?'آخر النشاطات':'Activité récente'}
                </div>
                {[...validations].sort((a,b)=>new Date(b.date_validation)-new Date(a.date_validation)).slice(0,15).map((v,i)=>{
                  const isSourate = v.sourate_id !== undefined;
                  const pts = isSourate?(v.type_recitation==='complete'?30:10):(v.type_validation==='hizb_complet'?100:(v.nombre_tomon||1)*30);
                  return(
                    <div key={i} style={{background:'#fff',borderRadius:10,padding:'10px 12px',marginBottom:6,
                      border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:16}}>{isSourate?'📖':'✅'}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13}}>
                          {isSourate?(v.sourate?.nom_ar||'Sourate'):(v.type_validation==='hizb_complet'?'Hizb complet':`T.${v.tomon_debut} ×${v.nombre_tomon}`)}
                        </div>
                        <div style={{fontSize:11,color:'#888'}}>{new Date(v.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</div>
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:'#1D9E75'}}>+{pts}</span>
                    </div>
                  );
                })}
                {validations.length===0&&(
                  <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>{lang==='ar'?'لا توجد نشاطات':'Aucune activité'}</div>
                )}
              </div>
            )}
            {onglet==='objectifs' && (
              <div>
                {objectifs&&objectifs.filter(o=>o.eleve_id===eleve.id).length>0 ? objectifs.filter(o=>o.eleve_id===eleve.id).map((obj,i)=>(
                  <div key={i} style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:10,border:'0.5px solid #e0e0d8'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <div style={{fontWeight:700,fontSize:14,color:'#085041',flex:1,marginRight:8}}>{obj.titre||obj.type||'Objectif'}</div>
                      <span style={{fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:10,flexShrink:0,
                        color:obj.atteint?'#1D9E75':'#EF9F27',background:obj.atteint?'#E1F5EE':'#FAEEDA'}}>
                        {obj.atteint?(lang==='ar'?'مكتمل':'Atteint'):(lang==='ar'?'قيد التنفيذ':'En cours')}
                      </span>
                    </div>
                    {obj.description&&<div style={{fontSize:12,color:'#888',marginBottom:8}}>{obj.description}</div>}
                    {obj.valeur_cible&&(
                      <div>
                        <div style={{height:6,background:'#f0f0ec',borderRadius:3,overflow:'hidden'}}>
                          <div style={{height:'100%',background:'#1D9E75',borderRadius:3,
                            width:`${Math.min(100,Math.round(((obj.valeur_actuelle||0)/obj.valeur_cible)*100))}%`}}/>
                        </div>
                        <div style={{fontSize:11,color:'#888',marginTop:4}}>{obj.valeur_actuelle||0}/{obj.valeur_cible}</div>
                      </div>
                    )}
                  </div>
                )) : (
                  <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>{lang==='ar'?'لا توجد أهداف':'Aucun objectif'}</div>
                )}
              </div>
            )}
            {onglet==='examens' && (
              <div style={{padding:'1rem 0'}}>
                {examens.length===0 ? (
                  <div style={{textAlign:'center',color:'#aaa',padding:'2rem',fontSize:13}}>
                    {lang==='ar'?'لا توجد نتائج امتحانات':'Aucun résultat d\'examen'}
                  </div>
                ) : examens.map(r=>{
                  const STATUTS={reussi:{label:'Réussi',color:'#1D9E75',bg:'#E1F5EE'},echoue:{label:'Échoué',color:'#E24B4A',bg:'#FCEBEB'},en_cours:{label:'En cours',color:'#EF9F27',bg:'#FAEEDA'},annule:{label:'Annulé',color:'#888',bg:'#f5f5f0'}};
                  const m=STATUTS[r.statut]||STATUTS.en_cours;
                  const examNom = r.examen?.nom || (lang==='ar'?'امتحان':'Examen');
                  const statutLabel = r.statut==='reussi'?(lang==='ar'?'ناجح ✓':'Réussi ✓'):r.statut==='echoue'?(lang==='ar'?'راسب ✗':'Échoué ✗'):(lang==='ar'?'معلق':'En cours');
                  return(
                    <div key={r.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'14px',marginBottom:8}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                        <div style={{fontSize:14,fontWeight:700,color:'#1a1a1a'}}>{examNom}</div>
                        <span style={{padding:'3px 12px',borderRadius:20,fontSize:11,fontWeight:700,background:m.bg,color:m.color}}>{statutLabel}</span>
                      </div>
                      <div style={{display:'flex',gap:12,fontSize:12,color:'#888',flexWrap:'wrap',alignItems:'center'}}>
                        <span>📅 {r.date_examen?new Date(r.date_examen).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—'}</span>
                        <span>📊 {lang==='ar'?'النتيجة:':'Score:'} <strong style={{color:'#1a1a1a'}}>{r.score||0}</strong>{r.examen?.score_minimum?` / ${r.examen.score_minimum}`:''}</span>
                        {r.examen?.bloquant&&r.statut==='echoue'&&<span style={{color:'#E24B4A',fontWeight:600}}>🔒 {lang==='ar'?'موقوف':'Bloqué'}</span>}
                        {r.certificat_genere&&<span style={{color:'#1D9E75',fontWeight:600}}>🏅 {lang==='ar'?'شهادة مُنحت':'Certificat émis'}</span>}
                        {r.notes_examinateur&&<span style={{fontStyle:'italic'}}>💬 {r.notes_examinateur}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {onglet==='certificats' && (
              <div style={{padding:'1rem 0'}}>
                {certificats.length===0 ? (
                  <div style={{textAlign:'center',color:'#aaa',padding:'2rem',fontSize:13}}>
                    {lang==='ar'?'لا توجد شهادات بعد — ستظهر تلقائياً عند بلوغ مرحلة':"Aucun certificat — apparaissent automatiquement lors d'un jalon"}
                  </div>
                ) : certificats.map(cert=>(
                  <div key={cert.id} style={{background:'linear-gradient(135deg,#378ADD,#0C447C)',border:'1px solid #EF9F2740',borderRadius:14,padding:'16px',marginBottom:10,display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:52,height:52,borderRadius:14,background:'#FAEEDA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>🏅</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#085041',direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{cert.nom_certificat_ar||cert.nom_certificat}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:4}}>
                        📅 {cert.date_obtention ? new Date(cert.date_obtention).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'long',year:'numeric'}) : '—'}
                      </div>
                    </div>
                    <span style={{fontSize:22}}>🎓</span>
                  </div>
                ))}
              </div>
            )}


            {onglet==='notes' && (() => {
              const niveauxCtx = typeof niveaux !== 'undefined' ? niveaux : [];
              const estSourate = isSourateNiveauDyn(eleve.code_niveau, niveauxCtx);
              // Pour élèves sourate : pts depuis recitationsSouratesEleve
              const ptsSourTot = recitationsSouratesEleve.reduce((s,r)=>s+(r.points||0),0);
              const ptsSourCompl = recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').reduce((s,r)=>s+(r.points||0),0);
              const nbSourCompl = recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length;
              const nbSourSeq = recitationsSouratesEleve.filter(r=>r.type_recitation==='sequence').length;
              const pts = estSourate
                ? { total: ptsSourTot, tomonPeriode: nbSourCompl, ptsTomon: ptsSourCompl, ptsEnsembles:0, ptsExamens: examens.reduce((s,e)=>s+(e.score||0),0), ptsCertificats: certificats.length*50, hizbsPeriode:0, ptsHizb:0, ptsRoboe:0, ptsNisf:0, details:{nbRoboe:0,nbNisf:0,nbHizb:0} }
                : calcPointsPeriode(validations||[], new Date('2000-01-01'), new Date(), baremeEleve, pointsEvenements);
              return (
                <div style={{padding:'1rem 0'}}>
                  {/* Total depuis le début */}
                  <div style={{background:'linear-gradient(135deg,#378ADD,#0C447C)',borderRadius:14,padding:'14px 16px',marginBottom:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{color:'rgba(255,255,255,0.8)',fontSize:11}}>{lang==='ar'?'المجموع الكلي منذ بداية المتابعة':'Total depuis le début du suivi'}</div>
                    <div style={{color:'#fff',fontWeight:800,fontSize:22}}>{pts.total.toLocaleString()} <span style={{fontSize:11,opacity:0.8}}>{lang==='ar'?'ن':'pts'}</span></div>
                  </div>



                  {/* Détail selon type élève */}
                  {estSourate ? (
                    // ── Élève Sourates ──
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      {[
                        {label:lang==='ar'?'السور المستظهرة':'Sourates récitées', val:nbSourCompl, pts:ptsSourCompl, color:'#534AB7', bg:'#EEEDFE', icon:'📜'},
                        {label:lang==='ar'?'المقاطع':'Séquences', val:nbSourSeq, pts:recitationsSouratesEleve.filter(r=>r.type_recitation==='sequence').reduce((s,r)=>s+(r.points||0),0), color:'#1D9E75', bg:'#E1F5EE', icon:'📌'},
                        {label:lang==='ar'?'الامتحانات':'Examens', val:'', pts:pts.ptsExamens||0, color:'#EF9F27', bg:'#FAEEDA', icon:'📝'},
                        {label:lang==='ar'?'الشهادات':'Certificats', val:certificats.length, pts:pts.ptsCertificats||0, color:'#085041', bg:'#E1F5EE', icon:'🏅'},
                      ].map((row,i)=>(
                        <div key={i} style={{background:row.bg,borderRadius:12,padding:'12px',border:`0.5px solid ${row.color}20`}}>
                          <div style={{fontSize:18,marginBottom:4}}>{row.icon}</div>
                          <div style={{fontSize:11,color:'#888'}}>{row.label}</div>
                          <div style={{fontSize:20,fontWeight:800,color:row.color}}>{row.val!==''?row.val:'—'}</div>
                          <div style={{fontSize:10,color:row.color,opacity:0.8}}>{row.pts>0?`+${row.pts} ${lang==='ar'?'ن':'pts'}`:'—'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // ── Élève Hizb ──
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      {[
                        {label:lang==='ar'?'الأثمان':'Tomon validés', val:pts.tomonPeriode, pts:pts.ptsTomon, color:'#378ADD', bg:'#E6F1FB', icon:'📖'},
                        {label:lang==='ar'?'الأرباع':'Roboâ', val:pts.details?.nbRoboe||0, pts:pts.ptsRoboe, color:'#1D9E75', bg:'#E1F5EE', icon:'✦'},
                        {label:lang==='ar'?'الأنصاف':'Nisf', val:pts.details?.nbNisf||0, pts:pts.ptsNisf, color:'#EF9F27', bg:'#FAEEDA', icon:'◈'},
                        {label:lang==='ar'?'أحزاب كاملة':'Hizb complets', val:pts.hizbsPeriode, pts:pts.ptsHizb, color:'#085041', bg:'#E1F5EE', icon:'🎯'},
                        {label:lang==='ar'?'الامتحانات':'Examens', val:'', pts:pts.ptsExamens||0, color:'#EF9F27', bg:'#FAEEDA', icon:'📝'},
                        {label:lang==='ar'?'الشهادات':'Certificats', val:'', pts:pts.ptsCertificats||0, color:'#D85A30', bg:'#FAECE7', icon:'🏅'},
                      ].map((row,i)=>(
                        <div key={i} style={{background:row.bg,borderRadius:12,padding:'12px',border:`0.5px solid ${row.color}20`}}>
                          <div style={{fontSize:18,marginBottom:4}}>{row.icon}</div>
                          <div style={{fontSize:11,color:'#888'}}>{row.label}</div>
                          <div style={{fontSize:20,fontWeight:800,color:row.color}}>{row.val!==''?row.val:'—'}</div>
                          <div style={{fontSize:10,color:row.color,opacity:0.8}}>{row.pts>0?`+${row.pts} ${lang==='ar'?'ن':'pts'}`:'—'}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pts.total===0 && (
                    <div style={{textAlign:'center',color:'#aaa',padding:'1.5rem',fontSize:13}}>
                      {lang==='ar'?'لا توجد استظهارات في هذه الفترة':'Aucune récitation sur cette période'}
                    </div>
                  )}
                </div>
              );
            })()}


            {onglet==='muraja' && (
              <div>
                {(murajaa.length+murajaaS.length)===0 ? (
                  <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>
                    {lang==='ar'?'لا توجد مراجعات':"Aucune muraja'a"}
                  </div>
                ) : [...murajaa,...murajaaS].sort((a,b)=>new Date(b.date_validation||b.date_validation)-new Date(a.date_validation||a.date_validation)).slice(0,20).map((v,i)=>(
                  <div key={i} style={{background:'#fff',borderRadius:10,padding:'10px 12px',marginBottom:6,
                    border:'0.5px solid #EF9F2730',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:16}}>📖</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13}}>
                        {v.type_validation==='hizb_muraja'?`Hizb ${v.hizb_validation}`:v.sourate?.nom_ar||"Murajaʼa"}
                      </div>
                      <div style={{fontSize:11,color:'#888'}}>{new Date(v.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</div>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:'#EF9F27'}}>
                      +{v.type_validation==='hizb_muraja'?100:30} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Passage niveau FAB - surveillant only */}
        {user.role==='surveillant' && (
          <button onClick={()=>{setNouveauNiveau('');setNotePassage('');setShowPassageModal(true);}}
            style={{position:'fixed',bottom:80,right:16,background:'#534AB7',color:'#fff',
              border:'none',borderRadius:14,padding:'10px 16px',fontSize:14,fontWeight:700,
              cursor:'pointer',zIndex:150,boxShadow:'0 4px 16px rgba(83,74,183,0.4)',fontFamily:'inherit'}}>
            🎓 Niveau
          </button>
        )}

        {/* Modal passage niveau - kept as is */}
        {showPassageModal&&(
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end'}}
            onClick={()=>setShowPassageModal(false)}>
            <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'1.5rem',width:'100%',maxHeight:'85vh',overflowY:'auto'}}
              onClick={e=>e.stopPropagation()}>
              <div style={{width:36,height:4,background:'#e0e0d8',borderRadius:2,margin:'0 auto 16px'}}/>
              <div style={{fontSize:16,fontWeight:700,color:'#534AB7',marginBottom:'1rem'}}>
                🎓 {lang==='ar'?'تغيير مستوى الطالب':'Passage de niveau'}
              </div>
              <div style={{background:'#F0EEFF',borderRadius:10,padding:'10px 12px',marginBottom:'1rem',fontSize:12}}>
                <div style={{fontWeight:600,color:'#534AB7',marginBottom:6}}>{lang==='ar'?'المكتسبات الحالية:':'Acquis actuels :'}</div>
                {estSourateEleve
                  ? <div style={{color:'#1D9E75',fontWeight:600}}>📖 {nbSouratesCompletes} {lang==='ar'?'سورة مكتملة':'sourates'} · {totalPtsSourates} pts</div>
                  : <div style={{color:'#555'}}>Hizb {etat?.hizbEnCours} · T.{etat?.prochainTomon} · {etat?.points?.total||0} pts</div>
                }
              </div>
              <div style={{marginBottom:'1rem'}}>
                <label style={{fontSize:13,fontWeight:600,color:'#444',display:'block',marginBottom:6}}>
                  {lang==='ar'?'المستوى الجديد:':'Nouveau niveau :'}
                </label>
                <select style={{width:'100%',padding:'13px 16px',borderRadius:12,border:'0.5px solid #e0e0d8',fontSize:16,fontFamily:'inherit',boxSizing:'border-box'}}
                  value={nouveauNiveau} onChange={e=>setNouveauNiveau(e.target.value)}>
                  <option value="">{lang==='ar'?'-- اختر --':'-- Choisir --'}</option>
                  {NIVEAUX_DISPONIBLES.map(n=>(
                    <option key={n} value={n}>{NIVEAUX_LABELS[n]||n}</option>
                  ))}
                </select>
              </div>
              {nouveauNiveau&&(()=>{
                const cible = isSourateNiveauDyn(nouveauNiveau, _niveauxCtx);
                let msg = '';
                if (estSourateEleve && cible) msg = lang==='ar'?`📖 سيبدأ من السورة رقم ${nbSouratesCompletes+1}`:`📖 Départ sourate n°${nbSouratesCompletes+1}`;
                else if (!estSourateEleve && !cible) msg = lang==='ar'?`📍 سيبدأ من Hizb ${etat?.hizbEnCours||1} T.${etat?.prochainTomon||1}`:`📍 Départ Hizb ${etat?.hizbEnCours||1} T.${etat?.prochainTomon||1}`;
                else if (estSourateEleve && !cible) msg = lang==='ar'?'📍 بداية نظام الأحزاب':'📍 Début système Hizb';
                else msg = lang==='ar'?'📍 بداية برنامج السور':'📍 Début programme Sourates';
                return <div style={{background:'#E1F5EE',borderRadius:10,padding:'10px 12px',marginBottom:'1rem',fontSize:12,color:'#085041',fontWeight:500}}>{msg}</div>;
              })()}
              <div style={{marginBottom:'1.2rem'}}>
                <label style={{fontSize:13,fontWeight:600,color:'#444',display:'block',marginBottom:6}}>
                  {lang==='ar'?'ملاحظة:':'Note :'}
                </label>
                <input style={{width:'100%',padding:'13px 16px',borderRadius:12,border:'0.5px solid #e0e0d8',fontSize:16,fontFamily:'inherit',boxSizing:'border-box'}}
                  value={notePassage} onChange={e=>setNotePassage(e.target.value)}
                  placeholder={lang==='ar'?'سبب الانتقال...':'Raison...'}/>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setShowPassageModal(false)}
                  style={{flex:1,padding:'14px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  {lang==='ar'?'إلغاء':'Annuler'}
                </button>
                <button onClick={handlePassageNiveau} disabled={!nouveauNiveau||savingPassage}
                  style={{flex:2,padding:'14px',background:nouveauNiveau&&!savingPassage?'#534AB7':'#ccc',color:'#fff',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:15}}>
                  {savingPassage?'...':(lang==='ar'?'✓ تأكيد الانتقال':'✓ Confirmer')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:18,cursor:'pointer',minWidth:38}}>←</button>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-secondary" onClick={handlePrint} style={{fontSize:12,padding:'6px 14px'}}>{t(lang,'imprimer_pdf')}</button>
          {user.role==='surveillant'&&(
            <button onClick={()=>{setNouveauNiveau('');setNotePassage('');setShowPassageModal(true);}}
              style={{padding:'6px 14px',fontSize:12,background:'#534AB7',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>
              🎓 {lang==='ar'?'تغيير المستوى':'Changer niveau'}
            </button>
          )}
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
                <div style={{fontSize:13,color:'#888'}}>{NIVEAUX_LABELS[eleve.code_niveau]||eleve.code_niveau||'—'} · {instituteurNom}</div>
                <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                  <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:500,background:sl.bg,color:sl.color}}>{sl.label}</span>
                  {passages.length>0&&<span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:500,background:'#EEEDFE',color:'#534AB7'}}>
                    🎓 {passages.length} {lang==='ar'?'مستوى سابق':'passage(s)'}
                  </span>}
                  {streak>0&&<span style={{padding:'2px 10px',borderRadius:20,fontSize:11,background:'#E6F1FB',color:'#0C447C'}}>🔥 {streak} {lang==='ar'?'أسابيع':'semaines'}</span>}
                  {vitesse.moyenne>0&&<span style={{padding:'2px 10px',borderRadius:20,fontSize:11,background:'#f5f5f0',color:'#666'}}>{vitesse.tendance==='hausse'?'📈':vitesse.tendance==='baisse'?'📉':'➡️'} {vitesse.moyenne} {estSourateEleve?(lang==='ar'?'سورة/أسبوع':'sur./sem.'):(lang==='ar'?'ثمن/أسبوع':'t./sem.')}</span>}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:38,fontWeight:800,color:sl.color,letterSpacing:'-2px'}}>
                  {estSourateEleve
                    ? recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length
                    : (etat?.points.total.toLocaleString()||0)}
                </div>
                <div style={{fontSize:11,color:'#888'}}>
                  {estSourateEleve?(lang==='ar'?'سورة مكتملة':'sourates'):t(lang,'pts_abrev')}
                </div>
              </div>
            </div>

            {/* Points breakdown */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
              {estSourateEleve ? [
                {l:lang==='ar'?'سور مكتملة':'Complètes', v:recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length, s:'', color:'#1D9E75', bg:'#E1F5EE'},
                {l:lang==='ar'?'مقاطع':'Séquences', v:recitationsSouratesEleve.filter(r=>r.type_recitation==='sequence').length, s:'', color:'#534AB7', bg:'#EEEDFE'},
                {l:lang==='ar'?'محفوظات':'Acquis', v:eleve.sourates_acquises||0, s:'', color:'#378ADD', bg:'#E6F1FB'},
                {l:lang==='ar'?'المجموع':'Total pts', v:totalPtsSourates||0, s:'', color:'#EF9F27', bg:'#FAEEDA'},
              ].map(({l,v,s,color,bg})=>(
                <div key={l} style={{background:bg,borderRadius:8,padding:'10px',textAlign:'center',border:`0.5px solid ${color}20`}}>
                  <div style={{fontSize:18,fontWeight:700,color}}>{v}</div>
                  <div style={{fontSize:11,color:'#888'}}>{l}</div>
                </div>
              )) : [
                ['Tomon',etat?.points.ptsTomon,`${etat?.tomonTotal||etat?.tomonCumul}×10`],
                ['Roboe',etat?.points.ptsRoboe,`${etat?.points.details?.nbRoboe}×25`],
                ['Nisf',etat?.points.ptsNisf,`${etat?.points.details?.nbNisf}×60`],
                ['Hizb',etat?.points.ptsHizb,`${etat?.points.details?.nbHizb}×100`],
              ].map(([l,v,s])=>(
                <div key={l} style={{background:'#f9f9f6',borderRadius:8,padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:700}}>{v}</div>
                  <div style={{fontSize:11,color:'#888'}}>{l}</div>
                  {s&&<div style={{fontSize:10,color:'#bbb'}}>{s}</div>}
                </div>
              ))}
            </div>

            {/* Acquis antérieurs — bouton accordéon (Hizb uniquement) */}
            {!estSourateEleve&&etat?.tomonAcquis>0&&(
              <div style={{marginBottom:8}}>
                <button onClick={()=>setShowAcquis(v=>!v)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'10px 14px',border:`1.5px solid ${showAcquis?'#1D9E75':'#9FE1CB'}`,borderRadius:showAcquis?'10px 10px 0 0':'10px',background:showAcquis?'#E1F5EE':'#f0faf6',cursor:'pointer',transition:'all 0.2s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>🎓</span>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#085041'}}>{lang==='ar'?'المكتسبات السابقة':lang==='en'?'Prior achievements':(lang==='ar'?'المكتسبات السابقة':'Acquis antérieurs')}</div>
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
                        {lbl:lang==='ar'?'حزب مكتمل':lang==='en'?'Complete Hizb':(lang==='ar'?'الأحزاب المكتملة':(lang==='ar'?'أحزاب مكتملة':'Hizb complets')),val:etat.hizbAcquisComplets,icon:'✓',color:'#EF9F27',bg:'#fff'},
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

            {/* Exception Hizb/Tomon — Hizb uniquement */}
            {user.role==='surveillant'&&!estSourateEleve&&(
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
                  await supabase.from('exceptions_hizb').insert(hizbs.map(h=>({eleve_id:eleve.id,ecole_id:user.ecole_id,hizb_numero:h,active:true,cree_par:user.id,date_creation:new Date().toISOString()})));
                  setShowExceptionModal(false);
                  await loadData();
                }}
                onCancel={()=>setShowExceptionModal(false)}
                lang={lang}
              />
            )}



            {/* KPI */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,borderTop:'0.5px solid #e8e8e0',paddingTop:12}}>
              {(estSourateEleve ? [
                [lang==='ar'?'السور المنجزة':'Sourates', recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length],
                [lang==='ar'?'المقاطع':'Séquences', recitationsSouratesEleve.filter(r=>r.type_recitation==='sequence').length],
                [lang==='ar'?'المحفوظات':'Acquis', eleve.sourates_acquises||0],
                ['Total', totalPtsSourates || 0],
              ] : [
                ['Hizb',`Hizb ${etat?.hizbEnCours}`],
                ['Tomon/Hizb',`${etat?.tomonDansHizbActuel}/8`],
                [t(lang,'hizb_complets'),etat?.hizbsComplets?.size],
                ['Total',etat?.tomonTotal||etat?.tomonCumul]
              ]).map(([l,v])=>(
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
                {user.role==='surveillant'&&<button className="action-btn" onClick={()=>navigate('objectifs')}>🎯 {t(lang,'definir')}</button>}
              </div>
            </div>
            
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
            {[['apercu',t(lang,'apercu')],['apprentissage',t(lang,'apprentissage')],['graphique',t(lang,'evolution')],['activite',t(lang,'activite')],['historique',t(lang,'historique')],['muraja',lang==='ar'?'المراجعة':'Muraja\u02bca'],['examens',lang==='ar'?'الامتحانات':'Examens'],['certificats',lang==='ar'?'الشهادات':'Certificats'],['notes',lang==='ar'?'النقاط':'Points']].map(([k,l])=>(
              <div key={k} className={`tab ${onglet===k?'active':''}`} onClick={()=>setOnglet(k)}>{l}</div>
            ))}
          </div>

          {/* APERÇU */}
          {onglet==='apercu'&&(
            <>
              {estSourateEleve ? (
                <>
                  <div className="position-card">
                    <div className="pos-block">
                      <div className="pos-val" style={{fontSize:14}}>{recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length}</div>
                      <div className="pos-lbl">{lang==='ar'?'سور مكتملة':'Complètes'}</div>
                    </div>
                    <div className="pos-block">
                      <div className="pos-val" style={{fontSize:14}}>{recitationsSouratesEleve.filter(r=>r.type_recitation==='sequence').length}</div>
                      <div className="pos-lbl">{lang==='ar'?'مقاطع':'Séquences'}</div>
                    </div>
                    <div className="pos-block">
                      <div className="pos-val" style={{fontSize:14}}>{eleve.sourates_acquises||0}</div>
                      <div className="pos-lbl">{lang==='ar'?'محفوظات':'Acquis'}</div>
                    </div>
                    <div className="pos-block">
                      <div className="pos-val" style={{fontSize:14}}>{totalPtsSourates.toLocaleString()}</div>
                      <div className="pos-lbl">{t(lang,'pts_abrev')}</div>
                    </div>
                  </div>
                </>
              ) : (
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
            </>
          )}

          {/* APPRENTISSAGE */}
          {onglet==='apprentissage'&&(
            <>
              <div className="section-label">{estSourateEleve?(lang==='ar'?'سجل التلاوات':'Historique des récitations'):t(lang,'suivi_apprentissage')}</div>
              {estSourateEleve ? (
                recitationsSouratesEleve.length===0 ? <div className="empty">{t(lang,'aucune_recitation_label')}</div> : (
                  <div className="table-wrap">
                    <table><thead><tr>
                      <th>{lang==='ar'?'التاريخ':'Date'}</th>
                      <th>{lang==='ar'?'السورة':'Sourate'}</th>
                      <th>{lang==='ar'?'النوع':'Type'}</th>
                      <th>{lang==='ar'?'الآيات':'Versets'}</th>
                      <th>{lang==='ar'?'النقاط':'Pts'}</th>
                      <th>{lang==='ar'?'صحَّح بواسطة':'Validé par'}</th>
                    </tr></thead>
                    <tbody>
                      {[...recitationsSouratesEleve].sort((a,b)=>new Date(b.date_validation||0)-new Date(a.date_validation||0)).map(r=>(
                        <tr key={r.id}>
                          <td style={{fontSize:12,color:'#888'}}>{r.date_validation?new Date(r.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR'):'—'}</td>
                          <td style={{fontWeight:600,direction:'rtl',fontFamily:"'Tajawal',Arial"}}>{r.sourate?.nom_ar||'—'}</td>
                          <td><span className={r.type_recitation==='complete'?'badge badge-green':'badge'}>{r.type_recitation==='complete'?(lang==='ar'?'كاملة':'Complète'):(lang==='ar'?'مقطع':'Séquence')}</span></td>
                          <td style={{fontSize:12,color:'#888'}}>{r.type_recitation==='sequence'&&r.verset_debut?`V.${r.verset_debut}→${r.verset_fin}`:'—'}</td>
                          <td style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>{r.points>0?`+${r.points}`:'—'}</td>
                          <td style={{fontSize:11,color:'#888'}}>{r.valideur?`${r.valideur.prenom} ${r.valideur.nom}`:(r.valide_par?'✓':'—')}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                )
              ) : (
                apprentissages.length===0?<div className="empty">{t(lang,'aucun_suivi')}</div>:(
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
                          const jours=validation?Math.round((new Date(validation.date_validation)-new Date(appr.date_debut))/(1000*60*60*24)):null;
                          return(
                            <tr key={appr.id}>
                              <td style={{fontWeight:500}}>Hizb {appr.hizb} — T.{appr.tomon}</td>
                              <td style={{fontSize:12,color:'#888'}}>{formatDateCourt(appr.date_debut)}</td>
                              <td style={{fontSize:12,color:'#888'}}>{validation?formatDateCourt(validation.date_validation):'—'}</td>
                              <td>{jours!==null?<span style={{fontSize:12,fontWeight:600,color:jours<=7?'#1D9E75':jours<=14?'#EF9F27':'#E24B4A'}}>{jours}j</span>:'—'}</td>
                              <td>{validation?<span className="badge badge-green" style={{fontSize:9}}>✓</span>:<span className="badge" style={{fontSize:9}}>⏳</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody></table>
                    </div>
                  </>
                )
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
                <span>{t(lang,'score_total')}: <strong style={{color:'#1D9E75'}}>{estSourateEleve?totalPtsSourates.toLocaleString():(etat?.points.total.toLocaleString()||0)} {t(lang,'pts_abrev')}</strong></span>
                <span>{lang==='ar'?'السرعة':lang==='en'?'Speed':(lang==='ar'?'الوتيرة':'Vitesse')}: <strong style={{color:vitesse.tendance==='hausse'?'#1D9E75':vitesse.tendance==='baisse'?'#E24B4A':'#888'}}>{vitesse.moyenne} T/{t(lang,+(lang==='ar'?' أسابيع':' semaines'))} {vitesse.tendance==='hausse'?'📈':vitesse.tendance==='baisse'?'📉':'➡️'}</strong></span>
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
                {(estSourateEleve ? [
                  {lbl:lang==='ar'?'سور مكتملة':'Complètes',val:recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length,icon:'📖',color:'#1D9E75',bg:'#E1F5EE'},
                  {lbl:lang==='ar'?'جلسات نشطة':'Jours actifs',val:Object.keys(heatmap).filter(d=>{const p=d.split('/');return(new Date()-new Date(p[2],p[1]-1,p[0]))/(1000*60*60*24)<=90;}).length,icon:'📅',color:'#EF9F27',bg:'#FAEEDA'},
                  {lbl:lang==='ar'?'مقاطع':'Séquences',val:recitationsSouratesEleve.filter(r=>r.type_recitation==='sequence').length,icon:'📌',color:'#534AB7',bg:'#EEEDFE'},
                ] : [
                  {lbl:t(lang,'streak_actuel'),val:`${streak} ${t(lang,+(lang==='ar'?' أسابيع':' semaines'))}`,icon:'🔥',color:'#EF9F27',bg:'#FAEEDA'},
                  {lbl:t(lang,'jours_actifs'),val:Object.keys(heatmap).filter(d=>{const p=d.split('/');return(new Date()-new Date(p[2],p[1]-1,p[0]))/(1000*60*60*24)<=90;}).length,icon:'📅',color:'#1D9E75',bg:'#E1F5EE'},
                  {lbl:t(lang,'moy_seance'),val:validations.filter(v=>v.type_validation==='tomon').length>0?(etat?.tomonCumul/validations.filter(v=>v.type_validation==='tomon').length).toFixed(1):'0',icon:'📊',color:'#378ADD',bg:'#E6F1FB'},
                ]).map(s=>(
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
          {onglet==='muraja'&&(
            <div>
              <div style={{fontSize:12,color:'#888',marginBottom:12,padding:'8px 12px',background:'#FFF3CD',borderRadius:8}}>
                ℹ️ {lang==='ar'?'هذه المراجعات الجماعية لا تؤثر على التقدم الفردي':'Ces muraja\u02bca collectives n\'affectent pas la progression individuelle'}
              </div>
              {(murajaa.length+murajaaS.length)===0?(
                <div className="empty">{lang==='ar'?'لا توجد مراجعات جماعية':'Aucune muraja\u02bca collective'}</div>
              ):(
                <div className="table-wrap">
                  <table><thead><tr>
                    <th>{lang==='ar'?'التاريخ':'Date'}</th>
                    <th>{lang==='ar'?'النوع':'Type'}</th>
                    <th>{lang==='ar'?'المحتوى':'Contenu'}</th>
                    <th>{lang==='ar'?'النقاط':'Pts'}</th>
                    <th>{lang==='ar'?'صحَّح بواسطة':'Validé par'}</th>
                  </tr></thead>
                  <tbody>
                    {murajaaS.map(r=>(
                      <tr key={'s'+r.id}>
                        <td style={{fontSize:12,color:'#888'}}>{new Date(r.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</td>
                        <td><span className="badge" style={{background:'#FFF3CD',color:'#856404',fontSize:10}}>{r.type_recitation==='complete'?(lang==='ar'?'سورة كاملة':'Sourate complète'):(lang==='ar'?'تسلسل':'Séquence')}</span></td>
                        <td style={{fontSize:12}}>{r.sourate?.nom_ar||'—'}{r.type_recitation==='sequence'&&r.verset_debut?` (${lang==='ar'?'آية':'v.'} ${r.verset_debut}–${r.verset_fin})`:''}</td>
                        <td><span style={{fontSize:12,fontWeight:600,color:'#EF9F27'}}>+{r.points||5}</span></td>
                        <td style={{fontSize:11,color:'#888'}}>{r.valideur?`${r.valideur.prenom} ${r.valideur.nom}`:'—'}</td>
                      </tr>
                    ))}
                    {murajaa.map(v=>(
                      <tr key={'v'+v.id}>
                        <td style={{fontSize:12,color:'#888'}}>{new Date(v.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</td>
                        <td><span className="badge" style={{background:'#FFF3CD',color:'#856404',fontSize:10}}>{v.type_validation==='hizb_muraja'?(lang==='ar'?'حزب كامل':'Hizb complet'):(lang==='ar'?'ثُمن':'Tomon')}</span></td>
                        <td style={{fontSize:12}}>{v.type_validation==='hizb_muraja'?`Hizb ${v.hizb_validation}`:`Hizb ${v.hizb_validation} — T${v.tomon_debut} ×${v.nombre_tomon}`}</td>
                        <td><span style={{fontSize:12,fontWeight:600,color:'#EF9F27'}}>+{v.type_validation==='hizb_muraja'?100:v.nombre_tomon*10}</span></td>
                        <td style={{fontSize:11,color:'#888'}}>{v.valideur?`${v.valideur.prenom} ${v.valideur.nom}`:'—'}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
            </div>
          )}

          {onglet==='examens'&&(
            <div style={{padding:'0.5rem 0'}}>
              {examens.length===0?(
                <div style={{textAlign:'center',color:'#aaa',padding:'2rem',fontSize:13}}>
                  {lang==='ar'?'لا توجد نتائج امتحانات':'Aucun résultat d\'examen'}
                </div>
              ):examens.map(r=>{
                const STATUTS2={reussi:{color:'#1D9E75',bg:'#E1F5EE'},echoue:{color:'#E24B4A',bg:'#FCEBEB'},en_cours:{color:'#EF9F27',bg:'#FAEEDA'}};
                const m2=STATUTS2[r.statut]||STATUTS2.en_cours;
                const examNom2 = r.examen?.nom || (lang==='ar'?'امتحان':'Examen');
                const statutLabel2 = r.statut==='reussi'?(lang==='ar'?'ناجح ✓':'Réussi ✓'):r.statut==='echoue'?(lang==='ar'?'راسب ✗':'Échoué ✗'):(lang==='ar'?'معلق':'En cours');
                return(
                  <div key={r.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#1a1a1a'}}>{examNom2}</div>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:m2.bg,color:m2.color}}>{statutLabel2}</span>
                    </div>
                    <div style={{display:'flex',gap:12,fontSize:11,color:'#888',flexWrap:'wrap'}}>
                      <span>📅 {r.date_examen?new Date(r.date_examen).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR'):'—'}</span>
                      <span>📊 <strong style={{color:'#1a1a1a'}}>{r.score||0}</strong>{r.examen?.score_minimum?` / ${r.examen.score_minimum}`:''}</span>
                      {r.examen?.bloquant&&r.statut==='echoue'&&<span style={{color:'#E24B4A',fontWeight:600}}>🔒 {lang==='ar'?'موقوف':'Bloqué'}</span>}
                      {r.certificat_genere&&<span style={{color:'#1D9E75',fontWeight:600}}>🏅</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {onglet==='certificats'&&(
            <div style={{padding:'0.5rem 0'}}>
              {certificats.length===0?(
                <div style={{textAlign:'center',color:'#aaa',padding:'2rem',fontSize:13}}>
                  {lang==='ar'?'لا توجد شهادات بعد':'Aucun certificat pour le moment'}
                </div>
              ):certificats.map(cert=>(
                <div key={cert.id} style={{background:'linear-gradient(135deg,#378ADD,#0C447C)',border:'1px solid #EF9F2740',borderRadius:14,padding:'14px',marginBottom:10,display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:44,height:44,borderRadius:12,background:'#FAEEDA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>🏅</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#085041',direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{cert.nom_certificat_ar||cert.nom_certificat}</div>
                    <div style={{fontSize:11,color:'#888',marginTop:3}}>📅 {cert.date_obtention?new Date(cert.date_obtention).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}


          {onglet==='notes'&&(()=>{
            const niveauxCtx2 = typeof niveaux !== 'undefined' ? niveaux : [];
            const estSourate2 = isSourateNiveauDyn(eleve.code_niveau, niveauxCtx2);
            // Pour élèves sourate : calculer pts depuis recitationsSouratesEleve
            const ptsSourateTotal = recitationsSouratesEleve.reduce((s,r)=>s+(r.points||0),0);
            const ptsSourateCompletes = recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').reduce((s,r)=>s+(r.points||0),0);
            const ptsSourateSequences = recitationsSouratesEleve.filter(r=>r.type_recitation==='sequence').reduce((s,r)=>s+(r.points||0),0);
            const pts = estSourate2
              ? { total: ptsSourateTotal, tomonPeriode: recitationsSouratesEleve.filter(r=>r.type_recitation==='complete').length, ptsTomon: ptsSourateCompletes, ptsEnsembles: 0, ptsExamens: examens.reduce((s,e)=>s+(e.score||0),0), ptsCertificats: certificats.length*50, hizbsPeriode:0, ptsHizb:0, ptsRoboe:0, ptsNisf:0, details:{nbRoboe:0,nbNisf:0,nbHizb:0} }
              : calcPointsPeriode(validations||[], new Date('2000-01-01'), new Date(), baremeEleve, pointsEvenements);
            return (
              <div style={{padding:'0.5rem 0'}}>
                {/* Total depuis le début */}
                <div style={{background:'linear-gradient(135deg,#378ADD,#0C447C)',borderRadius:12,padding:'12px 14px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{color:'rgba(255,255,255,0.8)',fontSize:10}}>{lang==='ar'?'المجموع الكلي':'Total suivi'}</div>
                  <div style={{color:'#fff',fontWeight:800,fontSize:18}}>{pts.total.toLocaleString()} <span style={{fontSize:10,opacity:0.8}}>{lang==='ar'?'ن':'pts'}</span></div>
                </div>

                {/* Détail */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {(estSourate2 ? [
                    {label:lang==='ar'?'السور':'Sourates', val:pts.tomonPeriode, pts:pts.ptsTomon, color:'#534AB7', bg:'#EEEDFE', icon:'📜'},
                    {label:lang==='ar'?'المجموعات':'Ensembles', val:'', pts:pts.ptsEnsembles||0, color:'#D85A30', bg:'#FAECE7', icon:'📦'},
                    {label:lang==='ar'?'الامتحانات':'Examens', val:'', pts:pts.ptsExamens||0, color:'#EF9F27', bg:'#FAEEDA', icon:'📝'},
                    {label:lang==='ar'?'الشهادات':'Certs', val:'', pts:pts.ptsCertificats||0, color:'#085041', bg:'#E1F5EE', icon:'🏅'},
                  ] : [
                    {label:lang==='ar'?'الأثمان':'Tomon', val:pts.tomonPeriode, pts:pts.ptsTomon, color:'#378ADD', bg:'#E6F1FB', icon:'📖'},
                    {label:lang==='ar'?'الأرباع':'Roboâ', val:pts.details?.nbRoboe||0, pts:pts.ptsRoboe, color:'#1D9E75', bg:'#E1F5EE', icon:'✦'},
                    {label:lang==='ar'?'الأنصاف':'Nisf', val:pts.details?.nbNisf||0, pts:pts.ptsNisf, color:'#EF9F27', bg:'#FAEEDA', icon:'◈'},
                    {label:lang==='ar'?'أحزاب كاملة':'Hizb ✓', val:pts.hizbsPeriode, pts:pts.ptsHizb, color:'#085041', bg:'#E1F5EE', icon:'🎯'},
                    ...(pts.ptsExamens>0?[{label:lang==='ar'?'الامتحانات':'Examens', val:'', pts:pts.ptsExamens, color:'#EF9F27', bg:'#FAEEDA', icon:'📝'}]:[]),
                    ...(pts.ptsCertificats>0?[{label:lang==='ar'?'الشهادات':'Certs', val:'', pts:pts.ptsCertificats, color:'#D85A30', bg:'#FAECE7', icon:'🏅'}]:[]),
                  ]).map((row,i)=>(
                    <div key={i} style={{background:row.bg,borderRadius:12,padding:'10px',border:`0.5px solid ${row.color}20`}}>
                      <div style={{fontSize:16,marginBottom:2}}>{row.icon}</div>
                      <div style={{fontSize:10,color:'#888'}}>{row.label}</div>
                      <div style={{fontSize:18,fontWeight:800,color:row.color}}>{row.val!==''?row.val:'—'}</div>
                      <div style={{fontSize:10,color:row.color,opacity:0.8}}>{row.pts>0?`+${row.pts} ${lang==='ar'?'ن':'pts'}`:'—'}</div>
                    </div>
                  ))}
                </div>
                {pts.total===0&&(
                  <div style={{textAlign:'center',color:'#aaa',padding:'1.5rem',fontSize:12}}>
                    {lang==='ar'?'لا توجد استظهارات في هذه الفترة':'Aucune récitation sur cette période'}
                  </div>
                )}
              </div>
            );
          })()}


          {onglet==='historique'&&(
            <div>
              {passages.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#534AB7',marginBottom:8}}>
                    🎓 {lang==='ar'?'سجل الانتقالات بين المستويات':'Historique des passages de niveau'}
                  </div>
                  {passages.map(p=>(
                    <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,background:'#F0EEFF',border:'1px solid #534AB720',marginBottom:6}}>
                      <span style={{fontSize:18}}>🎓</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#534AB7'}}>{p.niveau_from} → {p.niveau_to}</div>
                        <div style={{fontSize:11,color:'#888',marginTop:2}}>
                          {new Date(p.date_passage).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'numeric',month:'long',year:'numeric'})}
                          {p.valide_par_u&&(' · '+p.valide_par_u.prenom+' '+p.valide_par_u.nom)}
                        </div>
                        {p.note&&<div style={{fontSize:11,color:'#534AB7',marginTop:2,fontStyle:'italic'}}>{p.note}</div>}
                      </div>
                      <div style={{textAlign:'right',fontSize:11,color:'#888'}}>
                        <div>Tomon: <strong>{p.acquis_tomon}</strong></div>
                        <div>Pts: <strong>{p.acquis_points}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {estSourateEleve ? (
                recitationsSouratesEleve.length===0
                  ? <div className="empty">{t(lang,'aucune_recitation_label')}</div>
                  : (
                    <div className="table-wrap">
                      <table><thead><tr>
                        <th>{t(lang,'date_heure')}</th>
                        <th>{lang==='ar'?'السورة':'Sourate'}</th>
                        <th>{lang==='ar'?'النوع':'Type'}</th>
                        <th>{lang==='ar'?'الآيات':'Versets'}</th>
                        <th>{t(lang,'valide_par')}</th>
                      </tr></thead>
                      <tbody>
                        {recitationsSouratesEleve.map(r=>(
                          <tr key={r.id}>
                            <td style={{fontSize:12,color:'#888'}}>{formatDate(r.date_validation||r.created_at)}</td>
                            <td style={{fontWeight:600,direction:'rtl'}}>{r.sourate?.nom_ar||'—'}</td>
                            <td><span className={r.type_recitation==='complete'?'badge badge-green':'badge'}>{r.type_recitation==='complete'?(lang==='ar'?'كاملة':'Complète'):(lang==='ar'?'مقطع':'Séquence')}</span></td>
                            <td style={{fontSize:12,color:'#888'}}>{r.type_recitation==='sequence'&&r.verset_debut?`V.${r.verset_debut}→${r.verset_fin}`:'—'}</td>
                            <td style={{fontSize:12,color:'#888'}}>{r.valideur?(r.valideur.prenom+' '+r.valideur.nom):(r.valide_par?'✓':'—')}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )
              ) : (
                validations.length===0
                ?<div className="empty">{t(lang,'aucune_recitation_label')}</div>
                :(
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
                            <td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">{t(lang,'hizb_complet')}</span>:<span className="badge">{t(lang,'tomon_abrev')} ×{v.nombre_tomon}</span>}</td>
                            <td style={{fontSize:12,color:'#888'}}>{v.type_validation==='hizb_complet'?('Hizb '+v.hizb_valide):('T'+v.tomon_debut+' Hizb '+v.hizb_validation)}</td>
                            <td>{joursAppr!==null?<span style={{fontSize:12,fontWeight:600,color:joursAppr<=7?'#1D9E75':joursAppr<=14?'#EF9F27':'#E24B4A'}}>{joursAppr}j</span>:'—'}</td>
                            <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{v.type_validation==='hizb_complet'?100:v.nombre_tomon*10}</span></td>
                            <td style={{fontSize:12,color:'#888'}}>{v.valideur?(v.valideur.prenom+' '+v.valideur.nom):'—'}</td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}
      <PassageNiveauModal
        show={showPassageModal}
        onClose={()=>setShowPassageModal(false)}
        eleve={eleve}
        etat={etat}
        user={user}
        lang={lang}
        niveauxDisponibles={niveauxDisponibles}
        niveauxDyn={_niveauxCtx}
        NIVEAUX_LABELS={NIVEAUX_LABELS}
        nouveauNiveau={nouveauNiveau}
        setNouveauNiveau={setNouveauNiveau}
        notePassage={notePassage}
        setNotePassage={setNotePassage}
        onConfirm={handlePassageNiveau}
        saving={savingPassage}
        nbSouratesCompletes={nbSouratesCompletes}
        totalPtsSourates={totalPtsSourates}
      />
    </div>
  );
}