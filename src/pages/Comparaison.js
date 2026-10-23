import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, formatDateCourt, niveauTraduit, getSensForEleve, loadBareme, BAREME_DEFAUT, ptsValidation, calcPointsPeriode} from '../lib/helpers';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';
import MobileSkeletonList from '../components/MobileSkeletonList';
import { MobileHeader } from '../components/ui';
import { GitCompare } from 'lucide-react';

const PALETTE = ['#1D9E75','#378ADD','#EF9F27','#E24B4A','#534AB7','#D85A30'];

export default function Comparaison({ navigate, goBack, lang='fr', isMobile, user }) {
  const [allEleves, setAllEleves] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // FIX (oct 2026) : bareme complet (ensembles/jalons) pour calcPointsPeriode
  const [bareme, setBareme] = useState({ unites:{...BAREME_DEFAUT}, examens:{}, ensembles:{}, jalons:{} });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
    // FIX (oct 2026) : eleves suspendus exclus ; recitations de sourates, certificats (date_emission)
    // et points_eleves charges pour que les eleves en sourates ne soient plus a 0.
    const [{data:ed}, vd, {data:nv}, {data:ec}, br, rs, {data:cert}, pe] = await Promise.all([
      supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id).is('suspendu_at', null).order('nom'),
      fetchAll(supabase.from('validations').select('*').eq('ecole_id', user.ecole_id).order('date_validation')),
      supabase.from('niveaux').select('id,code,nom,sens_recitation').eq('ecole_id', user.ecole_id),
      supabase.from('ecoles').select('sens_recitation_defaut').eq('id', user.ecole_id).maybeSingle(),
      loadBareme(supabase, user.ecole_id),
      fetchAll(supabase.from('recitations_sourates').select('id,eleve_id,type_recitation,is_muraja,points,date_validation').eq('ecole_id', user.ecole_id)),
      supabase.from('certificats_eleves').select('id,eleve_id,jalon_id,date_emission,created_at').eq('ecole_id', user.ecole_id),
      fetchAll(supabase.from('points_eleves').select('id,eleve_id,type_event,points,date_event').eq('ecole_id', user.ecole_id)),
    ]);
    const baremeComplet = (br && br.unites) ? br : { unites:{...BAREME_DEFAUT}, examens:{}, ensembles:{}, jalons:{} };
    setBareme(baremeComplet);
    const maintenant = new Date();
    setAllEleves((ed||[]).map(e => {
      const vals=(vd||[]).filter(v=>v.eleve_id===e.id);
      const sensE = getSensForEleve(e, nv, ec);
      // BUG-FIX POINTS (oct 2026) : passer `bareme` (deja plat .unites) en 7eme
      // position pour avoir les vrais points dans etat.points.
      // calcPoints accepte barème plat ou avec .unites (voir helpers.js L533).
      const etatBrut=calcEtatEleve(vals,e.hizb_depart,e.tomon_depart, sensE, e, null, baremeComplet);
      // FIX (oct 2026) : score = calcPointsPeriode sur tout l'historique (validations, sourates
      // y compris muraja via r.points, certificats, examens), meme regle que la courbe ci-dessous.
      const recs=(rs||[]).filter(r=>r.eleve_id===e.id);
      const certs=(cert||[]).filter(c=>c.eleve_id===e.id).map(c=>({...c, date_obtention:c.date_emission}));
      const evts=(pe||[]).filter(p=>p.eleve_id===e.id);
      const total=calcPointsPeriode(vals, new Date('2000-01-01'), maintenant, baremeComplet, evts, recs, certs).total;
      const etat={...etatBrut, points:{...etatBrut.points, total}};
      return {...e,etat,validations:vals,recitations:recs,certificats:certs,pointsEvenements:evts};
    }));
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const toggle = (e) => {
    if (selected.find(s=>s.id===e.id)) setSelected(selected.filter(s=>s.id!==e.id));
    else if (selected.length<6) setSelected([...selected,e]);
  };

  const calcEvolution = (eleve) => {
    // FIX (oct 2026) : courbe = memes elements que le score (calcPointsPeriode) :
    // validations (ptsValidation), recitations de sourates (r.points, muraja comprise),
    // certificats (jalons) et examens (points_eleves). Le dernier point = score affiche.
    const jalons = (bareme && bareme.jalons) || {};
    const items=[
      ...(eleve.validations||[]).map(v=>({date:v.date_validation, v})),
      ...(eleve.recitations||[]).map(r=>({date:r.date_validation, p:Number(r.points)||0})),
      ...(eleve.certificats||[]).map(c=>({date:c.date_obtention||c.created_at, p:jalons[c.jalon_id]||0})),
      ...(eleve.pointsEvenements||[]).filter(x=>x.type_event==='examen').map(x=>({date:x.date_event, p:Number(x.points)||0})),
    ].filter(x=>x.date).sort((a,b)=>new Date(a.date)-new Date(b.date));
    let hc=new Set(); let score=0;
    const pts=[{score:0}];
    items.forEach(it=>{
      const v = it.v;
      if (v && v.type_validation==='hizb_complet') {
        if (hc.has(v.hizb_valide)) return; // deja compte
        hc.add(v.hizb_valide);
      }
      score += v ? ptsValidation(v, bareme) : it.p;
      pts.push({date:it.date,score,label:formatDateCourt(it.date)});
    });
    return pts;
  };

  const evolutions = (selected||[]).map(e=>({eleve:e,points:calcEvolution(e)}));
  const maxScore = Math.max(...evolutions.flatMap(ev=>ev.points.map(p=>p.score)),1);
  const filtered = allEleves.filter(e=>`${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{paddingBottom:isMobile?80:0, background:isMobile?'#f5f5f0':'transparent', minHeight:isMobile?'100vh':'auto'}}>
      {isMobile ? (
        <>
        <MobileHeader
          title={lang==='ar'?'مقارنة الطلاب':'Comparer'}
          subtitle={lang==='ar'?'اختر حتى 6 طلاب':"Sélectionnez jusqu'à 6 élèves"}
          icon={GitCompare}
          onBack={()=>goBack?goBack():navigate('dashboard')}
          lang={lang}
        />
        <div style={{height:12}}/>
        </>
      ) : (
        <div>
          <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
          <div style={{fontSize:20,fontWeight:600,marginBottom:'1.5rem'}}>{t(lang,'comparer_eleves')}</div>
        </div>
      )}
      <div style={{padding:isMobile?'0 12px':'0'}}>
      {loading?<MobileSkeletonList type="card-with-tabs" count={4} />:(
        <>
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'1rem',marginBottom:'1.25rem'}}>
            <div style={{fontSize:12,color:'#888',marginBottom:8}}>{t(lang,'selectionner_comparer')} :</div>
            <input className="field-input" style={{marginBottom:10}} placeholder={t(lang,'rechercher_eleve')} value={search} onChange={e=>setSearch(e.target.value)}/>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {(filtered||[]).map((e,idx)=>{
                const selIdx=selected.findIndex(s=>s.id===e.id);
                const isSelected=selIdx>=0;
                const color=isSelected?PALETTE[selIdx]:'#888';
                return(
                  <div key={e.id} onClick={()=>toggle(e)} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,cursor:'pointer',border:`1.5px solid ${isSelected?color:'#e0e0d8'}`,background:isSelected?color+'15':'#f9f9f6'}}>
                    {isSelected&&<div style={{width:8,height:8,borderRadius:'50%',background:color}}/>}
                    <span style={{fontSize:12,fontWeight:isSelected?500:400,color:isSelected?color:'#666'}}>{e.prenom} {e.nom}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {selected.length===0?(
            <div className="empty">{t(lang,'rechercher_commencer')}</div>
          ):(
            <>
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:'1rem'}}>
                {selected.map((e,idx)=>(
                  <div key={e.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',background:'#fff',border:`1.5px solid ${PALETTE[idx]}`,borderRadius:20}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:PALETTE[idx]}}/>
                    <span style={{fontSize:12,fontWeight:500,color:PALETTE[idx]}}>{e.prenom} {e.nom}</span>
                    <span style={{fontSize:11,color:'#888'}}>· {e.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>{t(lang,'evolution_score')}</div>
                <div style={{position:'relative',height:240,overflow:'hidden'}}>
                  {[0,25,50,75,100].map(pct=>(
                    <div key={pct} style={{position:'absolute',left:0,right:0,top:`${100-pct}%`,borderTop:'0.5px solid #e8e8e0'}}>
                      <span style={{fontSize:9,color:'#bbb',marginLeft:2}}>{Math.round(maxScore*pct/100)}</span>
                    </div>
                  ))}
                  <svg style={{position:'absolute',left:30,top:0,width:'calc(100% - 30px)',height:'90%'}}>
                    {(evolutions||[]).map((ev,idx)=>{
                      if(ev.points.length<2) return null;
                      const color=PALETTE[idx];
                      const w=100/(ev.points.length-1);
                      const pts=ev.points.map((p,i)=>`${i*w}%,${90-(p.score/maxScore)*85}%`).join(' ');
                      return(
                        <g key={ev.eleve.id}>
                          <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" opacity="0.9"/>
                          {ev.points.map((p,i)=><circle key={i} cx={`${i*w}%`} cy={`${90-(p.score/maxScore)*85}%`} r="3" fill={color}/>)}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div className="section-label">{t(lang,'tableau_comparatif')}</div>
              <div className="table-wrap">
                <table><thead><tr>
                  <th style={{width:'24%'}}>{t(lang,'eleve')}</th>
                  <th style={{width:'14%'}}>{t(lang,'score_total')}</th>
                  <th style={{width:'14%'}}>Hizb</th>
                  <th style={{width:'12%'}}>{t(lang,'tomon_abrev')}</th>
                  <th style={{width:'12%'}}>{t(lang,'hizb_abrev')}</th>
                  <th style={{width:'24%'}}>{lang==='ar'?'تقدم الحزب':'Progression'}</th>
                </tr></thead>
                <tbody>
                  {selected.map((e,idx)=>(
                    <tr key={e.id} className="clickable" onClick={()=>navigate('fiche',e)}>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:10,height:10,borderRadius:'50%',background:PALETTE[idx],flexShrink:0}}/><span style={{fontSize:13}}>{e.prenom} {e.nom}</span></div></td>
                      <td><span style={{fontSize:14,fontWeight:700,color:PALETTE[idx]}}>{e.etat.points.total.toLocaleString()}</span></td>
                      <td style={{fontSize:12}}>Hizb {e.etat.hizbEnCours}</td>
                      <td><span className="badge badge-blue" style={{fontSize:10}}>{e.etat.tomonTotal||e.etat.tomonCumul}</span></td>
                      <td><span className="badge badge-green" style={{fontSize:10}}>{e.etat.hizbsComplets.size}</span></td>
                      <td><div style={{display:'flex',gap:2}}>{[1,2,3,4,5,6,7,8].map(n=><div key={n} style={{flex:1,height:8,borderRadius:2,background:n<=e.etat.tomonDansHizbActuel?PALETTE[idx]:'#e8e8e0'}}/>)}</div></td>
                    </tr>
                  ))}
                </tbody></table>
              </div>

              <div className="section-label">{t(lang,'classement_entre_eux')}</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[...selected].sort((a,b)=>b.etat.points.total-a.etat.points.total).map((e,idx)=>{
                  const origIdx=selected.findIndex(s=>s.id===e.id);
                  const color=PALETTE[origIdx];
                  const maxPts=Math.max(...selected.map(s=>s.etat.points.total));
                  const pct=maxPts>0?(e.etat.points.total/maxPts)*100:0;
                  return(
                    <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#fff',border:`0.5px solid ${color}30`,borderRadius:10}}>
                      <div style={{fontSize:14,fontWeight:700,color,minWidth:20}}>{idx+1}</div>
                      <div style={{width:32,height:32,borderRadius:'50%',background:color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:12,color}}>{getInitiales(e.prenom,e.nom)}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500}}>{e.prenom} {e.nom}</div>
                        <div style={{height:5,background:'#e8e8e0',borderRadius:3,marginTop:4,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3}}/>
                        </div>
                      </div>
                      <div style={{fontSize:16,fontWeight:700,color}}>{e.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}
