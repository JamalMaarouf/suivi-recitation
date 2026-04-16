import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales, formatDate , loadBareme, BAREME_DEFAUT } from '../lib/helpers';
import { t } from '../lib/i18n';

const MOIS_FR=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MOIS_AR=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MOIS_EN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const getMois=(i,lang)=>lang==='ar'?MOIS_AR[i]:lang==='en'?MOIS_EN[i]:MOIS_FR[i];

export default function Calendrier({ user, navigate, goBack, lang='fr', isMobile }) {
  const [validations, setValidations] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bareme, setBareme] = React.useState({...BAREME_DEFAUT});
  const [mois, setMois] = useState(new Date().getMonth());
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    loadBareme(supabase, user.ecole_id).then(b=>setBareme({...BAREME_DEFAUT,...b.unites}));
    setLoading(true);
    const { data: vd } = await supabase.from('validations').select('*, valideur:valide_par(prenom,nom)')
        .eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false});
    const { data: ed } = await supabase.from('eleves').select('*')
        .eq('ecole_id', user.ecole_id);
    setValidations(vd||[]); setEleves(ed||[]); setLoading(false);
  };

  const joursNoms = lang==='ar'?['إث','ثل','أر','خم','جم','سب','أح']:lang==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const premierJour = new Date(annee, mois, 1);
  const dernierJour = new Date(annee, mois+1, 0);
  const jourSemaine = (premierJour.getDay()+6)%7;
  const debutCal = new Date(premierJour); debutCal.setDate(debutCal.getDate()-jourSemaine);
  const jours = []; const cur = new Date(debutCal);
  while (cur<=dernierJour || jours.length%7!==0) { jours.push(new Date(cur)); cur.setDate(cur.getDate()+1); if(jours.length>42)break; }

  const valParJour = {};
  validations.forEach(v => {
    const key = new Date(v.date_validation).toDateString();
    if(!valParJour[key]) valParJour[key]=[];
    valParJour[key].push(v);
  });

  const vMois = validations.filter(v=>{const d=new Date(v.date_validation);return d.getMonth()===mois&&d.getFullYear()===annee;});
  const tomonMois = vMois.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
  const hizbMois = vMois.filter(v=>v.type_validation==='hizb_complet').length;
  const joursActifsMois = new Set(vMois.map(v=>new Date(v.date_validation).toDateString())).size;
  const today = new Date().toDateString();
  const valsSelected = selectedDay ? (valParJour[selectedDay.toDateString()]||[]) : [];

  const prevMois=()=>{setSelectedDay(null);if(mois===0){setMois(11);setAnnee(a=>a-1);}else setMois(m=>m-1);};
  const nextMois=()=>{setSelectedDay(null);if(mois===11){setMois(0);setAnnee(a=>a+1);}else setMois(m=>m+1);};

  return (
    <div style={{paddingBottom:80,background:isMobile?'#f5f5f0':'transparent',minHeight:isMobile?'100vh':'auto'}}>
      {isMobile && (
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 16px',position:'sticky',top:0,zIndex:100,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:18,cursor:'pointer',minWidth:38}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#fff'}}>📅 {lang==='ar'?'التقويم':'Calendrier'}</div>
          </div>
        </div>
      )}
      {!isMobile && <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">{t(lang,'retour')}</button>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginBottom:'1.25rem'}}>
        {[{val:tomonMois,lbl:t(lang,'tomon_recites'),color:'#1D9E75',bg:'#E1F5EE'},{val:hizbMois,lbl:t(lang,'hizb_complets_label'),color:'#378ADD',bg:'#E6F1FB'},{val:joursActifsMois,lbl:t(lang,'jours_actifs'),color:'#EF9F27',bg:'#FAEEDA'}].map((k,i)=>(
          <div key={i} style={{background:k.bg,borderRadius:10,padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:24,fontWeight:700,color:k.color}}>{k.val}</div>
            <div style={{fontSize:11,color:k.color,opacity:0.8}}>{k.lbl}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
        <button onClick={prevMois} style={{padding:'6px 14px',border:'0.5px solid #e0e0d8',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:16}}>‹</button>
        <div style={{fontSize:16,fontWeight:600}}>{getMois(mois,lang)} {annee}</div>
        <button onClick={nextMois} style={{padding:'6px 14px',border:'0.5px solid #e0e0d8',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:16}}>›</button>
      </div>

      {loading ? <div className="loading">...</div> : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:4,marginBottom:6}}>
            {joursNoms.map(j=><div key={j} style={{textAlign:'center',fontSize:11,fontWeight:500,color:'#888',padding:'4px 0'}}>{j}</div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:4,marginBottom:'1.5rem'}}>
            {jours.map((jour,idx)=>{
              const key=jour.toDateString();
              const vals=valParJour[key]||[];
              const estMoisActuel=jour.getMonth()===mois;
              const estAujourdhui=key===today;
              const estSelectionne=selectedDay&&key===selectedDay.toDateString();
              const nbT=vals.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
              const nbH=vals.filter(v=>v.type_validation==='hizb_complet').length;
              return(
                <div key={idx} onClick={()=>vals.length>0&&setSelectedDay(jour)}
                  style={{aspectRatio:'1',borderRadius:8,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:vals.length>0?'pointer':'default',border:estSelectionne?'2px solid #1D9E75':estAujourdhui?'2px solid #9FE1CB':'0.5px solid #e0e0d8',background:estSelectionne?'#E1F5EE':vals.length>0?'#f0faf6':'#fff',opacity:estMoisActuel?1:0.3,padding:4}}>
                  <div style={{fontSize:13,fontWeight:estAujourdhui?700:400,color:estAujourdhui?'#1D9E75':'#1a1a1a'}}>{jour.getDate()}</div>
                  {vals.length>0&&<div style={{display:'flex',gap:2,marginTop:2}}>
                    {nbT>0&&<div style={{width:6,height:6,borderRadius:'50%',background:'#1D9E75'}}/>}
                    {nbH>0&&<div style={{width:6,height:6,borderRadius:'50%',background:'#EF9F27'}}/>}
                  </div>}
                  {vals.length>1&&<div style={{fontSize:9,color:'#1D9E75',fontWeight:600}}>{vals.length}</div>}
                </div>
              );
            })}
          </div>

          <div style={{display:'flex',gap:16,fontSize:11,color:'#888',marginBottom:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#1D9E75'}}/>{t(lang,'tomon_abrev')}</div>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#EF9F27'}}/>Hizb</div>
          </div>

          {selectedDay&&valsSelected.length>0&&(
            <>
              <div className="section-label">
                {selectedDay.toLocaleDateString(lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-FR',{weekday:'long',day:'numeric',month:'long'})} — {valsSelected.length}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {valsSelected.map(v=>{
                  const eleve=eleves.find(e=>e.id===v.eleve_id);
                  return(
                    <div key={v.id} onClick={()=>eleve&&navigate('fiche',eleve)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,cursor:eleve?'pointer':'default'}}>
                      {eleve?<div style={{width:36,height:36,borderRadius:'50%',background:'#E1F5EE',color:'#085041',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:13,flexShrink:0}}>{getInitiales(eleve.prenom,eleve.nom)}</div>:<div style={{width:36,height:36,borderRadius:'50%',background:'#f0f0ec'}}/>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500}}>{eleve?`${eleve.prenom} ${eleve.nom}`:'—'}</div>
                        <div style={{fontSize:12,color:'#888'}}>
                          {v.type_validation==='hizb_complet'?`Hizb ${v.hizb_valide} ${t(lang,'hizb_complets_label')}`:
                           `${v.nombre_tomon} ${t(lang,'tomon_abrev')}${v.tomon_debut?` (T.${v.tomon_debut}→T.${v.tomon_debut+v.nombre_tomon-1})`:''} · Hizb ${v.hizb_validation||'—'}`}
                        </div>
                        <div style={{fontSize:11,color:'#bbb'}}>{new Date(v.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}{v.valideur?` · ${v.valideur.prenom} ${v.valideur.nom}`:''}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        {v.type_validation==='hizb_complet'?<span className="badge badge-green" style={{fontSize:10}}>Hizb</span>:<span className="badge badge-blue" style={{fontSize:10}}>{v.nombre_tomon}{t(lang,'tomon_abrev')}</span>}
                        <div style={{fontSize:11,fontWeight:600,color:'#1D9E75',marginTop:2}}>+{v.type_validation==='hizb_complet'?(bareme.hizb_complet||100):v.nombre_tomon*(bareme.tomon||10)} {t(lang,'pts_abrev')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
