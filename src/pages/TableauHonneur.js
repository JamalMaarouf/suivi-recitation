import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, calcPointsPeriode, loadBareme, BAREME_DEFAUT } from '../lib/helpers';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';

export default function TableauHonneur({ user, navigate, goBack, lang='fr', isMobile }) {
  const [eleves, setEleves] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('global');
  const [periodeId, setPeriodeId] = useState('semaine');
  const [niveauxDyn, setNiveauxDyn] = useState([]);
  const [bareme, setBareme] = useState({...BAREME_DEFAUT});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    loadBareme(supabase, user.ecole_id).then(b => setBareme(b));
    const [{ data: ed }, { data: vd }, { data: pd }, { data: nv }, { data: pe }] = await Promise.all([
      supabase.from('eleves').select('id,prenom,nom,code_niveau,niveau,hizb_depart,tomon_depart,ecole_id').eq('ecole_id', user.ecole_id).order('nom'),
      fetchAll(supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,date_validation').eq('ecole_id', user.ecole_id)).then(data=>({data})),
      supabase.from('periodes_notes').select('*').eq('ecole_id', user.ecole_id).eq('actif', true).order('date_debut'),
      supabase.from('niveaux').select('id,code,nom,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
      supabase.from('points_eleves').select('*').eq('ecole_id', user.ecole_id).order('created_at', {ascending:false}),
    ]);
    const elevesData = (ed||[]).map(e => {
      const vals = (vd||[]).filter(v => v.eleve_id === e.id);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
      const evts = (pe||[]).filter(p=>p.eleve_id===e.id);
      return { ...e, etat, validations: vals, pointsEvenements: evts };
    });
    setEleves(elevesData);
    setAllValidations(vd||[]);
    setPeriodes(pd||[]);
    setNiveauxDyn(nv||[]);
    setLoading(false);
  };

  // Calcul des points selon période sélectionnée
  const getPointsPeriode = (eleve) => {
    const now = new Date();
    if (periodeId === 'semaine') {
      const d = new Date(now); d.setDate(now.getDate() - 7);
      return calcPointsPeriode(eleve.validations, d, now, bareme, eleve.pointsEvenements);
    }
    if (periodeId === 'mois') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return calcPointsPeriode(eleve.validations, d, now, bareme, eleve.pointsEvenements);
    }
    if (periodeId === 'trimestre') {
      const d = new Date(now); d.setMonth(now.getMonth() - 3); d.setDate(1);
      return calcPointsPeriode(eleve.validations, d, now, bareme, eleve.pointsEvenements);
    }
    const p = periodes.find(x => x.id === periodeId);
    if (p) return calcPointsPeriode(eleve.validations, p.date_debut, p.date_fin, bareme, eleve.pointsEvenements);
    return calcPointsPeriode(eleve.validations, new Date(0), now, bareme, eleve.pointsEvenements);
  };

  const PERIODES_FIXES = [
    { id: 'semaine', label: lang==='ar'?'الأسبوع':'Semaine' },
    { id: 'mois',    label: lang==='ar'?'الشهر':'Mois' },
    { id: 'trimestre', label: lang==='ar'?'الفصل (3 أشهر)':'Trimestre' },
  ];

  const elevesClasses = useMemo(() => {
    const filtered = vue === 'global' ? eleves : eleves.filter(e => e.code_niveau === vue);
    return [...filtered]
      .map(e => ({ ...e, ptsPeriode: getPointsPeriode(e) }))
      .sort((a, b) => b.ptsPeriode.total - a.ptsPeriode.total)
      .filter(e => e.ptsPeriode.total > 0 || periodeId === 'global');
  }, [eleves, vue, periodeId, periodes]);

  const medals = ['🥇','🥈','🥉'];
  const podiumColors = ['#EF9F27','#B0B0B0','#CD7F32'];
  const podiumBg = ['#FAEEDA','#f5f5f0','#f9f3ec'];

  const niveauxVues = niveauxDyn.length > 0
    ? niveauxDyn.map(n => ({ code: n.code, label: n.nom, color: n.couleur || '#888' }))
    : [
        {code:'5B',label:'5B',color:'#534AB7'},{code:'5A',label:'5A',color:'#378ADD'},
        {code:'2M',label:'2M',color:'#1D9E75'},{code:'2',label:'2',color:'#EF9F27'},
        {code:'1',label:'1',color:'#E24B4A'},
      ];

  const periodeLabel = () => {
    const f = PERIODES_FIXES.find(p => p.id === periodeId);
    if (f) return f.label;
    const p = periodes.find(x => x.id === periodeId);
    return p ? (p.nom_ar || p.nom) : '';
  };

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0a0a0f 0%,#0d1f1a 100%)',padding:'1.5rem 1rem',paddingBottom:80}}>
      {/* Sticky header */}
      <div style={{position:'sticky',top:0,zIndex:100,background:'rgba(10,10,15,0.95)',padding:'48px 16px 14px',backdropFilter:'blur(8px)',borderBottom:'0.5px solid rgba(255,255,255,0.05)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')}
            style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:10,padding:'8px 12px',color:'#9FE1CB',fontSize:18,cursor:'pointer',minWidth:38}}>←</button>
          <div style={{flex:1,textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,color:'#fff'}}>🏆 {t(lang,'tableau_honneur')}</div>
            <div style={{fontSize:11,color:'#5DCAA5',marginTop:2}}>{periodeLabel()}</div>
          </div>
        </div>
      </div>

      {/* Sélecteur période */}
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:11,color:'#5DCAA5',marginBottom:6,textAlign:'center',fontWeight:600}}>
          {lang==='ar'?'الفترة':'Période'}
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
          {PERIODES_FIXES.map(p => (
            <div key={p.id} onClick={()=>setPeriodeId(p.id)}
              style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:periodeId===p.id?700:400,
                background:periodeId===p.id?'#378ADD':'rgba(255,255,255,0.08)',
                color:periodeId===p.id?'#fff':'#9FE1CB',
                border:'1px solid '+(periodeId===p.id?'#378ADD':'rgba(255,255,255,0.15)')}}>
              {p.label}
            </div>
          ))}
          {periodes.map(p => (
            <div key={p.id} onClick={()=>setPeriodeId(p.id)}
              style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:periodeId===p.id?700:400,
                background:periodeId===p.id?'#534AB7':'rgba(255,255,255,0.08)',
                color:periodeId===p.id?'#fff':'#9FE1CB',
                border:'1px solid '+(periodeId===p.id?'#534AB7':'rgba(255,255,255,0.15)'),
                direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>
              {p.nom_ar||p.nom}
            </div>
          ))}
        </div>
      </div>

      {/* Sélecteur niveau */}
      <div style={{display:'flex',gap:6,marginBottom:'1.5rem',flexWrap:'wrap',justifyContent:'center'}}>
        <div onClick={()=>setVue('global')}
          style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:vue==='global'?700:400,
            background:vue==='global'?'#1D9E75':'rgba(255,255,255,0.08)',
            color:vue==='global'?'#fff':'#5DCAA5',
            border:'1px solid '+(vue==='global'?'#1D9E75':'rgba(255,255,255,0.15)')}}>
          🌍 {lang==='ar'?'الكل':'Global'}
        </div>
        {niveauxVues.map(n => (
          <div key={n.code} onClick={()=>setVue(n.code)}
            style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:vue===n.code?700:400,
              background:vue===n.code?n.color:'rgba(255,255,255,0.08)',
              color:vue===n.code?'#fff':'#9FE1CB',
              border:'1px solid '+(vue===n.code?n.color:'rgba(255,255,255,0.15)')}}>
            {n.label}
          </div>
        ))}
      </div>

      {loading ? <div style={{color:'#5DCAA5',textAlign:'center',padding:'3rem'}}>...</div> : (
        <>
          {elevesClasses.length === 0 ? (
            <div style={{textAlign:'center',color:'#3a6657',padding:'3rem',fontSize:14}}>
              {lang==='ar'?'لا توجد استظهارات في هذه الفترة':'Aucune récitation sur cette période'}
            </div>
          ) : (
            <>
              {/* Podium */}
              {elevesClasses.length >= 3 && (
                <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:12,marginBottom:'2.5rem'}}>
                  {[1,0,2].map(rank => {
                    const e = elevesClasses[rank];
                    if (!e) return null;
                    return (
                      <div key={e.id} onClick={()=>navigate('fiche',e)} style={{flex:1,maxWidth:160,display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer'}}>
                        {rank===0 && <div style={{fontSize:24,marginBottom:4}}>👑</div>}
                        <div style={{width:rank===0?60:48,height:rank===0?60:48,borderRadius:'50%',background:podiumBg[rank],display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:rank===0?22:18,color:podiumColors[rank]}}>{getInitiales(e.prenom,e.nom)}</div>
                        <div style={{fontSize:rank===0?13:12,fontWeight:600,color:'#fff',marginTop:8,textAlign:'center'}}>{e.prenom} {e.nom}</div>
                        <div style={{fontSize:rank===0?18:15,fontWeight:800,color:podiumColors[rank],margin:'4px 0'}}>{e.ptsPeriode.total.toLocaleString()} {t(lang,'pts_abrev')}</div>
                        <div style={{fontSize:10,color:podiumColors[rank],opacity:0.7}}>{e.ptsPeriode.tomonPeriode} {t(lang,'tomon_abrev')} · {e.ptsPeriode.hizbsPeriode} {t(lang,'hizb_abrev')}</div>
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
                {elevesClasses.map((e,idx) => {
                  const sl = scoreLabel(e.ptsPeriode.total);
                  return (
                    <div key={e.id} onClick={()=>navigate('fiche',e)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:12,marginBottom:8,cursor:'pointer'}}>
                      <div style={{fontSize:18,minWidth:32,textAlign:'center'}}>
                        {medals[idx] || <span style={{color:'#3a6657',fontSize:13,fontWeight:700}}>{idx+1}</span>}
                      </div>
                      <div style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'#9FE1CB',flexShrink:0}}>{getInitiales(e.prenom,e.nom)}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:600,color:'#fff'}}>{e.prenom} {e.nom}</div>
                        <div style={{fontSize:11,color:'#5DCAA5',marginTop:2}}>
                          {e.ptsPeriode.tomonPeriode} {t(lang,'tomon_abrev')}
                          {e.ptsPeriode.hizbsPeriode > 0 && ` · ${e.ptsPeriode.hizbsPeriode} ${t(lang,'hizb_abrev')} ✓`}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:16,fontWeight:800,color:'#EF9F27'}}>{e.ptsPeriode.total.toLocaleString()}</div>
                        <div style={{fontSize:10,color:'#3a6657'}}>{t(lang,'pts_abrev')}</div>
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
