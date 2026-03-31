import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, joursDepuis, isInactif, scoreLabel } from '../lib/helpers';
import { t } from '../lib/i18n';
import { getSouratesForNiveau } from '../lib/sourates';

const IS_SOURATE = (code) => ['5B','5A','2M'].includes(code||'');
const NIVEAU_COLORS = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };

function Avatar({ prenom, nom, size=36, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

function NiveauBadge({ code }) {
  const c = NIVEAU_COLORS[code||'1']||'#888';
  return <span style={{padding:'1px 7px',borderRadius:10,fontSize:10,fontWeight:700,background:c+'18',color:c,border:`0.5px solid ${c}30`}}>{code}</span>;
}

export default function Seance({ user, navigate, goBack, lang='fr' }) {
  const [eleves, setEleves] = useState([]);
  const [validationsAujourdhui, setValidationsAujourdhui] = useState([]);
  const [recitationsAujourdhui, setRecitationsAujourdhui] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [allRecitations, setAllRecitations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('seance');
  const [filterNiveau, setFilterNiveau] = useState('tous');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const debutJour = new Date(); debutJour.setHours(0,0,0,0);
    const debutSemaine = new Date(); debutSemaine.setDate(debutSemaine.getDate()-7);

    const [{ data: ed }, { data: instData }, { data: vd }, rdResult, { data: sdb }] = await Promise.all([
      supabase.from('eleves').select('*').order('nom'),
      supabase.from('utilisateurs').select('*').eq('role','instituteur'),
      supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').order('date_validation',{ascending:false}),
      supabase.from('recitations_sourates').select('*, valideur:valide_par(prenom,nom)').order('date_validation',{ascending:false}),
      supabase.from('sourates').select('*'),
    ]);

    const rd = rdResult.data || [];
    const vAujourdhui = (vd||[]).filter(v => new Date(v.date_validation) >= debutJour);
    const rAujourdhui = rd.filter(r => new Date(r.date_validation) >= debutJour);

    const elevesData = (ed||[]).map(e => {
      const isSourate = IS_SOURATE(e.code_niveau);
      const inst = (instData||[]).find(i => i.id === e.instituteur_referent_id);

      if (isSourate) {
        const recs = rd.filter(r => r.eleve_id === e.id);
        const recsAujourdhui = rAujourdhui.filter(r => r.eleve_id === e.id);
        const recsSemaine = rd.filter(r => r.eleve_id === e.id && new Date(r.date_validation) >= debutSemaine);
        const souratesCompletesAujourdhui = recsAujourdhui.filter(r=>r.type_recitation==='complete').length;
        const sequencesAujourdhui = recsAujourdhui.filter(r=>r.type_recitation==='sequence').length;
        const ptsAujourdhui = recsAujourdhui.reduce((s,r)=>s+(r.points||0),0);
        const souratesSemaine = recsSemaine.filter(r=>r.type_recitation==='complete').length;
        const dernierRec = recsAujourdhui[0]?.date_validation || recs[0]?.date_validation || null;

        // Find current sourate
        const souratesNiveau = getSouratesForNiveau(e.code_niveau);
        const souratesOrdonnees = [...souratesNiveau].sort((a,b)=>b.numero-a.numero);
        const souratesAcq = parseInt(e.sourates_acquises)||0;
        const souratesCompletes = new Set(recs.filter(r=>r.type_recitation==='complete').map(r=>r.sourate_id));
        const currentIdx = souratesOrdonnees.findIndex((s,i) => {
          if (i < souratesAcq) return false;
          const dbS = (sdb||[]).find(x=>x.numero===s.numero);
          return dbS ? !souratesCompletes.has(dbS.id) : false;
        });
        const currentSourate = currentIdx >= 0 ? souratesOrdonnees[currentIdx] : null;

        return {
          ...e, isSourate:true,
          recsAujourdhui, souratesCompletesAujourdhui, sequencesAujourdhui, ptsAujourdhui,
          souratesSemaine, actifAujourdhui: recsAujourdhui.length > 0,
          derniere: dernierRec, jours: joursDepuis(dernierRec), inactif: isInactif(dernierRec),
          currentSourate, instituteurNom: inst?`${inst.prenom} ${inst.nom}`:'—',
          etat: calcEtatEleve([], e.hizb_depart||1, e.tomon_depart||1),
        };
      } else {
        const vals = (vd||[]).filter(v => v.eleve_id === e.id);
        const etat = calcEtatEleve(vals, e.hizb_depart||1, e.tomon_depart||1);
        const valsAujourdhui = vAujourdhui.filter(v => v.eleve_id === e.id);
        const valsSemaine = (vd||[]).filter(v => v.eleve_id === e.id && new Date(v.date_validation) >= debutSemaine);
        const tomonAujourdhui = valsAujourdhui.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
        const hizbAujourdhui = valsAujourdhui.filter(v=>v.type_validation==='hizb_complet').length;
        const ptsAujourdhui = tomonAujourdhui*10+Math.floor(tomonAujourdhui/2)*25+Math.floor(tomonAujourdhui/4)*60+hizbAujourdhui*100;
        const tomonSemaine = valsSemaine.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
        const derniere = vals[0]?.date_validation || null;
        return {
          ...e, isSourate:false, etat,
          valsAujourdhui, tomonAujourdhui, hizbAujourdhui, ptsAujourdhui,
          tomonSemaine, actifAujourdhui: valsAujourdhui.length > 0,
          derniere, jours: joursDepuis(derniere), inactif: isInactif(derniere),
          instituteurNom: inst?`${inst.prenom} ${inst.nom}`:'—',
        };
      }
    });

    setEleves(elevesData);
    setValidationsAujourdhui(vAujourdhui);
    setRecitationsAujourdhui(rAujourdhui);
    setAllValidations(vd||[]);
    setAllRecitations(rd);
    setSouratesDB(sdb||[]);
    setLoading(false);
  };

  const filteredEleves = filterNiveau==='tous' ? eleves : eleves.filter(e=>(e.code_niveau||'1')===filterNiveau);
  const elevesVus = filteredEleves.filter(e=>e.actifAujourdhui).sort((a,b)=>b.ptsAujourdhui-a.ptsAujourdhui);
  const elevesNonVus = filteredEleves.filter(e=>!e.actifAujourdhui).sort((a,b)=>(b.jours||999)-(a.jours||999));

  const tomonTotal = validationsAujourdhui.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
  const hizbTotal = validationsAujourdhui.filter(v=>v.type_validation==='hizb_complet').length;
  const souratesTotal = recitationsAujourdhui.filter(r=>r.type_recitation==='complete').length;
  const sequencesTotal = recitationsAujourdhui.filter(r=>r.type_recitation==='sequence').length;
  const ptsTotal = elevesVus.reduce((s,e)=>s+e.ptsAujourdhui,0);

  const debutSemaine = new Date(); debutSemaine.setDate(debutSemaine.getDate()-6); debutSemaine.setHours(0,0,0,0);
  const joursActifs = {};
  [...allValidations, ...allRecitations].forEach(item => {
    const d = new Date(item.date_validation);
    if (d < debutSemaine) return;
    const key = d.toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{weekday:'short',day:'numeric'});
    if (!joursActifs[key]) joursActifs[key]={tomon:0,hizb:0,sourate:0,seq:0};
    if (item.type_validation==='tomon') joursActifs[key].tomon+=item.nombre_tomon;
    else if (item.type_validation==='hizb_complet') joursActifs[key].hizb++;
    else if (item.type_recitation==='complete') joursActifs[key].sourate++;
    else if (item.type_recitation==='sequence') joursActifs[key].seq++;
  });

  const medals = ['🥇','🥈','🥉'];
  const niveaux = ['tous','5B','5A','2M','2','1'];

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>{t(lang,'retour')}</button>
        <button onClick={()=>navigate('historique_seances')}
          style={{padding:'6px 14px',background:'#085041',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
          📊 {lang==='ar'?'تحليل الحصص':lang==='en'?'Session analysis':'Analyse des séances'}
        </button>
      </div>
      <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3,marginBottom:'1.25rem',width:'fit-content'}}>
        {[['seance',t(lang,'ma_seance')],['semaine',t(lang,'cette_semaine')]].map(([k,l])=>(
          <div key={k} onClick={()=>setVue(k)} style={{padding:'7px 16px',borderRadius:8,fontSize:12,fontWeight:vue===k?600:400,cursor:'pointer',background:vue===k?'#fff':'transparent',color:vue===k?'#1a1a1a':'#888',border:vue===k?'0.5px solid #e0e0d8':'none',whiteSpace:'nowrap'}}>{l}</div>
        ))}
      </div>

      {loading ? <div className="loading">...</div> : (
        <>
          {vue==='seance' && (
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:8}}>
                <div style={{fontSize:13,color:'#888'}}>{new Date().toLocaleDateString(lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {niveaux.map(n=>(
                    <div key={n} onClick={()=>setFilterNiveau(n)}
                      style={{padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:filterNiveau===n?700:400,cursor:'pointer',
                        background:filterNiveau===n?(n==='tous'?'#1D9E75':NIVEAU_COLORS[n]||'#1D9E75'):'#f0f0ec',
                        color:filterNiveau===n?'#fff':'#666',transition:'all 0.15s'}}>
                      {n==='tous'?(lang==='ar'?'الكل':lang==='en'?'All':'Tous'):n}
                    </div>
                  ))}
                </div>
              </div>

              {/* KPI */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8,marginBottom:'1.25rem'}}>
                {[
                  {val:elevesVus.length,lbl:t(lang,'eleves_vus'),color:'#1D9E75',bg:'#E1F5EE'},
                  {val:ptsTotal.toLocaleString(),lbl:t(lang,'pts_generes'),color:'#534AB7',bg:'#EEEDFE'},
                  {val:tomonTotal,lbl:t(lang,'tomon_abrev'),color:'#378ADD',bg:'#E6F1FB'},
                  {val:hizbTotal,lbl:'Hizb',color:'#EF9F27',bg:'#FAEEDA'},
                  {val:souratesTotal,lbl:lang==='ar'?'سور كاملة':lang==='en'?'Surahs':'Sourates',color:'#085041',bg:'#E1F5EE'},
                  {val:sequencesTotal,lbl:lang==='ar'?'مقاطع':lang==='en'?'Sequences':'Séquences',color:'#888',bg:'#f5f5f0'},
                ].map((k,i)=>(
                  <div key={i} style={{background:k.bg,borderRadius:10,padding:'10px 6px',textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:800,color:k.color}}>{k.val}</div>
                    <div style={{fontSize:10,color:k.color,opacity:0.8,marginTop:1}}>{k.lbl}</div>
                  </div>
                ))}
              </div>

              {/* Classement du jour */}
              {elevesVus.length>0&&(
                <>
                  <div className="section-label">{t(lang,'classement_seance')} ({elevesVus.length})</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:'1.5rem'}}>
                    {elevesVus.map((e,idx)=>{
                      const nc=NIVEAU_COLORS[e.code_niveau||'1']||'#888';
                      const heure=e.isSourate
                        ?(e.recsAujourdhui[0]?.date_validation?new Date(e.recsAujourdhui[0].date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'')
                        :(e.valsAujourdhui?.[0]?.date_validation?new Date(e.valsAujourdhui[0].date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'');
                      return(
                        <div key={e.id} onClick={()=>navigate('fiche',e)}
                          style={{display:'flex',alignItems:'center',gap:12,padding:'14px',background:'#fff',border:`0.5px solid ${idx===0?'#EF9F27':'#e0e0d8'}`,borderRadius:12,cursor:'pointer'}}>
                          <div style={{fontSize:22,minWidth:30,textAlign:'center'}}>{medals[idx]||`${idx+1}`}</div>
                          <Avatar prenom={e.prenom} nom={e.nom} size={40} bg={nc+'18'} color={nc}/>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                              <span style={{fontSize:14,fontWeight:600}}>{e.prenom} {e.nom}</span>
                              <NiveauBadge code={e.code_niveau}/>
                            </div>
                            <div style={{fontSize:12,color:'#888'}}>
                              {e.isSourate?(
                                <>
                                  {e.souratesCompletesAujourdhui>0&&<span style={{color:'#EF9F27',fontWeight:600}}>{e.souratesCompletesAujourdhui} {lang==='ar'?'سور':lang==='en'?'surahs':'sourates'} ✓</span>}
                                  {e.souratesCompletesAujourdhui>0&&e.sequencesAujourdhui>0&&' · '}
                                  {e.sequencesAujourdhui>0&&<span>{e.sequencesAujourdhui} {lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'}</span>}
                                  {e.currentSourate&&<span style={{marginRight:6,marginLeft:6,fontFamily:"'Tajawal',Arial",direction:'rtl',fontSize:12,color:'#085041'}}> · {e.currentSourate.nom_ar}</span>}
                                </>
                              ):(
                                <>
                                  {e.tomonAujourdhui>0&&`${e.tomonAujourdhui} ${t(lang,'tomon_abrev')}`}
                                  {e.tomonAujourdhui>0&&e.hizbAujourdhui>0&&' + '}
                                  {e.hizbAujourdhui>0&&`${e.hizbAujourdhui} Hizb`}
                                  {` — Hizb ${e.etat.hizbEnCours}`}
                                </>
                              )}
                            </div>
                            <div style={{fontSize:11,color:'#bbb'}}>{t(lang,'derniere_recitation')}: {heure}</div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:18,fontWeight:800,color:'#1D9E75'}}>+{e.ptsAujourdhui}</div>
                            <div style={{fontSize:10,color:'#888'}}>{t(lang,'pts_abrev')}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Détail Tomon/Hizb */}
              {validationsAujourdhui.filter(v=>{const el=eleves.find(e=>e.id===v.eleve_id);return el&&!el.isSourate&&(filterNiveau==='tous'||el.code_niveau===filterNiveau);}).length>0&&(
                <>
                  <div className="section-label">{lang==='ar'?'تفاصيل الحزب/الثُّمن':lang==='en'?'Hizb/Tomon details':'Détails Tomon/Hizb'}</div>
                  <div className="table-wrap" style={{marginBottom:'1.25rem'}}>
                    <table><thead><tr>
                      <th style={{width:'12%'}}>{lang==='ar'?'الوقت':'Heure'}</th>
                      <th style={{width:'24%'}}>{t(lang,'eleve')}</th>
                      <th style={{width:'10%'}}>Niv.</th>
                      <th style={{width:'32%'}}>{lang==='ar'?'التسميع':'Validation'}</th>
                      <th style={{width:'12%'}}>{t(lang,'valide_par')}</th>
                      <th style={{width:'10%'}}>{t(lang,'pts_abrev')}</th>
                    </tr></thead>
                    <tbody>
                      {validationsAujourdhui.filter(v=>{const el=eleves.find(e=>e.id===v.eleve_id);return el&&!el.isSourate&&(filterNiveau==='tous'||el.code_niveau===filterNiveau);}).map(v=>{
                        const eleve=eleves.find(e=>e.id===v.eleve_id);
                        return(
                          <tr key={v.id} className={eleve?'clickable':''} onClick={()=>eleve&&navigate('fiche',eleve)}>
                            <td style={{fontSize:12,color:'#888'}}>{new Date(v.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                            <td style={{fontSize:13}}>{eleve?`${eleve.prenom} ${eleve.nom}`:'—'}</td>
                            <td><NiveauBadge code={eleve?.code_niveau}/></td>
                            <td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb {v.hizb_valide}</span>:<span className="badge badge-blue">{v.nombre_tomon} {t(lang,'tomon_abrev')}{v.tomon_debut?` (T.${v.tomon_debut}→T.${v.tomon_debut+v.nombre_tomon-1})`:''}</span>}</td>
                            <td style={{fontSize:12,color:'#888'}}>{v.valideur?`${v.valideur.prenom} ${v.valideur.nom}`:'—'}</td>
                            <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{v.type_validation==='hizb_complet'?100:v.nombre_tomon*10}</span></td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                </>
              )}

              {/* Détail Sourates */}
              {recitationsAujourdhui.filter(r=>{const el=eleves.find(e=>e.id===r.eleve_id);return el&&el.isSourate&&(filterNiveau==='tous'||el.code_niveau===filterNiveau);}).length>0&&(
                <>
                  <div className="section-label">{lang==='ar'?'تفاصيل السور':lang==='en'?'Surah details':'Détails Sourates'}</div>
                  <div className="table-wrap" style={{marginBottom:'1.25rem'}}>
                    <table><thead><tr>
                      <th style={{width:'12%'}}>{lang==='ar'?'الوقت':'Heure'}</th>
                      <th style={{width:'22%'}}>{t(lang,'eleve')}</th>
                      <th style={{width:'10%'}}>Niv.</th>
                      <th style={{width:'26%'}}>{lang==='ar'?'السورة':'Sourate'}</th>
                      <th style={{width:'20%'}}>{lang==='ar'?'التفاصيل':'Détails'}</th>
                      <th style={{width:'10%'}}>{t(lang,'pts_abrev')}</th>
                    </tr></thead>
                    <tbody>
                      {recitationsAujourdhui.filter(r=>{const el=eleves.find(e=>e.id===r.eleve_id);return el&&el.isSourate&&(filterNiveau==='tous'||el.code_niveau===filterNiveau);}).map(r=>{
                        const eleve=eleves.find(e=>e.id===r.eleve_id);
                        const sourate=souratesDB.find(s=>s.id===r.sourate_id);
                        return(
                          <tr key={r.id} className={eleve?'clickable':''} onClick={()=>eleve&&navigate('fiche',eleve)}>
                            <td style={{fontSize:12,color:'#888'}}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                            <td style={{fontSize:13}}>{eleve?`${eleve.prenom} ${eleve.nom}`:'—'}</td>
                            <td><NiveauBadge code={eleve?.code_niveau}/></td>
                            <td style={{fontFamily:"'Tajawal',Arial",direction:'rtl',fontSize:14}}>{sourate?.nom_ar||'—'}</td>
                            <td>{r.type_recitation==='complete'?<span className="badge badge-green">{lang==='ar'?'كاملة':lang==='en'?'Complete':'Complète'}</span>:<span className="badge badge-blue">V.{r.verset_debut}→V.{r.verset_fin}</span>}</td>
                            <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{r.points||10}</span></td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                </>
              )}

              {/* À voir aujourd'hui */}
              <div className="section-label">{t(lang,'a_voir_aujourd_hui')} ({elevesNonVus.length})</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {elevesNonVus.slice(0,10).map(e=>{
                  const urgence=e.jours!=null&&e.jours>14;
                  const nc=NIVEAU_COLORS[e.code_niveau||'1']||'#888';
                  return(
                    <div key={e.id} onClick={()=>navigate('enregistrer',e)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:urgence?'#fff8f8':'#fff',border:`0.5px solid ${urgence?'#E24B4A30':'#e0e0d8'}`,borderRadius:10,cursor:'pointer'}}>
                      <Avatar prenom={e.prenom} nom={e.nom} size={34} bg={urgence?'#FCEBEB':nc+'15'} color={urgence?'#A32D2D':nc}/>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontSize:13,fontWeight:500,color:urgence?'#A32D2D':'#1a1a1a'}}>{e.prenom} {e.nom}</span>
                          <NiveauBadge code={e.code_niveau}/>
                        </div>
                        <div style={{fontSize:11,color:'#888',marginTop:2}}>
                          {e.isSourate
                            ?(e.currentSourate?<span style={{fontFamily:"'Tajawal',Arial",direction:'rtl'}}>{e.currentSourate.nom_ar}</span>:<span>{lang==='ar'?'لم يبدأ':lang==='en'?'Not started':'Pas commencé'}</span>)
                            :(`Hizb ${e.etat.hizbEnCours} · T.${e.etat.prochainTomon||1}${e.etat.enAttenteHizbComplet?' · ⏳':''}`)}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <span style={{fontSize:12,fontWeight:600,color:urgence?'#A32D2D':'#888'}}>{e.jours!=null?`${e.jours}${t(lang,'jour')}`:t(lang,'jamais')}</span>
                        {!e.isSourate&&<div style={{display:'flex',gap:2,marginTop:3,justifyContent:'flex-end'}}>{[1,2,3,4,5,6,7,8].map(n=><div key={n} style={{width:5,height:5,borderRadius:1,background:n<=e.etat.tomonDansHizbActuel?'#1D9E75':'#e8e8e0'}}/>)}</div>}
                      </div>
                    </div>
                  );
                })}
                {elevesNonVus.length===0&&<div className="empty">🎉 {lang==='ar'?'جميع الطلاب تمت رؤيتهم اليوم!':lang==='en'?'All students seen today!':'Tous les élèves vus aujourd\'hui !'}</div>}
              </div>
            </>
          )}

          {vue==='semaine'&&(
            <>
              <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
                {new Date(debutSemaine).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} → {new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}
              </div>
              <div className="section-label">{t(lang,'activite_par_jour')}</div>
              <div style={{display:'flex',gap:6,marginBottom:'1.5rem',flexWrap:'wrap'}}>
                {Object.entries(joursActifs).reverse().map(([jour,data])=>(
                  <div key={jour} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10,padding:'10px 14px',minWidth:85,textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#888',marginBottom:4}}>{jour}</div>
                    {data.tomon>0&&<div style={{fontSize:12,fontWeight:600,color:'#378ADD'}}>{data.tomon} {t(lang,'tomon_abrev')}</div>}
                    {data.hizb>0&&<div style={{fontSize:11,color:'#EF9F27'}}>{data.hizb} Hizb</div>}
                    {data.sourate>0&&<div style={{fontSize:12,fontWeight:600,color:'#085041'}}>{data.sourate} {lang==='ar'?'سور':lang==='en'?'sur.':'sur.'}</div>}
                    {data.seq>0&&<div style={{fontSize:11,color:'#888'}}>{data.seq} {lang==='ar'?'مق.':lang==='en'?'seq.':'séq.'}</div>}
                  </div>
                ))}
                {Object.keys(joursActifs).length===0&&<div className="empty">{t(lang,'aucune_activite')}</div>}
              </div>

              {[
                {label:lang==='ar'?'مستويات السور (5B/5A/2M)':lang==='en'?'Surah levels':'Niveaux sourates (5B/5A/2M)',
                 elevs:eleves.filter(e=>e.isSourate&&(e.souratesSemaine||0)>0).sort((a,b)=>(b.souratesSemaine||0)-(a.souratesSemaine||0)),
                 key:'sourate'},
                {label:lang==='ar'?'مستويات الحزب/الثُّمن (2/1)':lang==='en'?'Hizb/Tomon levels':'Niveaux Hizb/Tomon (2/1)',
                 elevs:eleves.filter(e=>!e.isSourate&&(e.tomonSemaine||0)>0).sort((a,b)=>(b.tomonSemaine||0)-(a.tomonSemaine||0)),
                 key:'tomon'},
              ].map(group=>group.elevs.length>0&&(
                <div key={group.key} style={{marginBottom:'1.5rem'}}>
                  <div className="section-label">{group.label}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {group.elevs.map((e,idx)=>{
                      const nc=NIVEAU_COLORS[e.code_niveau||'1']||'#888';
                      const val=group.key==='sourate'?e.souratesSemaine:e.tomonSemaine;
                      const maxVal=group.elevs[0]?(group.key==='sourate'?group.elevs[0].souratesSemaine:group.elevs[0].tomonSemaine):1;
                      return(
                        <div key={e.id} onClick={()=>navigate('fiche',e)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,cursor:'pointer'}}>
                          <div style={{fontSize:20,minWidth:28,textAlign:'center'}}>{medals[idx]||`${idx+1}`}</div>
                          <Avatar prenom={e.prenom} nom={e.nom} size={36} bg={nc+'18'} color={nc}/>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:13,fontWeight:600}}>{e.prenom} {e.nom}</span>
                              <NiveauBadge code={e.code_niveau}/>
                            </div>
                            <div style={{height:5,background:'#e8e8e0',borderRadius:3,marginTop:5,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${(val/maxVal)*100}%`,background:nc,borderRadius:3}}/>
                            </div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:16,fontWeight:700,color:nc}}>{val}</div>
                            <div style={{fontSize:10,color:'#888'}}>{group.key==='sourate'?(lang==='ar'?'سور':lang==='en'?'surahs':'sourates'):t(lang,'tomon_abrev')}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
