import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel } from '../lib/helpers';
import { t } from '../lib/i18n';

export default function TableauHonneur({ navigate, goBack, lang='fr' }) {
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: ed } = await supabase.from('eleves').select('*')
        .eq('ecole_id', user.ecole_id);
    const { data: vd } = await supabase.from('validations').select('*')
        .eq('ecole_id', user.ecole_id);
    const data = (ed||[]).map(e => {
      const vals = (vd||[]).filter(v => v.eleve_id === e.id);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
      return { ...e, etat };
    }).sort((a,b) => b.etat.points.total - a.etat.points.total);
    setEleves(data);
    setLoading(false);
  };

  const medals = ['🥇','🥈','🥉'];
  const podiumColors = ['#EF9F27','#B0B0B0','#CD7F32'];
  const podiumBg = ['#FAEEDA','#f5f5f0','#f9f3ec'];
  const [vue, setVue] = useState('global');
  const NIVEAUX_HON = [
    {code:'5B',label:'Préscolaire (5B)',color:'#534AB7'},
    {code:'5A',label:'Primaire 1-2 (5A)',color:'#378ADD'},
    {code:'2M',label:'Primaire 3-4 (2M)',color:'#1D9E75'},
    {code:'2', label:'Primaire 5-6 (2)', color:'#EF9F27'},
    {code:'1', label:'Collège/Lycée (1)',color:'#E24B4A'},
  ];
  const elevesNiveau = vue!=='global' ? eleves.filter(e=>e.code_niveau===vue) : eleves;

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0a0a0f 0%,#0d1f1a 100%)',padding:'2rem 1rem',paddingBottom:80}}>
      <button onClick={()=>goBack?goBack():navigate('dashboard')} style={{color:'#9FE1CB',background:'none',border:'none',cursor:'pointer',fontSize:14,marginBottom:'1.5rem',display:'block'}}>{t(lang,'retour')}</button>

      <div style={{textAlign:'center',marginBottom:'2rem'}}>
        <div style={{fontSize:36,marginBottom:8}}>🏆</div>
        <div style={{fontSize:28,fontWeight:800,color:'#fff',letterSpacing:'-1px'}}>{t(lang,'tableau_honneur')}</div>
        <div style={{fontSize:13,color:'#5DCAA5',marginTop:4}}>{t(lang,'gardiens_coran')}</div>
        <div style={{fontSize:11,color:'#3a6657',marginTop:2}}>{t(lang,'classement_score')}</div>
      </div>

      {loading ? <div style={{color:'#5DCAA5',textAlign:'center'}}>...</div> : (
        <>
          {/* Vue tabs */}
          <div style={{display:'flex',gap:6,marginBottom:'1.5rem',flexWrap:'wrap',justifyContent:'center'}}>
            <div onClick={()=>setVue('global')} style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:vue==='global'?700:400,background:vue==='global'?'#1D9E75':'rgba(255,255,255,0.08)',color:vue==='global'?'#fff':'#5DCAA5',border:'1px solid '+(vue==='global'?'#1D9E75':'rgba(255,255,255,0.15)')}}>
              🌍 {lang==='ar'?'الكل':'Global'}
            </div>
            {NIVEAUX_HON.map(n=>(
              <div key={n.code} onClick={()=>setVue(n.code)} style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:vue===n.code?700:400,background:vue===n.code?n.color:'rgba(255,255,255,0.08)',color:vue===n.code?'#fff':'#9FE1CB',border:'1px solid '+(vue===n.code?n.color:'rgba(255,255,255,0.15)')}}>
                {n.code}
              </div>
            ))}
          </div>
          {/* Podium */}
          {elevesNiveau.length >= 3 && (
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:12,marginBottom:'2.5rem'}}>
              {[1,0,2].map(rank => {
                const e = elevesNiveau[rank];
                if (!e) return null;
                return (
                  <div key={e.id} onClick={()=>navigate('fiche',e)} style={{flex:1,maxWidth:160,display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer'}}>
                    {rank===0&&<div style={{fontSize:24,marginBottom:4}}>👑</div>}
                    <div style={{width:rank===0?60:48,height:rank===0?60:48,borderRadius:'50%',background:podiumBg[rank],display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:rank===0?22:18,color:podiumColors[rank]}}>{getInitiales(e.prenom,e.nom)}</div>
                    <div style={{fontSize:rank===0?13:12,fontWeight:600,color:'#fff',marginTop:8,textAlign:'center'}}>{e.prenom} {e.nom}</div>
                    <div style={{fontSize:rank===0?18:15,fontWeight:800,color:podiumColors[rank],margin:'4px 0'}}>{e.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</div>
                    <div style={{width:'100%',height:rank===0?120:90,background:podiumBg[rank]+'22',border:`1px solid ${podiumColors[rank]}40`,borderRadius:'8px 8px 0 0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:rank===0?40:30,fontWeight:800,color:podiumColors[rank],opacity:0.6}}>{rank+1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Classement complet */}
          <div style={{maxWidth:600,margin:'0 auto'}}>
            {elevesNiveau.map((e,idx) => {
              const sl = scoreLabel(e.etat.points.total);
              return (
                <div key={e.id} onClick={()=>navigate('fiche',e)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:12,marginBottom:8,cursor:'pointer',transition:'all 0.15s'}}
                  onMouseEnter={ev=>ev.currentTarget.style.background='rgba(255,255,255,0.08)'}
                  onMouseLeave={ev=>ev.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <div style={{fontSize:18,minWidth:32,textAlign:'center'}}>{medals[idx]||<span style={{color:'#3a6657',fontSize:13}}>{idx+1}</span>}</div>
                  <div style={{width:38,height:38,borderRadius:'50%',background:sl.bg+'33',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:sl.color,flexShrink:0}}>{getInitiales(e.prenom,e.nom)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#fff'}}>{e.prenom} {e.nom}</div>
                    <div style={{fontSize:11,color:'#5DCAA5'}}>Hizb {e.etat.hizbEnCours} · {e.etat.tomonTotal||e.etat.tomonCumul} {t(lang,'tomon_abrev')} · {e.etat.hizbsComplets.size} {t(lang,'hizb_abrev')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:16,fontWeight:800,color:sl.color}}>{e.etat.points.total.toLocaleString()}</div>
                    <div style={{fontSize:10,color:'#3a6657'}}>{t(lang,'pts_abrev')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
