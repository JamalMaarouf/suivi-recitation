import React, { useState, useEffect } from 'react';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { getInitiales, scoreLabel, formatDate, formatDateCourt } from '../lib/helpers';
import { t } from '../lib/i18n';
import { getSouratesForNiveau, isSourateNiveau } from '../lib/sourates';

function Avatar({ prenom, nom, size=44, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

function NiveauBadge({ code }) {
  const colors = { '5B':'#534AB7', '5A':'#378ADD', '2M':'#1D9E75' };
  const c = colors[code] || '#888';
  return <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:c+'15',color:c,border:`0.5px solid ${c}30`}}>{code}</span>;
}

export default function FicheSourate({
  const { toast } = useToast(); eleve, user, navigate, goBack, lang='fr', isMobile }) {
  const [recitations, setRecitations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [instituteurNom, setInstituteurNom] = useState('—');
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState('progression');
  const [murajaaS, setMurajaaS] = useState([]);
  const [murajaa, setMurajaa]   = useState([]);
  const [selectedSourate, setSelectedSourate] = useState(null);

  const [showAcquis, setShowAcquis] = useState(false);
  const [showPassageModal, setShowPassageModal] = useState(false);
  const [nouveauNiveau, setNouveauNiveau] = useState('');
  const [notePassage, setNotePassage] = useState('');
  const [savingPassage, setSavingPassage] = useState(false);
  const codeNiveau = eleve.code_niveau || '5B';
  const souratesNiveau = getSouratesForNiveau(codeNiveau);
  // Order: 114 → 72 (start from shortest)
  const souratesOrdonnees = [...souratesNiveau].sort((a,b) => b.numero - a.numero);

  useEffect(() => { loadData(); }, [eleve.id]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: rd }, { data: sdb }, { data: mrec }, { data: mval }] = await Promise.all([
      supabase.from('recitations_sourates').select('*, valideur:valide_par(prenom,nom)')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', eleve.id).eq('is_muraja', false).order('date_validation', {ascending:false}),
      supabase.from('sourates').select('*'),
      supabase.from('recitations_sourates').select('*, sourate:sourate_id(nom_ar,numero), valideur:valide_par(prenom,nom)')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', eleve.id).eq('is_muraja', true).order('date_validation', {ascending:false}),
      supabase.from('validations').select('*, valideur:valide_par(prenom,nom)')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', eleve.id).in('type_validation',['tomon_muraja','hizb_muraja']).order('date_validation', {ascending:false}),
    ]);
    if (eleve.instituteur_referent_id) {
      const { data: inst } = await supabase.from('utilisateurs').select('prenom,nom').eq('id', eleve.instituteur_referent_id).single();
      if (inst) setInstituteurNom(inst.prenom+' '+inst.nom);
    }
    setRecitations(rd || []);
    setSouratesDB(sdb || []);
    setMurajaaS(mrec || []);
    setMurajaa(mval || []);
    setLoading(false);
  };

  // Match static sourate to DB id
  const getDbId = (numero) => souratesDB.find(s => s.numero === numero)?.id;

  // Get recitations for a specific sourate
  const getRecsSourate = (numero) => {
    const dbId = getDbId(numero);
    if (!dbId) return [];
    return recitations.filter(r => r.sourate_id === dbId);
  };

  const isComplete = (numero) => getRecsSourate(numero).some(r => r.type_recitation === 'complete');
  const getSequences = (numero) => getRecsSourate(numero).filter(r => r.type_recitation === 'sequence');

  // Stats globales
  const souratesCompletes = souratesOrdonnees.filter(s => isComplete(s.numero)).length;
  const souratesEnCours = souratesOrdonnees.filter(s => !isComplete(s.numero) && getSequences(s.numero).length > 0).length;
  const totalSequences = recitations.filter(r => r.type_recitation === 'sequence').length;
  const totalPoints = recitations.reduce((s,r) => s + (r.points||0), 0);

  // Acquis antérieurs points
  const souratesAcquises = parseInt(eleve.sourates_acquises)||0;
  const ptsAcquis = souratesAcquises * 30;
  const ptsSuivi = totalPoints;
  const ptsTotal = ptsAcquis + ptsSuivi;

  const sl = scoreLabel(ptsTotal);
  const pctProgression = souratesOrdonnees.length > 0
    ? Math.round((souratesCompletes + souratesAcquises) / souratesOrdonnees.length * 100)
    : 0;

  const handlePrint = () => {
    const w = window.open('', '', 'width=800,height=900');
    if (!w) return;
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const dateLocale = lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-FR';
    w.document.write(`<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head>
    <meta charset="UTF-8"><title>${eleve.prenom} ${eleve.nom}</title>
    <style>
      body{font-family:${lang==='ar'?"'Tajawal',Arial":"Arial"},sans-serif;color:#1a1a1a;padding:30px;direction:${dir}}
      h1{font-size:22px;color:#085041}h2{font-size:14px;margin:20px 0 10px;border-bottom:2px solid #1D9E75;padding-bottom:6px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
      .box{border:1px solid #e0e0d8;border-radius:8px;padding:12px;text-align:center}
      .box-title{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:4px}
      .box-val{font-size:20px;font-weight:700;color:#1D9E75}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f9f9f6;text-align:${lang==='ar'?'right':'left'};padding:8px;border-bottom:1px solid #e0e0d8;font-size:10px;text-transform:uppercase}
      td{padding:8px;border-bottom:1px solid #f0f0ec;text-align:${lang==='ar'?'right':'left'}}
      .complete{color:#EF9F27;font-weight:600}.seq{color:#1D9E75}.pts{color:#1D9E75;font-weight:600}
      .surah-name{font-family:'Amiri','Traditional Arabic',serif;font-size:14px}
    </style></head><body>
    <h1>${eleve.prenom} ${eleve.nom}</h1>
    <p style="color:#888;font-size:13px">${codeNiveau} · ${instituteurNom}${eleve.eleve_id_ecole ? ' · #'+eleve.eleve_id_ecole : ''}</p>
    <div class="grid">
      <div class="box"><div class="box-title">${lang==='ar'?'المجموع':lang==='en'?'Total score':(lang==='ar'?'مجموع النقاط':(lang==='ar'?'مجموع النقاط':'Score total'))}</div><div class="box-val">${ptsTotal.toLocaleString()} ${lang==='ar'?'ن':'pts'}</div></div>
      <div class="box"><div class="box-title">${lang==='ar'?'سور مكتملة':lang==='en'?'Complete surahs':(lang==='ar'?'السور المكتملة':(lang==='ar'?'السور المكتملة':'Sourates complètes'))}</div><div class="box-val">${souratesCompletes + souratesAcquises}/${souratesOrdonnees.length}</div></div>
      <div class="box"><div class="box-title">${lang==='ar'?'التقدم':lang==='en'?'Progress':(lang==='ar'?'التقدم':(lang==='ar'?'التقدم':'Progression'))}</div><div class="box-val">${pctProgression}%</div></div>
    </div>
    ${souratesAcquises > 0 ? `<div style="background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:12px;margin-bottom:16px">
      <strong>🎓 ${lang==='ar'?'المكتسبات السابقة':lang==='en'?'Prior achievements':lang==='ar'?'المكتسبات السابقة':(lang==='ar'?'المكتسبات السابقة':'Acquis antérieurs')} : ${souratesAcquises} ${lang==='ar'?'سورة':lang==='en'?'surahs':'sourates'} (+${ptsAcquis} ${lang==='ar'?'ن':'pts'})</strong>
    </div>` : ''}
    <h2>${lang==='ar'?'تفاصيل السور':lang==='en'?'Surah details':(lang==='ar'?'تفصيل السور':(lang==='ar'?'تفصيل السور':'Détail par sourate'))}</h2>
    <table><thead><tr>
      <th>${lang==='ar'?'السورة':lang==='en'?'Surah':'Sourate'}</th>
      <th>${lang==='ar'?'الحالة':lang==='en'?'Status':'Statut'}</th>
      <th>${lang==='ar'?'المقاطع':lang==='en'?'Sequences':(lang==='ar'?'المقاطع':(lang==='ar'?'المقاطع':(lang==='ar'?'المقاطع':'Séquences')))}</th>
      <th>${lang==='ar'?'النقاط':lang==='en'?(lang==='ar'?'النقاط':(lang==='ar'?'النقاط':'Points')):(lang==='ar'?'النقاط':(lang==='ar'?'النقاط':'Points'))}</th>
    </tr></thead><tbody>
    ${souratesOrdonnees.map(s => {
      const recs = getRecsSourate(s.numero);
      const comp = isComplete(s.numero);
      const seqs = getSequences(s.numero);
      const pts = recs.reduce((acc,r)=>acc+(r.points||0),0);
      return `<tr>
        <td class="surah-name">${s.nom_ar}</td>
        <td class="${comp?'complete':'seq'}">${comp?(lang==='ar'?'مكتملة':lang==='en'?'Complete':(lang==='ar'?'مكتملة':'Complète')):seqs.length>0?(lang==='ar'?'جارية':lang==='en'?'In progress':(lang==='ar'?'جارية':(lang==='ar'?'جارية':(lang==='ar'?'جارية':'En cours')))):(lang==='ar'?'لم تبدأ':lang==='en'?'Not started':(lang==='ar'?'لم تبدأ':(lang==='ar'?'لم تبدأ':(lang==='ar'?'لم تبدأ':'Pas commencée'))))}</td>
        <td>${seqs.length}</td>
        <td class="pts">${pts > 0 ? '+'+pts : '—'}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
    <div style="margin-top:30px;font-size:11px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:12px">
      ${t(lang,'genere_le')} ${new Date().toLocaleDateString(dateLocale)} · ${t(lang,'app_name')}
    </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 600);
  };

  if (loading) return (
    <div style={{padding:'2rem',textAlign:'center'}}>
      <div className="loading">...</div>
      <div style={{marginTop:'1rem',fontSize:13,color:'#888'}}>{eleve?.prenom} {eleve?.nom}</div>
      <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link" style={{marginTop:'1rem'}}>
        ← {lang==='ar'?'رجوع':'Retour'}
      </button>
    </div>
  );

  const NIVEAUX_ORDRE = ['5B','5A','2M','2','1'];
  const NIVEAUX_LABELS = {'5B':'Préscolaire (5B)','5A':'Primaire 1-2 (5A)','2M':'Primaire 3-4 (2M)','2':'Primaire 5-6 (2)','1':'Collège/Lycée (1)'};
  const niveauxDisponibles = NIVEAUX_ORDRE.filter(n=>n!==eleve.code_niveau);

  const handlePassageNiveau = async () => {
    if (!nouveauNiveau) return;
    setSavingPassage(true);
    try {
      const acquis = {
        eleve_id: eleve.id,
        ecole_id: user.ecole_id,
        niveau_from: eleve.code_niveau,
        niveau_to: nouveauNiveau,
        valide_par: user.id,
        acquis_sourates: parseInt(eleve.sourates_acquises)||0,
        acquis_points: 0,
        note: notePassage||null,
        date_passage: new Date().toISOString(),
      };
      const { error: errPassage } = await supabase.from('passages_niveau').insert(acquis);
      if (errPassage) throw errPassage;
      const resetData = { code_niveau: nouveauNiveau, sourates_acquises: 0 };
      const { error: errEleve } = await supabase.from('eleves').update(resetData).eq('id', eleve.id);
      if (errEleve) throw errEleve;
      setShowPassageModal(false);
      setNouveauNiveau('');
      setNotePassage('');
      navigate('dashboard');
    } catch(err) {
      toast.error(lang==='ar'?'خطأ في تغيير المستوى':'Erreur passage niveau: '+err.message);
    }
    setSavingPassage(false);
  };

  if (isMobile) {
    const NIVEAU_COLORS_FS = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75'};
    const nc = NIVEAU_COLORS_FS[codeNiveau] || '#1D9E75';
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        {/* Sticky header */}
        <div style={{background:'#fff', borderBottom:'0.5px solid #e0e0d8', position:'sticky', top:0, zIndex:100}}>
          <div style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px'}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#085041',padding:0,lineHeight:1}}>
              ←
            </button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800}}>{eleve.prenom} {eleve.nom}</div>
              <div style={{display:'flex',gap:6,alignItems:'center',marginTop:2}}>
                <NiveauBadge code={codeNiveau}/>
                <span style={{fontSize:12,color:'#888'}}>{instituteurNom}</span>
              </div>
            </div>
            <button onClick={()=>navigate('enregistrer',eleve)}
              style={{background:'#1D9E75',color:'#fff',border:'none',borderRadius:10,
                padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              + {lang==='ar'?'استظهار':'Récit.'}
            </button>
          </div>
          {/* Onglets */}
          <div style={{display:'flex',overflowX:'auto',scrollbarWidth:'none',borderTop:'0.5px solid #f0f0ec'}}>
            {[
              {k:'progression',label:lang==='ar'?'التقدم':'Progression'},
              {k:'historique', label:lang==='ar'?'التاريخ':'Historique'},
              {k:'muraja',     label:lang==='ar'?'المراجعة':"Murajaʼa"},
            ].map(tab=>(
              <div key={tab.k} onClick={()=>setOnglet(tab.k)}
                style={{padding:'10px 16px',fontSize:13,fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,
                  color:onglet===tab.k?'#085041':'#888',
                  borderBottom:onglet===tab.k?'2px solid #1D9E75':'2px solid transparent'}}>
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        {loading ? <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div> : (
          <div style={{padding:'12px'}}>
            {onglet==='progression' && (
              <div>
                {/* Sourates grid */}
                <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:8}}>
                  {lang==='ar'?'السور':lang==='en'?'Surahs':'Sourates'} ({souratesOrdonnees.length})
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                  {souratesOrdonnees.map(s=>{
                    const recs=getRecsSourate(s.numero);
                    const complete=recs.some(r=>r.type_recitation==='complete');
                    const sequences=recs.filter(r=>r.type_recitation==='sequence').length;
                    const dbId=getDbId(s.numero);
                    return(
                      <div key={s.numero} onClick={()=>setSelectedSourate(selectedSourate?.numero===s.numero?null:s)}
                        style={{background:'#fff',borderRadius:12,padding:'12px',cursor:'pointer',
                          border:complete?`2px solid ${nc}`:`0.5px solid ${selectedSourate?.numero===s.numero?nc:'#e0e0d8'}`,
                          background:complete?`${nc}08`:selectedSourate?.numero===s.numero?`${nc}05`:'#fff'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                          <span style={{fontSize:11,fontWeight:700,color:'#888'}}>#{s.numero}</span>
                          {complete && <span style={{fontSize:14}}>✅</span>}
                          {!complete && sequences>0 && <span style={{fontSize:11,color:nc,fontWeight:600}}>{sequences} séq.</span>}
                        </div>
                        <div style={{fontSize:14,fontWeight:700,color:complete?nc:'#1a1a1a',fontFamily:"'Tajawal',Arial",direction:'rtl',textAlign:'right'}}>
                          {s.nom_ar}
                        </div>
                        <div style={{fontSize:11,color:'#888',marginTop:2}}>{s.nom_fr||s.nom}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {onglet==='historique' && (
              <div>
                {recitations.slice(0,30).map(r=>{
                  const s=souratesDB.find(x=>x.id===r.sourate_id);
                  return(
                    <div key={r.id} style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,
                      border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontSize:20}}>📖</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:14,fontFamily:"'Tajawal',Arial",direction:'rtl'}}>{s?.nom_ar||'—'}</div>
                        <div style={{fontSize:12,color:'#888'}}>
                          {r.type_recitation==='complete'?'Sourate complète':'Séquence'} · {new Date(r.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}
                        </div>
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:nc}}>+{r.type_recitation==='complete'?30:10} pts</span>
                    </div>
                  );
                })}
                {recitations.length===0&&<div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>Aucune récitation</div>}
              </div>
            )}
            {onglet==='muraja' && (
              <div>
                {[...murajaaS,...murajaa].length===0 ? (
                  <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>Aucune murajaʼa</div>
                ) : [...murajaaS,...murajaa].slice(0,20).map((v,i)=>(
                  <div key={i} style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,
                    border:'0.5px solid #EF9F2730',display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:20}}>📖</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13}}>{v.sourate?.nom_ar||"Murajaʼa"}</div>
                      <div style={{fontSize:11,color:'#888'}}>{new Date(v.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</div>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:'#EF9F27'}}>+{v.points||10} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FAB passage niveau */}
        {user.role==='surveillant' && (
          <button onClick={()=>{setNouveauNiveau('');setNotePassage('');setShowPassageModal(true);}}
            style={{position:'fixed',bottom:80,right:16,background:'#534AB7',color:'#fff',
              border:'none',borderRadius:14,padding:'10px 16px',fontSize:14,fontWeight:700,
              cursor:'pointer',zIndex:150,boxShadow:'0 4px 16px rgba(83,74,183,0.4)',fontFamily:'inherit'}}>
            🎓 Niveau
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>{t(lang,'retour')}</button>
        <div style={{display:'flex',gap:8}}>
          {user.role==='surveillant'&&(
            <button onClick={()=>{setNouveauNiveau('');setNotePassage('');setShowPassageModal(true);}}
              style={{padding:'6px 14px',fontSize:12,background:'#534AB7',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>
              🎓 {lang==='ar'?'تغيير المستوى':'Changer niveau'}
            </button>
          )}
          <button className="btn-secondary" onClick={handlePrint} style={{fontSize:12,padding:'6px 14px'}}>{t(lang,'imprimer_pdf')}</button>
          <button className="btn-primary" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={() => navigate('enregistrer', eleve)}>
            {lang==='ar'?'+ استظهار':lang==='en'?'+ Recitation':'+ Récitation'}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.5rem',marginBottom:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
          <Avatar prenom={eleve.prenom} nom={eleve.nom} size={60} bg={sl.bg} color={sl.color}/>
          <div style={{flex:1}}>
            <div style={{fontSize:20,fontWeight:700}}>{eleve.prenom} {eleve.nom}</div>
            <div style={{display:'flex',gap:6,alignItems:'center',marginTop:4,flexWrap:'wrap'}}>
              <NiveauBadge code={codeNiveau}/>
              <span style={{fontSize:13,color:'#888'}}>{instituteurNom}</span>
              {eleve.eleve_id_ecole && <span style={{fontSize:12,color:'#bbb'}}>#{eleve.eleve_id_ecole}</span>}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:38,fontWeight:800,color:sl.color,letterSpacing:'-2px'}}>{ptsTotal.toLocaleString()}</div>
            <div style={{fontSize:11,color:'#888'}}>{t(lang,'pts_abrev')}</div>
          </div>
        </div>

        {/* Progression bar */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:6}}>
            <span>{lang==='ar'?'التقدم العام':lang==='en'?'Overall progress':'Progression globale'}</span>
            <span style={{fontWeight:700,color:'#1D9E75'}}>{souratesCompletes + souratesAcquises}/{souratesOrdonnees.length} {lang==='ar'?'سورة':lang==='en'?'surahs':'sourates'} ({pctProgression}%)</span>
          </div>
          <div style={{height:10,background:'#e8e8e0',borderRadius:5,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pctProgression}%`,background:'linear-gradient(90deg,#1D9E75,#5DCAA5)',borderRadius:5,transition:'width 0.5s'}}/>
          </div>
        </div>

        {/* KPI */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {[
            {l:lang==='ar'?'مكتملة':lang==='en'?'Complete':'Complètes', v:souratesCompletes+souratesAcquises, c:'#EF9F27', bg:'#FAEEDA'},
            {l:lang==='ar'?'جارية':lang==='en'?'In progress':(lang==='ar'?'جارية':(lang==='ar'?'جارية':(lang==='ar'?'جارية':'En cours'))), v:souratesEnCours, c:'#1D9E75', bg:'#E1F5EE'},
            {l:lang==='ar'?'مقاطع':lang==='en'?'Sequences':(lang==='ar'?'المقاطع':(lang==='ar'?'المقاطع':(lang==='ar'?'المقاطع':'Séquences'))), v:totalSequences, c:'#378ADD', bg:'#E6F1FB'},
            {l:lang==='ar'?'منذ المتابعة':lang==='en'?'Since tracking':'Depuis suivi', v:`+${ptsSuivi}`, c:'#534AB7', bg:'#EEEDFE'},
          ].map(k=>(
            <div key={k.l} style={{background:k.bg,borderRadius:8,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:700,color:k.c}}>{k.v}</div>
              <div style={{fontSize:10,color:k.c,opacity:0.8}}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Acquis antérieurs — bouton accordéon cliquable */}
        {souratesAcquises > 0 && (
          <div style={{marginTop:10}}>
            <button onClick={()=>setShowAcquis(v=>!v)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'10px 14px',border:`1.5px solid ${showAcquis?'#1D9E75':'#9FE1CB'}`,borderRadius:showAcquis?'10px 10px 0 0':'10px',background:showAcquis?'#E1F5EE':'#f0faf6',cursor:'pointer',transition:'all 0.2s'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:18}}>🎓</span>
                <div style={{textAlign:'left'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#085041'}}>{lang==='ar'?'المكتسبات السابقة':lang==='en'?'Prior achievements':lang==='ar'?'المكتسبات السابقة':(lang==='ar'?'المكتسبات السابقة':'Acquis antérieurs')}</div>
                  <div style={{fontSize:11,color:'#0F6E56'}}>{souratesAcquises} {lang==='ar'?'سورة محفوظة':lang==='en'?'surahs':'sourates'} · <strong>+{ptsAcquis} {t(lang,'pts_abrev')}</strong></div>
                </div>
              </div>
              <span style={{fontSize:16,color:'#1D9E75',fontWeight:700,display:'inline-block',transform:showAcquis?'rotate(180deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▼</span>
            </button>
            {showAcquis && (
              <div style={{background:'#f0faf6',border:'1.5px solid #1D9E75',borderTop:'none',borderRadius:'0 0 10px 10px',padding:'1rem'}}>
                <div style={{fontSize:11,color:'#085041',fontWeight:600,marginBottom:8}}>
                  {lang==='ar'?'السور المحفوظة قبل بدء المتابعة':lang==='en'?'Surahs memorized before tracking':'Sourates mémorisées avant le suivi'}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:12}}>
                  {souratesOrdonnees.slice(0, souratesAcquises).map(s=>(
                    <div key={s.numero} style={{padding:'4px 10px',background:'#fff',borderRadius:20,border:'0.5px solid #9FE1CB',fontSize:13,fontFamily:"'Tajawal',Arial",direction:'rtl',display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:10,color:'#bbb'}}>{s.numero}</span>
                      <span style={{color:'#085041',fontWeight:500}}>{s.nom_ar}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                  <div style={{background:'#E1F5EE',borderRadius:8,padding:'8px',textAlign:'center',border:'0.5px solid #9FE1CB'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#1D9E75'}}>+{ptsAcquis} {t(lang,'pts_abrev')}</div>
                    <div style={{fontSize:10,color:'#0F6E56'}}>{lang==='ar'?'نقاط المكتسبات':lang==='en'?'Prior points':'Points antérieurs'}</div>
                  </div>
                  <div style={{background:'#E6F1FB',borderRadius:8,padding:'8px',textAlign:'center',border:'0.5px solid #85B7EB'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#378ADD'}}>+{ptsSuivi} {t(lang,'pts_abrev')}</div>
                    <div style={{fontSize:10,color:'#0C447C'}}>{lang==='ar'?'منذ المتابعة':lang==='en'?'Since tracking':'Depuis le suivi'}</div>
                  </div>
                  <div style={{background:'#085041',borderRadius:8,padding:'8px',textAlign:'center'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>{ptsTotal} {t(lang,'pts_abrev')}</div>
                    <div style={{fontSize:10,color:'#9FE1CB'}}>{t(lang,'score_total')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-row" style={{marginBottom:'1rem'}}>
        {[
          ['progression', lang==='ar'?'التقدم':lang==='en'?'Progress':(lang==='ar'?'التقدم':(lang==='ar'?'التقدم':'Progression'))],
          ['historique', t(lang,'historique')],
          ['muraja', lang==='ar'?'المراجعة':'Murajaʼa'],
        ].map(([k,l])=>(
          <div key={k} className={`tab ${onglet===k?'active':''}`} onClick={()=>{setOnglet(k);setSelectedSourate(null);}}>{l}</div>
        ))}
      </div>

      {loading ? <div className="loading">...</div> : (
        <>
          {/* PROGRESSION */}
          {onglet === 'progression' && (
            <>
              {selectedSourate ? (
                // Détail d'une sourate
                <div>
                  <button className="back-link" onClick={()=>setSelectedSourate(null)}>{t(lang,'retour')}</button>
                  <div style={{textAlign:'center',padding:'1.25rem',background:'linear-gradient(135deg,#085041,#1D9E75)',borderRadius:16,marginBottom:'1.25rem',color:'#fff'}}>
                    <div style={{fontSize:26,fontWeight:800,fontFamily:"'Amiri','Traditional Arabic',serif",direction:'rtl'}}>{selectedSourate.nom_ar}</div>
                    <div style={{fontSize:12,opacity:0.7,marginTop:4}}>Sourate {selectedSourate.numero}</div>
                    <div style={{fontSize:13,marginTop:6}}>
                      {isComplete(selectedSourate.numero)
                        ? '✓ '+(lang==='ar'?'مكتملة':lang==='en'?'Complete':(lang==='ar'?'مكتملة':'Complète'))
                        : `${getSequences(selectedSourate.numero).length} ${lang==='ar'?'مقطع':lang==='en'?'seq.':'séq.'}`}
                    </div>
                  </div>

                  {/* Sequences detail */}
                  <div className="section-label">{lang==='ar'?'المقاطع المسجلة':lang==='en'?'Recorded sequences':'Séquences enregistrées'}</div>
                  {getRecsSourate(selectedSourate.numero).length === 0
                    ? <div className="empty">{lang==='ar'?'لا يوجد استظهار بعد':lang==='en'?'No recitation yet':'Aucune récitation encore'}</div>
                    : (
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {getRecsSourate(selectedSourate.numero).map((r,idx)=>(
                          <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#fff',border:`0.5px solid ${r.type_recitation==='complete'?'#EF9F27':'#e0e0d8'}`,borderRadius:12}}>
                            <span style={{fontSize:20}}>{r.type_recitation==='complete'?'🎉':'📍'}</span>
                            <div style={{flex:1}}>
                              {r.type_recitation==='complete'
                                ? <span className="badge badge-green">{lang==='ar'?'سورة كاملة':lang==='en'?'Full surah':'Sourate complète'}</span>
                                : <div>
                                    <span className="badge badge-blue">
                                      {lang==='ar'?'مقطع':lang==='en'?'Seq.':'Séq.'} {idx+1} — {lang==='ar'?'من الآية':lang==='en'?'V.':'V.'}{r.verset_debut} {lang==='ar'?'إلى':'→'} {lang==='ar'?'الآية':'V.'}{r.verset_fin}
                                    </span>
                                    <div style={{fontSize:11,color:'#bbb',marginTop:2}}>
                                      {lang==='ar'?`${r.verset_fin - r.verset_debut + 1} آية`:`${r.verset_fin - r.verset_debut + 1} ${lang==='en'?'verses':'versets'}`}
                                    </div>
                                  </div>}
                              <div style={{fontSize:11,color:'#bbb',marginTop:2}}>
                                {formatDate(r.date_validation)}{r.valideur?` · ${r.valideur.prenom} ${r.valideur.nom}`:''}
                              </div>
                            </div>
                            <span style={{fontSize:13,fontWeight:700,color:r.type_recitation==='complete'?'#EF9F27':'#1D9E75'}}>+{r.points} {t(lang,'pts_abrev')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  <button className="btn-primary" style={{marginTop:'1rem'}} onClick={()=>navigate('enregistrer',eleve)}>
                    {lang==='ar'?'+ استظهار جديد':lang==='en'?'+ New recitation':'+ Nouvelle récitation'}
                  </button>
                </div>
              ) : (
                // Liste de toutes les sourates
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {souratesOrdonnees.map((s,idx) => {
                    const recs = getRecsSourate(s.numero);
                    const comp = isComplete(s.numero);
                    const seqs = getSequences(s.numero);
                    const pts = recs.reduce((acc,r)=>acc+(r.points||0),0);
                    // Acquis = FIRST N (indices 0 to N-1), list is 114→78 descending
                    const isAcquis = idx < souratesAcquises;
                    return (
                      <div key={s.numero} onClick={()=>!isAcquis&&setSelectedSourate(s)}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                          background:isAcquis?'#f5f5f0':comp?'#FAEEDA':'#fff',
                          border:`0.5px solid ${isAcquis?'#e0e0d8':comp?'#EF9F27':seqs.length>0?'#9FE1CB':'#e0e0d8'}`,
                          borderRadius:12,cursor:isAcquis?'default':'pointer',opacity:isAcquis?0.7:1}}>
                        {/* Status icon */}
                        <div style={{width:36,height:36,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                          background:isAcquis?'#e0e0d8':comp?'#EF9F27':seqs.length>0?'#E1F5EE':'#f0f0ec',
                          fontSize:isAcquis||comp?16:12,fontWeight:700,
                          color:isAcquis?'#bbb':comp?'#fff':seqs.length>0?'#1D9E75':'#999'}}>
                          {isAcquis?'✓':comp?'✓':seqs.length>0?seqs.length:s.numero}
                        </div>
                        {/* Sourate name */}
                        <div style={{flex:1}}>
                          <div style={{fontSize:16,fontWeight:600,fontFamily:"'Amiri','Traditional Arabic',serif",direction:'rtl',textAlign:'right',
                            color:isAcquis?'#bbb':comp?'#412402':'#1a1a1a'}}>
                            {s.nom_ar}
                          </div>
                          <div style={{fontSize:11,color:'#888',marginTop:1}}>
                            {isAcquis
                              ? (lang==='ar'?'مكتسب سابق':lang==='en'?'Prior achievement':'Acquis antérieur')
                              : comp
                              ? `✓ ${lang==='ar'?'مكتملة':lang==='en'?'Complete':(lang==='ar'?'مكتملة':'Complète')} · ${seqs.length} ${lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'}`
                              : seqs.length > 0
                              ? `${seqs.length} ${lang==='ar'?'مقطع':lang==='en'?'seq.':'séq.'} — ${lang==='ar'?'جارية':lang==='en'?'in progress':'en cours'}`
                              : lang==='ar'?'لم تبدأ بعد':lang==='en'?'Not started':'Pas encore commencée'}
                          </div>
                          {/* Sequences mini-preview */}
                          {seqs.length > 0 && !comp && (
                            <div style={{display:'flex',gap:3,marginTop:4,flexWrap:'wrap'}}>
                              {seqs.map((sq,i)=>(
                                <span key={i} style={{fontSize:10,background:'#E1F5EE',color:'#085041',padding:'1px 6px',borderRadius:10}}>
                                  V.{sq.verset_debut}→{sq.verset_fin}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {pts > 0 && <div style={{fontSize:12,fontWeight:700,color:comp?'#EF9F27':'#1D9E75'}}>+{pts} {t(lang,'pts_abrev')}</div>}
                        {!isAcquis && <div style={{color:'#bbb',fontSize:16}}>›</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* HISTORIQUE */}
          {onglet === 'historique' && (
            recitations.length === 0
              ? <div className="empty">{t(lang,'aucune_recitation_label')}</div>
              : (
                <div className="table-wrap">
                  <table><thead><tr>
                    <th style={{width:'18%'}}>{t(lang,'date_heure')}</th>
                    <th style={{width:'28%'}}>{lang==='ar'?'السورة':lang==='en'?'Surah':'Sourate'}</th>
                    <th style={{width:'30%'}}>{lang==='ar'?'التفاصيل':lang==='en'?'Details':'Détails'}</th>
                    <th style={{width:'12%'}}>{t(lang,'pts_abrev')}</th>
                    <th style={{width:'12%'}}>{t(lang,'valide_par')}</th>
                  </tr></thead>
                  <tbody>
                    {recitations.map(r => {
                      const sourate = souratesDB.find(s => s.id === r.sourate_id);
                      return (
                        <tr key={r.id}>
                          <td style={{fontSize:12,color:'#888'}}>{formatDateCourt(r.date_validation)}</td>
                          <td style={{fontSize:14,fontFamily:"'Amiri','Traditional Arabic',serif",direction:'rtl',textAlign:'right'}}>{sourate?.nom_ar||'—'}</td>
                          <td>
                            {r.type_recitation==='complete'
                              ?<span className="badge badge-green">{lang==='ar'?'سورة كاملة':lang==='en'?'Complete':(lang==='ar'?'مكتملة':'Complète')}</span>
                              :<span className="badge badge-blue">V.{r.verset_debut} → V.{r.verset_fin} <span style={{opacity:0.7}}>({r.verset_fin-r.verset_debut+1} {lang==='ar'?'آية':lang==='en'?'v.':'v.'})</span></span>}
                          </td>
                          <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{r.points} {t(lang,'pts_abrev')}</span></td>
                          <td style={{fontSize:12,color:'#888'}}>{r.valideur?`${r.valideur.prenom} ${r.valideur.nom}`:'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody></table>
                </div>
              )
          )}
          {onglet==='muraja'&&(
            <div>
              <div style={{fontSize:12,color:'#888',marginBottom:12,padding:'8px 12px',background:'#FFF3CD',borderRadius:8}}>
                ℹ️ {lang==='ar'?'هذه المراجعات لا تؤثر على التقدم الفردي':"Ces murajaʼa ne modifient pas la progression individuelle"}
              </div>
              {(murajaaS.length+murajaa.length)===0?(
                <div className="empty">{lang==='ar'?'لا توجد مراجعات جماعية':"Aucune murajaʼa collective"}</div>
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
                      <tr key={r.id}>
                        <td style={{fontSize:12,color:'#888'}}>{new Date(r.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</td>
                        <td><span className="badge" style={{background:'#FFF3CD',color:'#856404',fontSize:10}}>{r.type_recitation==='complete'?(lang==='ar'?'سورة كاملة':'Sourate complète'):(lang==='ar'?'تسلسل':'Séquence')}</span></td>
                        <td style={{fontSize:12}}>{r.sourate?.nom_ar||'—'}</td>
                        <td><span style={{fontSize:12,fontWeight:600,color:'#EF9F27'}}>+{r.points||5}</span></td>
                        <td style={{fontSize:11,color:'#888'}}>{r.valideur?r.valideur.prenom+' '+r.valideur.nom:'—'}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* -- Modal Passage de Niveau -- */}
      {showPassageModal&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={()=>setShowPassageModal(false)}>
          <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',maxWidth:500,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:'#534AB7',marginBottom:'1rem'}}>
              🎓 {lang==='ar'?'تغيير مستوى الطالب':'Passage de niveau'}
            </div>
            <div style={{background:'#F0EEFF',borderRadius:10,padding:'12px',marginBottom:'1rem',fontSize:13}}>
              <div style={{fontWeight:600,color:'#534AB7',marginBottom:8}}>
                {lang==='ar'?'الاكتسابات الحالية:':'Acquis actuels (seront archivés) :'}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                <div style={{color:'#555'}}>{lang==='ar'?'المستوى الحالي:':'Niveau actuel :'} <strong>{eleve.code_niveau}</strong></div>
                <div style={{color:'#555'}}>{lang==='ar'?'السور المكتسبة:':'Sourates acquises :'} <strong>{eleve.sourates_acquises||0}</strong></div>
              </div>
            </div>
            <div style={{background:'#FCEBEB',borderRadius:10,padding:'10px 12px',marginBottom:'1rem',fontSize:12,color:'#E24B4A'}}>
              ⚠️ {lang==='ar'?'سيتم إعادة تعيين الاكتسابات إلى الصفر. هذا الإجراء لا يمكن التراجع عنه.':'Les acquis seront remis à zéro. Action irréversible.'}
            </div>
            <div style={{marginBottom:'1rem'}}>
              <label style={{fontSize:13,fontWeight:600,color:'#444',display:'block',marginBottom:6}}>{lang==='ar'?'المستوى الجديد:':'Nouveau niveau :'}</label>
              <select style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #ddd',fontSize:13}} value={nouveauNiveau} onChange={e=>setNouveauNiveau(e.target.value)}>
                <option value="">{lang==='ar'?'-- اختر المستوى --':'-- Choisir le niveau --'}</option>
                {niveauxDisponibles.map(n=>(
                  <option key={n} value={n}>{NIVEAUX_LABELS[n]||n}</option>
                ))}
              </select>
            </div>
            <div style={{marginBottom:'1.2rem'}}>
              <label style={{fontSize:13,fontWeight:600,color:'#444',display:'block',marginBottom:6}}>{lang==='ar'?'ملاحظة (اختياري):':'Note (optionnelle) :'}</label>
              <input style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #ddd',fontSize:13,boxSizing:'border-box'}} value={notePassage} onChange={e=>setNotePassage(e.target.value)}
                placeholder={lang==='ar'?'سبب الانتقال...':'Raison du passage...'}/>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowPassageModal(false)} className="back-link">
                {lang==='ar'?'إلغاء':'Annuler'}
              </button>
              <button onClick={handlePassageNiveau} disabled={!nouveauNiveau||savingPassage}
                style={{flex:1,padding:'10px',background:nouveauNiveau&&!savingPassage?'#534AB7':'#ccc',color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:nouveauNiveau?'pointer':'default'}}>
                {savingPassage?'...':(lang==='ar'?'تأكيد الانتقال':'Confirmer le passage')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}