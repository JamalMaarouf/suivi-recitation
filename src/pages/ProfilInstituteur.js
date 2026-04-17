import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, formatDateCourt, isInactif, joursDepuis, niveauTraduit , loadBareme, BAREME_DEFAUT } from '../lib/helpers';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';

function Avatar({ prenom, nom, size=44, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

export default function ProfilInstituteur({ instituteur, user, navigate, goBack, lang='fr', isMobile }) {
  const [eleves, setEleves] = useState([]);
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bareme, setBareme] = React.useState({...BAREME_DEFAUT});

  useEffect(() => { loadData(); }, [instituteur.id]);

  const loadData = async () => {
    loadBareme(supabase, user.ecole_id).then(b=>setBareme({...BAREME_DEFAUT,...b.unites}));
    setLoading(true);
    const {data:ed}=await supabase.from('eleves').select('*')
        .eq('ecole_id', user.ecole_id).eq('instituteur_referent_id',instituteur.id);
    const vd = await fetchAll(supabase.from('validations').select('*, valideur:valide_par(prenom,nom)')
        .eq('ecole_id', user.ecole_id).eq('valide_par',instituteur.id).order('date_validation',{ascending:false}));
    const allVd = await fetchAll(supabase.from('validations').select('*')
        .eq('ecole_id', user.ecole_id));
    const elevesData=(ed||[]).map(e=>{
      const vals=(allVd||[]).filter(v=>v.eleve_id===e.id);
      const etat=calcEtatEleve(vals,e.hizb_depart,e.tomon_depart);
      const derniere=vals[0]?.date_validation||null;
      return {...e,etat,derniere,jours:joursDepuis(derniere),inactif:isInactif(derniere)};
    });
    setEleves(elevesData); setValidations(vd||[]); setLoading(false);
  };

  const totalPoints=eleves.reduce((s,e)=>s+e.etat.points.total,0);
  const totalTomon=eleves.reduce((s,e)=>s+(e.etat.tomonTotal||e.etat.tomonCumul),0);
  const totalHizb=eleves.reduce((s,e)=>s+e.etat.hizbsComplets.size,0);
  const nbInactifs=eleves.filter(e=>e.inactif).length;
  const nbAttente=eleves.filter(e=>e.etat.enAttenteHizbComplet).length;
  const meilleur=[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total)[0]||null;

  return (
    <div style={{paddingBottom:isMobile?80:0,background:isMobile?'#f5f5f0':'transparent',minHeight:isMobile?'100vh':'auto'}}>
      {isMobile ? (
        <div style={{background:'linear-gradient(135deg,#374151,#4B5563)',padding:'48px 16px 16px',position:'sticky',top:0,zIndex:100,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#fff'}}>👨‍🏫 {lang==='ar'?'ملف الأستاذ':'Profil'}</div>
          </div>
        </div>
      ) : (
        <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">←</button>
      )}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.5rem',marginBottom:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
          <Avatar prenom={instituteur.prenom} nom={instituteur.nom} size={60}/>
          <div>
            <div style={{fontSize:20,fontWeight:600}}>{instituteur.prenom} {instituteur.nom}</div>
            <div style={{fontSize:13,color:'#888'}}>{t(lang,'role_instituteur')} · {eleves.length} {t(lang,'eleves_referents')}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {[{lbl:t(lang,'score_groupe'),val:totalPoints.toLocaleString(),color:'#1D9E75',bg:'#E1F5EE'},{lbl:t(lang,'tomon_abrev'),val:totalTomon,color:'#378ADD',bg:'#E6F1FB'},{lbl:t(lang,'inactifs_filter'),val:nbInactifs,color:nbInactifs>0?'#A32D2D':'#bbb',bg:nbInactifs>0?'#FCEBEB':'#f9f9f6'},{lbl:t(lang,'attente_filter'),val:nbAttente,color:nbAttente>0?'#633806':'#bbb',bg:nbAttente>0?'#FAEEDA':'#f9f9f6'}].map(k=>(
            <div key={k.lbl} style={{background:k.bg,borderRadius:8,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:700,color:k.color}}>{k.val}</div>
              <div style={{fontSize:10,color:k.color,opacity:0.8}}>{k.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {loading?<div className="loading">...</div>:(
        <>
          {meilleur&&(
            <>
              <div className="section-label">{t(lang,'meilleur_eleve')}</div>
              <div onClick={()=>navigate('fiche',meilleur)} style={{display:'flex',alignItems:'center',gap:12,padding:'14px',background:'#FAEEDA',border:'0.5px solid #EF9F27',borderRadius:12,cursor:'pointer',marginBottom:'1rem'}}>
                <Avatar prenom={meilleur.prenom} nom={meilleur.nom} size={44} bg="#FAC775" color="#412402"/>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600,color:'#412402'}}>{meilleur.prenom} {meilleur.nom}</div>
                  <div style={{fontSize:12,color:'#854F0B'}}>Hizb {meilleur.etat.hizbEnCours} · {meilleur.etat.tomonTotal||meilleur.etat.tomonCumul} {t(lang,'tomon_abrev')} · {meilleur.etat.hizbsComplets.size} Hizb</div>
                </div>
                <div style={{fontSize:22,fontWeight:800,color:'#EF9F27'}}>{meilleur.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</div>
              </div>
            </>
          )}

          <div className="section-label">{t(lang,'eleves')} ({eleves.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:'1.5rem'}}>
            {[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).map((e,idx)=>{
              const sl=scoreLabel(e.etat.points.total);
              return(
                <div key={e.id} onClick={()=>navigate('fiche',e)} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:'#fff',border:`0.5px solid ${e.inactif?'#E24B4A30':e.etat.enAttenteHizbComplet?'#EF9F2730':'#e0e0d8'}`,borderRadius:10,cursor:'pointer'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#bbb',minWidth:20,textAlign:'center'}}>{idx+1}</div>
                  <Avatar prenom={e.prenom} nom={e.nom} size={34} bg={sl.bg} color={sl.color}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{e.prenom} {e.nom}</div>
                    <div style={{fontSize:11,color:'#888'}}>Hizb {e.etat.hizbEnCours} · {e.etat.tomonDansHizbActuel}/8 {t(lang,'tomon_abrev')}</div>
                  </div>
                  <div style={{display:'flex',gap:2,marginRight:8}}>{[1,2,3,4,5,6,7,8].map(n=><div key={n} style={{width:5,height:8,borderRadius:2,background:n<=e.etat.tomonDansHizbActuel?(e.etat.enAttenteHizbComplet?'#EF9F27':'#1D9E75'):'#e8e8e0'}}/>)}</div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:13,fontWeight:700,color:sl.color}}>{e.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</div>
                    {e.inactif&&<span style={{fontSize:10,color:'#A32D2D'}}>{e.jours}{t(lang,'jour')}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-label">{t(lang,'activite_recente')}</div>
          {validations.length===0?<div className="empty">{t(lang,'aucune_activite')}</div>:(
            <div className="table-wrap">
              <table><thead><tr>
                <th style={{width:'20%'}}>{lang==='ar'?'التاريخ':'Date'}</th>
                <th style={{width:'28%'}}>{t(lang,'eleve')}</th>
                <th style={{width:'32%'}}>{lang==='ar'?'الاستظهار':'Validation'}</th>
                <th style={{width:'20%'}}>{t(lang,'pts_abrev')}</th>
              </tr></thead>
              <tbody>
                {validations.slice(0,15).map(v=>{
                  const eleve=eleves.find(e=>e.id===v.eleve_id);
                  return(
                    <tr key={v.id} className={eleve?'clickable':''} onClick={()=>eleve&&navigate('fiche',eleve)}>
                      <td style={{fontSize:12,color:'#888'}}>{formatDateCourt(v.date_validation)}</td>
                      <td style={{fontSize:13}}>{eleve?`${eleve.prenom} ${eleve.nom}`:'—'}</td>
                      <td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb {v.hizb_valide}</span>:<span className="badge badge-blue">{v.nombre_tomon} {t(lang,'tomon_abrev')}{v.tomon_debut?` (T.${v.tomon_debut}→${v.tomon_debut+v.nombre_tomon-1})`:''}</span>}</td>
                      <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{v.type_validation==='hizb_complet'?(bareme.hizb_complet||100):v.nombre_tomon*(bareme.tomon||10)} {t(lang,'pts_abrev')}</span></td>
                    </tr>
                  );
                })}
              </tbody></table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
