import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, joursDepuis, isInactif, scoreLabel, formatDateCourt } from '../lib/helpers';
import { t } from '../lib/i18n';

function Avatar({ prenom, nom, size=36, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

export default function Seance({ user, navigate, lang='fr' }) {
  const [eleves, setEleves] = useState([]);
  const [validationsAujourdhui, setValidationsAujourdhui] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('seance');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: ed } = await supabase.from('eleves').select('*').order('nom');
    const { data: instData } = await supabase.from('utilisateurs').select('*').eq('role','instituteur');
    const { data: vd } = await supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').order('date_validation',{ascending:false});
    const debutJour = new Date(); debutJour.setHours(0,0,0,0);
    const debutSemaine = new Date(); debutSemaine.setDate(debutSemaine.getDate()-7);
    const vAujourdhui = (vd||[]).filter(v => new Date(v.date_validation) >= debutJour);
    const elevesData = (ed||[]).map(e => {
      const vals = (vd||[]).filter(v => v.eleve_id === e.id);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
      const derniere = vals[0]?.date_validation || null;
      const valsAujourdhui = vAujourdhui.filter(v => v.eleve_id === e.id);
      const valsSemaine = (vd||[]).filter(v => v.eleve_id === e.id && new Date(v.date_validation) >= debutSemaine);
      const tomonAujourdhui = valsAujourdhui.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
      const hizbAujourdhui = valsAujourdhui.filter(v=>v.type_validation==='hizb_complet').length;
      const tomonSemaine = valsSemaine.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
      const derniereValidationAujourdhui = valsAujourdhui[0]?.date_validation || null;
      const inst = (instData||[]).find(i => i.id === e.instituteur_referent_id);
      return { ...e, etat, derniere, jours:joursDepuis(derniere), inactif:isInactif(derniere), tomonAujourdhui, hizbAujourdhui, tomonSemaine, derniereValidationAujourdhui, valsAujourdhui, instituteurNom: inst?`${inst.prenom} ${inst.nom}`:'—' };
    });
    setEleves(elevesData);
    setValidationsAujourdhui(vAujourdhui);
    setAllValidations(vd||[]);
    setLoading(false);
  };

  const elevesVusAujourdhui = eleves
    .filter(e => e.tomonAujourdhui > 0 || e.hizbAujourdhui > 0)
    .sort((a,b) => {
      const sa = a.tomonAujourdhui*10 + a.hizbAujourdhui*100;
      const sb = b.tomonAujourdhui*10 + b.hizbAujourdhui*100;
      if (sb !== sa) return sb - sa;
      return new Date(b.derniereValidationAujourdhui||0) - new Date(a.derniereValidationAujourdhui||0);
    });

  const elevesNonVus = eleves.filter(e => e.tomonAujourdhui===0 && e.hizbAujourdhui===0).sort((a,b)=>(b.jours||999)-(a.jours||999));
  const tomonTotal = validationsAujourdhui.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
  const hizbTotal = validationsAujourdhui.filter(v=>v.type_validation==='hizb_complet').length;
  const ptsTotal = tomonTotal*10 + Math.floor(tomonTotal/2)*25 + Math.floor(tomonTotal/4)*60 + hizbTotal*100;

  const debutSemaine = new Date(); debutSemaine.setDate(debutSemaine.getDate()-6); debutSemaine.setHours(0,0,0,0);
  const elevesSemaine = eleves.filter(e=>e.tomonSemaine>0).sort((a,b)=>b.tomonSemaine-a.tomonSemaine);
  const joursActifs = {};
  allValidations.filter(v=>new Date(v.date_validation)>=debutSemaine).forEach(v => {
    const key = new Date(v.date_validation).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});
    if(!joursActifs[key]) joursActifs[key]={tomon:0,hizb:0};
    if(v.type_validation==='tomon') joursActifs[key].tomon+=v.nombre_tomon;
    else joursActifs[key].hizb++;
  });

  const medals = ['🥇','🥈','🥉'];

  return (
    <div>
      <button className="back-link" onClick={()=>navigate('dashboard')}>{t(lang,'retour')}</button>
      <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3,marginBottom:'1.25rem',width:'fit-content'}}>
        {[['seance',t(lang,'ma_seance')],['semaine',t(lang,'cette_semaine')]].map(([k,l])=>(
          <div key={k} onClick={()=>setVue(k)} style={{padding:'7px 16px',borderRadius:8,fontSize:12,fontWeight:vue===k?600:400,cursor:'pointer',background:vue===k?'#fff':'transparent',color:vue===k?'#1a1a1a':'#888',border:vue===k?'0.5px solid #e0e0d8':'none',whiteSpace:'nowrap'}}>{l}</div>
        ))}
      </div>

      {loading ? <div className="loading">...</div> : (
        <>
          {vue==='seance' && (
            <>
              <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>{new Date().toLocaleDateString(lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:'1.5rem'}}>
                {[
                  {val:elevesVusAujourdhui.length,lbl:t(lang,'eleves_vus'),color:'#1D9E75',bg:'#E1F5EE'},
                  {val:tomonTotal,lbl:t(lang,'tomon_valides_label'),color:'#378ADD',bg:'#E6F1FB'},
                  {val:hizbTotal,lbl:t(lang,'hizb_complets_label'),color:'#EF9F27',bg:'#FAEEDA'},
                  {val:ptsTotal.toLocaleString(),lbl:t(lang,'pts_generes'),color:'#534AB7',bg:'#EEEDFE'},
                ].map((k,i)=>(
                  <div key={i} style={{background:k.bg,borderRadius:12,padding:'12px',textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:800,color:k.color}}>{k.val}</div>
                    <div style={{fontSize:11,color:k.color,opacity:0.8,marginTop:2}}>{k.lbl}</div>
                  </div>
                ))}
              </div>

              {elevesVusAujourdhui.length > 0 && (
                <>
                  <div className="section-label">{t(lang,'classement_seance')}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:'1.5rem'}}>
                    {elevesVusAujourdhui.map((e,idx)=>{
                      const sl=scoreLabel(e.etat.points.total);
                      const ptsSeance=e.tomonAujourdhui*10+e.hizbAujourdhui*100;
                      const derniereHeure=e.derniereValidationAujourdhui?new Date(e.derniereValidationAujourdhui).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
                      return (
                        <div key={e.id} onClick={()=>navigate('fiche',e)}
                          style={{display:'flex',alignItems:'center',gap:12,padding:'14px',background:'#fff',border:`0.5px solid ${idx===0?'#EF9F27':'#e0e0d8'}`,borderRadius:12,cursor:'pointer'}}>
                          <div style={{fontSize:22,minWidth:30,textAlign:'center'}}>{medals[idx]||`${idx+1}`}</div>
                          <Avatar prenom={e.prenom} nom={e.nom} size={40} bg={sl.bg} color={sl.color}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,fontWeight:600}}>{e.prenom} {e.nom}</div>
                            <div style={{fontSize:12,color:'#888',marginTop:2}}>
                              {e.tomonAujourdhui>0&&`${e.tomonAujourdhui} ${t(lang,'tomon_abrev')}`}
                              {e.tomonAujourdhui>0&&e.hizbAujourdhui>0&&' + '}
                              {e.hizbAujourdhui>0&&`${e.hizbAujourdhui} Hizb`}
                              {' — '}Hizb {e.etat.hizbEnCours}
                            </div>
                            <div style={{fontSize:11,color:'#bbb'}}>
                              {t(lang,'derniere_recitation')}: {derniereHeure}
                              {e.valsAujourdhui[0]?.valideur?` · ${e.valsAujourdhui[0].valideur.prenom} ${e.valsAujourdhui[0].valideur.nom}`:''}
                            </div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:18,fontWeight:800,color:'#1D9E75'}}>+{ptsSeance}</div>
                            <div style={{fontSize:10,color:'#888'}}>{t(lang,'pts_abrev')}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {validationsAujourdhui.length>0&&(
                <>
                  <div className="section-label">{t(lang,'detail_validations')}</div>
                  <div className="table-wrap" style={{marginBottom:'1.5rem'}}>
                    <table><thead><tr>
                      <th style={{width:'15%'}}>{lang==='ar'?'الوقت':'Heure'}</th>
                      <th style={{width:'25%'}}>{t(lang,'eleve')}</th>
                      <th style={{width:'32%'}}>{lang==='ar'?'التسميع':'Validation'}</th>
                      <th style={{width:'18%'}}>{t(lang,'valide_par')}</th>
                      <th style={{width:'10%'}}>{t(lang,'pts_abrev')}</th>
                    </tr></thead>
                    <tbody>
                      {validationsAujourdhui.map(v=>{
                        const eleve=eleves.find(e=>e.id===v.eleve_id);
                        return(
                          <tr key={v.id} className={eleve?'clickable':''} onClick={()=>eleve&&navigate('fiche',eleve)}>
                            <td style={{fontSize:12,color:'#888'}}>{new Date(v.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                            <td style={{fontSize:13}}>{eleve?`${eleve.prenom} ${eleve.nom}`:'—'}</td>
                            <td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb {v.hizb_valide} {t(lang,'hizb_complets_label')}</span>:<span className="badge badge-blue">{v.nombre_tomon} {t(lang,'tomon_abrev')}{v.tomon_debut?` (T.${v.tomon_debut}→T.${v.tomon_debut+v.nombre_tomon-1})`:''}</span>}</td>
                            <td style={{fontSize:12,color:'#888'}}>{v.valideur?`${v.valideur.prenom} ${v.valideur.nom}`:'—'}</td>
                            <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{v.type_validation==='hizb_complet'?100:v.nombre_tomon*10}</span></td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                </>
              )}

              <div className="section-label">{t(lang,'a_voir_aujourd_hui')} ({elevesNonVus.length})</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {elevesNonVus.slice(0,8).map(e=>{
                  const urgence=e.jours!=null&&e.jours>14;
                  return(
                    <div key={e.id} onClick={()=>navigate('enregistrer',e)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:urgence?'#fff8f8':'#fff',border:`0.5px solid ${urgence?'#E24B4A30':'#e0e0d8'}`,borderRadius:10,cursor:'pointer'}}>
                      <Avatar prenom={e.prenom} nom={e.nom} size={34} bg={urgence?'#FCEBEB':'#E1F5EE'} color={urgence?'#A32D2D':'#085041'}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500,color:urgence?'#A32D2D':'#1a1a1a'}}>{e.prenom} {e.nom}</div>
                        <div style={{fontSize:11,color:'#888'}}>
                          {['5B','5A'].includes(e.code_niveau)
                            ? <span style={{padding:'1px 6px',borderRadius:10,fontSize:10,fontWeight:700,background:'#534AB7',color:'#fff'}}>{e.code_niveau}</span>
                            : `Hizb ${e.etat.hizbEnCours} · T.${e.etat.prochainTomon||1} ${t(lang,'prochain')}${e.etat.enAttenteHizbComplet?' · ⏳ Hizb':''}`}
                        </div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                        <span style={{fontSize:12,fontWeight:600,color:urgence?'#A32D2D':'#888'}}>{e.jours!=null?`${e.jours}${t(lang,'jour')}`:t(lang,'jamais')}</span>
                        <div style={{display:'flex',gap:2}}>{[1,2,3,4,5,6,7,8].map(n=><div key={n} style={{width:5,height:5,borderRadius:1,background:n<=e.etat.tomonDansHizbActuel?'#1D9E75':'#e8e8e0'}}/>)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {vue==='semaine' && (
            <>
              <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
                {new Date(debutSemaine).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} → {new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}
              </div>
              <div className="section-label">{t(lang,'activite_par_jour')}</div>
              <div style={{display:'flex',gap:6,marginBottom:'1.5rem',flexWrap:'wrap'}}>
                {Object.entries(joursActifs).reverse().map(([jour,data])=>(
                  <div key={jour} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10,padding:'10px 14px',minWidth:80,textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#888',marginBottom:4}}>{jour}</div>
                    {data.tomon>0&&<div style={{fontSize:13,fontWeight:600,color:'#378ADD'}}>{data.tomon} {t(lang,'tomon_abrev')}</div>}
                    {data.hizb>0&&<div style={{fontSize:11,color:'#EF9F27'}}>{data.hizb} Hizb</div>}
                  </div>
                ))}
                {Object.keys(joursActifs).length===0&&<div className="empty">{t(lang,'aucune_activite')}</div>}
              </div>
              <div className="section-label">{t(lang,'classement_semaine')}</div>
              {elevesSemaine.length===0?<div className="empty">{t(lang,'aucune_activite')}</div>:(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {elevesSemaine.map((e,idx)=>{
                    const sl=scoreLabel(e.etat.points.total);
                    return(
                      <div key={e.id} onClick={()=>navigate('fiche',e)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,cursor:'pointer'}}>
                        <div style={{fontSize:20,minWidth:28,textAlign:'center'}}>{medals[idx]||`${idx+1}`}</div>
                        <Avatar prenom={e.prenom} nom={e.nom} size={36} bg={sl.bg} color={sl.color}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600}}>{e.prenom} {e.nom}</div>
                          <div style={{height:5,background:'#e8e8e0',borderRadius:3,marginTop:6,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${(e.tomonSemaine/elevesSemaine[0].tomonSemaine)*100}%`,background:'#1D9E75',borderRadius:3}}/>
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:16,fontWeight:700,color:'#1D9E75'}}>{e.tomonSemaine}</div>
                          <div style={{fontSize:10,color:'#888'}}>{t(lang,'tomon_abrev')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
